import * as crypto from "crypto";

/**
 * Broker passwords must survive a round-trip (MetaApi needs the real
 * password to re-provision an account), so this is reversible
 * encryption, not hashing — AES-256-GCM with a per-record IV.
 *
 * The key never leaves Cloud Functions: it lives in Secret Manager as
 * BROKER_ENC_KEY and is never sent to the browser.
 */

const ALGORITHM = "aes-256-gcm";

function loadKey(secretValue: string): Buffer {
  const trimmed = (secretValue || "").trim();
  if (!trimmed) throw new Error("BROKER_ENC_KEY is not configured.");

  // Accept base64 (preferred), hex, or raw utf-8 — always derive 32 bytes.
  let key: Buffer | null = null;
  if (/^[A-Za-z0-9+/=]+$/.test(trimmed)) {
    const candidate = Buffer.from(trimmed, "base64");
    if (candidate.length === 32) key = candidate;
  }
  if (!key && /^[0-9a-fA-F]{64}$/.test(trimmed)) {
    key = Buffer.from(trimmed, "hex");
  }
  if (!key) {
    key = crypto.createHash("sha256").update(trimmed, "utf-8").digest();
  }
  return key;
}

export function encryptSecret(plaintext: string, secretValue: string): string {
  const key = loadKey(secretValue);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf-8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return [
    "v1",
    iv.toString("base64"),
    tag.toString("base64"),
    ciphertext.toString("base64"),
  ].join(".");
}

export function decryptSecret(payload: string, secretValue: string): string {
  const parts = (payload || "").split(".");
  if (parts.length !== 4 || parts[0] !== "v1") {
    throw new Error("Stored broker credential is malformed.");
  }
  const key = loadKey(secretValue);
  const iv = Buffer.from(parts[1], "base64");
  const tag = Buffer.from(parts[2], "base64");
  const ciphertext = Buffer.from(parts[3], "base64");

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf-8");
}

/** `12345678` → `1234••78` for display. */
export function maskAccount(value?: string | null): string {
  const digits = (value || "").replace(/\s+/g, "");
  if (!digits) return "";
  if (digits.length <= 4) return "•".repeat(digits.length);
  return `${digits.slice(0, 3)}${"•".repeat(Math.max(2, digits.length - 5))}${digits.slice(-2)}`;
}
