const test = require("node:test");
const assert = require("node:assert/strict");
const { ConflictException } = require("@nestjs/common");
const { prisma } = require("../dist/db/client.js");
const { createRoomTypeSchema } = require("../dist/src/modules/rooms/dto.js");
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
    const result = await service.deactivateOneRoomUnit(
      "owner-1",
      "room-type-1",
    );
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

test("new room types default to one unit when quantity is omitted", () => {
  const parsed = createRoomTypeSchema.parse({
    propertyId: "property-1",
    name: "Deluxe Suite",
    basePriceKobo: 6000000,
    maxGuests: 2,
  });
  assert.equal(parsed.unitCount, 1);
});

test("creating a room type provisions the requested room units atomically", async () => {
  const originals = {
    findProperty: prisma.property.findFirst,
    transaction: prisma.$transaction,
  };
  const calls = { roomTypeCreate: 0, createManyRows: null, reviews: 0 };
  prisma.property.findFirst = async () => ({ id: "property-1" });
  prisma.$transaction = async (callback) =>
    callback({
      roomType: {
        create: async ({ data }) => {
          calls.roomTypeCreate += 1;
          return { id: "room-type-1", ...data };
        },
      },
      roomUnit: {
        createMany: async ({ data }) => {
          calls.createManyRows = data;
          return { count: data.length };
        },
      },
    });
  const review = {
    async recordContentChange() {
      calls.reviews += 1;
    },
  };
  const service = new RoomsService(review);

  try {
    const result = await service.createRoomType("owner-1", {
      propertyId: "property-1",
      name: "Executive Suite",
      basePriceKobo: 8500000,
      maxGuests: 3,
      unitCount: 3,
    });
    assert.equal(result.id, "room-type-1");
    assert.equal(calls.roomTypeCreate, 1);
    assert.equal(calls.reviews, 1);
    assert.equal(calls.createManyRows.length, 3);
    assert.deepEqual(calls.createManyRows, [
      { roomTypeId: "room-type-1" },
      { roomTypeId: "room-type-1" },
      { roomTypeId: "room-type-1" },
    ]);
  } finally {
    prisma.property.findFirst = originals.findProperty;
    prisma.$transaction = originals.transaction;
  }
});
