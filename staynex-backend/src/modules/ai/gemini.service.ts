import { Injectable, Logger } from "@nestjs/common";

export interface GeminiTurn {
  role: "user" | "model";
  text: string;
}

const MODEL = "gemini-2.0-flash";
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

/**
 * Minimal Google Gemini integration (HTTP, no SDK). Reads the key at call time
 * and degrades gracefully: `isConfigured()` is false when unset, and `generate`
 * returns null on any provider/network error so the assistant can surface a
 * clear "unavailable" state instead of crashing.
 */
@Injectable()
export class GeminiService {
  private readonly logger = new Logger(GeminiService.name);

  isConfigured(): boolean {
    return Boolean(process.env.GEMINI_API_KEY);
  }

  async generate(systemPrompt: string, history: GeminiTurn[]): Promise<string | null> {
    const key = process.env.GEMINI_API_KEY;
    if (!key) return null;

    try {
      const res = await fetch(`${ENDPOINT}?key=${encodeURIComponent(key)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: history.map((t) => ({ role: t.role, parts: [{ text: t.text }] })),
          generationConfig: { temperature: 0.3, maxOutputTokens: 512 },
        }),
      });

      if (!res.ok) {
        this.logger.warn(`Gemini call failed: HTTP ${res.status}`);
        return null;
      }
      const json = (await res.json().catch(() => null)) as {
        candidates?: { content?: { parts?: { text?: string }[] } }[];
      } | null;
      const text = json?.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("").trim();
      return text && text.length > 0 ? text : null;
    } catch (err) {
      this.logger.warn(`Gemini error: ${err instanceof Error ? err.message : "unknown"}`);
      return null;
    }
  }
}
