import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { prisma } from "../../../db";
import type {
  ApprovalActionResult,
  PropertyDetail,
  PropertyStatus,
  PropertySummary,
} from "../../../types";
import {
  propertyDetailInclude,
  propertySummaryInclude,
  toPropertyDetail,
  toPropertySummary,
} from "../properties/mappers";
import { AuditService } from "../audit/audit.service";
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
    adminUserId: string,
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
          actorUserId: adminUserId,
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
}
