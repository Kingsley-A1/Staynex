import { Injectable, NotFoundException } from "@nestjs/common";
import { prisma } from "../../../db";
import type { NotificationRow, NotificationsPage } from "../../../types";
import {
  afterCursor,
  decodeCursor,
  encodeCursor,
} from "../../common/pagination";

/**
 * The signed-in user's in-app notification inbox: what the bell renders.
 * Only IN_APP rows are inbox items — EMAIL/PUSH rows are delivery bookkeeping.
 */
@Injectable()
export class InboxService {
  async list(
    userId: string,
    cursor: string | undefined,
    take: number,
  ): Promise<NotificationsPage> {
    const where = { userId, channel: "IN_APP" as const };
    const cursorWhere = afterCursor(decodeCursor(cursor));
    const [rows, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where: cursorWhere ? { AND: [where, cursorWhere] } : where,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: take + 1,
      }),
      prisma.notification.count({ where: { ...where, readAt: null } }),
    ]);

    const page = rows.slice(0, take);
    const last = page[page.length - 1];
    return {
      rows: page.map(toRow),
      nextCursor:
        rows.length > take && last
          ? encodeCursor(last.createdAt, last.id)
          : null,
      unreadCount,
    };
  }

  async getOne(userId: string, id: string): Promise<NotificationRow> {
    const notification = await prisma.notification.findFirst({
      where: { id, userId, channel: "IN_APP" },
    });
    if (!notification) throw new NotFoundException("Notification not found");
    return toRow(notification);
  }

  /** Mark the given notifications read — or all of the user's unread ones. */
  async markRead(userId: string, ids?: string[]): Promise<{ updated: number }> {
    const result = await prisma.notification.updateMany({
      where: {
        userId,
        channel: "IN_APP",
        readAt: null,
        ...(ids && ids.length > 0 ? { id: { in: ids } } : {}),
      },
      data: { readAt: new Date(), status: "READ" },
    });
    return { updated: result.count };
  }
}

function toRow(n: {
  id: string;
  type: string;
  title: string;
  body: string;
  imageUrl: string | null;
  linkUrl: string | null;
  readAt: Date | null;
  createdAt: Date;
}): NotificationRow {
  return {
    id: n.id,
    type: n.type as NotificationRow["type"],
    title: n.title,
    body: n.body,
    imageUrl: n.imageUrl,
    linkUrl: n.linkUrl,
    readAt: n.readAt ? n.readAt.toISOString() : null,
    createdAt: n.createdAt.toISOString(),
  };
}
