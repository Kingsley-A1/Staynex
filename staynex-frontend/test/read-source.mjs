// Shared helpers for the source-text regression tests.
//
// These suites assert on source text rather than behaviour, so they are
// sensitive to where code lives. `apiClientSource` reads the whole API client
// as one string, which keeps the assertions about *what the client does*
// instead of *which file it happens to be in* — the API client is split into
// per-domain modules under src/lib/api/.

import { readdir, readFile } from "node:fs/promises";

const API_DIR = new URL("../src/lib/api/", import.meta.url);

/** Read one source file relative to the test directory. */
export async function readSource(path, base) {
  return readFile(new URL(path, base), "utf8");
}

/** The entire API client, every module concatenated. */
export async function apiClientSource() {
  const files = (await readdir(API_DIR))
    .filter((f) => f.endsWith(".ts"))
    .sort();
  const parts = await Promise.all(
    files.map((f) => readFile(new URL(f, API_DIR), "utf8")),
  );
  return parts.join("\n");
}
