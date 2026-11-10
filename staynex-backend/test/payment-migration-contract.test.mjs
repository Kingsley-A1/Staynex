import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const migrationUrl = new URL(
  "../prisma/migrations/20260821090000_payment_provider_mode/migration.sql",
  import.meta.url,
);

test("payment provider-mode migration is additive and preserves payment evidence", async () => {
  let sql = null;
  try {
    sql = await readFile(fileURLToPath(migrationUrl), "utf8");
  } catch {
    // The assertion below records the intended RED state as a test failure.
  }

  assert.ok(sql, "payment provider-mode migration must exist");
  assert.match(sql, /ADD COLUMN "providerReference" STRING/);
  assert.match(sql, /ADD COLUMN "mode" "PaymentMode" NOT NULL DEFAULT 'TEST'/);
  assert.match(sql, /SET "provider" = 'paystack' WHERE "provider" IS NULL/);
  assert.match(sql, /ALTER COLUMN "provider" SET NOT NULL/);
  assert.match(sql, /Payment_provider_mode_status_idx/);
  assert.doesNotMatch(sql, /DROP COLUMN|DROP TABLE|TRUNCATE|DELETE FROM/i);
});
