import { Injectable, Logger } from "@nestjs/common";
import { splitGeminiSseEvents } from "./gemini-sse";

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
// Initial + two JSON retries stay under the 60s proxy budget. A streaming turn
// uses at most one JSON fallback and stays under the browser's 45s deadline.
const GEMINI_REQUEST_TIMEOUT_MS = 15_000;
const GENERATION_CONFIG = { temperature: 0.3, maxOutputTokens: 512 } as const;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export type GeminiFailureReason =
  | "provider_rate_limited"
  | "provider_overloaded"
  | "provider_timeout"
  | "provider_unconfigured"
  | "provider_error";

export type GeminiResult =
  | { ok: true; text: string }
  | { ok: false; reason: GeminiFailureReason };

export class GeminiStreamError extends Error {
  constructor(
    public readonly reason: GeminiFailureReason,
    message: string,
  ) {
    super(message);
    this.name = "GeminiStreamError";
  }
}

/** Extract concatenated text from one Gemini SSE `data:` event block. */
function textFromSseEvent(block: string): string {
  const data = block
    .split("\n")
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trim())
    .join("");
  if (!data) return "";
  try {
    const json = JSON.parse(data) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    return (
      json?.candidates?.[0]?.content?.parts
        ?.map((p) => p.text ?? "")
        .join("") ?? ""
    );
  } catch {
    return "";
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
            candidates?: { content?: { parts?: { text?: string }[] } }[];
          } | null;
          const text = json?.candidates?.[0]?.content?.parts
            ?.map((p) => p.text ?? "")
            .join("")
            .trim();
          if (text && text.length > 0) return { ok: true, text };
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
    const timeout = setTimeout(
      () => controller.abort(),
      GEMINI_REQUEST_TIMEOUT_MS,
    );
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
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const split = splitGeminiSseEvents(buffer);
        buffer = split.rest;
        for (const event of split.events) {
          const text = textFromSseEvent(event);
          if (text) yield text;
        }
      }
      const tail = textFromSseEvent(buffer);
      if (tail) yield tail;
    } catch (error) {
      if (error instanceof GeminiStreamError) throw error;
      throw new GeminiStreamError(
        isAbortError(error) ? "provider_timeout" : "provider_error",
        error instanceof Error ? error.message : "Gemini stream failed",
      );
    } finally {
      clearTimeout(timeout);
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
    GEMINI_REQUEST_TIMEOUT_MS,
  );
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}
