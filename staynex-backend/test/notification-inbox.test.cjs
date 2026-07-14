const test = require("node:test");
const assert = require("node:assert/strict");
const { NotFoundException } = require("@nestjs/common");
const { prisma } = require("../dist/db/client.js");
const { InboxService } = require("../dist/src/modules/notifications/inbox.service.js");

test("notification detail is scoped to the signed-in user and in-app channel", async () => {
  const original = prisma.notification.findFirst;
  let where;
  prisma.notification.findFirst = async (query) => {
    where = query.where;
    return {
      id: "notification-1",
      type: "GENERAL",
      title: "A complete update",
      body: "Full notification body",
      linkUrl: "/host/bookings",
      readAt: null,
      createdAt: new Date("2026-07-14T12:00:00.000Z"),
    };
  };
  try {
    const row = await new InboxService().getOne("user-1", "notification-1");
    assert.deepEqual(where, {
      id: "notification-1",
      userId: "user-1",
      channel: "IN_APP",
    });
    assert.equal(row.id, "notification-1");
    assert.equal(row.linkUrl, "/host/bookings");
  } finally {
    prisma.notification.findFirst = original;
  }
});

test("notification detail does not reveal a missing or foreign notification", async () => {
  const original = prisma.notification.findFirst;
  prisma.notification.findFirst = async () => null;
  try {
    await assert.rejects(
      () => new InboxService().getOne("user-1", "foreign-notification"),
      (error) => error instanceof NotFoundException,
    );
  } finally {
    prisma.notification.findFirst = original;
  }
});
