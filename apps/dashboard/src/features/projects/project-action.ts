"use server";

import { redirect } from "next/navigation";
import { projectsServerSchema } from "./project-schema.server";
import {
    saveProjectToDatabase,
    updateProjectInDatabase,
    deleteProjectFromDatabase,
    retrieveProjectFromDatabase,
} from "./project.model";
import { requireUserIsAuthenticated } from "@/features/auth/auth-helpers.server";
import { requireUserIsOrgMember } from "@/features/organizations/organization-helpers.server";
import { requireUserCanDeleteProject } from "./project-helpers.server";
import { retrieveOrganizationFromDatabase } from "@/features/organizations/organization.model";
import type { ActionResult } from "@repo/types";

export async function projectsAction(
    _previous: ActionResult,
    formData: FormData,
): Promise<ActionResult> {

    const raw = Object.fromEntries(formData.entries());
    const parsed = projectsServerSchema.safeParse(raw);

    if (!parsed.success) {
        return { error: "Invalid input" };
    }

    const { intent } = parsed.data;

    const { userId } = await requireUserIsAuthenticated();

    switch (intent) {
        case "create-project": {
            const { name, description, organizationId } = parsed.data;

            const [org] = await Promise.all([
                retrieveOrganizationFromDatabase(organizationId),
                requireUserIsOrgMember(organizationId, userId),
                saveProjectToDatabase({
                    name,
                    description,
                    organization: { connect: { id: organizationId } },
                    createdBy: { connect: { id: userId } },
                }),
            ]);

            redirect(`/dashboard/organizations/${org?.slug}/projects`);
        }

        case "update-project": {
            const { id, name, description } = parsed.data;

            const project = await retrieveProjectFromDatabase(id);
            if (!project) return { error: "Project not found" };

            const [org] = await Promise.all([
                retrieveOrganizationFromDatabase(project.organizationId),
                requireUserIsOrgMember(userId, project.organizationId),
                updateProjectInDatabase(id, { name, description }),
            ]);
            redirect(`/dashboard/organizations/${org?.slug}/projects`);
        }

        case "delete-project": {
            const { id } = parsed.data;

            const { project } = await requireUserCanDeleteProject({ userId, projectId: id });
            const [org] = await Promise.all([
                retrieveOrganizationFromDatabase(project.organizationId),
                deleteProjectFromDatabase(id),
            ]);

            redirect(`/dashboard/organizations/${org?.slug}/projects`);
        }

        default: {
            return { error: "Invalid intent" };
        }
    }

}