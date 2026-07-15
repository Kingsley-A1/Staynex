const test = require("node:test");
const assert = require("node:assert/strict");
const { BadRequestException, ConflictException } = require("@nestjs/common");
const { prisma } = require("../dist/db/client.js");
const {
  MAX_AVAILABILITY_RANGE_DAYS,
  setCapacitySchema,
} = require("../dist/src/modules/availability/dto.js");
const {
  AvailabilityService,
} = require("../dist/src/modules/availability/availability.service.js");

function iso(date) {
  return date.toISOString().slice(0, 10);
}

function addDays(date, days) {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

const today = new Date();
today.setUTCHours(0, 0, 0, 0);

const validInput = {
  roomTypeId: "room-type-1",
  from: iso(today),
  to: iso(addDays(today, 29)),
  totalUnits: 2,
};

test("availability input accepts a launch window and rejects unsafe ranges", () => {
  assert.equal(setCapacitySchema.safeParse(validInput).success, true);
  assert.equal(
    setCapacitySchema.safeParse({
      ...validInput,
      from: "2026-02-30",
    }).success,
    false,
  );
  assert.equal(
    setCapacitySchema.safeParse({
      ...validInput,
      from: iso(addDays(today, -1)),
      to: iso(today),
    }).success,
    false,
  );
  assert.equal(
    setCapacitySchema.safeParse({
      ...validInput,
      from: iso(today),
      to: iso(addDays(today, 367)),
    }).success,
    false,
  );
  assert.equal(MAX_AVAILABILITY_RANGE_DAYS, 366);
});

function mockAvailabilityDatabase({ committed = [] } = {}) {
  const originals = {
    findRoomType: prisma.roomType.findFirst,
    transaction: prisma.$transaction,
  };
  const calls = {
    transactions: 0,
    createdDays: 0,
    updatedRanges: 0,
    reviews: 0,
  };

  prisma.roomType.findFirst = async () => ({
    id: validInput.roomTypeId,
    propertyId: "property-1",
    _count: { roomUnits: 2 },
  });
  prisma.$transaction = async (callback) => {
    calls.transactions += 1;
    return callback({
      availabilityCalendar: {
        findMany: async () => committed,
        createMany: async ({ data }) => {
          calls.createdDays += data.length;
          return { count: data.length };
        },
        updateMany: async () => {
          calls.updatedRanges += 1;
          return { count: committed.length };
        },
      },
    });
  };

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

test("availability cannot exceed active physical room units", async () => {
  const database = mockAvailabilityDatabase();
  const service = new AvailabilityService(database.review);
  try {
    await assert.rejects(
      () => service.setCapacity("owner-1", { ...validInput, totalUnits: 3 }),
      (error) => error instanceof BadRequestException,
    );
    assert.equal(database.calls.transactions, 0);
  } finally {
    database.restore();
  }
});

test("availability cannot be reduced below existing bookings and holds", async () => {
  const database = mockAvailabilityDatabase({
    committed: [
      {
        date: new Date("2026-07-20T00:00:00.000Z"),
        bookedUnits: 1,
        heldUnits: 1,
      },
    ],
  });
  const service = new AvailabilityService(database.review);
  try {
    await assert.rejects(
      () => service.setCapacity("owner-1", { ...validInput, totalUnits: 1 }),
      (error) => error instanceof ConflictException,
    );
    assert.equal(database.calls.transactions, 1);
    assert.equal(database.calls.createdDays, 0);
  } finally {
    database.restore();
  }
});

test("a valid availability range updates every day and invalidates review content", async () => {
  const database = mockAvailabilityDatabase();
  const service = new AvailabilityService(database.review);
  try {
    const result = await service.setCapacity("owner-1", validInput);
    assert.deepEqual(result, { updatedDays: 30 });
    assert.equal(database.calls.transactions, 1);
    assert.equal(database.calls.createdDays, 30);
    assert.equal(database.calls.updatedRanges, 1);
    assert.equal(database.calls.reviews, 1);
  } finally {
    database.restore();
  }
});
