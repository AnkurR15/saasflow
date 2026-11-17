import { test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { decryptFile, encryptFile, hashToken, newToken, TOKEN_PATTERN } from "./crypto";
import { DropError, parseFileName, readLimited, sameOrigin } from "./http";

test("encrypted files round-trip; tampering and cross-drop substitution fail", () => {
  process.env.SECURE_DROP_ENCRYPTION_KEY = randomBytes(32).toString("hex");
  const token = newToken();
  assert.match(token, TOKEN_PATTERN);
  const hash = hashToken(token);
  const original = Buffer.from("confidential file contents");
  const encrypted = encryptFile(original, hash);
  assert.equal(encrypted.includes(original), false);
  assert.deepEqual(decryptFile(encrypted, hash), original);
  assert.notDeepEqual(encryptFile(original, hash), encrypted);
  assert.throws(() => decryptFile(encrypted, hashToken(newToken())));
  encrypted[encrypted.length - 1] ^= 1;
  assert.throws(() => decryptFile(encrypted, hash));
});

test("missing or invalid encryption configuration fails closed", () => {
  const original = process.env.SECURE_DROP_ENCRYPTION_KEY;
  try {
    delete process.env.SECURE_DROP_ENCRYPTION_KEY;
    assert.throws(() => encryptFile(Buffer.from("secret"), "hash"));
    process.env.SECURE_DROP_ENCRYPTION_KEY = "invalid";
    assert.throws(() => encryptFile(Buffer.from("secret"), "hash"));
  } finally { process.env.SECURE_DROP_ENCRYPTION_KEY = original; }
});

test("body limits apply to streamed requests without a content length", async () => {
  const request = new Request("https://example.test", {
    method: "POST", body: new ReadableStream({ start(controller) {
      controller.enqueue(new Uint8Array(3)); controller.enqueue(new Uint8Array(3)); controller.close();
    } }), duplex: "half",
  } as RequestInit);
  await assert.rejects(readLimited(request, 5), (error: unknown) => error instanceof DropError && error.status === 413);
  const small = new Request("https://example.test", { method: "POST", body: "hello" });
  assert.equal((await readLimited(small, 5)).toString(), "hello");
});

test("mutations reject cross-origin and missing Origin headers", () => {
  const previous = process.env.SECURE_DROP_APP_ORIGIN;
  process.env.SECURE_DROP_APP_ORIGIN = "https://drop.example.test";
  try {
    assert.throws(() => sameOrigin(new Request("http://localhost:3001")));
    assert.throws(() => sameOrigin(new Request("http://localhost:3001", { headers: { origin: "https://evil.test" } })));
    assert.doesNotThrow(() => sameOrigin(new Request("http://localhost:3001", { headers: { origin: "https://drop.example.test" } })));
  } finally {
    if (previous === undefined) delete process.env.SECURE_DROP_APP_ORIGIN;
    else process.env.SECURE_DROP_APP_ORIGIN = previous;
  }
});

test("filenames reject traversal, malformed encoding and disguised extensions", () => {
  for (const name of ["", " ", ".", "..", "../file", "a\\b", "a\n.txt", "photo\u202egnp.exe", "a\u2066.txt", "x".repeat(181)]) {
    assert.throws(() => parseFileName(encodeURIComponent(name)), (error: unknown) => error instanceof DropError && error.status === 400);
  }
  assert.throws(() => parseFileName("%ZZ"));
  assert.equal(parseFileName(encodeURIComponent("résumé.pdf")), "résumé.pdf");
  assert.equal(parseFileName(encodeURIComponent("report (final).pdf")), "report (final).pdf");
});

test("production origin configuration fails closed", () => {
  const previous = { ...process.env };
  try {
    Object.assign(process.env, { NODE_ENV: "production" });
    for (const origin of [undefined, "http://example.test", "https://example.test/path", "https://example.test/"]) {
      if (origin === undefined) delete process.env.SECURE_DROP_APP_ORIGIN;
      else process.env.SECURE_DROP_APP_ORIGIN = origin;
      assert.throws(() => sameOrigin(new Request("https://example.test", { headers: { origin: "https://example.test" } })));
    }
    process.env.SECURE_DROP_APP_ORIGIN = "https://example.test";
    assert.doesNotThrow(() => sameOrigin(new Request("http://internal:3001", { headers: { origin: "https://example.test" } })));
  } finally {
    for (const name of ["NODE_ENV", "SECURE_DROP_APP_ORIGIN"]) {
      if (previous[name] === undefined) delete process.env[name];
      else process.env[name] = previous[name];
    }
  }
});
