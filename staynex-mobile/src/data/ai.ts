// Staynex AI service functions. Response shapes are `import type`'d from the
// canonical backend contract — no local copies (skill.md §7). Grounding,
// refusals, and property cards are all server truth; the client renders them.

import type {
  AgentConversation,
  AgentMessage,
  AgentMessageFeedback,
  AgentMessageFeedbackResult,
  AssistantReply,
} from "@staynex/backend/types";
import { api } from "@/core/client";

/** One assistant turn. `operation` replaces the latest turn (retry/edit). */
export interface AssistantAsk {
  message: string;
  conversationId?: string;
  /** Ground the answer in one property's verified public facts. */
  propertySlug?: string;
  operation?:
    | { type: "retry"; assistantMessageId: string }
    | { type: "edit"; userMessageId: string };
}

export const aiApi = {
  /** Non-streaming turn — the fallback when SSE isn't available. */
  ask: (body: AssistantAsk) => api.post<AssistantReply>("/ai/assistant", body),

  conversations: () => api.get<AgentConversation[]>("/ai/conversations"),
  createConversation: (title?: string) =>
    api.post<AgentConversation>("/ai/conversations", title ? { title } : {}),
  messages: (conversationId: string) =>
    api.get<AgentMessage[]>(
      `/ai/conversations/${encodeURIComponent(conversationId)}/messages`,
    ),
  rename: (conversationId: string, title: string) =>
    api.patch<AgentConversation>(
      `/ai/conversations/${encodeURIComponent(conversationId)}`,
      { title },
    ),
  setPinned: (conversationId: string, pinned: boolean) =>
    api.post<AgentConversation>(
      `/ai/conversations/${encodeURIComponent(conversationId)}/pin`,
      { pinned },
    ),
  remove: (conversationId: string) =>
    api.delete<{ ok: true }>(`/ai/conversations/${encodeURIComponent(conversationId)}`),

  /** Idempotent tri-state feedback (UP / DOWN / null clears). */
  setFeedback: (
    conversationId: string,
    messageId: string,
    feedback: AgentMessageFeedback | null,
  ) =>
    api.put<AgentMessageFeedbackResult>(
      `/ai/conversations/${encodeURIComponent(conversationId)}/messages/${encodeURIComponent(messageId)}/feedback`,
      { feedback },
    ),
};
