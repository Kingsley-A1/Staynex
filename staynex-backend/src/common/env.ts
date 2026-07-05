/**
 * Read a positive integer from the environment, falling back when the variable
 * is unset or malformed. Shared by every interval/background service so tuning
 * knobs parse identically platform-wide.
 */
export function readPositiveIntEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/** Like {@link readPositiveIntEnv} but 0 is a valid value (e.g. "no delay"). */
export function readNonNegativeIntEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}
