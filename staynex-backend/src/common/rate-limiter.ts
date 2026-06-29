import { Injectable } from "@nestjs/common";

/**
 * Tiny in-memory sliding-window rate limiter. Dependency-free and good enough to
 * stop a single principal (signed-in user or anonymous IP) from burning the
 * shared Gemini free-tier quota. State is per-process — fine for the current
 * single-instance deployment; move to a shared store (e.g. Redis) if the API is
 * horizontally scaled.
 */
@Injectable()
export class RateLimiterService {
  private readonly hits = new Map<string, number[]>();

  /**
   * Records an attempt for `key` and reports whether it is allowed.
   * @returns `true` if within `limit` over the trailing `windowMs`, else `false`.
   */
  check(key: string, limit: number, windowMs: number): boolean {
    const now = Date.now();
    const cutoff = now - windowMs;
    this.sweepIfNeeded(cutoff);

    const recent = (this.hits.get(key) ?? []).filter((t) => t > cutoff);
    if (recent.length >= limit) {
      this.hits.set(key, recent); // keep the pruned window
      return false;
    }
    recent.push(now);
    this.hits.set(key, recent);
    return true;
  }

  /** Drop keys whose windows have fully expired, only once the map grows large. */
  private sweepIfNeeded(cutoff: number): void {
    if (this.hits.size < 5000) return;
    for (const [key, times] of this.hits) {
      const live = times.filter((t) => t > cutoff);
      if (live.length === 0) this.hits.delete(key);
      else this.hits.set(key, live);
    }
  }
}
