import { test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { spawn, type ChildProcess } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { encode } from "next-auth/jwt";

// Run explicitly after building all apps. Uses only the supplied disposable database.
test("built apps serve pages and enforce Secure Drop and admin authorization over HTTP", {
  skip: !process.env.RUN_APP_SMOKE || !process.env.SECURE_DROP_TEST_DATABASE_URL,
  timeout: 120_000,
}, async () => {
  process.env.DATABASE_URL = process.env.SECURE_DROP_TEST_DATABASE_URL;
  const { prisma } = await import("@repo/db");
  const secret = randomBytes(32).toString("hex");
  const suffix = randomUUID();
  const processes: ChildProcess[] = [];
  const userIds: string[] = [];
  let organizationId: string | undefined;
  const root = fileURLToPath(new URL("../../../../../", import.meta.url));
  const origin = "https://drop.example.test";
  async function start(app: string, port: number, adminId: string) {
    const cwd = `${root}/apps/${app}`;
    const require = createRequire(`${cwd}/package.json`);
    const child = spawn(process.execPath, [require.resolve("next/dist/bin/next"), "start", "-p", String(port), "-H", "127.0.0.1"], {
      cwd, windowsHide: true, stdio: "ignore", env: {
        ...process.env, NODE_ENV: "production", AUTH_SECRET: secret, AUTH_TRUST_HOST: "true",
        AUTH_URL: `http://127.0.0.1:${port}`, ADMIN_USER_ID: adminId,
        SECURE_DROP_APP_ORIGIN: origin, SECURE_DROP_ENCRYPTION_KEY: randomBytes(32).toString("hex"),
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
    for (let i = 0; i < 2; i++) userIds.push((await prisma.user.create({ data: { email: `${suffix}-${i}@example.test`, password: "unused-test-hash" } })).id);
    const org = await prisma.organization.create({ data: { name: "HTTP smoke", slug: suffix, memberships: { create: { userId: userIds[0], role: "ADMIN" } } } });
    organizationId = org.id;
    const project = await prisma.project.create({ data: { name: "Smoke project", organizationId: org.id, createdById: userIds[0] } });
    const invite = await prisma.invite.create({ data: { organizationId: org.id, expiresAt: new Date(Date.now() + 60000) } });
    await Promise.all([start("web", 3330, userIds[0]), start("dashboard", 3331, userIds[0]), start("admin", 3332, userIds[0])]);
    const member = await cookie(userIds[0]);
    const outsider = await cookie(userIds[1]);
    const dashboard = "http://127.0.0.1:3331";
    const base = `/dashboard/organizations/${org.slug}`;
    const landing = await fetch("http://127.0.0.1:3330");
    assert.equal(landing.status, 200);
    assert.match(await landing.text(), /Secure Drop/);
    for (const path of ["/auth/sign-in", "/auth/sign-up", "/drop"]) assert.equal((await fetch(dashboard + path)).status, 200, path);
    const protectedPages: [string, RegExp][] = [
      [base, /HTTP smoke/], [`${base}/members`, /Members/], [`${base}/projects`, /Projects/],
      [`${base}/projects/new`, /Create a project/], [`${base}/projects/${project.id}/edit`, /Edit project/],
      [`${base}/secure-drop`, /Share a file securely/], ["/dashboard/organizations/new", /Create an organization/],
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
  } finally {
    for (const child of processes) child.kill();
    if (organizationId) await prisma.organization.delete({ where: { id: organizationId } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.$disconnect();
  }
});
