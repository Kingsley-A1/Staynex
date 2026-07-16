const test = require("node:test");
const assert = require("node:assert/strict");
const { ConflictException } = require("@nestjs/common");
const { prisma } = require("../dist/db/client.js");
const { RoomsService } = require("../dist/src/modules/rooms/rooms.service.js");
const { createRoomTypeSchema } = require("../dist/src/modules/rooms/dto.js");

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

test("room type input defaults physical room quantity to one", () => {
  const parsed = createRoomTypeSchema.parse({
    propertyId: "property-1",
    name: "Deluxe Room",
    basePriceKobo: 5000000,
    maxGuests: 2,
  });
  assert.equal(parsed.unitCount, 1);
});

test("room type creation atomically creates the requested physical units", async () => {
  const originals = {
    findProperty: prisma.property.findFirst,
    transaction: prisma.$transaction,
  };
  const calls = { units: [], reviews: 0 };
  prisma.property.findFirst = async () => ({ id: "property-1" });
  prisma.$transaction = async (callback) =>
    callback({
      roomType: {
        create: async () => ({ id: "room-type-new" }),
      },
      roomUnit: {
        createMany: async ({ data }) => {
          calls.units = data;
          return { count: data.length };
        },
      },
    });
  const service = new RoomsService({
    async recordContentChange() {
      calls.reviews += 1;
    },
  });

  try {
    await service.createRoomType("owner-1", {
      propertyId: "property-1",
      name: "Deluxe Room",
      basePriceKobo: 5000000,
      maxGuests: 2,
      unitCount: 3,
    });
    assert.equal(calls.units.length, 3);
    assert.deepEqual(calls.units, [
      { roomTypeId: "room-type-new" },
      { roomTypeId: "room-type-new" },
      { roomTypeId: "room-type-new" },
    ]);
    assert.equal(calls.reviews, 1);
  } finally {
    prisma.property.findFirst = originals.findProperty;
    prisma.$transaction = originals.transaction;
  }
});
