import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(path) {
  return readFile(new URL(path, import.meta.url), "utf8");
}

test("AI mark places AI strokes inside a complete orbit of dots", async () => {
  const icons = await source("../src/components/icons.tsx");
  const mark = icons.slice(
    icons.indexOf("export function IconAi"),
    icons.indexOf("export function IconBell"),
  );
  assert.equal((mark.match(/<circle/g) ?? []).length, 8);
  assert.match(mark, /M15\.35 9v6/);
});

test("shared buttons wrap safely and retain touch target height", async () => {
  const button = await source("../src/ui/button.tsx");
  assert.match(button, /whitespace-normal/);
  assert.match(button, /break-words/);
  assert.match(button, /min-h-11/);
  assert.doesNotMatch(button, /md: "h-11/);
});

test("room creation closes after save and R2 signed PUT origins are allowed by CSP", async () => {
  const [rooms, config] = await Promise.all([
    source("../src/features/properties/room-manager.tsx"),
    source("../next.config.ts"),
  ]);
  assert.match(rooms, /setAdding\(false\);\s*router\.refresh/);
  assert.match(config, /r2\.cloudflarestorage\.com/);
  assert.match(config, /mediaUploadOrigin/);
});
