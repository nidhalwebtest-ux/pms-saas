/**
 * Symmetric encryption for third-party secrets stored in the DB (WhatsApp
 * Cloud API access tokens). AES-256-GCM, key from WHATSAPP_TOKEN_KEY
 * (32 bytes, base64 or hex). SERVER ONLY — never import from client code.
 *
 * Format: "v1:" + base64(iv[12] | authTag[16] | ciphertext)
 */
import crypto from "crypto";

const PREFIX = "v1:";

function loadKey(): Buffer {
  const raw = process.env.WHATSAPP_TOKEN_KEY ?? "";
  if (!raw) throw new Error("WHATSAPP_TOKEN_KEY is not set");
  const key = /^[0-9a-fA-F]{64}$/.test(raw) ? Buffer.from(raw, "hex") : Buffer.from(raw, "base64");
  if (key.length !== 32) throw new Error("WHATSAPP_TOKEN_KEY must be 32 bytes (base64 or hex)");
  return key;
}

export function encryptSecret(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", loadKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return PREFIX + Buffer.concat([iv, cipher.getAuthTag(), enc]).toString("base64");
}

export function decryptSecret(stored: string): string {
  if (!stored.startsWith(PREFIX)) throw new Error("Unsupported secret format");
  const buf = Buffer.from(stored.slice(PREFIX.length), "base64");
  const iv = buf.subarray(0, 12), tag = buf.subarray(12, 28), data = buf.subarray(28);
  const decipher = crypto.createDecipheriv("aes-256-gcm", loadKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}

/** Show only the last 4 characters of a secret in the UI. */
export function maskSecret(plain: string): string {
  return plain.length <= 4 ? "••••" : "••••" + plain.slice(-4);
}
