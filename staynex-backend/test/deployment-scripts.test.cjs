const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");

test("production start applies migrations before booting the API", () => {
  const pkg = JSON.parse(readFileSync(join(__dirname, "..", "package.json"), "utf8"));

  assert.equal(
    pkg.scripts["prisma:migrate:deploy"],
    "prisma migrate deploy --schema prisma/schema.prisma",
  );
  assert.match(pkg.scripts.start, /prisma:migrate:deploy/);
  assert.match(pkg.scripts.start, /node dist\/src\/main\.js/);
  assert.equal(pkg.scripts["start:runtime"], "node dist/src/main.js");
});
