import type { PayoutMethodStatus } from "@prisma/client";
import type {
  OwnerLocationView,
  OwnerPayoutMethodView,
  OwnerProfileView,
  PayoutMethodStatusValue,
} from "../../../types";

// Prisma `include` shape for an OwnerLocation rendered as OwnerLocationView.
export const ownerLocationInclude = {
  city: { select: { name: true } },
  area: { select: { name: true } },
  _count: { select: { properties: true } },
} as const;

interface LocationRow {
  id: string;
  cityId: string;
  areaId: string | null;
  label: string | null;
  addressLine: string | null;
  isPrimary: boolean;
  createdAt: Date;
  city: { name: string };
  area: { name: string } | null;
  _count: { properties: number };
}

export function toOwnerLocationView(loc: LocationRow): OwnerLocationView {
  return {
    id: loc.id,
    cityId: loc.cityId,
    cityName: loc.city.name,
    areaId: loc.areaId,
    areaName: loc.area?.name ?? null,
    label: loc.label,
    addressLine: loc.addressLine,
    isPrimary: loc.isPrimary,
    propertyCount: loc._count.properties,
    createdAt: loc.createdAt.toISOString(),
  };
}

interface PayoutRow {
  id: string;
  bankName: string;
  accountName: string;
  accountNumberLast4: string;
  accountNumberEnc: string | null;
  provider: string | null;
  status: PayoutMethodStatus;
  updatedAt: Date;
}

export function toPayoutMethodView(method: PayoutRow): OwnerPayoutMethodView {
  return {
    id: method.id,
    bankName: method.bankName,
    accountName: method.accountName,
    accountNumberLast4: method.accountNumberLast4,
    provider: method.provider,
    status: method.status as PayoutMethodStatusValue,
    hasEncryptedNumber: Boolean(method.accountNumberEnc),
    updatedAt: method.updatedAt.toISOString(),
  };
}

export function toOwnerProfileView(
  displayName: string | null,
  profile: { businessName: string | null; phone: string | null; onboardingCompletedAt: Date | null } | null,
): OwnerProfileView {
  return {
    displayName,
    businessName: profile?.businessName ?? null,
    phone: profile?.phone ?? null,
    onboardingCompletedAt: profile?.onboardingCompletedAt?.toISOString() ?? null,
  };
}
