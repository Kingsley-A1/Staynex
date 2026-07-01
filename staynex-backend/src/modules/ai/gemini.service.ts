import { Injectable, Logger } from "@nestjs/common";

export interface GeminiTurn {
  role: "user" | "model";
  text: string;
}

// Free tier (verified June 2026): gemini-2.0-flash allows ~15 RPM / 1M TPM /
// 1500 RPD. A 429 = one of those dimensions was exhausted; it is transient and
// resolves on its own. If sustained 429s become a problem, gemini-2.5-flash or
// the newer Gemini 3 Flash (recommended free-tier model in 2026) are drop-in
// model swaps — see docs/staynex-ai-plan.md.
const MODEL = "gemini-2.0-flash";
const BASE = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}`;
const ENDPOINT = `${BASE}:generateContent`;
const STREAM_ENDPOINT = `${BASE}:streamGenerateContent`;

// 429 (rate limit) and 503 (model overloaded) are transient; retry with backoff.
const RETRYABLE_STATUS = new Set([429, 503]);
const MAX_RETRIES = 2;
const BASE_BACKOFF_MS = 600;
const MAX_BACKOFF_MS = 4000;
const GEMINI_REQUEST_TIMEOUT_MS = 30_000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export type GeminiResult =
  | { ok: true; text: string }
  | { ok: false; reason: "rate_limited" | "unconfigured" | "error" };

/** Thrown by the streaming path when the provider rate-limits (HTTP 429). */
export class GeminiRateLimitError extends Error {
  constructor() {
    super("Gemini rate limited");
    this.name = "GeminiRateLimitError";
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
    return json?.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
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

  isConfigured(): boolean {
    return Boolean(process.env.GEMINI_API_KEY);
  }

  /** Back-compat: returns the reply text, or null on any failure. */
  async generate(systemPrompt: string, history: GeminiTurn[]): Promise<string | null> {
    const result = await this.generateResult(systemPrompt, history);
    return result.ok ? result.text : null;
  }

  /** Typed variant — lets callers distinguish a rate limit from a hard error. */
  async generateResult(systemPrompt: string, history: GeminiTurn[]): Promise<GeminiResult> {
    const key = process.env.GEMINI_API_KEY;
    if (!key) return { ok: false, reason: "unconfigured" };

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
      try {
        const res = await fetchWithTimeout(
          `${ENDPOINT}?key=${encodeURIComponent(key)}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              systemInstruction: { parts: [{ text: systemPrompt }] },
              contents: history.map((t) => ({
                role: t.role,
                parts: [{ text: t.text }],
              })),
              generationConfig: { temperature: 0.4, maxOutputTokens: 512 },
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
          return { ok: false, reason: "error" };
        }

        // Transient — back off and retry (unless we're out of attempts).
        if (RETRYABLE_STATUS.has(res.status) && attempt < MAX_RETRIES) {
          const wait = this.backoffMs(res.headers.get("retry-after"), attempt);
          this.logger.warn(
            `Gemini HTTP ${res.status} (attempt ${attempt + 1}/${MAX_RETRIES + 1}); retrying in ${wait}ms.`,
          );
          await sleep(wait);
          continue;
        }

        if (res.status === 429) {
          this.logger.warn("Gemini rate limit (429) — quota exhausted, giving up this turn.");
          return { ok: false, reason: "rate_limited" };
        }
        this.logger.warn(`Gemini call failed: HTTP ${res.status}`);
        return { ok: false, reason: "error" };
      } catch (err) {
        // Network error — retry if attempts remain.
        if (attempt < MAX_RETRIES) {
          const wait = this.backoffMs(null, attempt);
          this.logger.warn(
            `Gemini network error: ${err instanceof Error ? err.message : "unknown"}; retrying in ${wait}ms.`,
          );
          await sleep(wait);
          continue;
        }
        this.logger.warn(`Gemini error: ${err instanceof Error ? err.message : "unknown"}`);
        return { ok: false, reason: "error" };
      }
    }
    return { ok: false, reason: "error" };
  }

  /**
   * Stream the completion as incremental text deltas. Single attempt (the
   * non-streaming path keeps the retry budget); throws `GeminiRateLimitError` on
   * 429 and a generic Error otherwise, so the caller can fall back gracefully.
   * Yields nothing if unconfigured handled by caller (`isConfigured`).
   */
  async *streamText(systemPrompt: string, history: GeminiTurn[]): AsyncGenerator<string> {
    const key = process.env.GEMINI_API_KEY;
    if (!key) throw new Error("Gemini not configured");

    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      GEMINI_REQUEST_TIMEOUT_MS,
    );
    try {
      const res = await fetch(
        `${STREAM_ENDPOINT}?alt=sse&key=${encodeURIComponent(key)}`,
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
            generationConfig: { temperature: 0.4, maxOutputTokens: 512 },
          }),
        },
      );

      if (!res.ok || !res.body) {
        if (res.status === 429) {
          this.logger.warn("Gemini stream rate limited (429).");
          throw new GeminiRateLimitError();
        }
        this.logger.warn(`Gemini stream failed: HTTP ${res.status}`);
        throw new Error(`Gemini stream HTTP ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let sep: number;
        // SSE events are separated by a blank line.
        while ((sep = buffer.indexOf("\n\n")) !== -1) {
          const event = buffer.slice(0, sep);
          buffer = buffer.slice(sep + 2);
          const text = textFromSseEvent(event);
          if (text) yield text;
        }
      }
      const tail = textFromSseEvent(buffer);
      if (tail) yield tail;
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
