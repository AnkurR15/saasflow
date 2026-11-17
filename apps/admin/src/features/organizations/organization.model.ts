import { prisma } from "@repo/db";
import { requireAdminIsAuthenticated } from "@/features/auth/auth-helpers.server";

export async function retrieveAllOrganizationsFromDatabase() {
    await requireAdminIsAuthenticated();
    return prisma.organization.findMany({
        include: {
            _count: {
                select: {
                    memberships: true,
                    projects: true,
                    fileDrops: true,
                },
            },
        },
        orderBy: { createdAt: "desc" },
    });
}

export async function retrieveOrganizationWithMembersAndProjectsFromDatabase(
    id: string,
) {
    await requireAdminIsAuthenticated();
    return prisma.organization.findUnique({
        where: { id },
        include: {
            memberships: {
                include: {
                    user: { select: { id: true, email: true, name: true } },
                },
            },
            projects: {
                orderBy: { createdAt: "desc" },
            },
        },
    });
}
