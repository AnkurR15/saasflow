import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir, mkdtemp, rm, stat, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

test("cleanup removes old payloads and orphan directories but preserves active and recent shares", { skip: !process.env.SECURE_DROP_TEST_DATABASE_URL }, async () => {
  process.env.DATABASE_URL = process.env.SECURE_DROP_TEST_DATABASE_URL;
  const { prisma } = await import("@repo/db");
  const root = await mkdtemp(path.join(tmpdir(), "secure-cleanup-test-"));
  const organization = await prisma.organization.create({ data: { name: "Cleanup test", slug: `cleanup-${randomUUID()}` } });
  const old = new Date(Date.now() - 2 * 86_400_000);
  const future = new Date(Date.now() + 86_400_000);
  const base = { organizationId: organization.id, createdById: "test-user", expiryHours: 24, expiresAt: future };
  const staleBucket = randomUUID();
  const activeBucket = randomUUID();
  const repoRoot = fileURLToPath(new URL("../../../../../", import.meta.url));
  const require = createRequire(path.join(repoRoot, "packages/db/package.json"));
  const runCleanup = (storageRoot: string) => promisify(execFile)(
    process.execPath, [require.resolve("tsx/cli"), path.join(repoRoot, "packages/db/src/secure-drop-cleanup.ts")],
    { cwd: path.join(repoRoot, "packages/db"), env: { ...process.env, DATABASE_URL: process.env.SECURE_DROP_TEST_DATABASE_URL, SECURE_DROP_STORAGE_DIR: storageRoot } },
  );
  try {
    await prisma.$executeRaw`
      INSERT INTO "RequestRateLimit" ("bucket", "hits", "expiresAt")
      VALUES (${staleBucket}, 1, statement_timestamp() - interval '1 second'),
             (${activeBucket}, 1, statement_timestamp() + interval '1 day')
    `;
    const expired = await prisma.secureShare.create({ data: { ...base, publishedAt: old, expiresAt: old } });
    const expiredDraft = await prisma.secureShare.create({ data: { ...base, expiresAt: old } });
    const revoked = await prisma.secureShare.create({ data: { ...base, revokedAt: old } });
    const active = await prisma.secureShare.create({ data: base });
    const recent = await prisma.secureShare.create({ data: { ...base, revokedAt: new Date() } });
    const orphan = "c" + randomUUID().replaceAll("-", "").slice(0, 24);
    for (const id of [expired.id, expiredDraft.id, revoked.id, active.id, recent.id]) {
      await mkdir(path.join(root, id));
      await writeFile(path.join(root, id, "chunk"), "encrypted bytes");
    }
    await mkdir(path.join(root, orphan, active.id), { recursive: true });
    await writeFile(path.join(root, orphan, active.id, "0.chunk"), "encrypted bytes");
    const unrelated = "c" + randomUUID().replaceAll("-", "").slice(0, 24);
    for (const id of [unrelated, "reports"]) {
      await mkdir(path.join(root, id));
      await writeFile(path.join(root, id, "keep.txt"), "unrelated data");
    }
    for (const id of [orphan, unrelated, "reports"]) await utimes(path.join(root, id), old, old);
    await runCleanup(root);
    assert.equal(await prisma.requestRateLimit.count({ where: { bucket: staleBucket } }), 0);
    assert.equal(await prisma.requestRateLimit.count({ where: { bucket: activeBucket } }), 1);
    for (const id of [expired.id, expiredDraft.id, revoked.id, orphan]) await assert.rejects(stat(path.join(root, id)), { code: "ENOENT" });
    for (const id of [active.id, recent.id, unrelated, "reports"]) assert.equal((await stat(path.join(root, id))).isDirectory(), true);
    for (const id of [expired.id, expiredDraft.id, revoked.id]) assert.ok((await prisma.secureShare.findUniqueOrThrow({ where: { id } })).storageReleasedAt);
    for (const id of [active.id, recent.id]) assert.equal((await prisma.secureShare.findUniqueOrThrow({ where: { id } })).storageReleasedAt, null);

    const failed = await prisma.secureShare.create({ data: { ...base, revokedAt: old } });
    const failedPayload = path.join(root, failed.id);
    await mkdir(failedPayload);
    await writeFile(path.join(failedPayload, "chunk"), "encrypted bytes");
    const invalidRoot = path.join(root, "not-a-directory");
    await writeFile(invalidRoot, "not a directory");
    await assert.rejects(runCleanup(invalidRoot), { code: 1 });
    assert.ok((await stat(path.join(failedPayload, "chunk"))).isFile());
    assert.equal((await prisma.secureShare.findUniqueOrThrow({ where: { id: failed.id } })).storageReleasedAt, null);
    await runCleanup(root);
    await assert.rejects(stat(failedPayload), { code: "ENOENT" });
    const { storageReleasedAt } = await prisma.secureShare.findUniqueOrThrow({ where: { id: failed.id } });
    assert.ok(storageReleasedAt);
    await runCleanup(root);
    assert.deepEqual((await prisma.secureShare.findUniqueOrThrow({ where: { id: failed.id } })).storageReleasedAt, storageReleasedAt);
  } finally {
    await prisma.requestRateLimit.deleteMany({ where: { bucket: { in: [staleBucket, activeBucket] } } });
    await prisma.organization.delete({ where: { id: organization.id } });
    await prisma.$disconnect();
    await rm(root, { recursive: true, force: true });
  }
});
