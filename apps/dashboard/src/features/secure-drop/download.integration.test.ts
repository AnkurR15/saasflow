import { test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { encryptFile, hashToken, newToken } from "./crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { writeChunk } from "./storage";

// Only runs against an explicitly supplied, migrated test database.
test("downloads enforce expiry, revocation and atomic one-time consumption", {
  skip: !process.env.SECURE_DROP_TEST_DATABASE_URL,
}, async () => {
  process.env.DATABASE_URL = process.env.SECURE_DROP_TEST_DATABASE_URL;
  process.env.SECURE_DROP_ENCRYPTION_KEY = randomBytes(32).toString("hex");
  process.env.SECURE_DROP_APP_ORIGIN = "https://drop.example.test";
  const { prisma } = await import("@repo/db");
  const { POST } = await import("../../app/api/secure-drop/download/route");
  const organization = await prisma.organization.create({ data: { name: "Secure Drop test", slug: `drop-test-${randomUUID()}` } });
  const bytes = Buffer.from("confidential test file");
  async function create(overrides: { expiresAt?: Date; revokedAt?: Date } = {}) {
    const token = newToken();
    const tokenHash = hashToken(token);
    const drop = await prisma.fileDrop.create({ data: {
      organizationId: organization.id, createdById: "test-creator", fileName: "sample.txt",
      size: bytes.length, tokenHash, ciphertext: encryptFile(bytes, tokenHash),
      createdAt: new Date(Date.now() - 120_000),
      expiresAt: new Date(Date.now() + 60_000), ...overrides,
    } });
    return { token, id: drop.id };
  }
  function download(token: string) {
    return POST(new Request("https://drop.example.test/api/secure-drop/download", {
      method: "POST", headers: { origin: "https://drop.example.test" }, body: token,
    }));
  }
  try {
    const active = await create();
    const responses = await Promise.all(Array.from({ length: 5 }, () => download(active.token)));
    assert.equal(responses.filter(r => r.status === 200).length, 1);
    assert.equal(responses.filter(r => r.status === 404).length, 4);
    const success = responses.find(r => r.ok)!;
    assert.deepEqual(Buffer.from(await success.arrayBuffer()), bytes);
    assert.equal(success.headers.get("cache-control"), "no-store");
    assert.equal((await prisma.fileDrop.findUniqueOrThrow({ where: { id: active.id } })).ciphertext.length, 0);
    assert.equal((await download(active.token)).status, 404);
    assert.equal((await download((await create({ expiresAt: new Date(Date.now() - 1000) })).token)).status, 404);
    assert.equal((await download((await create({ revokedAt: new Date() })).token)).status, 404);
    assert.equal((await download(newToken())).status, 404);
    assert.equal((await download("invalid")).status, 404);
    const recoverable = await create();
    const key = process.env.SECURE_DROP_ENCRYPTION_KEY;
    delete process.env.SECURE_DROP_ENCRYPTION_KEY;
    assert.equal((await download(recoverable.token)).status, 503);
    process.env.SECURE_DROP_ENCRYPTION_KEY = key;
    assert.equal((await download(recoverable.token)).status, 200);
  } finally {
    await prisma.organization.delete({ where: { id: organization.id } });
    await prisma.$disconnect();
  }
});

test("browser form downloads work with a null Origin while rejecting cross-site forms", {
  skip: !process.env.SECURE_DROP_TEST_DATABASE_URL,
}, async () => {
  process.env.DATABASE_URL = process.env.SECURE_DROP_TEST_DATABASE_URL;
  process.env.SECURE_DROP_ENCRYPTION_KEY = randomBytes(32).toString("hex");
  process.env.SECURE_DROP_APP_ORIGIN = "https://drop.example.test";
  const storage = await mkdtemp(path.join(tmpdir(), "secure-form-test-"));
  process.env.SECURE_DROP_STORAGE_DIR = storage;
  const { prisma } = await import("@repo/db");
  const { POST } = await import("../../app/api/secure-drop/file/route");
  const organization = await prisma.organization.create({ data: { name: "Form download test", slug: `form-${randomUUID()}` } });
  const token = newToken();
  const bytes = Buffer.from("browser form download");
  try {
    const share = await prisma.secureShare.create({ data: {
      organizationId: organization.id, createdById: "test-user", tokenHash: hashToken(token), downloadOnce: true,
      expiryHours: 1, publishedAt: new Date(), expiresAt: new Date(Date.now() + 60_000),
      files: { create: { path: "folder/file.txt", size: bytes.length, uploadedSize: bytes.length } },
    }, include: { files: true } });
    const file = share.files[0];
    await writeChunk(share.id, file.id, 0, bytes);
    const submit = (site: string) => POST(new Request("https://drop.example.test/api/secure-drop/file", {
      method: "POST", headers: { origin: "null", "sec-fetch-site": site, "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token, fileId: file.id }),
    }));
    assert.equal((await submit("cross-site")).status, 403);
    const response = await submit("same-origin");
    assert.equal(response.status, 200);
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), bytes);
    assert.equal((await submit("same-origin")).status, 404);
  } finally {
    await prisma.organization.delete({ where: { id: organization.id } });
    await prisma.$disconnect();
    await rm(storage, { recursive: true, force: true });
  }
});
