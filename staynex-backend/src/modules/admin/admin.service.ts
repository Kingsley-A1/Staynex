import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { prisma } from "../../../db";
import type {
  AdminBookingsPage,
  AdminPaymentExceptionRow,
  AdminPaymentRow,
  AdminPaymentsPage,
  AdminPerformanceView,
  AdminPayoutRow,
  AdminPayoutsView,
  AuthUser,
  AiLogRow,
  ApprovalActionResult,
  AuditLogRow,
  AvailabilityDriftRow,
  BookingStatus,
  PaymentState,
  PropertyDetail,
  PropertyStatus,
  PropertySummary,
  WebVitalName,
} from "../../../types";
import {
  bookingRowInclude,
  paymentRowInclude,
  payoutRowInclude,
  toBookingRow,
  toPaymentRow,
  toPayoutRow,
} from "../bookings/report-mappers";
import { BookingMaintenanceService } from "../bookings/booking-maintenance.service";
import { BookingsService } from "../bookings/bookings.service";
import {
  propertyDetailInclude,
  propertySummaryInclude,
  toPropertyDetail,
  toPropertySummary,
} from "../properties/mappers";
import { AuditService } from "../audit/audit.service";
import { auditActorId } from "../auth/auth.service";
import { NotificationsService } from "../notifications/notifications.service";
import { PaymentEventsService } from "../payments/payment-events.service";
import { PaymentProviderRegistry } from "../payments/payment-provider.registry";
import type {
  AdminListQuery,
  ApprovalActionInput,
  MarkPayoutPaidInput,
} from "./dto";

const DECISION_STATUS: Record<ApprovalActionInput["decision"], PropertyStatus> =
  {
    APPROVE: "APPROVED",
    REJECT: "REJECTED",
    REQUEST_CHANGES: "DRAFT",
  };

const DECISION_ACTION: Record<ApprovalActionInput["decision"], string> = {
  APPROVE: "PROPERTY_APPROVED",
  REJECT: "PROPERTY_REJECTED",
  REQUEST_CHANGES: "PROPERTY_CHANGES_REQUESTED",
};

const DECISION_REVIEW_STATUS: Record<
  ApprovalActionInput["decision"],
  "PUBLISHED" | "FAILED" | "MANUAL_REVIEW"
> = {
  APPROVE: "PUBLISHED",
  REJECT: "FAILED",
  REQUEST_CHANGES: "MANUAL_REVIEW",
};

const BOOKING_STATUSES: BookingStatus[] = [
  "HOLD",
  "PENDING_PAYMENT",
  "CONFIRMED",
  "CANCELLED",
  "EXPIRED",
];
const PAYMENT_STATUSES: PaymentState[] = [
  "INITIATED",
  "PENDING",
  "SUCCESS",
  "FAILED",
  "REQUIRES_REFUND",
  "REFUNDED",
];

const PERFORMANCE_WINDOW_HOURS = 24;
const PERFORMANCE_SAMPLE_LIMIT = 2_000;
const WEB_VITAL_NAMES: WebVitalName[] = ["LCP", "INP", "CLS", "FCP", "TTFB"];
const CORE_TARGETS: Partial<Record<WebVitalName, number>> = {
  LCP: 2500,
  INP: 200,
  CLS: 0.1,
};

/** Opaque list cursor: createdAt ISO + row id, newest-first pagination. */
function encodeCursor(createdAt: Date, id: string): string {
  return `${createdAt.toISOString()}_${id}`;
}

function decodeCursor(
  cursor: string | undefined,
): { createdAt: Date; id: string } | null {
  if (!cursor) return null;
  const split = cursor.lastIndexOf("_");
  if (split <= 0) return null;
  const createdAt = new Date(cursor.slice(0, split));
  const id = cursor.slice(split + 1);
  if (Number.isNaN(createdAt.getTime()) || !id) return null;
  return { createdAt, id };
}

/** Keyset condition for newest-first (createdAt desc, id desc) pagination. */
function afterCursor(cursor: { createdAt: Date; id: string } | null) {
  if (!cursor) return undefined;
  return {
    OR: [
      { createdAt: { lt: cursor.createdAt } },
      { createdAt: cursor.createdAt, id: { lt: cursor.id } },
    ],
  };
}

type WebVitalRow = {
  name: string;
  value: number;
  rating: string | null;
  route: string;
  target: number | null;
  targetMet: boolean | null;
  createdAt: Date;
};

