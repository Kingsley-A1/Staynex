// Staynex seed — launch geography only.
// Idempotent: safe to run repeatedly (upserts on unique keys, guards the rest).
// Run with: pnpm --filter @staynex/backend prisma:seed  (requires DATABASE_URL).

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

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
  for (const [citySlug, list] of Object.entries(AREAS)) {
    const city = cityBySlug[citySlug];
    if (!city) continue;
    for (const a of list) {
      const slug = areaSlug(a.name, citySlug);
      await prisma.area.upsert({
        where: { slug },
        update: { name: a.name, type: a.type, notable: a.notable ?? false, cityId: city.id },
        create: { slug, name: a.name, type: a.type, notable: a.notable ?? false, cityId: city.id },
      });
    }
  }

  const [cities, areas] = await Promise.all([
    prisma.city.count(),
    prisma.area.count(),
  ]);
  console.log(`Seed complete: ${cities} cities, ${areas} areas.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
