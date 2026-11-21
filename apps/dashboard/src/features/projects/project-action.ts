"use server";

import { Prisma } from "@repo/db";
import type { ActionResult } from "@repo/types";
import { redirect } from "next/navigation";
import { requireUserIsAuthenticated } from "@/features/auth/auth-helpers.server";
import { projectsServerSchema } from "./project-schema.server";
import { deleteProjectFromDatabase, saveProjectToDatabase, updateProjectInDatabase } from "./project.model";

export async function projectsAction(_previous: ActionResult, formData: FormData): Promise<ActionResult> {
    const parsed = projectsServerSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return { error: "Invalid input" };
    const { userId } = await requireUserIsAuthenticated();
    const input = parsed.data;
    let result;
    try {
        switch (input.intent) {
            case "create-project":
                result = await saveProjectToDatabase(input.organizationId, userId, { name: input.name, description: input.description });
                break;
            case "update-project":
                result = await updateProjectInDatabase(input.id, userId, { name: input.name, description: input.description });
                break;
            case "delete-project":
                result = await deleteProjectFromDatabase(input.id, userId);
                break;
        }
    } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
            return { error: "The project or organization is unavailable, or your role does not allow this change." };
        }
        throw error;
    }
    redirect(`/dashboard/organizations/${result.organization.slug}/projects`);
}