function summarizeMetric(name: WebVitalName, rows: WebVitalRow[]) {
  const group = rows.filter((row) => row.name === name);
  const latest = group[0];
  const target = CORE_TARGETS[name] ?? latest?.target ?? null;
  const values = group.map((row) => row.value);
  const goodCount = group.filter(
    (row) => normalizedRating(row) === "good",
  ).length;
  const needsImprovementCount = group.filter(
    (row) => normalizedRating(row) === "needs-improvement",
  ).length;
  const poorCount = group.filter(
    (row) => normalizedRating(row) === "poor",
  ).length;
  const targetMetRows = group.filter((row) => row.targetMet !== null);

  return {
    name,
    sampleCount: group.length,
    p75: percentile(values, 0.75),
    average: values.length
      ? round(values.reduce((sum, value) => sum + value, 0) / values.length)
      : null,
    goodCount,
    needsImprovementCount,
    poorCount,
    target,
    targetMetRate: targetMetRows.length
      ? round(
          (targetMetRows.filter((row) => row.targetMet === true).length /
            targetMetRows.length) *
            100,
        )
      : null,
    latestValue: latest ? round(latest.value) : null,
    latestRating: latest?.rating ?? null,
    latestRoute: latest?.route ?? null,
    updatedAt: latest?.createdAt.toISOString() ?? null,
  };
}

function summarizeRoutes(rows: WebVitalRow[]) {
  const byRoute = new Map<string, WebVitalRow[]>();
  for (const row of rows) {
    const list = byRoute.get(row.route) ?? [];
    list.push(row);
    byRoute.set(row.route, list);
  }
  return [...byRoute.entries()]
    .map(([route, group]) => ({
      route,
      sampleCount: group.length,
      lcpP75: percentile(valuesFor(group, "LCP"), 0.75),
      inpP75: percentile(valuesFor(group, "INP"), 0.75),
      clsP75: percentile(valuesFor(group, "CLS"), 0.75),
      poorCount: group.filter((row) => normalizedRating(row) === "poor").length,
      updatedAt: group[0]?.createdAt.toISOString() ?? new Date(0).toISOString(),
    }))
    .sort((a, b) => b.poorCount - a.poorCount || b.sampleCount - a.sampleCount);
}

function performanceRecommendations(
  metrics: ReturnType<typeof summarizeMetric>[],
  routes: ReturnType<typeof summarizeRoutes>,
  sampleCount: number,
): string[] {
  if (sampleCount === 0) {
    return [
      "No browser samples yet. Open the public and host journeys once after deploy.",
    ];
  }
  const recommendations: string[] = [];
  const lcp = metrics.find((metric) => metric.name === "LCP");
  const inp = metrics.find((metric) => metric.name === "INP");
  const cls = metrics.find((metric) => metric.name === "CLS");
  if ((lcp?.p75 ?? 0) > 2500) {
    recommendations.push(
      "LCP is above 2.5s. Check hero image priority, CDN caching, and API waterfalls.",
    );
  }
  if ((inp?.p75 ?? 0) > 200) {
    recommendations.push(
      "INP is above 200ms. Audit heavy client bundles and interactive handlers.",
    );
  }
  if ((cls?.p75 ?? 0) > 0.1) {
    recommendations.push(
      "CLS is above 0.1. Reserve media/header space and avoid late layout shifts.",
    );
  }
  const poorRoute = routes.find((route) => route.poorCount > 0);
  if (poorRoute) {
    recommendations.push(
      `Prioritize ${poorRoute.route}; it has the highest poor-sample count.`,
    );
  }
  if (recommendations.length === 0) {
    recommendations.push(
      "Core Web Vitals are within the current Staynex targets for this sample window.",
    );
  }
  return recommendations;
}

function valuesFor(rows: WebVitalRow[], name: WebVitalName): number[] {
  return rows.filter((row) => row.name === name).map((row) => row.value);
}

function normalizedRating(row: WebVitalRow): string | null {
  if (row.rating) return row.rating;
  const target = CORE_TARGETS[row.name as WebVitalName];
  if (!target) return null;
  return row.value <= target ? "good" : "poor";
}

function percentile(values: number[], point: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(
    sorted.length - 1,
    Math.ceil(sorted.length * point) - 1,
  );
  return round(sorted[index]);
}

function round(value: number): number {
  return Number(value.toFixed(value < 10 ? 3 : 0));
}

/** Admin authority: property approval + payment/payout operations. Every money
 * override is audited and leaves a PaymentEvent trail. */
