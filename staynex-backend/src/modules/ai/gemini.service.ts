import { Injectable, Logger } from "@nestjs/common";
import { parseGeminiSseEvent, splitGeminiSseEvents } from "./gemini-sse";

export interface GeminiTurn {
  role: "user" | "model";
  text: string;
}

// Free tier (verified June 2026): gemini-2.5-flash allows ~15 RPM / 1M TPM /
// 1500 RPD. A 429 = one of those dimensions was exhausted; it is transient and
// resolves on its own. If sustained 429s become a problem, gemini-2.5-flash or
// the newer Gemini 3 Flash (recommended free-tier model in 2026) are drop-in
// model swaps — see docs/staynex-ai-plan.md.
const DEFAULT_MODEL = "gemini-2.5-flash";
const GEMINI_API_BASE =
  "https://generativelanguage.googleapis.com/v1beta/models";

// 429 (rate limit) and 503 (model overloaded) are transient; retry with backoff.
const RETRYABLE_STATUS = new Set([429, 503]);
const MAX_RETRIES = 2;
const BASE_BACKOFF_MS = 600;
const MAX_BACKOFF_MS = 4000;
// Initial + two JSON retries stay under the 60s proxy budget. Streaming uses an
// inactivity timeout so a healthy response is not aborted while tokens arrive.
const GEMINI_JSON_REQUEST_TIMEOUT_MS = 15_000;
const GEMINI_STREAM_IDLE_TIMEOUT_MS = 25_000;
const GENERATION_CONFIG = { temperature: 0.3, maxOutputTokens: 1024 } as const;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export type GeminiFailureReason =
  | "provider_rate_limited"
  | "provider_overloaded"
  | "provider_timeout"
  | "provider_unconfigured"
  | "provider_error"
  | "provider_output_limited";

export type GeminiResult =
  | { ok: true; text: string }
  | {
      ok: false;
      reason: GeminiFailureReason;
      partialText?: string;
    };

export class GeminiStreamError extends Error {
  constructor(
    public readonly reason: GeminiFailureReason,
    message: string,
  ) {
    super(message);
    this.name = "GeminiStreamError";
  }
}

/**
 * Minimal Google Gemini integration (HTTP, no SDK). Reads the key at call time
 * and degrades gracefully. Transient 429/503 responses are retried with
 * exponential backoff that honours the `Retry-After` header; on exhaustion it
 * returns a typed failure so the assistant can surface an honest state instead
 * of crashing or hammering the quota.
 */
@Injectable()
export class GeminiService {
  private readonly logger = new Logger(GeminiService.name);

  private endpoint(
    action: "generateContent" | "streamGenerateContent",
  ): string {
    const model = process.env.GEMINI_MODEL?.trim() || DEFAULT_MODEL;
    return `${GEMINI_API_BASE}/${encodeURIComponent(model)}:${action}`;
  }

  isConfigured(): boolean {
    return Boolean(process.env.GEMINI_API_KEY);
  }

  /** Back-compat: returns the reply text, or null on any failure. */
  async generate(
    systemPrompt: string,
    history: GeminiTurn[],
  ): Promise<string | null> {
    const result = await this.generateResult(systemPrompt, history);
    return result.ok ? result.text : null;
  }

