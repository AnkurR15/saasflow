import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { isPlatformAdmin } from "./admin-policy";

export async function requireAdminIsAuthenticated() {
    const session = await auth();

    if (!session?.user?.email) {
        redirect("/auth/sign-in");
    }

    if (!isPlatformAdmin(session.user)) {
        redirect("/unauthorized");
    }

    return { userId: session.user.id, user: session.user };
}
