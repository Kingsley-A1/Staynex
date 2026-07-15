import type {
  GeminiFailureReason,
  GeminiResult,
  GeminiTurn,
} from "./gemini.service";

export type AssistantRecovery =
  | "none"
  | "application_throttled"
  | "provider_rate_limited"
  | "provider_overloaded"
  | "provider_timeout"
  | "provider_unconfigured"
  | "provider_error"
  | "provider_output_limited"
  | "partial_response"
  | "transport_interrupted";

export interface CompletionProvider {
  streamText(
    systemPrompt: string,
    history: GeminiTurn[],
  ): AsyncGenerator<string>;
  generateResult(
    systemPrompt: string,
    history: GeminiTurn[],
    maxRetries?: number,
  ): Promise<GeminiResult>;
}

export type ReliableCompletionEvent =
  | { type: "chunk"; text: string }
  | {
      type: "result";
      text: string;
      recovery: AssistantRecovery;
      usedFallback: boolean;
      partial: boolean;
    };

/**
 * Prefer streaming, but use the non-streaming provider endpoint if the stream
 * fails before emitting text. This stays inside one assistant turn: callers
 * persist the user message, agent message, and action log exactly once.
 */
export async function* completeReliably(
  provider: CompletionProvider,
  systemPrompt: string,
  history: GeminiTurn[],
): AsyncGenerator<ReliableCompletionEvent> {
  let full = "";
  let streamFailure: GeminiFailureReason = "provider_error";

  try {
    for await (const delta of provider.streamText(systemPrompt, history)) {
      if (!delta) continue;
      full += delta;
      yield { type: "chunk", text: delta };
    }
  } catch (error) {
    streamFailure = failureReason(error);
    if (full) {
      yield {
        type: "result",
        text: full,
        recovery:
          streamFailure === "provider_output_limited"
            ? "provider_output_limited"
            : "partial_response",
        usedFallback: false,
        partial: true,
      };
      return;
    }
  }

  if (full) {
    yield {
      type: "result",
      text: full,
      recovery: "none",
      usedFallback: false,
      partial: false,
    };
    return;
  }

  // Empty or pre-token failed streams are safe to retry through JSON because
  // no assistant text has reached the caller and persistence is still pending.
  // The stream already consumed part of the proxy deadline. One JSON attempt
  // keeps this whole browser request bounded while still providing fallback.
  const fallback = await provider.generateResult(systemPrompt, history, 0);
  if (fallback.ok) {
    yield { type: "chunk", text: fallback.text };
    yield {
      type: "result",
      text: fallback.text,
      recovery: "none",
      usedFallback: true,
      partial: false,
    };
    return;
  }

  if (fallback.partialText) {
    yield { type: "chunk", text: fallback.partialText };
    yield {
      type: "result",
      text: fallback.partialText,
      recovery: fallback.reason,
      usedFallback: true,
      partial: true,
    };
    return;
  }

  yield {
    type: "result",
    text: "",
    recovery: fallback.reason ?? streamFailure,
    usedFallback: true,
    partial: false,
  };
}

export function failureReason(error: unknown): GeminiFailureReason {
  if (
    error instanceof Error &&
    "reason" in error &&
    typeof (error as Error & { reason?: unknown }).reason === "string"
  ) {
    const reason = (error as Error & { reason: string }).reason;
    if (isGeminiFailureReason(reason)) return reason;
  }
  return "provider_error";
}

function isGeminiFailureReason(value: string): value is GeminiFailureReason {
  return [
    "provider_rate_limited",
    "provider_overloaded",
    "provider_timeout",
    "provider_unconfigured",
    "provider_error",
    "provider_output_limited",
  ].includes(value);
}

export function recoveryMessage(recovery: AssistantRecovery): string {
  switch (recovery) {
    case "provider_rate_limited":
      return "Staynex AI's model quota is temporarily busy. Your Staynex message limit was not reached. Please try again shortly.";
    case "provider_overloaded":
      return "Staynex AI's model provider is temporarily overloaded. Please try again shortly.";
    case "provider_timeout":
      return "The model took too long to respond. Please try again shortly.";
    case "provider_unconfigured":
      return "Staynex AI is temporarily unavailable. You can still search stays, view rooms, and book directly on the property page.";
    case "provider_output_limited":
      return "The model reached its response limit before finishing. The partial answer is shown above; ask me to continue from where it stopped.";
    case "partial_response":
      return "The model connection ended after part of the response. The partial answer is shown above; verify details before acting on it.";
    default:
      return "Staynex AI couldn't reach its model right now. Please try again, or continue booking directly on the property page.";
  }
}