@Injectable()
export class AdminService {
  constructor(
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    private readonly bookings: BookingsService,
    private readonly maintenance: BookingMaintenanceService,
    private readonly providers: PaymentProviderRegistry,
    private readonly paymentEvents: PaymentEventsService,
  ) {}

  async approvalQueue(): Promise<PropertySummary[]> {
    const rows = await prisma.property.findMany({
      where: { status: "PENDING_REVIEW" },
      orderBy: { updatedAt: "asc" },
      include: propertySummaryInclude,
    });
    return rows.map(toPropertySummary);
  }

  async listProperties(): Promise<PropertySummary[]> {
    const rows = await prisma.property.findMany({
      where: { status: { not: "ARCHIVED" } },
      orderBy: { updatedAt: "desc" },
      include: propertySummaryInclude,
    });
    return rows.map(toPropertySummary);
  }

  async getForReview(id: string): Promise<PropertyDetail> {
    const property = await prisma.property.findUnique({
      where: { id },
      include: propertyDetailInclude,
    });
    if (!property) throw new NotFoundException("Property not found");
    return toPropertyDetail(property);
  }

  async review(
    admin: AuthUser,
    propertyId: string,
    input: ApprovalActionInput,
  ): Promise<ApprovalActionResult> {
    const existing = await prisma.property.findUnique({
      where: { id: propertyId },
      select: { id: true, status: true, contentVersion: true },
    });
    if (!existing) throw new NotFoundException("Property not found");
    if (existing.status !== "PENDING_REVIEW") {
      throw new BadRequestException("Property is not pending review");
    }

    const status = DECISION_STATUS[input.decision];
    const reviewStatus = DECISION_REVIEW_STATUS[input.decision];
    const now = new Date();

    // State change + audit in one transaction so an override can never land
    // without its audit record (skill.md §9).
    const updated = await prisma.$transaction(async (tx) => {
      await tx.propertyReviewRun.updateMany({
        where: { propertyId, status: { in: ["PENDING", "SCHEDULED"] } },
        data: {
          status: "CANCELLED",
          completedAt: now,
          summary: `Superseded by admin decision: ${input.decision}.`,
        },
      });
      const next = await tx.property.update({
        where: { id: propertyId },
        data: {
          status,
          reviewStatus,
          reviewSource: "ADMIN_OVERRIDE",
          reviewedAt: now,
          scheduledPublishAt: null,
        },
      });
      await tx.propertyReviewRun.create({
        data: {
          propertyId,
          contentVersion: existing.contentVersion,
          source: "ADMIN_OVERRIDE",
          status: reviewStatus,
          riskScore: input.decision === "APPROVE" ? 0 : 100,
          summary: input.note ?? `Admin decision: ${input.decision}.`,
          publishedAt: input.decision === "APPROVE" ? now : null,
          completedAt: now,
        },
      });
      await this.audit.record(
        {
          actorUserId: auditActorId(admin),
          action: DECISION_ACTION[input.decision],
          entityType: "Property",
          entityId: propertyId,
          propertyId,
        },
        tx,
      );
      return next;
    });

    await this.notifications.onPropertyManualDecision(
      propertyId,
      input.decision,
      input.note,
    );
    return { id: updated.id, status: updated.status as PropertyStatus };
  }

  // --- Money operations: bookings/payments lists, exceptions, actions ------

  /** Bookings, newest first, searchable by guest/property/reference/id. */
  async listBookings(query: AdminListQuery): Promise<AdminBookingsPage> {
    const status = BOOKING_STATUSES.find((s) => s === query.status);
    const where: Prisma.BookingWhereInput = {
      ...(status ? { status } : {}),
      ...(query.q
        ? {
            OR: [
              { id: query.q },
              { guestEmail: { contains: query.q, mode: "insensitive" } },
              {
                payment: {
                  reference: { contains: query.q, mode: "insensitive" },
                },
              },
              {
                roomUnit: {
                  roomType: {
                    property: {
                      name: { contains: query.q, mode: "insensitive" },
                    },
                  },
                },
              },
            ],
          }
        : {}),
    };
    const cursorWhere = afterCursor(decodeCursor(query.cursor));
    const rows = await prisma.booking.findMany({
      where: cursorWhere ? { AND: [where, cursorWhere] } : where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: query.take + 1,
      include: bookingRowInclude,
    });
    const page = rows.slice(0, query.take);
    const last = page[page.length - 1];
    return {
      rows: page.map(toBookingRow),
      nextCursor:
        rows.length > query.take && last
          ? encodeCursor(last.createdAt, last.id)
          : null,
    };
  }

