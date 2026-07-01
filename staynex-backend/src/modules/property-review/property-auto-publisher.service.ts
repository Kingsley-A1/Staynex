import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PropertyReviewService } from "./property-review.service";

const PUBLISH_INTERVAL_MS = readPositiveIntEnv("PROPERTY_AUTO_PUBLISH_INTERVAL_MS", 30_000);

@Injectable()
export class PropertyAutoPublisherService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PropertyAutoPublisherService.name);
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(private readonly reviews: PropertyReviewService) {}

  onModuleInit(): void {
    if (process.env.PROPERTY_AUTO_PUBLISH_DISABLED === "true") return;
    this.timer = setInterval(() => void this.tick(), PUBLISH_INTERVAL_MS);
    void this.tick();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  private async tick(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const { published, cancelled } = await this.reviews.publishDueProperties();
      if (published > 0 || cancelled > 0) {
        this.logger.log(`Auto-publisher published=${published} cancelled=${cancelled}`);
      }
    } catch (err) {
      this.logger.error(
        `Auto-publisher failed: ${err instanceof Error ? err.message : "unknown"}`,
      );
    } finally {
      this.running = false;
    }
  }
}

function readPositiveIntEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
