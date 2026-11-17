import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

export const MAX_FILE_BYTES = 5 * 1024 * 1024;
export const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

function key() {
  const value = process.env.SECURE_DROP_ENCRYPTION_KEY;
  if (!value || !/^[a-fA-F0-9]{64}$/.test(value)) {
    throw new Error("SECURE_DROP_ENCRYPTION_KEY must be 32 random bytes encoded as hex");
  }
  return Buffer.from(value, "hex");
}

export function newToken() { return randomBytes(32).toString("base64url"); }
export function hashToken(token: string) { return createHash("sha256").update(token).digest("hex"); }

// Bind the encrypted bytes to the link, preventing ciphertext swaps between drops.
export function encryptFile(bytes: Uint8Array, tokenHash: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  cipher.setAAD(Buffer.from(tokenHash));
  const encrypted = Buffer.concat([cipher.update(bytes), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]);
}

export function decryptFile(bytes: Uint8Array, tokenHash: string) {
  const data = Buffer.from(bytes);
  const decipher = createDecipheriv("aes-256-gcm", key(), data.subarray(0, 12));
  decipher.setAAD(Buffer.from(tokenHash));
  decipher.setAuthTag(data.subarray(12, 28));
  return Buffer.concat([decipher.update(data.subarray(28)), decipher.final()]);
}
