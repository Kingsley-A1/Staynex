// Staynex AI assistant transport, including the SSE stream.

import { request, apiUrl, csrfHeaderFor } from "./client";
import { ApiError } from "./client";
import { parseAssistantEvent, splitSseBlocks } from "@/lib/ai-stream-protocol";
import type {
  AgentConversation,
  AgentMessage,
  AgentMessageFeedback,
  AgentMessageFeedbackResult,
  AssistantReply,
  AssistantRecovery,
  PropertySummary,
} from "@/lib/types";

export interface AgentStreamMeta {
  conversationId: string;
  userMessageId: string;
  messageId: string;
  refused: boolean;
  unavailable: boolean;
  groundedFacts: string[];
  properties: PropertySummary[];
  recovery: AssistantRecovery;
  requestId: string;
}

export type AssistantOperation =
  | { type: "retry"; assistantMessageId: string }
  | { type: "edit"; userMessageId: string };

export interface AssistantRequest {
  message: string;
  conversationId?: string;
  propertySlug?: string;
  pagePath?: string;
  operation?: AssistantOperation;
}

const AI_STREAM_IDLE_TIMEOUT_MS = 30_000;

export class AssistantTransportError extends Error {
  constructor(
    public readonly recovery: AssistantRecovery,
    public readonly requestId: string,
    message: string,
  ) {
    super(message);
    this.name = "AssistantTransportError";
  }
}

/**
 * Streams an assistant reply over Server-Sent Events. `onChunk` fires for each
 * incremental text delta; `onDone` fires once with the final metadata. Throws
 * `ApiError` (e.g. 429) before any streaming begins.
 */
export async function askAgentStream(
  body: AssistantRequest,
  handlers: {
    onChunk: (text: string) => void;
    onDone: (meta: AgentStreamMeta) => void;
  },
): Promise<void> {
  const csrfHeaders = await csrfHeaderFor("POST");
  const requestId = crypto.randomUUID();
  const controller = new AbortController();
  let timeout = 0;
  const armIdleTimeout = () => {
    window.clearTimeout(timeout);
    timeout = window.setTimeout(
      () => controller.abort(),
      AI_STREAM_IDLE_TIMEOUT_MS,
    );
  };
  armIdleTimeout();
  try {
    const res = await fetch(apiUrl("/ai/assistant/stream"), {
      method: "POST",
      credentials: "include",
      signal: controller.signal,
      headers: {
        Accept: "text/event-stream",
        "Content-Type": "application/json",
        "X-Request-ID": requestId,
        ...csrfHeaders,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok || !res.body) {
      let detail: string | null = null;
      let diagnostics: {
        code?: string;
        recovery?: AssistantRecovery;
        requestId?: string;
        retryAfterSeconds?: number;
      } = {};
      try {
        const data = (await res.json()) as typeof diagnostics & {
          message?: string;
        };
        if (typeof data.message === "string") detail = data.message;
        diagnostics = data;
      } catch {
        /* non-JSON error body */
      }
      throw new ApiError(res.status, res.statusText, detail, diagnostics);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let doneMeta: AgentStreamMeta | null = null;

    function handleBlock(block: string) {
      const event = parseAssistantEvent(block);
      if (!event) return;
      if (event.type === "chunk" && typeof event.text === "string") {
        handlers.onChunk(event.text);
      } else if (event.type === "done") {
        doneMeta = {
          conversationId: event.conversationId ?? body.conversationId ?? "",
          userMessageId: event.userMessageId ?? "",
          messageId: event.messageId ?? "",
          refused: Boolean(event.refused),
          unavailable: Boolean(event.unavailable),
          groundedFacts: event.groundedFacts ?? [],
          properties: event.properties ?? [],
          recovery: event.recovery ?? "none",
          requestId:
            event.requestId ?? res.headers.get("x-request-id") ?? requestId,
        };
      }
    }

    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      armIdleTimeout();
      buffer += decoder.decode(value, { stream: true });
      const split = splitSseBlocks(buffer);
      buffer = split.rest;
      split.blocks.forEach(handleBlock);
    }
    if (buffer.trim()) handleBlock(buffer);
    if (!doneMeta) {
      throw new AssistantTransportError(
        "transport_interrupted",
        res.headers.get("x-request-id") ?? requestId,
        "Assistant stream ended without a final event",
      );
    }
    handlers.onDone(doneMeta);
  } catch (error) {
    if (error instanceof ApiError || error instanceof AssistantTransportError)
      throw error;
    const timedOut = error instanceof Error && error.name === "AbortError";
    throw new AssistantTransportError(
      "transport_interrupted",
      requestId,
      timedOut ? "Assistant stream timed out" : "Assistant stream failed",
    );
  } finally {
    window.clearTimeout(timeout);
  }
}

export const agentApi = {
  ask: (body: AssistantRequest) =>
    request<AssistantReply>("/ai/assistant", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  askStream: askAgentStream,
  listConversations: () => request<AgentConversation[]>("/ai/conversations"),
  createConversation: (title?: string) =>
    request<AgentConversation>("/ai/conversations", {
      method: "POST",
      body: JSON.stringify(title ? { title } : {}),
    }),
  messages: (id: string) =>
    request<AgentMessage[]>(`/ai/conversations/${id}/messages`),
  setFeedback: (
    conversationId: string,
    messageId: string,
    feedback: AgentMessageFeedback | null,
  ) =>
    request<AgentMessageFeedbackResult>(
      `/ai/conversations/${conversationId}/messages/${messageId}/feedback`,
      {
        method: "PUT",
        body: JSON.stringify({ feedback }),
      },
    ),
  rename: (id: string, title: string) =>
    request<AgentConversation>(`/ai/conversations/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ title }),
    }),
  setPinned: (id: string, pinned: boolean) =>
    request<AgentConversation>(`/ai/conversations/${id}/pin`, {
      method: "POST",
      body: JSON.stringify({ pinned }),
    }),
  remove: (id: string) =>
    request<{ ok: true }>(`/ai/conversations/${id}`, { method: "DELETE" }),
};
