import { prisma } from "./index";

async function main() {
  const now = new Date();
  const cleared = await prisma.fileDrop.updateMany({
    where: { expiresAt: { lte: now }, NOT: { ciphertext: Buffer.alloc(0) } },
    data: { ciphertext: Buffer.alloc(0) },
  });
  const removed = await prisma.fileDrop.deleteMany({
    where: { expiresAt: { lte: new Date(now.getTime() - 30 * 86_400_000) } },
  });
  console.log(`Cleared ${cleared.count} expired payloads; removed ${removed.count} old records.`);
}

main().catch(() => { console.error("Secure-drop cleanup failed."); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
