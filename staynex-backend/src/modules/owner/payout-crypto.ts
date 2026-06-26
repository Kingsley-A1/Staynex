import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

// AES-256-GCM encryption for owner bank account numbers at rest. The key comes
// from OWNER_PAYOUT_ENCRYPTION_KEY (64 hex chars = 32 bytes). When the key is not
// configured, callers must store only masked details (never the full number).
// Card data is never stored anywhere (skill.md §9).

const ALGO = "aes-256-gcm";
const KEY_RE = /^[0-9a-fA-F]{64}$/;

export function payoutEncryptionAvailable(): boolean {
  const key = process.env.OWNER_PAYOUT_ENCRYPTION_KEY;
  return typeof key === "string" && KEY_RE.test(key);
}

function keyBuffer(): Buffer {
  const key = process.env.OWNER_PAYOUT_ENCRYPTION_KEY;
  if (!key || !KEY_RE.test(key)) {
    throw new Error("OWNER_PAYOUT_ENCRYPTION_KEY is not configured (need 64 hex characters)");
  }
  return Buffer.from(key, "hex");
}

/** Encrypt to `iv:authTag:ciphertext` (all hex). */
export function encryptAccountNumber(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, keyBuffer(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${tag.toString("hex")}:${enc.toString("hex")}`;
}

/** Decrypt a payload produced by `encryptAccountNumber`. */
export function decryptAccountNumber(payload: string): string {
  const [ivHex, tagHex, dataHex] = payload.split(":");
  if (!ivHex || !tagHex || !dataHex) throw new Error("Malformed encrypted payout payload");
  const decipher = createDecipheriv(ALGO, keyBuffer(), Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  return Buffer.concat([decipher.update(Buffer.from(dataHex, "hex")), decipher.final()]).toString(
    "utf8",
  );
}

/** Last 4 digits of an account number (for masked display). */
export function last4(accountNumber: string): string {
  return accountNumber.replace(/\D/g, "").slice(-4);
}
