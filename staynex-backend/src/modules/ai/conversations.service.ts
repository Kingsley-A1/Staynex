import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { AIMessageRole } from "@prisma/client";
import { prisma } from "../../../db";
import type { AgentConversation, AgentMessage, AuthUser } from "../../../types";

/**
 * Staynex Agent conversation store. Conversations are private to their owner:
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
    });
    return rows.map(toConversation);
  }

  async create(user: AuthUser | null, title?: string): Promise<AgentConversation> {
    const created = await prisma.aIConversation.create({
      data: { userId: user?.id ?? null, title: title ?? null },
    });
    return toConversation(created);
  }

  async rename(user: AuthUser | null, id: string, title: string): Promise<AgentConversation> {
    await this.assertAccess(user, id);
    const updated = await prisma.aIConversation.update({ where: { id }, data: { title } });
    return toConversation(updated);
  }

  async setPinned(user: AuthUser | null, id: string, pinned: boolean): Promise<AgentConversation> {
    await this.assertAccess(user, id);
    const updated = await prisma.aIConversation.update({ where: { id }, data: { pinned } });
    return toConversation(updated);
  }

  async softDelete(user: AuthUser | null, id: string): Promise<{ ok: true }> {
    await this.assertAccess(user, id);
    await prisma.aIConversation.update({ where: { id }, data: { deletedAt: new Date() } });
    return { ok: true };
  }

  async messages(user: AuthUser | null, id: string): Promise<AgentMessage[]> {
    await this.assertAccess(user, id);
    const rows = await prisma.aIMessage.findMany({
      where: { conversationId: id },
      orderBy: { createdAt: "asc" },
      take: 200,
    });
    return rows.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      createdAt: m.createdAt.toISOString(),
    }));
  }

  /** Throws unless the principal may access this (non-deleted) conversation. */
  async assertAccess(user: AuthUser | null, id: string) {
    const convo = await prisma.aIConversation.findUnique({ where: { id } });
    if (!convo || convo.deletedAt) throw new NotFoundException("Conversation not found");
    // Owner-scoped conversations require the matching user; anonymous ones
    // (userId null) are accessible by whoever holds the id.
    if (convo.userId != null && convo.userId !== user?.id) {
      throw new ForbiddenException("Not your conversation");
    }
    return convo;
  }

  // --- helpers used by the agent send flow --------------------------------

  async saveMessage(conversationId: string, role: AIMessageRole, content: string): Promise<void> {
    await prisma.aIMessage.create({ data: { conversationId, role, content } });
    await prisma.aIConversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });
  }

  /**
   * Recent turns to replay to the model for conversational memory. Returns
   * chronological (oldest→newest) messages, windowed by both a message count and
   * a character budget (token-budget proxy), and guaranteed to start on a USER
   * turn — Gemini expects history to begin with `user` and alternate.
   */
  async recentForModel(
    conversationId: string,
    maxMessages = 12,
    maxChars = 6000,
  ): Promise<{ role: AIMessageRole; content: string }[]> {
    // Newest-first so we keep the most recent context when the budget is tight.
    const rows = await prisma.aIMessage.findMany({
      where: { conversationId },
      orderBy: { createdAt: "desc" },
      take: maxMessages,
      select: { role: true, content: true },
    });

    const picked: { role: AIMessageRole; content: string }[] = [];
    let chars = 0;
    for (const row of rows) {
      chars += row.content.length;
      // Always keep at least the latest turn, even if it alone exceeds the budget.
      if (chars > maxChars && picked.length > 0) break;
      picked.push(row);
    }

    picked.reverse(); // back to chronological order
    // Drop any leading AGENT turns so the window starts on a USER turn.
    while (picked.length > 0 && picked[0].role !== AIMessageRole.USER) {
      picked.shift();
    }
    return picked;
  }

  /** Set a title from the first user message if one isn't set yet. */
  async ensureTitle(conversationId: string, fromMessage: string): Promise<void> {
    const convo = await prisma.aIConversation.findUnique({
      where: { id: conversationId },
      select: { title: true },
    });
    if (convo && !convo.title) {
      const title = fromMessage.replace(/\s+/g, " ").trim().slice(0, 60);
      await prisma.aIConversation.update({ where: { id: conversationId }, data: { title } });
    }
  }
}

function toConversation(c: {
  id: string;
  title: string | null;
  pinned: boolean;
  updatedAt: Date;
}): AgentConversation {
  return {
    id: c.id,
    title: c.title,
    pinned: c.pinned,
    updatedAt: c.updatedAt.toISOString(),
  };
}
