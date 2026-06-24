// Staynex seed — launch cities + sample properties.
// Idempotent: safe to run repeatedly (upserts on unique keys, guards the rest).
// Run with: pnpm --filter @staynex/backend prisma:seed  (requires DATABASE_URL).

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const NGN = (naira) => naira * 100; // store money as minor units (kobo)

const REGIONS = [
  { slug: "cross-river", name: "Cross River" },
  { slug: "akwa-ibom", name: "Akwa Ibom" },
  { slug: "rivers", name: "Rivers" },
  { slug: "lagos-state", name: "Lagos" },
  { slug: "fct", name: "Federal Capital Territory" },
];

const CITIES = [
  { slug: "calabar", name: "Calabar", region: "cross-river" },
  { slug: "uyo", name: "Uyo", region: "akwa-ibom" },
  { slug: "port-harcourt", name: "Port Harcourt", region: "rivers" },
  { slug: "lagos", name: "Lagos", region: "lagos-state" },
  { slug: "abuja", name: "Abuja", region: "fct" },
];

// Local areas per city (admin-editable later). LGA = local government area.
const LGA = "LOCAL_GOVERNMENT_AREA";
const HOOD = "NEIGHBORHOOD";
const AREAS = {
  calabar: [
    { name: "Calabar Municipal", type: LGA, notable: true },
    { name: "Calabar South", type: LGA, notable: true },
    { name: "Marina", type: HOOD, notable: true },
    { name: "State Housing", type: HOOD },
    { name: "Diamond Hill", type: HOOD },
  ],
  uyo: [
    { name: "Uyo", type: LGA, notable: true },
    { name: "Ewet Housing", type: HOOD, notable: true },
    { name: "Itam", type: HOOD },
  ],
  "port-harcourt": [
    { name: "Port Harcourt City", type: LGA, notable: true },
    { name: "Old GRA", type: HOOD, notable: true },
    { name: "Diobu", type: HOOD },
  ],
  lagos: [
    { name: "Eti-Osa", type: LGA, notable: true },
    { name: "Victoria Island", type: HOOD, notable: true },
    { name: "Lekki", type: HOOD, notable: true },
    { name: "Ikeja", type: HOOD },
  ],
  abuja: [
    { name: "Municipal Area Council", type: LGA, notable: true },
    { name: "Maitama", type: HOOD, notable: true },
    { name: "Wuse", type: HOOD },
    { name: "Garki", type: HOOD },
  ],
};

const areaSlug = (name, citySlug) =>
  `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}-${citySlug}`;

const PROPERTIES = [
  {
    slug: "marina-crest-hotel",
    name: "Marina Crest Hotel",
    city: "calabar",
    area: "Marina",
    description: "Waterfront hotel with calm rooms and easy access to the marina.",
    rooms: [
      { name: "Standard Room", priceNaira: 48000, maxGuests: 2, units: 5 },
      { name: "Deluxe Room", priceNaira: 72000, maxGuests: 3, units: 3 },
    ],
  },
  {
    slug: "duke-town-suites",
    name: "Duke Town Suites",
    city: "calabar",
    area: "Calabar Municipal",
    description: "Modern self-contained suites in the heart of Calabar.",
    rooms: [{ name: "Studio Suite", priceNaira: 36000, maxGuests: 2, units: 6 }],
  },
  {
    slug: "harbor-nest-apartments",
    name: "Harbor Nest Apartments",
    city: "uyo",
    area: "Ewet Housing",
    description: "Quiet serviced apartments ideal for longer stays.",
    rooms: [{ name: "One-Bedroom Apartment", priceNaira: 29500, maxGuests: 2, units: 4 }],
  },
  {
    slug: "tinapa-grand-resort",
    name: "Tinapa Grand Resort",
    city: "calabar",
    area: "Calabar Municipal",
    description: "Resort stays near Tinapa with family-friendly suites.",
    rooms: [{ name: "Resort Suite", priceNaira: 72000, maxGuests: 4, units: 4 }],
  },
];

/** Next `days` dates at UTC midnight (for @db.Date availability rows). */
function upcomingDates(days) {
  const out = [];
  const base = new Date();
  base.setUTCHours(0, 0, 0, 0);
  for (let i = 0; i < days; i += 1) {
    const d = new Date(base);
    d.setUTCDate(base.getUTCDate() + i);
    out.push(d);
  }
  return out;
}

