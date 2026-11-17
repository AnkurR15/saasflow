import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { decryptFile, encryptFile } from "./crypto";
import { DropError, parseFileName } from "./http";

export const CHUNK_BYTES = 4 * 1024 * 1024;
export const MAX_SHARE_FILE_BYTES = 5 * 1024 ** 3;
export const MAX_SHARE_BYTES = 20 * 1024 ** 3;
export const MAX_ORGANIZATION_BYTES = 50 * 1024 ** 3;
export const MAX_SHARE_FILES = 200;

export function parseRelativePath(value: unknown) {
  if (typeof value !== "string" || value.length > 1024) throw new DropError(400, "Invalid file path.");
  const parts = value.split("/");
  if (parts.length > 20) throw new DropError(400, "Folders may be at most 20 levels deep.");
  return parts.map(part => parseFileName(encodeURIComponent(part))).join("/");
}

export function storageRoot() {
  const root = process.env.SECURE_DROP_STORAGE_DIR;
  if (!root || !path.isAbsolute(root)) throw new Error("SECURE_DROP_STORAGE_DIR must be an absolute path to persistent private storage");
  return path.resolve(root);
}

function chunkPath(shareId: string, fileId: string, index: number) {
  if (!/^[a-z0-9]+$/.test(shareId) || !/^[a-z0-9]+$/.test(fileId) || !Number.isSafeInteger(index) || index < 0) throw new Error("Invalid storage identifier");
  return path.join(storageRoot(), shareId, fileId, `${index}.chunk`);
}

function aad(shareId: string, fileId: string, index: number) { return `${shareId}:${fileId}:${index}`; }

export async function prepareStorage() {
  encryptFile(new Uint8Array(), "configuration-check");
  await mkdir(storageRoot(), { recursive: true, mode: 0o700 });
}

export async function writeChunk(shareId: string, fileId: string, index: number, bytes: Uint8Array) {
  const target = chunkPath(shareId, fileId, index);
  await mkdir(path.dirname(target), { recursive: true, mode: 0o700 });
  const temporary = `${target}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporary, encryptFile(bytes, aad(shareId, fileId, index)), { mode: 0o600, flag: "wx" });
    await rename(temporary, target);
  } finally { await rm(temporary, { force: true }); }
}

export async function readChunk(shareId: string, fileId: string, index: number) {
  return decryptFile(await readFile(chunkPath(shareId, fileId, index)), aad(shareId, fileId, index));
}