  /** Payments, newest first, searchable by reference/guest/property. */
  async listPayments(query: AdminListQuery): Promise<AdminPaymentsPage> {
    const status = PAYMENT_STATUSES.find((s) => s === query.status);
    const where: Prisma.PaymentWhereInput = {
      ...(status ? { status } : {}),
      ...(query.q
        ? {
            OR: [
              { reference: { contains: query.q, mode: "insensitive" } },
              {
                booking: {
                  guestEmail: { contains: query.q, mode: "insensitive" },
                },
              },
              {
                booking: {
                  roomUnit: {
                    roomType: {
                      property: {
                        name: { contains: query.q, mode: "insensitive" },
                      },
                    },
                  },
                },
              },
            ],
          }
        : {}),
    };
    const cursorWhere = afterCursor(decodeCursor(query.cursor));
    const rows = await prisma.payment.findMany({
      where: cursorWhere ? { AND: [where, cursorWhere] } : where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: query.take + 1,
      include: paymentRowInclude,
    });
    const page = rows.slice(0, query.take);
    const last = page[page.length - 1];
    return {
      rows: page.map(toPaymentRow),
      nextCursor:
        rows.length > query.take && last
          ? encodeCursor(last.createdAt, last.id)
          : null,
    };
  }

  /**
   * The exception queue: every payment where funds moved but the platform
   * owes a human action (REQUIRES_REFUND). This list must trend to empty —
   * its existence is the fix for the silent-loss class of failures (P1).
   */
  async paymentExceptions(): Promise<AdminPaymentExceptionRow[]> {
    const payments = await prisma.payment.findMany({
      where: { status: "REQUIRES_REFUND" },
      orderBy: { updatedAt: "desc" },
      take: 100,
      include: {
        booking: {
          include: {
            roomUnit: {
              include: {
                roomType: { include: { property: { select: { name: true } } } },
              },
            },
          },
        },
      },
    });

    const references = payments
      .map((p) => p.reference)
      .filter((r): r is string => Boolean(r));
    const events = references.length
      ? await prisma.paymentEvent.findMany({
          where: { reference: { in: references } },
          orderBy: { createdAt: "desc" },
        })
      : [];
    const eventsByRef = new Map<string, typeof events>();
    for (const event of events) {
      if (!event.reference) continue;
      const list = eventsByRef.get(event.reference) ?? [];
      if (list.length < 5) list.push(event);
      eventsByRef.set(event.reference, list);
    }

    return payments.map((p) => ({
      reference: p.reference,
      bookingId: p.bookingId,
      bookingStatus: p.booking.status as BookingStatus,
      propertyName: p.booking.roomUnit.roomType.property.name,
      guestEmail: p.booking.guestEmail,
      grossAmountKobo: p.grossAmountKobo > 0 ? p.grossAmountKobo : p.amount,
      currency: p.currency,
      // Refunds are actioned from this queue, so the admin must see which
      // provider actually captured the money before confirming.
      provider: p.provider,
      status: p.status as PaymentState,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
      events: (p.reference ? (eventsByRef.get(p.reference) ?? []) : []).map(
        (e) => ({
          id: e.id,
          eventType: e.eventType,
          outcome: e.outcome,
          detail: e.detail,
          createdAt: e.createdAt.toISOString(),
        }),
      ),
    }));
  }

  /** Audited support action: force a fresh provider verification. */
  async reverifyPayment(
    admin: AuthUser,
    reference: string,
  ): Promise<AdminPaymentRow> {
    const exists = await prisma.payment.findUnique({
      where: { reference },
      select: { id: true },
    });
    if (!exists) throw new NotFoundException("Payment not found");

    await this.bookings.syncPaymentStatus(reference, { force: true });
    await this.audit.record({
      actorUserId: auditActorId(admin),
      action: "PAYMENT_REVERIFIED",
      entityType: "Payment",
      entityId: exists.id,
      propertyId: null,
    });
    return this.paymentRowByReference(reference);
  }

