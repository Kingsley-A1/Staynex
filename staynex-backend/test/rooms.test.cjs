const test = require("node:test");
const assert = require("node:assert/strict");
const { ConflictException } = require("@nestjs/common");
const { prisma } = require("../dist/db/client.js");
const { RoomsService } = require("../dist/src/modules/rooms/rooms.service.js");

function mockRoomsDatabase({
  activeCount = 3,
  removable = { id: "unit-3" },
  futureCapacity = [],
} = {}) {
  const originals = {
    findRoomType: prisma.roomType.findFirst,
    transaction: prisma.$transaction,
  };
  const calls = { deactivated: 0, capacityUpdates: 0, reviews: 0 };

  prisma.roomType.findFirst = async () => ({
    id: "room-type-1",
    propertyId: "property-1",
  });
  prisma.$transaction = async (callback) =>
    callback({
      roomUnit: {
        count: async () => activeCount,
        findFirst: async () => removable,
        update: async () => {
          calls.deactivated += 1;
          return removable;
        },
      },
      availabilityCalendar: {
        findMany: async () => futureCapacity,
        updateMany: async () => {
          calls.capacityUpdates += 1;
          return { count: 1 };
        },
      },
    });

  return {
    calls,
    review: {
      async recordContentChange() {
        calls.reviews += 1;
      },
    },
    restore() {
      prisma.roomType.findFirst = originals.findRoomType;
      prisma.$transaction = originals.transaction;
    },
  };
}

test("decreasing room units deactivates one unit and caps future availability", async () => {
  const database = mockRoomsDatabase();
  const service = new RoomsService(database.review);
  try {
    const result = await service.deactivateOneRoomUnit("owner-1", "room-type-1");
    assert.deepEqual(result, { unitCount: 2 });
    assert.equal(database.calls.deactivated, 1);
    assert.equal(database.calls.capacityUpdates, 1);
    assert.equal(database.calls.reviews, 1);
  } finally {
    database.restore();
  }
});

test("decreasing room units refuses to undercut committed inventory", async () => {
  const database = mockRoomsDatabase({
    activeCount: 2,
    futureCapacity: [
      {
        date: new Date("2026-08-20T00:00:00.000Z"),
        bookedUnits: 1,
        heldUnits: 1,
      },
    ],
  });
  const service = new RoomsService(database.review);
  try {
    await assert.rejects(
      () => service.deactivateOneRoomUnit("owner-1", "room-type-1"),
      (error) => error instanceof ConflictException,
    );
    assert.equal(database.calls.deactivated, 0);
  } finally {
    database.restore();
  }
});

test("decreasing room units preserves units attached to current stays", async () => {
  const database = mockRoomsDatabase({ removable: null });
  const service = new RoomsService(database.review);
  try {
    await assert.rejects(
      () => service.deactivateOneRoomUnit("owner-1", "room-type-1"),
      (error) => error instanceof ConflictException,
    );
    assert.equal(database.calls.deactivated, 0);
  } finally {
    database.restore();
  }
});
