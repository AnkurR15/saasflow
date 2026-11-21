import { readdir, rm, stat } from "node:fs/promises";
import path from "node:path";
import { prisma } from "./index";

const shareOrFileId = /^c[a-z0-9]{24}$/;
const chunkName = /^\d+(?:\.[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12})?\.chunk$/;

async function containsOnlyShareFiles(directory: string) {
  const files = await readdir(directory, { withFileTypes: true });
  for (const file of files) {
    if (!file.isDirectory() || !shareOrFileId.test(file.name)) return false;
    const chunks = await readdir(path.join(directory, file.name), { withFileTypes: true });
    if (chunks.some(chunk => !chunk.isFile() || !chunkName.test(chunk.name))) return false;
  }
  return true;
}

async function main() {
  const now = new Date();
  // Counters are opened and expired using the same PostgreSQL clock.
  await prisma.$executeRaw`DELETE FROM "RequestRateLimit" WHERE "expiresAt" <= statement_timestamp()`;
  const cleared = await prisma.fileDrop.updateMany({
    where: { expiresAt: { lte: now }, NOT: { ciphertext: Buffer.alloc(0) } }, data: { ciphertext: Buffer.alloc(0) },
  });
  const removed = await prisma.fileDrop.deleteMany({ where: { expiresAt: { lte: new Date(now.getTime() - 30 * 86_400_000) } } });
  const root = process.env.SECURE_DROP_STORAGE_DIR;
  if (!root || !path.isAbsolute(root)) throw new Error("SECURE_DROP_STORAGE_DIR must be an absolute path");
  // Never release reservations when the configured storage root is missing
  // or is a file: an unmounted or misconfigured volume is not a deletion.
  if (!(await stat(root)).isDirectory()) throw new Error("SECURE_DROP_STORAGE_DIR must be an existing directory");
  // Keep payloads for 24 hours after expiry or revocation so an already-started
  // transfer can finish. Access is denied immediately by the download route.
  const cutoff = new Date(now.getTime() - 24 * 3_600_000);
  const expired = await prisma.secureShare.findMany({ where: { storageReleasedAt: null, OR: [{ expiresAt: { lte: cutoff } }, { revokedAt: { lte: cutoff } }] }, select: { id: true } });
  for (const share of expired) {
    if (!/^[a-z0-9]+$/.test(share.id)) throw new Error("Invalid storage identifier");
    await rm(path.join(root, share.id), { recursive: true, force: true });
    // Release the reservation only after filesystem removal succeeds. If the
    // database update fails, the next cleanup run safely retries the removal.
    await prisma.secureShare.updateMany({ where: { id: share.id, storageReleasedAt: null }, data: { storageReleasedAt: new Date() } });
  }
  // Organization deletion can cascade database rows before cleanup sees them.
  // Only remove old, unreferenced directories and never follow symlinks.
  const entries = await readdir(root, { withFileTypes: true }).catch((error: NodeJS.ErrnoException) => { if (error.code === "ENOENT") return []; throw error; });
  for (const entry of entries) {
    if (!entry.isDirectory() || !shareOrFileId.test(entry.name)) continue;
    const directory = path.join(root, entry.name);
    if ((await stat(directory)).mtime > cutoff) continue;
    const share = await prisma.secureShare.findUnique({ where: { id: entry.name }, select: { id: true } });
    if (!share && await containsOnlyShareFiles(directory)) await rm(directory, { recursive: true, force: true });
  }
  const oldShares = await prisma.secureShare.deleteMany({ where: { storageReleasedAt: { not: null }, expiresAt: { lte: new Date(now.getTime() - 30 * 86_400_000) } } });
  console.log(`Cleared ${cleared.count} legacy payloads and ${expired.length} share directories; removed ${removed.count + oldShares.count} old records.`);
}

main().catch(() => { console.error("Secure-drop cleanup failed."); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
