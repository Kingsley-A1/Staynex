/** Split provider SSE frames without assuming LF-only line endings. */
export function splitGeminiSseEvents(buffer: string): {
  events: string[];
  rest: string;
} {
  const events: string[] = [];
  let rest = buffer;
  for (;;) {
    const match = /\r?\n\r?\n/.exec(rest);
    if (!match || match.index === undefined) break;
    events.push(rest.slice(0, match.index));
    rest = rest.slice(match.index + match[0].length);
  }
  return { events, rest };
}

export interface GeminiSseEvent {
  text: string;
  finishReason: string | null;
}

/** Read both text deltas and the provider's terminal reason from one SSE frame. */
export function parseGeminiSseEvent(block: string): GeminiSseEvent | null {
  const data = block
    .split(/\r?\n/)
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trim())
    .join("");
  if (!data) return null;
  try {
    const json = JSON.parse(data) as {
      candidates?: {
        content?: { parts?: { text?: string }[] };
        finishReason?: string;
      }[];
    };
    const candidate = json.candidates?.[0];
    return {
      text:
        candidate?.content?.parts?.map((part) => part.text ?? "").join("") ??
        "",
      finishReason: candidate?.finishReason ?? null,
    };
  } catch {
    return null;
  }
}
