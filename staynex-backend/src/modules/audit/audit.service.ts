import { Injectable } from "@nestjs/common";
import { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "../../../db";

export interface AuditEntry {
  actorUserId: string | null;
  action: string; // e.g. "PROPERTY_APPROVED"
  entityType: string; // e.g. "Property"
  entityId: string;
  propertyId?: string | null;
}

// Accepts the global client or a transaction client, so an override + its audit
// row can be committed atomically.
type DbClient = PrismaClient | Prisma.TransactionClient;

/**
 * Append-only audit trail. Every admin override (approve/reject/request-changes,
 * and future overrides) must call this — see skill.md §9.
 */
@Injectable()
export class AuditService {
  record(entry: AuditEntry, client: DbClient = prisma) {
    return client.auditLog.create({
      data: {
        actorUserId: entry.actorUserId,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId,
        propertyId: entry.propertyId ?? null,
      },
    });
  }
}
