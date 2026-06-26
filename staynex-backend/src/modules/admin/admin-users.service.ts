import {
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { prisma } from "../../../db";
import type { AdminUserDetail, AdminUserRow, AuthUser, RevealedPayoutMethod } from "../../../types";
import { auditActorId, deriveCapabilities } from "../auth/auth.service";
import { AuditService } from "../audit/audit.service";
import {
  ownerLocationInclude,
  toOwnerLocationView,
  toOwnerProfileView,
  toPayoutMethodView,
} from "../owner/mappers";
import { decryptAccountNumber } from "../owner/payout-crypto";

/**
 * Super Admin user inspection. Listing + non-sensitive detail is available to any
 * admin; payout method details are restricted to ADMIN_MANAGER, and revealing the
 * full account number is ADMIN_MANAGER-only and always audited (skill.md §9).
 */
@Injectable()
export class AdminUsersService {
  constructor(private readonly audit: AuditService) {}

  async listUsers(): Promise<AdminUserRow[]> {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      take: 200,
      include: {
        capabilities: { select: { capability: true } },
        _count: { select: { ownedProperties: true, bookings: true } },
      },
    });

    return users.map((u) => {
      const capabilities = deriveCapabilities(u.role, u.capabilities);
      return {
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        capabilities,
        isOwner: capabilities.includes("OWNER"),
        isAdmin: capabilities.includes("ADMIN_REVIEWER") || capabilities.includes("ADMIN_MANAGER"),
        propertyCount: u._count.ownedProperties,
        bookingCount: u._count.bookings,
        createdAt: u.createdAt.toISOString(),
      };
    });
  }

  async getUser(id: string, viewer: AuthUser): Promise<AdminUserDetail> {
    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        capabilities: { select: { capability: true } },
        ownerProfile: {
          select: { businessName: true, phone: true, onboardingCompletedAt: true },
        },
        ownerLocations: {
          orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
          include: ownerLocationInclude,
        },
        payoutMethod: true,
        _count: { select: { ownedProperties: true, bookings: true } },
      },
    });
    if (!user) throw new NotFoundException("User not found");

    const isManager = viewer.capabilities.includes("ADMIN_MANAGER");
    const payoutMethod = user.payoutMethod ? toPayoutMethodView(user.payoutMethod) : null;

    const payoutAgg = await prisma.payout.groupBy({
      by: ["status"],
      where: { ownerId: id },
      _sum: { amount: true },
    });
    let paidKobo = 0;
    let pendingKobo = 0;
    for (const group of payoutAgg) {
      const sum = group._sum.amount ?? 0;
      if (group.status === "PAID") paidKobo += sum;
      else if (group.status === "PENDING" || group.status === "PROCESSING") pendingKobo += sum;
    }

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      capabilities: deriveCapabilities(user.role, user.capabilities),
      createdAt: user.createdAt.toISOString(),
      ownerProfile: user.ownerProfile ? toOwnerProfileView(user.name, user.ownerProfile) : null,
      ownerLocations: user.ownerLocations.map(toOwnerLocationView),
      payoutMethod: isManager ? payoutMethod : null,
      payoutRestricted: !isManager && payoutMethod !== null,
      counts: { properties: user._count.ownedProperties, bookings: user._count.bookings },
      payoutSummary: { paidKobo, pendingKobo, currency: "NGN" },
    };
  }

  /** ADMIN_MANAGER-only reveal of the full account number. Always audited. */
  async revealPayoutMethod(
    adminManager: AuthUser,
    ownerId: string,
  ): Promise<RevealedPayoutMethod> {
    const method = await prisma.ownerPayoutMethod.findUnique({ where: { ownerId } });
    if (!method) throw new NotFoundException("No payout method on file for this owner");
    if (!method.accountNumberEnc) {
      throw new ServiceUnavailableException(
        "The full account number is not available (payout encryption is not configured).",
      );
    }

    let accountNumber: string;
    try {
      accountNumber = decryptAccountNumber(method.accountNumberEnc);
    } catch {
      throw new ServiceUnavailableException("Could not decrypt the payout details.");
    }

    await this.audit.record({
      actorUserId: auditActorId(adminManager),
      action: "OWNER_PAYOUT_REVEALED",
      entityType: "OwnerPayoutMethod",
      entityId: method.id,
    });

    return {
      ownerId,
      bankName: method.bankName,
      accountName: method.accountName,
      accountNumber,
      provider: method.provider,
    };
  }
}
