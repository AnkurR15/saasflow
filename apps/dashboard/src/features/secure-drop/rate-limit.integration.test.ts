import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac, randomBytes } from "node:crypto";

test("recipient requests share an atomic budget, honor the trusted ingress address and recover after expiry", {
  skip: !process.env.SECURE_DROP_TEST_DATABASE_URL,
}, async () => {
  process.env.DATABASE_URL = process.env.SECURE_DROP_TEST_DATABASE_URL;
  process.env.AUTH_SECRET = randomBytes(32).toString("hex");
  process.env.ARCJET_KEY = "";
  process.env.RATE_LIMIT_IP_HEADER = "x-client-ip";
  const origin = "https://drop.example.test";
  process.env.SECURE_DROP_APP_ORIGIN = origin;
  const { prisma } = await import("@repo/db");
  const { POST } = await import("../../app/api/secure-drop/details/route");
  const addresses = ["192.0.2.1", "192.0.2.2"];
  const buckets = addresses.map(ip => createHmac("sha256", process.env.AUTH_SECRET!).update(`listFiles:ip:${ip}`).digest("hex"));
  const open = (ip: string, forwarded: number) => POST(new Request(origin + "/api/secure-drop/details", {
    method: "POST", body: "invalid", headers: { origin, "x-client-ip": ip, "x-forwarded-for": `198.51.100.${forwarded}` },
  }));
  try {
    const responses = await Promise.all(Array.from({ length: 61 }, (_, i) => open(addresses[0], i)));
    assert.equal(responses.filter(r => r.status === 404).length, 60);
    const denied = responses.filter(r => r.status === 429);
    assert.equal(denied.length, 1);
    assert.equal(denied[0].headers.get("retry-after"), "60");
    assert.equal(denied[0].headers.get("cache-control"), "no-store");
    assert.equal((await open(addresses[1], 0)).status, 404);
    await prisma.requestRateLimit.update({ where: { bucket: buckets[0] }, data: { expiresAt: new Date(0) } });
    assert.equal((await open(addresses[0], 0)).status, 404);
  } finally {
    await prisma.requestRateLimit.deleteMany({ where: { bucket: { in: buckets } } });
    await prisma.$disconnect();
  }
});
