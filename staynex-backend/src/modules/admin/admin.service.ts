import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { prisma } from "../../../db";
import type {
  AdminBookingsView,
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
  toBookingRow,
  toPaymentRow,
} from "../bookings/report-mappers";
import {
  propertyDetailInclude,
  propertySummaryInclude,
  toPropertyDetail,
  toPropertySummary,
} from "../properties/mappers";
import { AuditService } from "../audit/audit.service";
import { auditActorId } from "../auth/auth.service";
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

/** Admin property approval. Every decision is an override and is audited. */
@Injectable()
export class AdminService {
  constructor(private readonly audit: AuditService) {}

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
      select: { id: true, status: true },
    });
    if (!existing) throw new NotFoundException("Property not found");
    if (existing.status !== "PENDING_REVIEW") {
      throw new BadRequestException("Property is not pending review");
    }

    const status = DECISION_STATUS[input.decision];

    // State change + audit in one transaction so an override can never land
    // without its audit record (skill.md §9).
    const updated = await prisma.$transaction(async (tx) => {
      const next = await tx.property.update({ where: { id: propertyId }, data: { status } });
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
