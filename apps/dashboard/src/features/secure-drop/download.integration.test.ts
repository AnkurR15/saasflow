import { test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { encryptFile, hashToken, newToken } from "./crypto";

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
