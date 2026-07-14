import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { AIMessageFeedback, AIMessageRole, Prisma } from "@prisma/client";
import { prisma } from "../../../db";
import type {
  AgentConversation,
  AgentMessage,
  AgentMessageFeedbackResult,
  AuthUser,
  PropertySummary,
} from "../../../types";

export interface AssistantTurn {
  conversationId: string;
  userMessageId: string;
  message: string;
  replaceAgentMessageId?: string;
  editUserMessageId?: string;
}

export type AssistantReplacementOperation =
  | { type: "retry"; assistantMessageId: string }
  | { type: "edit"; userMessageId: string };

interface RecentForModelOptions {
  excludeMessageIds?: string[];
  overrideUserMessage?: { id: string; content: string };
}

/**
 * Staynex AI conversation store. Conversations are private to their owner:
 * authenticated users see only their own history; anonymous conversations
 * (userId = null) are accessible by id only (capability-based) so a guest can
 * keep one session conversation without leaking others'.
 */
@Injectable()
export class ConversationsService {
  /** Authenticated history list. Anonymous principals get nothing. */
  async list(user: AuthUser | null): Promise<AgentConversation[]> {
    if (!user) return [];
    const rows = await prisma.aIConversation.findMany({
      where: { userId: user.id, deletedAt: null },
      orderBy: [{ pinned: "desc" }, { updatedAt: "desc" }],
      take: 100,
      include: {
        messages: {
          where: { supersededAt: null },
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { content: true },
        },
      },
    });
    return rows.map((row) =>
      toConversation(
        row,
        row.messages[0] ? truncate(row.messages[0].content, 100) : null,
      ),
    );
  }

  async create(
    user: AuthUser | null,
    title?: string,
  ): Promise<AgentConversation> {
    const created = await prisma.aIConversation.create({
      data: { userId: user?.id ?? null, title: title ?? null },
    });
    return toConversation(created);
  }

  async rename(
    user: AuthUser | null,
    id: string,
    title: string,
  ): Promise<AgentConversation> {
    await this.assertAccess(user, id);
    const updated = await prisma.aIConversation.update({
      where: { id },
      data: { title },
    });
    return toConversation(updated);
  }

  async setPinned(
    user: AuthUser | null,
    id: string,
    pinned: boolean,
  ): Promise<AgentConversation> {
    await this.assertAccess(user, id);
    const updated = await prisma.aIConversation.update({
      where: { id },
      data: { pinned },
    });
    return toConversation(updated);
  }

  async softDelete(user: AuthUser | null, id: string): Promise<{ ok: true }> {
    await this.assertAccess(user, id);
    await prisma.aIConversation.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    return { ok: true };
  }