  /**
   * Audited refund: the provider must accept the refund request before any
   * local state changes. Then payment -> REFUNDED, the booking is cancelled
   * with capacity released, and an unsettled payout is clawed back.
   */
  async refundPayment(
    admin: AuthUser,
    reference: string,
    note: string | undefined,
  ): Promise<AdminPaymentRow> {
    const payment = await prisma.payment.findUnique({
      where: { reference },
      select: { id: true, status: true, provider: true },
    });
    if (!payment) throw new NotFoundException("Payment not found");
    if (payment.status === "REFUNDED") {
      throw new BadRequestException("This payment is already refunded.");
    }
    if (payment.status !== "SUCCESS" && payment.status !== "REQUIRES_REFUND") {
      throw new BadRequestException(
        `Only captured payments can be refunded (status is ${payment.status}).`,
      );
    }

    // Refund through the provider that actually captured the money, resolved
    // from the payment row — never a default. Provider first: if it rejects,
    // nothing changes locally, so an admin never sees a refund we didn't make.
    const provider = this.providers.get(payment.provider);
    await provider.refundTransaction(reference);

    const initiator = `admin ${admin.email ?? admin.id}${note ? ` — ${note}` : ""}`;
    const result = await this.bookings.applyRefund(reference, initiator);
    await this.paymentEvents.record({
      eventType: "admin.refund",
      provider: provider.name,
      reference,
      outcome: result.outcome,
      detail: result.detail,
    });
    await this.audit.record({
      actorUserId: auditActorId(admin),
      action: "PAYMENT_REFUND_ISSUED",
      entityType: "Payment",
      entityId: payment.id,
      propertyId: null,
    });
    return this.paymentRowByReference(reference);
  }

  /** On-demand availability reconciliation (also runs on an interval). */
  async availabilityDrift(): Promise<AvailabilityDriftRow[]> {
    return this.maintenance.reconcileAvailability();
  }

  /** Core Web Vitals and route health from first-party browser beacons. */
  async performance(): Promise<AdminPerformanceView> {
    const since = new Date(
      Date.now() - PERFORMANCE_WINDOW_HOURS * 60 * 60 * 1000,
    );
    const rows = await prisma.webVitalMetric.findMany({
      where: { createdAt: { gte: since } },
      orderBy: { createdAt: "desc" },
      take: PERFORMANCE_SAMPLE_LIMIT,
    });

    const metrics = WEB_VITAL_NAMES.map((name) => summarizeMetric(name, rows));
    const routes = summarizeRoutes(rows).slice(0, 20);
    return {
      generatedAt: new Date().toISOString(),
      windowHours: PERFORMANCE_WINDOW_HOURS,
      totalSamples: rows.length,
      metrics,
      routes,
      recommendations: performanceRecommendations(metrics, routes, rows.length),
    };
  }

  // --- Phase A: owner payout settlement (manual) ---------------------------

  /** Payout queue + platform accounting totals. Read-only view. */
  async payoutQueue(): Promise<AdminPayoutsView> {
    const [payouts, paymentTotals, payoutByStatus] = await Promise.all([
      prisma.payout.findMany({
        orderBy: [{ status: "asc" }, { eligibleAt: "asc" }],
        take: 100,
        include: payoutRowInclude,
      }),
      prisma.payment.aggregate({
        _sum: {
          grossAmountKobo: true,
          platformFeeKobo: true,
          ownerPayoutKobo: true,
        },
        where: { status: "SUCCESS" },
      }),
      prisma.payout.groupBy({ by: ["status"], _sum: { amount: true } }),
    ]);

    let pendingPayoutKobo = 0;
    let paidPayoutKobo = 0;
    for (const group of payoutByStatus) {
      const sum = group._sum.amount ?? 0;
      if (group.status === "PENDING" || group.status === "PROCESSING")
        pendingPayoutKobo += sum;
      else if (group.status === "PAID") paidPayoutKobo += sum;
    }

    return {
      payouts: payouts.map(toPayoutRow),
      totals: {
        grossRevenueKobo: paymentTotals._sum.grossAmountKobo ?? 0,
        platformCommissionKobo: paymentTotals._sum.platformFeeKobo ?? 0,
        ownerPayoutKobo: paymentTotals._sum.ownerPayoutKobo ?? 0,
        pendingPayoutKobo,
        paidPayoutKobo,
      },
    };
  }

