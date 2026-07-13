import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { prisma } from "../../../db";
import type {
  AuthUser,
  OwnerLocationView,
  OwnerOnboardingState,
  OwnerPayoutMethodView,
  OwnerProfileView,
  OwnerSettingsView,
  PayoutBankDirectoryView,
  ResolvedPayoutAccount,
} from "../../../types";
import { BankDirectoryService } from "../payments/bank-directory.service";
import type {
  CreateLocationInput,
  OwnerProfileInput,
  PayoutMethodInput,
  UpdateLocationInput,
} from "./dto";
import {
  ownerLocationInclude,
  toOwnerLocationView,
  toOwnerProfileView,
  toPayoutMethodView,
} from "./mappers";
import {
  encryptAccountNumber,
  last4,
  payoutEncryptionAvailable,
} from "./payout-crypto";

@Injectable()
export class OwnerService {
  constructor(private readonly bankDirectory: BankDirectoryService) {}

  // --- Settings / onboarding snapshots -------------------------------------

  async getSettings(user: AuthUser): Promise<OwnerSettingsView> {
    const [profile, locations, payoutMethod] = await Promise.all([
      this.profileRow(user.id),
      this.listLocations(user.id),
      this.getPayoutMethod(user.id),
    ]);
    return {
      profile: toOwnerProfileView(user.name, profile),
      locations,
      payoutMethod,
    };
  }

  async getOnboardingState(user: AuthUser): Promise<OwnerOnboardingState> {
    const [profile, locations, payoutMethod, propertyCount] = await Promise.all(
      [
        this.profileRow(user.id),
        this.listLocations(user.id),
        this.getPayoutMethod(user.id),
        prisma.property.count({ where: { ownerId: user.id } }),
      ],
    );

    const hasBusinessName = Boolean(profile?.businessName);
    const hasPhone = Boolean(profile?.phone);
    const hasLocation = locations.length > 0;
    const completedAt = profile?.onboardingCompletedAt ?? null;
    const hasPayoutOrSkipped = Boolean(payoutMethod) || Boolean(completedAt);
    const payoutSkipped = Boolean(completedAt) && !payoutMethod;

    return {
      profile: toOwnerProfileView(user.name, profile),
      locations,
      payoutMethod,
      payoutSkipped,
      readiness: {
        hasBusinessName,
        hasPhone,
        hasLocation,
        hasPayoutOrSkipped,
        complete:
          hasBusinessName && hasPhone && hasLocation && hasPayoutOrSkipped,
      },
      propertyCount,
    };
  }

  // --- Owner/business profile ----------------------------------------------

  async updateProfile(
    user: AuthUser,
    input: OwnerProfileInput,
  ): Promise<OwnerProfileView> {
    const profile = await prisma.ownerProfile.upsert({
      where: { userId: user.id },
      update: {
        ...(input.businessName !== undefined
          ? { businessName: input.businessName }
          : {}),
        ...(input.phone !== undefined ? { phone: input.phone } : {}),
      },
      create: {
        userId: user.id,
        businessName: input.businessName ?? null,
        phone: input.phone ?? null,
      },
    });

    let displayName = user.name;
    if (input.displayName !== undefined) {
      const updated = await prisma.user.update({
        where: { id: user.id },
        data: { name: input.displayName },
        select: { name: true },
      });
      displayName = updated.name;
    }
    return toOwnerProfileView(displayName, profile);
  }

  // --- Locations ------------------------------------------------------------

  async listLocations(ownerId: string): Promise<OwnerLocationView[]> {
    const rows = await prisma.ownerLocation.findMany({
      where: { ownerId },
      orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
      include: ownerLocationInclude,
    });
    return rows.map(toOwnerLocationView);
  }

