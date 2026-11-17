"use server";

import { redirect } from "next/navigation";
import slugify from "slugify";
import { organizationsServerSchema } from "./organization-schema.server";
import {
    saveOrganizationToDatabase,
    manageMembership,
} from "./organization.model";
import { requireUserIsAuthenticated } from "@/features/auth/auth-helpers.server";
import { randomUUID } from "node:crypto";
import type { ActionResult } from "@repo/types";
import { revalidatePath } from "next/cache";

export async function organizationsAction(
    _previous: ActionResult,
    formData: FormData,
): Promise<ActionResult> {
    const raw = Object.fromEntries(formData.entries())
    const parsed = organizationsServerSchema.safeParse(raw)

    if (!parsed.success) {
        return { error: "Invalid input" }
    }

    const { intent } = parsed.data
    const { userId } = await requireUserIsAuthenticated();

    switch (intent) {
        case "create-organization": {
            const { name } = parsed.data;

            const slug = `${slugify(name, { lower: true, strict: true }).slice(0, 60) || "organization"}-${randomUUID()}`;

            const org = await saveOrganizationToDatabase({
                name,
                slug,
                memberships: { create: { userId, role: "ADMIN" } },
            });

            redirect(`/dashboard/organizations/${org.slug}`)
        }

        case "update-member-role": {
            const { membershipId, organizationId, role } = parsed.data;

            const result = await manageMembership({ organizationId, userId, membershipId, role });
            if (result.error) return result;

            revalidatePath("/dashboard", "layout")

            return {}
        }

        case "remove-member": {
            const { membershipId, organizationId } = parsed.data;

            const result = await manageMembership({ organizationId, userId, membershipId });
            if (result.error) return result;

            revalidatePath("/dashboard", "layout")

            return {}
        }

        default: {
            return { error: "Invalid intent" }
        }
    }
}
