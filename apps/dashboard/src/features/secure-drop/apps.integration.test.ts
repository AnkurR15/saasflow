import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac, randomBytes, randomUUID } from "node:crypto";
import { spawn, type ChildProcess } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { encode } from "next-auth/jwt";
import { mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { verifyTransferBoundaries } from "./transfer-boundaries.test-helper";
import type { Prisma } from "@repo/db";

async function waitForBlockedRequest(tx: Prisma.TransactionClient, pid: number) {
  const deadline = Date.now() + 5_000;
  while (Date.now() < deadline) {
    const [result] = await tx.$queryRaw<{ waiting: boolean }[]>`
      SELECT EXISTS (SELECT 1 FROM pg_locks WHERE NOT granted AND ${pid}::int = ANY(pg_blocking_pids(pid))) AS waiting
    `;
    if (result.waiting) return;
    await new Promise(resolve => setTimeout(resolve, 25));
  }
  assert.fail("Expected the request to wait for the database transaction");
}

// Run explicitly after building all apps. Uses only the supplied disposable database.
test("built apps serve pages and enforce Secure Drop and admin authorization over HTTP", {
  skip: !process.env.RUN_APP_SMOKE || !process.env.SECURE_DROP_TEST_DATABASE_URL,
  timeout: process.env.RUN_SECURE_DROP_LARGE === "1" ? 60 * 60_000 : 180_000,
}, async () => {
  process.env.DATABASE_URL = process.env.SECURE_DROP_TEST_DATABASE_URL;
  const { prisma } = await import("@repo/db");
  const secret = randomBytes(32).toString("hex");
  const suffix = randomUUID();
  const processes: ChildProcess[] = [];
  const userIds: string[] = [];
  let organizationId: string | undefined;
  const loginBucket = createHmac("sha256", secret).update("signIn:ip:shared").digest("hex");
  let uploadBucket: string | undefined;
  const root = fileURLToPath(new URL("../../../../../", import.meta.url));
  const origin = "https://drop.example.test";
  const storage = await mkdtemp(path.join(tmpdir(), "secure-share-test-"));
  async function start(app: string, port: number, adminId: string) {
    const cwd = `${root}/apps/${app}`;
    const require = createRequire(`${cwd}/package.json`);
    const child = spawn(process.execPath, [require.resolve("next/dist/bin/next"), "start", "-p", String(port), "-H", "127.0.0.1"], {
      cwd, windowsHide: true, stdio: "ignore", env: {
        ...process.env, NODE_ENV: "production", AUTH_SECRET: secret, AUTH_TRUST_HOST: "true",
        AUTH_URL: `http://127.0.0.1:${port}`, ADMIN_USER_ID: adminId,
        SECURE_DROP_APP_ORIGIN: origin, SECURE_DROP_ENCRYPTION_KEY: randomBytes(32).toString("hex"),
        SECURE_DROP_STORAGE_DIR: storage,
        ARCJET_KEY: "", RATE_LIMIT_IP_HEADER: "",
      },
    });
    processes.push(child);
    const deadline = Date.now() + 30_000;
    while (Date.now() < deadline) {
      if (child.exitCode !== null) throw new Error(`${app} exited before startup`);
      try { await fetch(`http://127.0.0.1:${port}/auth/sign-in`, { signal: AbortSignal.timeout(1000) }); return; }
      catch { await new Promise(resolve => setTimeout(resolve, 250)); }
    }
    throw new Error(`${app} did not start`);
  }
  async function cookie(id: string) {
    const token = await encode({ secret, salt: "authjs.session-token", token: { id, sub: id, email: `${id}@example.test` } });
    return `authjs.session-token=${token}`;
  }
  try {
    for (let i = 0; i < 3; i++) userIds.push((await prisma.user.create({ data: { email: `${suffix}-${i}@example.test`, password: "unused-test-hash" } })).id);
    const org = await prisma.organization.create({ data: { name: "HTTP smoke", slug: suffix, memberships: { create: { userId: userIds[0], role: "ADMIN" } } } });
    organizationId = org.id;
    await prisma.organizationMembership.create({ data: { organizationId: org.id, userId: userIds[2], role: "MEMBER" } });
    const project = await prisma.project.create({ data: { name: "Smoke project", organizationId: org.id, createdById: userIds[0] } });
    const invite = await prisma.invite.create({ data: { organizationId: org.id, expiresAt: new Date(Date.now() + 60000) } });
    await Promise.all([start("web", 3330, userIds[0]), start("dashboard", 3331, userIds[0]), start("admin", 3332, userIds[0])]);
    const member = await cookie(userIds[0]);
    const outsider = await cookie(userIds[1]);
    const teammate = await cookie(userIds[2]);
    const dashboard = "http://127.0.0.1:3331";
    const base = `/dashboard/organizations/${org.slug}`;
    const landing = await fetch("http://127.0.0.1:3330");
    assert.equal(landing.status, 200);
    assert.match(await landing.text(), /Secure Drop/);
    for (const path of ["/auth/sign-in", "/auth/sign-up", "/drop"]) assert.equal((await fetch(dashboard + path)).status, 200, path);
    const protectedPages: [string, RegExp][] = [
      [base, /HTTP smoke/], [`${base}/members`, /Members/], [`${base}/projects`, /Projects/],
      [`${base}/projects/new`, /Create a project/], [`${base}/projects/${project.id}/edit`, /Edit project/],
      [`${base}/secure-drop`, /Create a share/], ["/dashboard/organizations/new", /Create an organization/],
      [`/invite/${invite.token}`, /You have been invited to join/],
    ];
    for (const [path, content] of protectedPages) {
      const response = await fetch(dashboard + path, { headers: { cookie: member }, redirect: "manual" });
      assert.equal(response.status, 200, path);
      assert.match(await response.text(), content, path);
    }
    const loginRedirect = await fetch(dashboard + `/invite/${invite.token}`, { redirect: "manual" });
    assert.match(loginRedirect.headers.get("location") ?? "", /redirectTo=/);
    // Next.js can stream its shell with 200 before a page calls notFound().
    const foreignPage = await (await fetch(dashboard + base, { headers: { cookie: outsider } })).text();
    assert.match(foreignPage, /NEXT_HTTP_ERROR_FALLBACK;404|This page could not be found/);
    assert.doesNotMatch(foreignPage, /HTTP smoke/);
    for (const [path, content] of [["/", /Organizations/], [`/organizations/${org.id}`, /HTTP smoke/]] as const) {
      const response = await fetch("http://127.0.0.1:3332" + path, { headers: { cookie: member }, redirect: "manual" });
      assert.equal(response.status, 200, path);
      assert.match(await response.text(), content, path);
    }
    const denied = await fetch("http://127.0.0.1:3332", { headers: { cookie: outsider }, redirect: "manual" });
    assert.match(denied.headers.get("location") ?? "", /unauthorized/);
    await prisma.$executeRaw`
      INSERT INTO "RequestRateLimit" ("bucket", "hits", "expiresAt") VALUES (${loginBucket}, 10, statement_timestamp() + interval '1 minute')
    `;
    for (const app of [dashboard, "http://127.0.0.1:3332"]) {
      const csrf = await fetch(app + "/api/auth/csrf");
      const { csrfToken } = await csrf.json();
      const cookies = csrf.headers.getSetCookie().map(value => value.split(";")[0]).join("; ");
      const login = await fetch(app + "/api/auth/callback/credentials", {
        method: "POST", redirect: "manual", headers: { cookie: cookies },
        body: new URLSearchParams({ csrfToken, email: "fixture@example.test", password: "fixture-only" }),
      });
      assert.match(login.headers.get("location") ?? "", /code=rate_limit/, "direct credential callbacks must honor the login budget");
    }
    const endpoint = `${dashboard}/api/organizations/${org.id}/drops`;
    const headers = { origin, cookie: member, "x-file-name": "sample.txt", "x-expires-hours": "1" };
    assert.equal((await fetch(endpoint, { method: "POST", headers: { ...headers, cookie: outsider }, body: "secret" })).status, 404);
    assert.equal((await fetch(endpoint, { method: "POST", headers: { ...headers, origin: "https://evil.test" }, body: "secret" })).status, 403);
    assert.equal((await fetch(endpoint, { method: "POST", headers: { ...headers, "x-file-name": "..%2Fbad.txt" }, body: "secret" })).status, 400);
    const uploaded = await fetch(endpoint, { method: "POST", headers, body: "secret payload" });
    assert.equal(uploaded.status, 201);
    const { token, id } = await uploaded.json();
    const downloaded = await fetch(`${dashboard}/api/secure-drop/download`, { method: "POST", headers: { origin }, body: token });
    assert.equal(downloaded.status, 200);
    assert.equal(await downloaded.text(), "secret payload");
    assert.equal(downloaded.headers.get("cache-control"), "no-store");
    assert.equal((await prisma.fileDrop.findUniqueOrThrow({ where: { id } })).ciphertext.length, 0);
    assert.equal((await fetch(`${dashboard}/api/secure-drop/download`, { method: "POST", headers: { origin }, body: token })).status, 404);
    const second = await (await fetch(endpoint, { method: "POST", headers, body: "revoke me" })).json();
    assert.equal((await fetch(`${endpoint}?id=${second.id}`, { method: "DELETE", headers })).status, 204);
    assert.equal((await fetch(`${dashboard}/api/secure-drop/download`, { method: "POST", headers: { origin }, body: second.token })).status, 404);

    const shares = `${dashboard}/api/organizations/${org.id}/shares`;
    const manifest = { files: [{ path: "reports/large.pdf", size: 4 * 1024 * 1024 + 3 }, { path: "reports/data.xlsx", size: 4 }], projectId: project.id, hours: 24, downloadOnce: true };
    const create = (body: unknown, who = member) => fetch(shares, { method: "POST", headers: { origin, cookie: who, "content-type": "application/json" }, body: JSON.stringify(body) });
    assert.equal((await create(manifest, outsider)).status, 404);
    assert.equal((await create({ ...manifest, projectId: "foreign-project" })).status, 400);
    assert.equal((await create({ ...manifest, files: [{ path: "../escape", size: 1 }] })).status, 400);
    assert.equal((await create({ ...manifest, files: [{ path: "too-big.zip", size: 5 * 1024 ** 3 + 1 }] })).status, 400);
    const maximum = await create({ files: [{ path: "maximum.zip", size: 5 * 1024 ** 3 }], hours: 1, downloadOnce: true });
    assert.equal(maximum.status, 201);
    const maximumId = (await maximum.json()).id;
    assert.equal((await fetch(`${shares}/${maximumId}`, { method: "DELETE", headers: { origin, cookie: member } })).status, 204);
    const retained = await prisma.secureShare.create({ data: {
      organizationId: org.id, createdById: userIds[0], expiryHours: 24, expiresAt: new Date(Date.now() + 60_000), revokedAt: new Date(),
      files: { create: Array.from({ length: 9 }, (_, index) => ({ path: `retained-${index}.zip`, size: BigInt(5 * 1024 ** 3) })) },
    } });
    assert.equal((await create({ files: [{ path: "extra.txt", size: 1 }], hours: 1, downloadOnce: true })).status, 409,
      "revoking shares must not release their storage reservations before cleanup");
    // The cleanup suite verifies that this marker is only set after removal.
    await prisma.secureShare.update({ where: { id: retained.id }, data: { storageReleasedAt: new Date() } });
    const afterCleanup = await create({ files: [{ path: "extra.txt", size: 1 }], hours: 1, downloadOnce: true });
    assert.equal(afterCleanup.status, 201);
    assert.equal((await fetch(`${shares}/${(await afterCleanup.json()).id}`, { method: "DELETE", headers: { origin, cookie: member } })).status, 204);
    const expiring = await prisma.secureShare.create({ data: {
      organizationId: org.id, createdById: userIds[0], expiryHours: 24, expiresAt: new Date(Date.now() + 60_000),
      files: { create: { path: "pending.txt", size: 1, uploadedSize: 1 } },
    } });
    let pendingPublish: Promise<Response> | undefined;
    let completed = false;
    await prisma.$transaction(async tx => {
      const [{ pid }] = await tx.$queryRaw<{ pid: number }[]>`SELECT pg_backend_pid() AS pid`;
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`secure-share-org:${org.id}`}))`;
      pendingPublish = fetch(`${shares}/${expiring.id}`, { method: "POST", headers: { origin, cookie: member } }).then(response => { completed = true; return response; });
      await waitForBlockedRequest(tx, pid);
      assert.equal(completed, false, "publication must wait for the organization reservation lock");
      await tx.secureShare.update({ where: { id: expiring.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    }, { timeout: 10_000 });
    assert.equal((await pendingPublish!).status, 404, "an expired draft cannot be published after the reservation lock is released");
    const created = await create(manifest);
    assert.equal(created.status, 201);
    const draft = await created.json();
    const publish = () => fetch(`${shares}/${draft.id}`, { method: "POST", headers: { origin, cookie: member } });
    assert.equal((await publish()).status, 409);
    assert.equal((await fetch(`${shares}/${draft.id}`, { method: "DELETE", headers: { origin, cookie: teammate } })).status, 404);
    const large = Buffer.alloc(4 * 1024 * 1024 + 3, 0x42);
    async function chunk(fileId: string, index: number, body: Buffer) {
      return fetch(`${shares}/${draft.id}/files/${fileId}`, { method: "PUT", headers: { origin, cookie: member, "x-chunk-index": String(index) }, body: new Uint8Array(body) });
    }
    const largeId = draft.files.find((file: { path: string }) => file.path.endsWith("large.pdf")).id;
    const smallId = draft.files.find((file: { path: string }) => file.path.endsWith("data.xlsx")).id;
    assert.equal((await chunk(largeId, 1, large.subarray(-3))).status, 409);
    uploadBucket = createHmac("sha256", secret).update(`uploadChunk:user:${userIds[0]}`).digest("hex");
    await prisma.$executeRaw`
      UPDATE "RequestRateLimit" SET "hits" = 160, "expiresAt" = statement_timestamp() + interval '10 seconds'
      WHERE "bucket" = ${uploadBucket}
    `;
    const throttled = await chunk(largeId, 0, large.subarray(0, -3));
    assert.equal(throttled.status, 429);
    assert.equal(throttled.headers.get("retry-after"), "10");
    assert.equal(await prisma.secureShareChunk.count({ where: { fileId: largeId } }), 0);
    assert.equal((await prisma.secureShareFile.findUniqueOrThrow({ where: { id: largeId } })).uploadedSize, BigInt(0));
    await assert.rejects(stat(path.join(storage, draft.id, largeId)), { code: "ENOENT" });
    await prisma.$executeRaw`
      UPDATE "RequestRateLimit" SET "expiresAt" = statement_timestamp() WHERE "bucket" = ${uploadBucket}
    `;
    assert.equal((await chunk(largeId, 0, large.subarray(0, -3))).status, 204);
    assert.equal((await chunk(largeId, 0, large.subarray(0, -3))).status, 204);
    assert.equal((await chunk(largeId, 0, Buffer.alloc(4 * 1024 * 1024, 0x43))).status, 409);
    assert.equal((await chunk(largeId, 1, large.subarray(-3))).status, 204);
    assert.equal((await chunk(smallId, 0, Buffer.from("data"))).status, 204);
    const published = await publish();
    assert.equal(published.status, 200);
    const shareToken = (await published.json()).token;
    const details = await fetch(`${dashboard}/api/secure-drop/details`, { method: "POST", headers: { origin }, body: shareToken });
    assert.equal(details.status, 200);
    assert.deepEqual((await details.json()).files.map((file: { path: string }) => file.path), ["reports/data.xlsx", "reports/large.pdf"]);
    const getFile = (fileId: string, value = shareToken) => fetch(`${dashboard}/api/secure-drop/file`, { method: "POST", headers: { origin, "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ token: value, fileId }) });
    const raced = await Promise.all([getFile(largeId), getFile(largeId)]);
    assert.deepEqual(raced.map(response => response.status).sort(), [200, 404]);
    assert.deepEqual(Buffer.from(await raced.find(response => response.ok)!.arrayBuffer()), large);
    assert.equal(await (await getFile(smallId)).text(), "data");
    assert.equal((await getFile(smallId)).status, 404);

    const repeatDraft = await (await create({ files: [{ path: "again.txt", size: 5 }], hours: 1, downloadOnce: false })).json();
    const repeatId = repeatDraft.files[0].id;
    assert.equal((await fetch(`${shares}/${repeatDraft.id}/files/${repeatId}`, { method: "PUT", headers: { origin, cookie: member, "x-chunk-index": "0" }, body: "again" })).status, 204);
    const repeatToken = (await (await fetch(`${shares}/${repeatDraft.id}`, { method: "POST", headers: { origin, cookie: member } })).json()).token;
    assert.equal(await (await getFile(repeatId, repeatToken)).text(), "again");
    assert.equal(await (await getFile(repeatId, repeatToken)).text(), "again");
    await prisma.secureShare.update({ where: { id: repeatDraft.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    assert.equal((await getFile(repeatId, repeatToken)).status, 404);
    await prisma.secureShare.update({ where: { id: repeatDraft.id }, data: { expiresAt: new Date(Date.now() + 60000) } });
    assert.equal((await fetch(`${shares}/${repeatDraft.id}`, { method: "DELETE", headers: { origin, cookie: member } })).status, 204);
    assert.equal((await getFile(repeatId, repeatToken)).status, 404);

    const teamDraft = await (await create({ files: [{ path: "team-only.txt", size: 4 }], hours: 1, downloadOnce: false }, teammate)).json();
    assert.equal((await fetch(`${shares}/${teamDraft.id}/files/${teamDraft.files[0].id}`, { method: "PUT", headers: { origin, cookie: teammate, "x-chunk-index": "0" }, body: "team" })).status, 204);
    const teamToken = (await (await fetch(`${shares}/${teamDraft.id}`, { method: "POST", headers: { origin, cookie: teammate } })).json()).token;
    const adminPage = await (await fetch(dashboard + `${base}/secure-drop`, { headers: { cookie: member } })).text();
    assert.match(adminPage, /team-only\.txt/);
    assert.doesNotMatch(adminPage, new RegExp(teamToken));
    const memberPage = await (await fetch(dashboard + `${base}/secure-drop`, { headers: { cookie: teammate } })).text();
    assert.match(memberPage, /team-only\.txt/);
    assert.doesNotMatch(memberPage, /again\.txt/);
    const adminMembership = { userId_organizationId: { userId: userIds[0], organizationId: org.id } };
    let pendingRevoke: Promise<Response> | undefined;
    await prisma.$transaction(async tx => {
      const [{ pid }] = await tx.$queryRaw<{ pid: number }[]>`SELECT pg_backend_pid() AS pid`;
      await tx.organizationMembership.update({ where: adminMembership, data: { role: "MEMBER" } });
      pendingRevoke = fetch(`${shares}/${teamDraft.id}`, { method: "DELETE", headers: { origin, cookie: member } });
      await waitForBlockedRequest(tx, pid);
    }, { timeout: 10_000 });
    assert.equal((await pendingRevoke!).status, 404, "a demoted admin cannot revoke a teammate's share");
    await prisma.organizationMembership.update({ where: adminMembership, data: { role: "ADMIN" } });
    assert.equal((await fetch(`${shares}/${teamDraft.id}`, { method: "DELETE", headers: { origin, cookie: member } })).status, 204);
    assert.equal((await getFile(teamDraft.files[0].id, teamToken)).status, 404);

    const pendingDraftResponse = await create({ files: [{ path: "pending-chunk.bin", size: 1 }], hours: 1, downloadOnce: true }, teammate);
    assert.equal(pendingDraftResponse.status, 201);
    const pendingDraft = await pendingDraftResponse.json();
    const pendingFileId = pendingDraft.files[0].id;
    const pendingUrl = `${shares}/${pendingDraft.id}/files/${pendingFileId}`;
    const sendPendingChunk = () => fetch(pendingUrl, {
      method: "PUT", headers: { origin, cookie: teammate, "x-chunk-index": "0" }, body: "x",
    });
    let pendingUpload: Promise<Response> | undefined;
    await prisma.$transaction(async tx => {
      const [{ pid }] = await tx.$queryRaw<{ pid: number }[]>`SELECT pg_backend_pid() AS pid`;
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`secure-share:${pendingDraft.id}`}))`;
      pendingUpload = sendPendingChunk();
      await waitForBlockedRequest(tx, pid);
      await tx.organizationMembership.delete({ where: { userId_organizationId: { userId: userIds[2], organizationId: org.id } } });
    }, { timeout: 10_000 });
    assert.equal((await pendingUpload!).status, 404, "a queued upload must stop after its sender is removed");
    assert.equal(await prisma.secureShareChunk.count({ where: { fileId: pendingFileId } }), 0);
    assert.equal((await prisma.secureShareFile.findUniqueOrThrow({ where: { id: pendingFileId } })).uploadedSize, BigInt(0));
    await assert.rejects(stat(path.join(storage, pendingDraft.id)), { code: "ENOENT" });
    await verifyTransferBoundaries(shares, origin, member, process.env.RUN_SECURE_DROP_LARGE === "1");
  } finally {
    for (const child of processes) child.kill();
    await prisma.requestRateLimit.deleteMany({ where: { bucket: { in: uploadBucket ? [loginBucket, uploadBucket] : [loginBucket] } } });
    if (organizationId) await prisma.organization.delete({ where: { id: organizationId } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.$disconnect();
    await rm(storage, { recursive: true, force: true });
  }
});