  async messages(user: AuthUser | null, id: string): Promise<AgentMessage[]> {
    await this.assertAccess(user, id);
    const rows = await prisma.aIMessage.findMany({
      where: { conversationId: id, supersededAt: null },
      orderBy: { createdAt: "asc" },
      take: 200,
    });
    return rows.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      feedback: m.feedback,
      properties: parsePropertyCards(m.propertyCards),
      createdAt: m.createdAt.toISOString(),
    }));
  }

  /** Throws unless the principal may access this (non-deleted) conversation. */
  async assertAccess(user: AuthUser | null, id: string) {
    const convo = await prisma.aIConversation.findUnique({ where: { id } });
    if (!convo || convo.deletedAt)
      throw new NotFoundException("Conversation not found");
    // Owner-scoped conversations require the matching user; anonymous ones
    // (userId null) are accessible by whoever holds the id.
    if (convo.userId != null && convo.userId !== user?.id) {
      throw new ForbiddenException("Not your conversation");
    }
    return convo;
  }

  // --- helpers used by the agent send flow --------------------------------

  async saveMessage(
    conversationId: string,
    role: AIMessageRole,
    content: string,
  ): Promise<string> {
    const message = await prisma.aIMessage.create({
      data: { conversationId, role, content },
      select: { id: true },
    });
    await prisma.aIConversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });
    return message.id;
  }

  /**
   * Validate a retry/edit against the latest visible completed turn. Older
   * history cannot be rewritten, and the existing response remains visible
   * until a replacement is successfully persisted.
   */
  async prepareReplacement(
    user: AuthUser | null,
    conversationId: string,
    operation: AssistantReplacementOperation,
    editedMessage: string,
  ): Promise<AssistantTurn> {
    const conversation = await this.assertAccess(user, conversationId);
    if (conversation.userId == null && user) {
      await prisma.aIConversation.update({
        where: { id: conversationId },
        data: { userId: user.id },
      });
    }
    const latest = await prisma.aIMessage.findMany({
      where: { conversationId, supersededAt: null },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 2,
      select: { id: true, role: true, content: true },
    });
    const agent = latest[0];
    const userMessage = latest[1];
    if (
      !agent ||
      !userMessage ||
      agent.role !== AIMessageRole.AGENT ||
      userMessage.role !== AIMessageRole.USER
    ) {
      throw new ConflictException(
        "Only the latest completed Staynex AI turn can be changed",
      );
    }
    if (
      operation.type === "retry" &&
      operation.assistantMessageId !== agent.id
    ) {
      throw new ConflictException(
        "Only the latest Staynex AI response can be regenerated",
      );
    }
    if (
      operation.type === "edit" &&
      operation.userMessageId !== userMessage.id
    ) {
      throw new ConflictException("Only the latest user message can be edited");
    }

    return {
      conversationId,
      userMessageId: userMessage.id,
      message: operation.type === "edit" ? editedMessage : userMessage.content,
      replaceAgentMessageId: agent.id,
      ...(operation.type === "edit"
        ? { editUserMessageId: userMessage.id }
        : {}),
    };
  }

  /** Persist one assistant outcome and its log atomically. */
  async completeTurn(
    turn: AssistantTurn,
    reply: string,
    actionType: string,
    summary: string,
    properties: PropertySummary[] = [],
  ): Promise<string> {
    const now = new Date();
    return prisma.$transaction(async (tx) => {
      if (turn.replaceAgentMessageId) {
        const replaced = await tx.aIMessage.updateMany({
          where: {
            id: turn.replaceAgentMessageId,
            conversationId: turn.conversationId,
            role: AIMessageRole.AGENT,
            supersededAt: null,
          },
          data: { supersededAt: now },
        });
        if (replaced.count !== 1) {
          throw new ConflictException(
            "This response was already replaced; refresh the conversation",
          );
        }
      }

      if (turn.editUserMessageId) {
        const edited = await tx.aIMessage.updateMany({
          where: {
            id: turn.editUserMessageId,
            conversationId: turn.conversationId,
            role: AIMessageRole.USER,
            supersededAt: null,
          },
          data: { content: turn.message },
        });
        if (edited.count !== 1) {
          throw new ConflictException(
            "This message can no longer be edited; refresh the conversation",
          );
        }
      }

      const agentMessage = await tx.aIMessage.create({
        data: {
          conversationId: turn.conversationId,
          role: AIMessageRole.AGENT,
          content: reply,
          ...(properties.length
            ? {
                propertyCards: properties as unknown as Prisma.InputJsonValue,
              }
            : {}),
        },
        select: { id: true },
      });
      await tx.aIActionLog.create({
        data: {
          conversationId: turn.conversationId,
          actionType,
          summary,
        },
      });
      await tx.aIConversation.update({
        where: { id: turn.conversationId },
        data: { updatedAt: now },
      });
      return agentMessage.id;
    });
  }

  async setMessageFeedback(
    user: AuthUser | null,
    conversationId: string,
    messageId: string,
    feedback: AIMessageFeedback | null,
  ): Promise<AgentMessageFeedbackResult> {
    await this.assertAccess(user, conversationId);
    const updated = await prisma.aIMessage.updateMany({
      where: {
        id: messageId,
        conversationId,
        role: AIMessageRole.AGENT,
        supersededAt: null,
      },
      // Keep the action timestamp when a rating is cleared so that clearing a
      // newer rating does not accidentally reactivate an older correction.
      data: { feedback, feedbackAt: new Date() },
    });
    if (updated.count !== 1) {
      throw new NotFoundException("Assistant message not found");
    }
    return { messageId, feedback };
  }

  /** The most recently submitted visible-message rating guides later turns. */
  async latestAgentFeedback(
    conversationId: string,
  ): Promise<AIMessageFeedback | null> {
    const latest = await prisma.aIMessage.findFirst({
      where: {
        conversationId,
        role: AIMessageRole.AGENT,
        supersededAt: null,
        feedbackAt: { not: null },
      },
      orderBy: [{ feedbackAt: "desc" }, { id: "desc" }],
      select: { feedback: true },
    });
    return latest?.feedback ?? null;
  }

  /**
   * Recent turns to replay to the model for conversational memory. Returns
   * chronological (oldest→newest) messages, windowed by both a message count and
   * a character budget (token-budget proxy), and guaranteed to start on a USER
   * turn — Gemini expects history to begin with `user` and alternate.
   */
  async recentForModel(
    conversationId: string,
    maxMessages = 24,
    maxChars = 9000,
    options: RecentForModelOptions = {},
  ): Promise<{ role: AIMessageRole; content: string }[]> {
    // Newest-first so we keep the most recent context when the budget is tight.
    const rows = await prisma.aIMessage.findMany({
      where: {
        conversationId,
        supersededAt: null,
        ...(options.excludeMessageIds?.length
          ? { id: { notIn: options.excludeMessageIds } }
          : {}),
      },
      orderBy: { createdAt: "desc" },
      take: maxMessages,
      select: { id: true, role: true, content: true },
    });

    const picked: { role: AIMessageRole; content: string }[] = [];
    let chars = 0;
    for (const row of rows) {
      chars += row.content.length;
      // Always keep at least the latest turn, even if it alone exceeds the budget.
      if (chars > maxChars && picked.length > 0) break;
      picked.push(
        options.overrideUserMessage?.id === row.id
          ? { ...row, content: options.overrideUserMessage.content }
          : row,
      );
    }

    picked.reverse(); // back to chronological order
    // Drop any leading AGENT turns so the window starts on a USER turn.
    while (picked.length > 0 && picked[0].role !== AIMessageRole.USER) {
      picked.shift();
    }
    return picked;
  }

  /**
   * Compact context from the user's other recent conversations so a new chat
   * doesn't start from zero (cross-conversation memory). Each line carries the
   * conversation title plus its last exchange, truncated. Authenticated users
   * only — anonymous sessions have no identity to link conversations across.
   */
  async crossConversationContext(
    user: AuthUser | null,
    excludeConversationId: string,
    maxConversations = 3,
  ): Promise<string[]> {
    if (!user) return [];
    const rows = await prisma.aIConversation.findMany({
      where: {
        userId: user.id,
        deletedAt: null,
        id: { not: excludeConversationId },
      },
      orderBy: { updatedAt: "desc" },
      take: maxConversations,
      select: {
        title: true,
        updatedAt: true,
        messages: {
          where: { supersededAt: null },
          orderBy: { createdAt: "desc" },
          take: 2,
          select: { role: true, content: true },
        },
      },
    });

    const lines: string[] = [];
    for (const convo of rows) {
      const exchange = [...convo.messages].reverse();
      if (exchange.length === 0) continue;
      const parts = exchange.map(
        (m) =>
          `${m.role === AIMessageRole.USER ? "they asked" : "you answered"}: "${truncate(m.content, 140)}"`,
      );
      lines.push(
        `In "${convo.title ?? "an earlier chat"}", ${parts.join("; ")}`,
      );
    }
    return lines;
  }

  /** Set a title from the first user message if one isn't set yet. */
  async ensureTitle(
    conversationId: string,
    fromMessage: string,
  ): Promise<void> {
    const convo = await prisma.aIConversation.findUnique({
      where: { id: conversationId },
      select: { title: true },
    });
    if (convo && !convo.title) {
      const title = fromMessage.replace(/\s+/g, " ").trim().slice(0, 60);
      await prisma.aIConversation.update({
        where: { id: conversationId },
        data: { title },
      });
    }
  }
}

function toConversation(
  c: {
    id: string;
    title: string | null;
    pinned: boolean;
    updatedAt: Date;
  },
  preview: string | null = null,
): AgentConversation {
  return {
    id: c.id,
    title: c.title,
    pinned: c.pinned,
    updatedAt: c.updatedAt.toISOString(),
    preview,
  };
}

function truncate(text: string, max: number): string {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

function parsePropertyCards(value: Prisma.JsonValue | null): PropertySummary[] {
  if (!Array.isArray(value)) return [];
  const cards: PropertySummary[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const record = item as Record<string, unknown>;
    if (
      typeof record.id === "string" &&
      typeof record.name === "string" &&
      typeof record.slug === "string" &&
      typeof record.cityName === "string" &&
      (typeof record.fromPriceKobo === "number" ||
        record.fromPriceKobo === null)
    ) {
      cards.push(item as unknown as PropertySummary);
    }
  }
  return cards;
}
