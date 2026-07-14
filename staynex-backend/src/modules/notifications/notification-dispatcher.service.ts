import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { prisma } from "../../../db";
import { readPositiveIntEnv } from "../../common/env";
import { MAX_DELIVERY_ATTEMPTS, NotificationsService } from "./notifications.service";

const RETRY_INTERVAL_MS = readPositiveIntEnv("NOTIFICATION_RETRY_INTERVAL_MS", 2 * 60_000);
/** A QUEUED row older than this crashed mid-send and is retried too. */
const STUCK_QUEUED_MS = 10 * 60_000;
const MAX_ROWS_PER_RUN = 50;

/**
 * Outbox retry dispatcher: re-attempts FAILED (and crash-stuck QUEUED)
 * EMAIL/PUSH deliveries from their stored payloads, up to
 * MAX_DELIVERY_ATTEMPTS, so a provider blip never permanently drops a
 * notification. Same interval pattern as the other background services.
 */
@Injectable()
export class NotificationDispatcherService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NotificationDispatcherService.name);
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(private readonly notifications: NotificationsService) {}

  onModuleInit(): void {
    if (process.env.NOTIFICATION_RETRY_DISABLED === "true") return;
    this.timer = setInterval(() => void this.run(), RETRY_INTERVAL_MS);
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async run(): Promise<{ retried: number }> {
    if (this.running) return { retried: 0 };
    this.running = true;
    try {
      const stuckBefore = new Date(Date.now() - STUCK_QUEUED_MS);
      // EMAIL/PUSH rows always carry a payload; IN_APP rows are SENT and never
      // match. Rows without a usable payload are failed out by the deliverers.
      const rows = await prisma.notification.findMany({
        where: {
          channel: { in: ["EMAIL", "PUSH"] },
          attempts: { lt: MAX_DELIVERY_ATTEMPTS },
          OR: [{ status: "FAILED" }, { status: "QUEUED", updatedAt: { lt: stuckBefore } }],
        },
        orderBy: { updatedAt: "asc" },
        take: MAX_ROWS_PER_RUN,
        select: { id: true, channel: true, userId: true, payload: true },
      });

      for (const row of rows) {
        if (row.channel === "EMAIL") {
          await this.notifications.deliverEmailRow(row);
        } else {
          await this.notifications.deliverPushRow(row);
        }
      }
      if (rows.length > 0) {
        this.logger.log(`Notification retry: re-attempted ${rows.length} delivery(ies).`);
      }
      return { retried: rows.length };
    } catch (err) {
      this.logger.error(
        `Notification retry failed: ${err instanceof Error ? err.message : "unknown"}`,
      );
      return { retried: 0 };
    } finally {
      this.running = false;
    }
  }
}
