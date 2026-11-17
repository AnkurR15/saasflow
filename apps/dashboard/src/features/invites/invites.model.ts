import type { Prisma } from "@repo/db";
import { prisma } from "@repo/db";
import { randomBytes } from "node:crypto";

export async function rotateInvite(organizationId: string, userId: string) {
    return prisma.$transaction(async tx => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${organizationId}))`;
        const actor = await tx.organizationMembership.findUnique({ where: { userId_organizationId: { userId, organizationId } } });
        if (actor?.role !== "ADMIN") return null;
        await tx.invite.deleteMany({ where: { organizationId } });
        return tx.invite.create({ data: { organizationId, token: randomBytes(32).toString("base64url"), expiresAt: new Date(Date.now() + 7 * 86400000) } });
    });
}

export async function acceptInvite(token: string, userId: string) {
    return prisma.$transaction(async tx => {
        const candidate = await tx.invite.findUnique({ where: { token } });
        if (!candidate) return null;
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${candidate.organizationId}))`;
        const invite = await tx.invite.findUnique({ where: { token }, include: { organization: true } });
        if (!invite || invite.expiresAt <= new Date()) return null;
        await tx.organizationMembership.upsert({
            where: { userId_organizationId: { userId, organizationId: invite.organizationId } },
            create: { userId, organizationId: invite.organizationId, role: "MEMBER" }, update: {},
        });
        return invite.organization.slug;
    });
}

export async function saveInviteToDatabase(
    data: Prisma.InviteCreateInput
) {
    return prisma.invite.create({
        data
    })
}

export async function retrieveInviteByTokenFromDatabase(token: string) {
    return prisma.invite.findUnique({
        where: { token },
        include: { organization: true }
    })
}

export async function deleteInviteFromDatabase(id: string) {
    return prisma.invite.delete({ where: { id } });
}

export async function deleteInvitesByOrganizationIdFromDatabase(
    organizationId: string
) {
    return prisma.invite.deleteMany({ where: { organizationId } });
 }
