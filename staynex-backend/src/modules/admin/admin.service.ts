import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { prisma } from "../../../db";
import type {
  AdminBookingsView,
  AdminPayoutRow,
  AdminPayoutsView,
  AuthUser,
  AiLogRow,
  ApprovalActionResult,
  AuditLogRow,
  PropertyDetail,
  PropertyStatus,
  PropertySummary,
} from "../../../types";
import {
  bookingRowInclude,
  paymentRowInclude,
  payoutRowInclude,
  toBookingRow,
  toPaymentRow,
  toPayoutRow,
} from "../bookings/report-mappers";
import {
  propertyDetailInclude,
  propertySummaryInclude,
  toPropertyDetail,
  toPropertySummary,
} from "../properties/mappers";
import { AuditService } from "../audit/audit.service";
import { auditActorId } from "../auth/auth.service";
import { NotificationsService } from "../notifications/notifications.service";
import type { ApprovalActionInput } from "./dto";

const DECISION_STATUS: Record<ApprovalActionInput["decision"], PropertyStatus> = {
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

/** Admin property approval. Every decision is an override and is audited. */
@Injectable()
export class AdminService {
  constructor(
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  async approvalQueue(): Promise<PropertySummary[]> {
    const rows = await prisma.property.findMany({
      where: { status: "PENDING_REVIEW" },
      orderBy: { updatedAt: "asc" },
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

    await this.notifications.onPropertyManualDecision(propertyId, input.decision, input.note);
    return { id: updated.id, status: updated.status as PropertyStatus };
  }

  // --- Phase 4: platform-wide operational visibility (read-only) ------------

  /** Recent bookings + payments across the whole platform. */
  async bookingsOverview(): Promise<AdminBookingsView> {
    const [bookings, payments] = await Promise.all([
      prisma.booking.findMany({
        orderBy: { createdAt: "desc" },
        take: 100,
        include: bookingRowInclude,
      }),
      prisma.payment.findMany({
        orderBy: { createdAt: "desc" },
        take: 100,
        include: paymentRowInclude,
      }),
    ]);
    return { bookings: bookings.map(toBookingRow), payments: payments.map(toPaymentRow) };
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
        _sum: { grossAmountKobo: true, platformFeeKobo: true, ownerPayoutKobo: true },
        where: { status: "SUCCESS" },
      }),
      prisma.payout.groupBy({ by: ["status"], _sum: { amount: true } }),
    ]);

    let pendingPayoutKobo = 0;
    let paidPayoutKobo = 0;
    for (const group of payoutByStatus) {
      const sum = group._sum.amount ?? 0;
      if (group.status === "PENDING" || group.status === "PROCESSING") pendingPayoutKobo += sum;
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
   * Every settlement is an admin override and is audited (skill.md §9).
   */
  async markPayoutPaid(admin: AuthUser, payoutId: string): Promise<AdminPayoutRow> {
    const existing = await prisma.payout.findUnique({
      where: { id: payoutId },
      select: { id: true, status: true, propertyId: true },
    });
    if (!existing) throw new NotFoundException("Payout not found");
    if (existing.status === "PAID") throw new BadRequestException("Payout is already marked paid");
    if (existing.status === "FAILED") throw new BadRequestException("This payout is marked failed");

    const now = new Date();
    const updated = await prisma.$transaction(async (tx) => {
      const next = await tx.payout.update({
        where: { id: payoutId },
        data: { status: "PAID", approvedAt: now, paidAt: now, processedByUserId: admin.id },
        include: payoutRowInclude,
      });
      await this.audit.record(
        {
          actorUserId: auditActorId(admin),
          action: "PAYOUT_MARKED_PAID",
          entityType: "Payout",
          entityId: payoutId,
          propertyId: existing.propertyId,
        },
        tx,
      );
      return next;
    });
    return toPayoutRow(updated);
  }

  /** Audit trail (admin overrides). */
  async auditLogs(): Promise<AuditLogRow[]> {
    const rows = await prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 100 });
    return rows.map((r) => ({
      id: r.id,
      action: r.action,
      entityType: r.entityType,
      entityId: r.entityId,
      actorUserId: r.actorUserId,
      propertyId: r.propertyId,
      createdAt: r.createdAt.toISOString(),
    }));
  }

  /** AI assistant action log (conversations are tool-first; never authority). */
  async aiLogs(): Promise<AiLogRow[]> {
    const rows = await prisma.aIActionLog.findMany({ orderBy: { createdAt: "desc" }, take: 100 });
    return rows.map((r) => ({
      id: r.id,
      conversationId: r.conversationId,
      actionType: r.actionType,
      summary: r.summary,
      createdAt: r.createdAt.toISOString(),
    }));
  }
}