  /** Typed variant — lets callers distinguish a rate limit from a hard error. */
  async generateResult(
    systemPrompt: string,
    history: GeminiTurn[],
    maxRetries = MAX_RETRIES,
  ): Promise<GeminiResult> {
    const key = process.env.GEMINI_API_KEY;
    if (!key) return { ok: false, reason: "provider_unconfigured" };

    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
      try {
        const res = await fetchWithTimeout(
          `${this.endpoint("generateContent")}?key=${encodeURIComponent(key)}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              systemInstruction: { parts: [{ text: systemPrompt }] },
              contents: history.map((t) => ({
                role: t.role,
                parts: [{ text: t.text }],
              })),
              generationConfig: GENERATION_CONFIG,
            }),
          },
        );

        if (res.ok) {
          const json = (await res.json().catch(() => null)) as {
            candidates?: {
              content?: { parts?: { text?: string }[] };
              finishReason?: string;
            }[];
          } | null;
          const candidate = json?.candidates?.[0];
          const text = candidate?.content?.parts
            ?.map((p) => p.text ?? "")
            .join("")
            .trim();
          if (candidate?.finishReason === "MAX_TOKENS") {
            this.logger.warn(
              "Gemini reached maxOutputTokens before completing the response.",
            );
            return {
              ok: false,
              reason: "provider_output_limited",
              ...(text ? { partialText: text } : {}),
            };
          }
          if (
            text &&
            text.length > 0 &&
            (!candidate?.finishReason || candidate.finishReason === "STOP")
          ) {
            return { ok: true, text };
          }
          if (candidate?.finishReason && candidate.finishReason !== "STOP") {
            this.logger.warn(
              `Gemini stopped with finish reason ${candidate.finishReason}.`,
            );
          }
          this.logger.warn("Gemini returned an empty completion.");
          return { ok: false, reason: "provider_error" };
        }

        // Transient — back off and retry (unless we're out of attempts).
        if (RETRYABLE_STATUS.has(res.status) && attempt < maxRetries) {
          const wait = this.backoffMs(res.headers.get("retry-after"), attempt);
          this.logger.warn(
            `Gemini HTTP ${res.status} (attempt ${attempt + 1}/${maxRetries + 1}); retrying in ${wait}ms.`,
          );
          await sleep(wait);
          continue;
        }

        if (res.status === 429) {
          this.logger.warn(
            "Gemini rate limit (429) — quota exhausted, giving up this turn.",
          );
          return { ok: false, reason: "provider_rate_limited" };
        }
        if (res.status === 503)
          return { ok: false, reason: "provider_overloaded" };
        this.logger.warn(`Gemini call failed: HTTP ${res.status}`);
        return { ok: false, reason: "provider_error" };
      } catch (err) {
        // Network error — retry if attempts remain.
        if (attempt < maxRetries) {
          const wait = this.backoffMs(null, attempt);
          this.logger.warn(
            `Gemini network error: ${err instanceof Error ? err.message : "unknown"}; retrying in ${wait}ms.`,
          );
          await sleep(wait);
          continue;
        }
        this.logger.warn(
          `Gemini error: ${err instanceof Error ? err.message : "unknown"}`,
        );
        return {
          ok: false,
          reason: isAbortError(err) ? "provider_timeout" : "provider_error",
        };
      }
    }
    return { ok: false, reason: "provider_error" };
  }

  /**
   * Stream the completion as incremental text deltas. Single attempt (the
   * non-streaming path keeps the retry budget); throws `GeminiStreamError` with
   * a precise provider reason so the caller can fall back gracefully.
   * Yields nothing if unconfigured handled by caller (`isConfigured`).
   */
  async *streamText(
    systemPrompt: string,
    history: GeminiTurn[],
  ): AsyncGenerator<string> {
    const key = process.env.GEMINI_API_KEY;
    if (!key) throw new Error("Gemini not configured");

    const controller = new AbortController();
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const armIdleTimeout = () => {
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(
        () => controller.abort(),
        GEMINI_STREAM_IDLE_TIMEOUT_MS,
      );
    };
    armIdleTimeout();
    try {
      const res = await fetch(
        `${this.endpoint("streamGenerateContent")}?alt=sse&key=${encodeURIComponent(key)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: systemPrompt }] },
            contents: history.map((t) => ({
              role: t.role,
              parts: [{ text: t.text }],
            })),
            generationConfig: GENERATION_CONFIG,
          }),
        },
      );

      if (!res.ok || !res.body) {
        if (res.status === 429) {
          this.logger.warn("Gemini stream rate limited (429).");
          throw new GeminiStreamError(
            "provider_rate_limited",
            "Gemini stream rate limited",
          );
        }
        if (res.status === 503) {
          throw new GeminiStreamError(
            "provider_overloaded",
            "Gemini stream overloaded",
          );
        }
        this.logger.warn(`Gemini stream failed: HTTP ${res.status}`);
        throw new GeminiStreamError(
          "provider_error",
          `Gemini stream HTTP ${res.status}`,
        );
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let finishReason: string | null = null;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        armIdleTimeout();
        buffer += decoder.decode(value, { stream: true });
        const split = splitGeminiSseEvents(buffer);
        buffer = split.rest;
        for (const event of split.events) {
          const parsed = parseGeminiSseEvent(event);
          if (!parsed) continue;
          if (parsed.finishReason) finishReason = parsed.finishReason;
          if (parsed.text) yield parsed.text;
        }
      }
      const tail = parseGeminiSseEvent(buffer);
      if (tail?.finishReason) finishReason = tail.finishReason;
      if (tail?.text) yield tail.text;
      assertSuccessfulStreamFinish(finishReason);
    } catch (error) {
      if (error instanceof GeminiStreamError) throw error;
      throw new GeminiStreamError(
        isAbortError(error) ? "provider_timeout" : "provider_error",
        error instanceof Error ? error.message : "Gemini stream failed",
      );
    } finally {
      if (timeout) clearTimeout(timeout);
    }
  }

  /** Honour `Retry-After` (seconds) when present; otherwise exponential backoff + jitter. */
  private backoffMs(retryAfter: string | null, attempt: number): number {
    const headerSeconds = retryAfter ? Number(retryAfter) : NaN;
    if (Number.isFinite(headerSeconds) && headerSeconds > 0) {
      return Math.min(headerSeconds * 1000, MAX_BACKOFF_MS);
    }
    const expo = BASE_BACKOFF_MS * 2 ** attempt + Math.random() * 250;
    return Math.min(expo, MAX_BACKOFF_MS);
  }
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

async function fetchWithTimeout(
  input: string,
  init: RequestInit,
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    GEMINI_JSON_REQUEST_TIMEOUT_MS,
  );
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

function assertSuccessfulStreamFinish(finishReason: string | null): void {
  if (finishReason === "STOP") return;
  if (finishReason === "MAX_TOKENS") {
    throw new GeminiStreamError(
      "provider_output_limited",
      "Gemini stream reached maxOutputTokens",
    );
  }
  throw new GeminiStreamError(
    "provider_error",
    finishReason
      ? `Gemini stream stopped with finish reason ${finishReason}`
      : "Gemini stream closed without a terminal finish reason",
  );
}