async function main() {
  // Country
  const nigeria = await prisma.country.upsert({
    where: { code: "NG" },
    update: { name: "Nigeria" },
    create: { name: "Nigeria", code: "NG" },
  });

  // Regions
  const regionBySlug = {};
  for (const r of REGIONS) {
    regionBySlug[r.slug] = await prisma.region.upsert({
      where: { slug: r.slug },
      update: { name: r.name, countryId: nigeria.id },
      create: { name: r.name, slug: r.slug, countryId: nigeria.id },
    });
  }

  // Cities
  const cityBySlug = {};
  for (const c of CITIES) {
    cityBySlug[c.slug] = await prisma.city.upsert({
      where: { slug: c.slug },
      update: { name: c.name, countryId: nigeria.id, regionId: regionBySlug[c.region].id },
      create: {
        name: c.name,
        slug: c.slug,
        countryId: nigeria.id,
        regionId: regionBySlug[c.region].id,
      },
    });
  }

  // Areas (LGAs + neighborhoods)
  const areaBySlug = {};
  for (const [citySlug, list] of Object.entries(AREAS)) {
    const city = cityBySlug[citySlug];
    if (!city) continue;
    for (const a of list) {
      const slug = areaSlug(a.name, citySlug);
      areaBySlug[slug] = await prisma.area.upsert({
        where: { slug },
        update: { name: a.name, type: a.type, notable: a.notable ?? false, cityId: city.id },
        create: { slug, name: a.name, type: a.type, notable: a.notable ?? false, cityId: city.id },
      });
    }
  }

  // Demo owner. Fixed id matches the frontend `DEMO_OWNER_ID` (x-user-id
  // stand-in) so the owner dashboard sees these properties' bookings live.
  const owner = await prisma.user.upsert({
    where: { email: "owner@staynex.demo" },
    update: { role: "OWNER", name: "Demo Owner" },
    create: { id: "demo-owner", email: "owner@staynex.demo", name: "Demo Owner", role: "OWNER" },
  });
  await prisma.ownerProfile.upsert({
    where: { userId: owner.id },
    update: { businessName: "Staynex Demo Hospitality" },
    create: { userId: owner.id, businessName: "Staynex Demo Hospitality" },
  });

  // Properties + rooms + units + availability
  const dates = upcomingDates(30);
  for (const p of PROPERTIES) {
    const areaId = p.area ? (areaBySlug[areaSlug(p.area, p.city)]?.id ?? null) : null;
    const property = await prisma.property.upsert({
      where: { slug: p.slug },
      update: {
        name: p.name,
        description: p.description,
        status: "APPROVED",
        ownerId: owner.id,
        cityId: cityBySlug[p.city].id,
        areaId,
      },
      create: {
        name: p.name,
        slug: p.slug,
        description: p.description,
        status: "APPROVED",
        ownerId: owner.id,
        cityId: cityBySlug[p.city].id,
        areaId,
      },
    });

    for (const room of p.rooms) {
      let roomType = await prisma.roomType.findFirst({
        where: { propertyId: property.id, name: room.name },
      });
      if (!roomType) {
        roomType = await prisma.roomType.create({
          data: {
            propertyId: property.id,
            name: room.name,
            basePriceKobo: NGN(room.priceNaira),
            maxGuests: room.maxGuests,
          },
        });
        for (let u = 1; u <= room.units; u += 1) {
          await prisma.roomUnit.create({
            data: { roomTypeId: roomType.id, code: `${room.name.slice(0, 3).toUpperCase()}-${u}` },
          });
        }
      } else {
        await prisma.roomType.update({
          where: { id: roomType.id },
          data: { basePriceKobo: NGN(room.priceNaira), maxGuests: room.maxGuests },
        });
      }

      // Availability for the next 30 days (idempotent on [roomTypeId, date]).
      for (const date of dates) {
        await prisma.availabilityCalendar.upsert({
          where: { roomTypeId_date: { roomTypeId: roomType.id, date } },
          update: { totalUnits: room.units },
          create: { roomTypeId: roomType.id, date, totalUnits: room.units },
        });
      }
    }
  }

  const [cities, properties, rooms] = await Promise.all([
    prisma.city.count(),
    prisma.property.count(),
    prisma.roomType.count(),
  ]);
  console.log(`Seed complete: ${cities} cities, ${properties} properties, ${rooms} room types.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
