"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { invitesServerSchema } from "./invites-schema.server";
import { rotateInvite, acceptInvite } from "./invites.model";
import { requireUserIsAuthenticated } from "@/features/auth/auth-helpers.server";
import { buildInviteUrl } from "@/features/organizations/organization-helpers.server";
import type { ActionResult } from "@repo/types";

export async function invitesAction(_previous: ActionResult, formData: FormData): Promise<ActionResult<{ url?: string }>> {
    const parsed = invitesServerSchema.safeParse(Object.fromEntries(formData.entries()));
    if (!parsed.success) return { error: "Invalid input" };
    const { userId } = await requireUserIsAuthenticated();
    if (parsed.data.intent === "generate-invite") {
        const invite = await rotateInvite(parsed.data.organizationId, userId);
        if (!invite) return { error: "Only organization admins can generate invite links." };
        revalidatePath("/dashboard", "layout");
        return { data: { url: buildInviteUrl(invite.token) } };
    }
    const slug = await acceptInvite(parsed.data.token, userId);
    if (!slug) return { error: "This invite is invalid, expired, or has been replaced." };
    revalidatePath("/dashboard", "layout");
    redirect(`/dashboard/organizations/${slug}`);
}
