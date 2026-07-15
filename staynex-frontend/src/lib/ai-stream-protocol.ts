import type { AssistantRecovery, PropertySummary } from "./types";

export interface ParsedAssistantEvent {
  type?: string;
  text?: string;
  conversationId?: string;
  userMessageId?: string;
  messageId?: string;
  refused?: boolean;
  unavailable?: boolean;
  groundedFacts?: string[];
  properties?: PropertySummary[];
  recovery?: AssistantRecovery;
  requestId?: string;
}

/** Split complete SSE blocks while accepting both LF and CRLF proxy output. */
export function splitSseBlocks(buffer: string): {
  blocks: string[];
  rest: string;
} {
  const normalized = buffer.replace(/\r\n/g, "\n");
  const parts = normalized.split("\n\n");
  return { blocks: parts.slice(0, -1), rest: parts.at(-1) ?? "" };
}

export function parseAssistantEvent(
  block: string,
): ParsedAssistantEvent | null {
  const data = block
    .split(/\r?\n/)
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trimStart())
    .join("\n");
  if (!data) return null;
  try {
    return JSON.parse(data) as ParsedAssistantEvent;
  } catch {
    return null;
  }
}

export function recoveryCopy(recovery: AssistantRecovery): string {
  switch (recovery) {
    case "application_throttled":
      return "You’ve reached Staynex AI’s message limit for this minute. Wait briefly, then try again.";
    case "provider_rate_limited":
      return "The AI model’s quota is temporarily busy; your Staynex message limit was not reached. Try again shortly.";
    case "provider_overloaded":
      return "The AI model is temporarily overloaded. Try again shortly.";
    case "provider_timeout":
      return "The AI model took too long to respond. Try again shortly.";
    case "provider_unconfigured":
      return "Staynex AI is temporarily offline. Search and booking are still available.";
    case "provider_output_limited":
      return "The model reached its response limit. The answer above is partial; ask Staynex AI to continue.";
    case "partial_response":
      return "The model connection ended mid-response. Treat the answer above as partial and verify any details.";
    case "transport_interrupted":
      return "The response connection ended unexpectedly. Check chat history before sending the message again.";
    case "provider_error":
      return "Staynex AI couldn’t reach its model. Search and booking are still available.";
    default:
      return "";
  }
}
