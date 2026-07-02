import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { prisma } from "../../../db";
import { r2ConfigPresent } from "./r2-storage.provider";
import { MEDIA_SCOPES } from "./dto";
import { STORAGE_PROVIDER, type StorageProvider } from "./storage";

const SWEEP_INTERVAL_MS = readPositiveIntEnv("MEDIA_SWEEP_INTERVAL_MS", 6 * 60 * 60_000);
/** Objects younger than this are considered in-flight uploads, never orphans. */
const ORPHAN_MIN_AGE_MS = 24 * 60 * 60_000;
const MAX_CANDIDATES_PER_SWEEP = 500;

/**
 * Reclaims storage objects that were uploaded but never attached (owner closed
 * the tab, attach failed, or a row was deleted while the object delete failed).
 * Truth is the database: any object under a media prefix, older than 24h, whose
 * public URL is referenced by no PropertyMedia/RoomMedia row, is deleted.
 * Follows the same interval pattern as PropertyAutoPublisherService.
 */
@Injectable()
export class MediaSweeperService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MediaSweeperService.name);
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(@Inject(STORAGE_PROVIDER) private readonly storage: StorageProvider) {}

  onModuleInit(): void {
    // Only meaningful against real storage; the dev stub lists nothing anyway.
    if (process.env.MEDIA_SWEEP_DISABLED === "true" || !r2ConfigPresent()) return;
    this.timer = setInterval(() => void this.sweep(), SWEEP_INTERVAL_MS);
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async sweep(): Promise<{ scanned: number; deleted: number }> {
    if (this.running) return { scanned: 0, deleted: 0 };
    this.running = true;
    try {
      const olderThan = new Date(Date.now() - ORPHAN_MIN_AGE_MS);
      let scanned = 0;
      let deleted = 0;

      for (const scope of MEDIA_SCOPES) {
        const candidates = await this.storage.listObjects(
          `${scope}/`,
          olderThan,
          MAX_CANDIDATES_PER_SWEEP,
        );
        for (const candidate of candidates) {
          scanned += 1;
          if (await this.isReferenced(candidate.key)) continue;
          try {
            await this.storage.deleteObject(candidate.key);
            deleted += 1;
          } catch (err) {
            this.logger.warn(
              `Orphan delete failed for ${candidate.key}: ${
                err instanceof Error ? err.message : "unknown"
              }`,
            );
          }
        }
      }

      if (deleted > 0) {
        this.logger.log(`Media sweep: scanned=${scanned} deleted=${deleted} orphans.`);
      }
      return { scanned, deleted };
    } catch (err) {
      this.logger.error(`Media sweep failed: ${err instanceof Error ? err.message : "unknown"}`);
      return { scanned: 0, deleted: 0 };
    } finally {
      this.running = false;
    }
  }

  private async isReferenced(key: string): Promise<boolean> {
    const url = this.storage.publicUrl(key);
    const [property, room] = await Promise.all([
      prisma.propertyMedia.findFirst({ where: { url }, select: { id: true } }),
      prisma.roomMedia.findFirst({ where: { url }, select: { id: true } }),
    ]);
    return Boolean(property ?? room);
  }
}

function readPositiveIntEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
