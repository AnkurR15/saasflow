import { prisma } from "@repo/db";

const organizationSlug = { organization: { select: { slug: true } } } as const;
type ProjectFields = { name: string; description?: string };

export async function saveProjectToDatabase(organizationId: string, userId: string, fields: ProjectFields) {
    return prisma.project.create({
        data: {
            ...fields,
            organization: { connect: { id: organizationId, memberships: { some: { userId } } } },
            createdBy: { connect: { id: userId } },
        },
        select: organizationSlug,
    });
}

export async function retrieveProjectFromDatabase(id: string) {
    return prisma.project.findUnique({ where: { id } });
}

export async function retrieveProjectsByOrganizationIdFromDatabase(
    organizationId: string,
) {
    return prisma.project.findMany({
        where: { organizationId },
        orderBy: { createdAt: "desc" },
    });
}

export async function updateProjectInDatabase(id: string, userId: string, fields: ProjectFields) {
    return prisma.project.update({
        where: { id, organization: { memberships: { some: { userId } } } },
        data: fields, select: organizationSlug,
    });
}

export async function deleteProjectFromDatabase(id: string, userId: string) {
    return prisma.project.delete({
        where: { id, OR: [
            { createdById: userId, organization: { memberships: { some: { userId } } } },
            { organization: { memberships: { some: { userId, role: { in: ["ADMIN", "MODERATOR"] } } } } },
        ] },
        select: organizationSlug,
    });
}