  async createLocation(
    ownerId: string,
    input: CreateLocationInput,
  ): Promise<OwnerLocationView> {
    await this.assertCityAndArea(input.cityId, input.areaId ?? null);

    const existingCount = await prisma.ownerLocation.count({
      where: { ownerId },
    });
    const makePrimary = input.isPrimary === true || existingCount === 0;

    const created = await prisma.$transaction(async (tx) => {
      if (makePrimary) {
        await tx.ownerLocation.updateMany({
          where: { ownerId },
          data: { isPrimary: false },
        });
      }
      return tx.ownerLocation.create({
        data: {
          ownerId,
          cityId: input.cityId,
          areaId: input.areaId ?? null,
          label: input.label ?? null,
          addressLine: input.addressLine ?? null,
          isPrimary: makePrimary,
        },
        include: ownerLocationInclude,
      });
    });
    return toOwnerLocationView(created);
  }

  async updateLocation(
    ownerId: string,
    locationId: string,
    input: UpdateLocationInput,
  ): Promise<OwnerLocationView> {
    const existing = await prisma.ownerLocation.findFirst({
      where: { id: locationId, ownerId },
      select: { id: true, cityId: true, isPrimary: true },
    });
    if (!existing) throw new NotFoundException("Location not found");

    const cityId = input.cityId ?? existing.cityId;
    if (input.cityId !== undefined || input.areaId !== undefined) {
      await this.assertCityAndArea(cityId, input.areaId ?? null);
    }

    const updated = await prisma.$transaction(async (tx) => {
      // Promote to primary (and demote the rest) when requested.
      if (input.isPrimary === true && !existing.isPrimary) {
        await tx.ownerLocation.updateMany({
          where: { ownerId },
          data: { isPrimary: false },
        });
      }
      return tx.ownerLocation.update({
        where: { id: locationId },
        data: {
          ...(input.cityId !== undefined ? { cityId: input.cityId } : {}),
          ...(input.areaId !== undefined ? { areaId: input.areaId } : {}),
          ...(input.label !== undefined ? { label: input.label } : {}),
          ...(input.addressLine !== undefined
            ? { addressLine: input.addressLine }
            : {}),
          ...(input.isPrimary !== undefined
            ? { isPrimary: input.isPrimary }
            : {}),
        },
        include: ownerLocationInclude,
      });
    });
    return toOwnerLocationView(updated);
  }

  /**
   * Delete a location. Rules:
   *  - Can't delete the only location once onboarding is complete.
   *  - If listings reference it, require a replacement and migrate them in one
   *    transaction; otherwise block with a 409.
   *  - Promote another location to primary if the primary one is removed.
   */
  async deleteLocation(
    ownerId: string,
    locationId: string,
    replacementLocationId?: string,
  ): Promise<OwnerLocationView[]> {
    const location = await prisma.ownerLocation.findFirst({
      where: { id: locationId, ownerId },
      include: { _count: { select: { properties: true } } },
    });
    if (!location) throw new NotFoundException("Location not found");

    const [locationCount, profile] = await Promise.all([
      prisma.ownerLocation.count({ where: { ownerId } }),
      prisma.ownerProfile.findUnique({
        where: { userId: ownerId },
        select: { onboardingCompletedAt: true },
      }),
    ]);

    if (profile?.onboardingCompletedAt && locationCount <= 1) {
      throw new ConflictException(
        "You must keep at least one location after completing onboarding.",
      );
    }

    const propertyCount = location._count.properties;
    let replacement: { id: string } | null = null;
    if (propertyCount > 0) {
      if (!replacementLocationId) {
        throw new ConflictException(
          `This location is used by ${propertyCount} listing${propertyCount === 1 ? "" : "s"}. Provide a replacement location to move them.`,
        );
      }
      if (replacementLocationId === locationId) {
        throw new BadRequestException(
          "Replacement location must be a different location.",
        );
      }
      replacement = await prisma.ownerLocation.findFirst({
        where: { id: replacementLocationId, ownerId },
        select: { id: true },
      });
      if (!replacement)
        throw new BadRequestException("Replacement location not found.");
    }

    await prisma.$transaction(async (tx) => {
      if (replacement) {
        await tx.property.updateMany({
          where: { ownerLocationId: locationId },
          data: { ownerLocationId: replacement.id },
        });
      }
      await tx.ownerLocation.delete({ where: { id: locationId } });
      if (location.isPrimary) {
        const next = await tx.ownerLocation.findFirst({
          where: { ownerId },
          orderBy: { createdAt: "asc" },
          select: { id: true },
        });
        if (next)
          await tx.ownerLocation.update({
            where: { id: next.id },
            data: { isPrimary: true },
          });
      }
    });

    return this.listLocations(ownerId);
  }

