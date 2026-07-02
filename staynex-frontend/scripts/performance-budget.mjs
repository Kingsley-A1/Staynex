import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { gzipSync } from "node:zlib";

const appDir = fileURLToPath(new URL("..", import.meta.url));
const manifestPath = join(appDir, ".next", "app-build-manifest.json");
const staticDir = join(appDir, ".next");
const budgetKb = Number(process.env.HOME_ROUTE_JS_BUDGET_KB ?? 145);

if (!existsSync(manifestPath)) {
  console.error("Missing .next/app-build-manifest.json. Run `pnpm build` first.");
  process.exit(1);
}

const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const homeFiles = manifest.pages?.["/page"] ?? [];
const jsFiles = [...new Set(homeFiles.filter((file) => file.endsWith(".js")))];
const totalBytes = jsFiles.reduce((sum, file) => {
  const path = join(staticDir, file);
  return existsSync(path)
    ? sum + gzipSync(readFileSync(path), { level: 9 }).byteLength
    : sum;
}, 0);
const totalKb = totalBytes / 1024;

if (totalKb > budgetKb) {
  console.error(
    `Home route gzip JS budget exceeded: ${totalKb.toFixed(1)} KiB > ${budgetKb} KiB.`,
  );
  process.exit(1);
}

console.log(
  `Home route gzip JS: ${totalKb.toFixed(1)} KiB / ${budgetKb} KiB budget.`,
);
