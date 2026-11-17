import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

test("invite rotation is atomic and repeated acceptance preserves roles", { skip: !process.env.SECURE_DROP_TEST_DATABASE_URL }, async () => {
  process.env.DATABASE_URL = process.env.SECURE_DROP_TEST_DATABASE_URL;
  const { prisma } = await import("@repo/db");
  const { rotateInvite, acceptInvite } = await import("../invites/invites.model");
  const suffix = randomUUID();
  const users: string[] = [];
  let organizationId: string | undefined;
  try {
    for (let i = 0; i < 2; i++) {
      users.push((await prisma.user.create({ data: { email: `${suffix}-${i}@example.test`, password: "unused-test-hash" } })).id);
    }
    const org = await prisma.organization.create({ data: { name: "Invite regression", slug: suffix, memberships: { create: { userId: users[0], role: "ADMIN" } } } });
    organizationId = org.id;
    assert.equal(await rotateInvite(org.id, users[1]), null);
    const first = await rotateInvite(org.id, users[0]);
    assert.ok(first);
    const rotated = await Promise.all([rotateInvite(org.id, users[0]), rotateInvite(org.id, users[0])]);
    assert.equal(await prisma.invite.count({ where: { organizationId: org.id } }), 1);
    assert.equal(await acceptInvite(first.token, users[1]), null);
    const active = await prisma.invite.findFirstOrThrow({ where: { organizationId: org.id } });
    assert.ok(rotated.some(invite => invite?.token === active.token));
    assert.deepEqual(await Promise.all([acceptInvite(active.token, users[1]), acceptInvite(active.token, users[1])]), [org.slug, org.slug]);
    assert.equal(await prisma.organizationMembership.count({ where: { userId: users[1], organizationId: org.id } }), 1);
    await acceptInvite(active.token, users[0]);
    assert.equal((await prisma.organizationMembership.findUniqueOrThrow({ where: { userId_organizationId: { userId: users[0], organizationId: org.id } } })).role, "ADMIN");
    await prisma.invite.update({ where: { id: active.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    assert.equal(await acceptInvite(active.token, users[1]), null);
  } finally {
    if (organizationId) await prisma.organization.delete({ where: { id: organizationId } });
    await prisma.user.deleteMany({ where: { id: { in: users } } });
    await prisma.$disconnect();
  }
});
