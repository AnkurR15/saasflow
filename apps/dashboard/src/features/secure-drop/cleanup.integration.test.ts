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
  try {
    const expired = await prisma.secureShare.create({ data: { ...base, expiresAt: old } });
    const revoked = await prisma.secureShare.create({ data: { ...base, revokedAt: old } });
    const active = await prisma.secureShare.create({ data: base });
    const recent = await prisma.secureShare.create({ data: { ...base, revokedAt: new Date() } });
    const orphan = "orphan123";
    for (const id of [expired.id, revoked.id, active.id, recent.id, orphan]) {
      await mkdir(path.join(root, id));
      await writeFile(path.join(root, id, "chunk"), "encrypted bytes");
    }
    await utimes(path.join(root, orphan), old, old);
    const repoRoot = fileURLToPath(new URL("../../../../../", import.meta.url));
    const require = createRequire(path.join(repoRoot, "packages/db/package.json"));
    await promisify(execFile)(process.execPath, [require.resolve("tsx/cli"), path.join(repoRoot, "packages/db/src/secure-drop-cleanup.ts")], {
      cwd: path.join(repoRoot, "packages/db"), env: { ...process.env, DATABASE_URL: process.env.SECURE_DROP_TEST_DATABASE_URL, SECURE_DROP_STORAGE_DIR: root },
    });
    for (const id of [expired.id, revoked.id, orphan]) await assert.rejects(stat(path.join(root, id)), { code: "ENOENT" });
    for (const id of [active.id, recent.id]) assert.equal((await stat(path.join(root, id))).isDirectory(), true);
    for (const id of [expired.id, revoked.id]) assert.ok((await prisma.secureShare.findUniqueOrThrow({ where: { id } })).storageReleasedAt);
    for (const id of [active.id, recent.id]) assert.equal((await prisma.secureShare.findUniqueOrThrow({ where: { id } })).storageReleasedAt, null);

    const failed = await prisma.secureShare.create({ data: { ...base, revokedAt: old } });
    const invalidRoot = path.join(root, "not-a-directory");
    await writeFile(invalidRoot, "not a directory");
    await assert.rejects(promisify(execFile)(process.execPath, [require.resolve("tsx/cli"), path.join(repoRoot, "packages/db/src/secure-drop-cleanup.ts")], {
      cwd: path.join(repoRoot, "packages/db"), env: { ...process.env, DATABASE_URL: process.env.SECURE_DROP_TEST_DATABASE_URL, SECURE_DROP_STORAGE_DIR: invalidRoot },
    }));
    assert.equal((await prisma.secureShare.findUniqueOrThrow({ where: { id: failed.id } })).storageReleasedAt, null);
  } finally {
    await prisma.organization.delete({ where: { id: organization.id } });
    await prisma.$disconnect();
    await rm(root, { recursive: true, force: true });
  }
});
