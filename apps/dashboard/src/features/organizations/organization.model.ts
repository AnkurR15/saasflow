import type { Prisma, Role } from "@repo/db";
import { prisma } from "@repo/db";

export async function saveOrganizationToDatabase(
    data: Prisma.OrganizationCreateInput
) {
    return prisma.organization.create({
        data
    })
}

export async function retrieveOrganizationFromDatabase(id: string) {
    return prisma.organization.findUnique({ where: { id } });
}

export async function retrieveOrganizationBySlugFromDatabase(slug: string) {
    return prisma.organization.findUnique({ where: { slug } });
}

export async function retrieveOrganizationsByUserIdFromDatabase(userId: string) {
    return prisma.organization.findMany({
        where: {
            memberships: {
                some: { userId },
            },
        },
    });
}

export async function deleteOrganizationFromDatabase(id: string) {
    return prisma.organization.delete({ where: { id } });
}

export async function saveMembershipToDatabase(
    data: Prisma.OrganizationMembershipCreateInput,
) {
    return prisma.organizationMembership.create({ data });
}

export async function retrieveMembershipFromDatabase({
    userId,
    organizationId,
}: {
    userId: string;
    organizationId: string;
}) {
    return prisma.organizationMembership.findUnique({
        where: {
            userId_organizationId: { userId, organizationId },
        },
    });
}

export async function retrieveMembershipsByOrganizationIdFromDatabase(
    organizationId: string,
) {
    return prisma.organizationMembership.findMany({
        where: { organizationId },
        include: { user: { select: { id: true, email: true, name: true } } },
    });
}

export async function manageMembership({ organizationId, userId, membershipId, role }: {
    organizationId: string; userId: string; membershipId: string; role?: Role;
}) {
    return prisma.$transaction(async tx => {
        // Serialize role changes so concurrent removals cannot eliminate every admin.
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${organizationId}))`;
        const actor = await tx.organizationMembership.findUnique({
            where: { userId_organizationId: { userId, organizationId } },
        });
        if (actor?.role !== "ADMIN") return { error: "Only organization admins can manage members." };
        const target = await tx.organizationMembership.findFirst({ where: { id: membershipId, organizationId } });
        if (!target) return { error: "Member not found in this organization." };
        if (target.role === "ADMIN" && role !== "ADMIN") {
            const admins = await tx.organizationMembership.count({ where: { organizationId, role: "ADMIN" } });
            if (admins <= 1) return { error: "Assign another admin before removing or demoting the last admin." };
        }
        if (role) {
            await tx.organizationMembership.update({ where: { id: membershipId, organizationId }, data: { role } });
        } else {
            await tx.organizationMembership.delete({ where: { id: membershipId, organizationId } });
        }
        return {};
    });
}

export async function retrieveActiveInviteByOrganizationIdFromDatabase(
    organizationId: string
) {
    return prisma.invite.findFirst({
        where: {
            organizationId,
            expiresAt: {
                gt: new Date()
            }
        },
    });
}
