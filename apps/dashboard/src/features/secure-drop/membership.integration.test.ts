import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

test("member management rejects cross-tenant targets and preserves an admin under concurrency", {
  skip: !process.env.SECURE_DROP_TEST_DATABASE_URL,
}, async () => {
  process.env.DATABASE_URL = process.env.SECURE_DROP_TEST_DATABASE_URL;
  const { prisma } = await import("@repo/db");
  const { manageMembership } = await import("../organizations/organization.model");
  const { saveProjectToDatabase, updateProjectInDatabase, deleteProjectFromDatabase } = await import("../projects/project.model");
  const suffix = randomUUID();
  const users: string[] = [];
  const organizations: string[] = [];
  try {
    for (let i = 0; i < 3; i++) {
      const user = await prisma.user.create({ data: { email: `${suffix}-${i}@example.test`, password: "unused-test-hash" } });
      users.push(user.id);
    }
    for (let i = 0; i < 2; i++) {
      const org = await prisma.organization.create({ data: { name: "Membership test", slug: `${suffix}-${i}` } });
      organizations.push(org.id);
    }
    const [admin, second, foreign] = await Promise.all([
      prisma.organizationMembership.create({ data: { organizationId: organizations[0], userId: users[0], role: "ADMIN" } }),
      prisma.organizationMembership.create({ data: { organizationId: organizations[0], userId: users[1], role: "ADMIN" } }),
      prisma.organizationMembership.create({ data: { organizationId: organizations[1], userId: users[2], role: "MEMBER" } }),
    ]);
    const base = { organizationId: organizations[0], userId: users[0] };
    const fields = { name: "Scoped project" };
    await assert.rejects(saveProjectToDatabase(base.organizationId, foreign.userId, fields), { code: "P2025" });
    await saveProjectToDatabase(base.organizationId, admin.userId, fields);
    const project = await prisma.project.findFirstOrThrow({ where: { organizationId: base.organizationId } });
    await assert.rejects(updateProjectInDatabase(project.id, foreign.userId, fields), { code: "P2025" });
    await assert.rejects(deleteProjectFromDatabase(project.id, foreign.userId), { code: "P2025" });
    await manageMembership({ ...base, membershipId: second.id, role: "MEMBER" });
    await updateProjectInDatabase(project.id, second.userId, { name: "Edited by member" });
    await assert.rejects(deleteProjectFromDatabase(project.id, second.userId), { code: "P2025" });
    await manageMembership({ ...base, membershipId: second.id, role: "MODERATOR" });
    await deleteProjectFromDatabase(project.id, second.userId);
    await manageMembership({ ...base, membershipId: second.id, role: "ADMIN" });
    assert.ok((await manageMembership({ ...base, membershipId: foreign.id, role: "ADMIN" })).error);
    assert.ok((await manageMembership({ ...base, membershipId: foreign.id })).error);
    assert.equal((await prisma.organizationMembership.findUniqueOrThrow({ where: { id: foreign.id } })).role, "MEMBER");
    assert.ok((await manageMembership({ ...base, userId: users[2], membershipId: admin.id })).error);
    const results = await Promise.all([
      manageMembership({ ...base, membershipId: admin.id, role: "MEMBER" }),
      manageMembership({ ...base, userId: users[1], membershipId: second.id }),
    ]);
    assert.equal(results.filter(result => result.error).length, 1);
    assert.equal(await prisma.organizationMembership.count({ where: { organizationId: organizations[0], role: "ADMIN" } }), 1);
  } finally {
    await prisma.organization.deleteMany({ where: { id: { in: organizations } } });
    await prisma.user.deleteMany({ where: { id: { in: users } } });
    await prisma.$disconnect();
  }
});