  // --- Payout method --------------------------------------------------------

  async getPayoutMethod(
    ownerId: string,
  ): Promise<OwnerPayoutMethodView | null> {
    const method = await prisma.ownerPayoutMethod.findUnique({
      where: { ownerId },
    });
    return method ? toPayoutMethodView(method) : null;
  }

  listPayoutBanks(): Promise<PayoutBankDirectoryView> {
    return this.bankDirectory.list();
  }

  verifyPayoutAccount(
    input: PayoutMethodInput,
  ): Promise<ResolvedPayoutAccount> {
    return this.bankDirectory.resolve(input.bankCode, input.accountNumber);
  }

  async upsertPayoutMethod(
    ownerId: string,
    input: PayoutMethodInput,
  ): Promise<OwnerPayoutMethodView> {
    // Provider first: activate nothing until Paystack supplies the canonical
    // bank and account-holder names for this exact bank-code/number pair.
    const verified = await this.bankDirectory.resolve(
      input.bankCode,
      input.accountNumber,
    );
    const accountNumberLast4 = last4(input.accountNumber);
    // Encrypt the full number only when a key is configured; otherwise keep masked.
    const accountNumberEnc = payoutEncryptionAvailable()
      ? encryptAccountNumber(input.accountNumber)
      : null;

    const method = await prisma.ownerPayoutMethod.upsert({
      where: { ownerId },
      update: {
        bankCode: verified.bankCode,
        bankName: verified.bankName,
        accountName: verified.accountName,
        accountNumberLast4,
        accountNumberEnc,
        provider: verified.provider,
        status: "ACTIVE",
      },
      create: {
        ownerId,
        bankCode: verified.bankCode,
        bankName: verified.bankName,
        accountName: verified.accountName,
        accountNumberLast4,
        accountNumberEnc,
        provider: verified.provider,
        status: "ACTIVE",
      },
    });
    return toPayoutMethodView(method);
  }

  // --- Onboarding completion ------------------------------------------------

  async completeOnboarding(
    user: AuthUser,
    skipPayout: boolean,
  ): Promise<OwnerOnboardingState> {
    const [profile, locationCount, payoutMethod] = await Promise.all([
      this.profileRow(user.id),
      prisma.ownerLocation.count({ where: { ownerId: user.id } }),
      prisma.ownerPayoutMethod.findUnique({
        where: { ownerId: user.id },
        select: { id: true },
      }),
    ]);

    const missing: string[] = [];
    if (!profile?.businessName) missing.push("business name");
    if (!profile?.phone) missing.push("contact phone");
    if (locationCount === 0) missing.push("at least one location");
    if (missing.length > 0) {
      throw new BadRequestException(
        `Add your ${missing.join(", ")} before finishing onboarding.`,
      );
    }
    if (!payoutMethod && !skipPayout) {
      throw new BadRequestException(
        "Add a payout method, or choose to add it later, before finishing onboarding.",
      );
    }

    await prisma.ownerProfile.update({
      where: { userId: user.id },
      data: { onboardingCompletedAt: new Date() },
    });
    return this.getOnboardingState(user);
  }

  // --- internals -----------------------------------------------------------

  private profileRow(userId: string) {
    return prisma.ownerProfile.findUnique({
      where: { userId },
      select: { businessName: true, phone: true, onboardingCompletedAt: true },
    });
  }

  private async assertCityAndArea(
    cityId: string,
    areaId: string | null,
  ): Promise<void> {
    const city = await prisma.city.findUnique({
      where: { id: cityId },
      select: { id: true },
    });
    if (!city) throw new BadRequestException("Select a valid city.");
    if (areaId) {
      const area = await prisma.area.findFirst({
        where: { id: areaId, cityId },
        select: { id: true },
      });
      if (!area)
        throw new BadRequestException(
          "Select an area that belongs to the chosen city.",
        );
    }
  }
}
