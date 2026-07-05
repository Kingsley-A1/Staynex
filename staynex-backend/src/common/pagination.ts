/**
 * Keyset (cursor) pagination helpers for newest-first lists ordered by
 * (createdAt desc, id desc). The cursor is opaque to clients.
 */

export interface ListCursor {
  createdAt: Date;
  id: string;
}

export function encodeCursor(createdAt: Date, id: string): string {
  return `${createdAt.toISOString()}_${id}`;
}

export function decodeCursor(cursor: string | undefined): ListCursor | null {
  if (!cursor) return null;
  const split = cursor.lastIndexOf("_");
  if (split <= 0) return null;
  const createdAt = new Date(cursor.slice(0, split));
  const id = cursor.slice(split + 1);
  if (Number.isNaN(createdAt.getTime()) || !id) return null;
  return { createdAt, id };
}

/** Prisma where-fragment selecting rows strictly after the cursor. */
export function afterCursor(cursor: ListCursor | null):
  | {
      OR: [
        { createdAt: { lt: Date } },
        { createdAt: Date; id: { lt: string } },
      ];
    }
  | undefined {
  if (!cursor) return undefined;
  return {
    OR: [
      { createdAt: { lt: cursor.createdAt } },
      { createdAt: cursor.createdAt, id: { lt: cursor.id } },
    ],
  };
}
