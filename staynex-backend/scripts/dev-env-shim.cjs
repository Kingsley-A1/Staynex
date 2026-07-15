// Dev-only preload shim — NOT part of the application.
//
// The backend reads configuration from process.env only (config/env.ts has no
// dotenv), which is correct for Railway but means a bare local `nest start`
// boots without `staynex-backend/.env`. This shim loads that file into
// process.env (never overriding variables that are already set), so local dev
// behaves like the deployed environment.
//
// Usage (combine with the DNS shim as needed):
//   NODE_OPTIONS="--require ./staynex-backend/scripts/dev-env-shim.cjs" pnpm dev:backend
//
const { readFileSync } = require("node:fs");
const { join } = require("node:path");

try {
  const envPath = join(__dirname, "..", ".env");
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (process.env[key] !== undefined) continue; // real env always wins
    process.env[key] = rawValue.trim().replace(/^"(.*)"$/, "$1");
  }
} catch {
  /* no .env — the process runs on whatever env it already has */
}
