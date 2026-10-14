import type { Prisma } from "@repo/db";
import { prisma } from "@repo/db";

export async function saveProjectToDatabase(
    data: Prisma.ProjectCreateInput,
) {
    return prisma.project.create({ data });
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

export async function updateProjectInDatabase(
    id: string,
    data: Prisma.ProjectUpdateInput,
) {
    return prisma.project.update({ where: { id }, data });
}

export async function deleteProjectFromDatabase(id: string) {
    return prisma.project.delete({ where: { id } });
}