  /**
   * Manually mark a payout as settled (Phase A: paid out-of-band by an admin).
   * Settling before `eligibleAt` requires an explicit override plus a note —
   * the eligibility gate exists in data and is now enforced in the transition
   * (payment-review P11). Every settlement is audited (skill.md §9).
   */
  async markPayoutPaid(
    admin: AuthUser,
    payoutId: string,
    input: MarkPayoutPaidInput,
  ): Promise<AdminPayoutRow> {
    const existing = await prisma.payout.findUnique({
      where: { id: payoutId },
      select: { id: true, status: true, propertyId: true, eligibleAt: true },
    });
    if (!existing) throw new NotFoundException("Payout not found");
    if (existing.status === "PAID")
      throw new BadRequestException("Payout is already marked paid");
    if (existing.status === "FAILED")
      throw new BadRequestException("This payout is marked failed");

    const now = new Date();
    const early = existing.eligibleAt.getTime() > now.getTime();
    if (early && !input.overrideEligibility) {
      throw new BadRequestException(
        `This payout is not eligible until ${existing.eligibleAt.toISOString()}. ` +
          "To settle early, confirm the override and add a note.",
      );
    }
    if (early && !input.note?.trim()) {
      throw new BadRequestException(
        "Early settlement requires a note explaining why.",
      );
    }

    const updated = await prisma.$transaction(async (tx) => {
      const next = await tx.payout.update({
        where: { id: payoutId },
        data: {
          status: "PAID",
          approvedAt: now,
          paidAt: now,
          processedByUserId: admin.id,
          ...(input.note?.trim() ? { note: input.note.trim() } : {}),
        },
        include: payoutRowInclude,
      });
      await this.audit.record(
        {
          actorUserId: auditActorId(admin),
          action: early ? "PAYOUT_MARKED_PAID_EARLY" : "PAYOUT_MARKED_PAID",
          entityType: "Payout",
          entityId: payoutId,
          propertyId: existing.propertyId,
        },
        tx,
      );
      return next;
    });
    // Tell the host their money is on the way (best-effort, deduped).
    await this.notifications.onPayoutSettled(payoutId);
    return toPayoutRow(updated);
  }

  /** Mark a payout FAILED with a mandatory reason (audited). */
  async markPayoutFailed(
    admin: AuthUser,
    payoutId: string,
    reason: string,
  ): Promise<AdminPayoutRow> {
    const existing = await prisma.payout.findUnique({
      where: { id: payoutId },
      select: { id: true, status: true, propertyId: true },
    });
    if (!existing) throw new NotFoundException("Payout not found");
    if (existing.status !== "PENDING" && existing.status !== "PROCESSING") {
      throw new BadRequestException(
        `Only unsettled payouts can be failed (status is ${existing.status}).`,
      );
    }

    const updated = await prisma.$transaction(async (tx) => {
      const next = await tx.payout.update({
        where: { id: payoutId },
        data: {
          status: "FAILED",
          failedAt: new Date(),
          note: reason,
          processedByUserId: admin.id,
        },
        include: payoutRowInclude,
      });
      await this.audit.record(
        {
          actorUserId: auditActorId(admin),
          action: "PAYOUT_MARKED_FAILED",
          entityType: "Payout",
          entityId: payoutId,
          propertyId: existing.propertyId,
        },
        tx,
      );
      return next;
    });
    await this.notifications.onPayoutFailed(payoutId, reason);
    return toPayoutRow(updated);
  }

  /** Audit trail (admin overrides). */
  async auditLogs(): Promise<AuditLogRow[]> {
    const rows = await prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        actor: { select: { name: true, email: true } },
        property: { select: { name: true, slug: true } },
      },
    });
    return rows.map((r) => ({
      id: r.id,
      action: r.action,
      entityType: r.entityType,
      entityId: r.entityId,
      actorUserId: r.actorUserId,
      actorName: r.actor?.name ?? null,
      actorEmail: r.actor?.email ?? null,
      propertyId: r.propertyId,
      propertyName: r.property?.name ?? null,
      propertySlug: r.property?.slug ?? null,
      createdAt: r.createdAt.toISOString(),
    }));
  }

  /** AI assistant action log (conversations are tool-first; never authority). */
  async aiLogs(): Promise<AiLogRow[]> {
    const rows = await prisma.aIActionLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return rows.map((r) => ({
      id: r.id,
      conversationId: r.conversationId,
      actionType: r.actionType,
      summary: r.summary,
      createdAt: r.createdAt.toISOString(),
    }));
  }

  private async paymentRowByReference(
    reference: string,
  ): Promise<AdminPaymentRow> {
    const payment = await prisma.payment.findUnique({
      where: { reference },
      include: paymentRowInclude,
    });
    if (!payment) throw new NotFoundException("Payment not found");
    return toPaymentRow(payment);
  }
}
