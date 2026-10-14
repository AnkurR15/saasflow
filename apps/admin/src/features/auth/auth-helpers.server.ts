import { redirect } from "next/navigation";
import { auth } from "@/auth";

export async function requireAdminIsAuthenticated() {
    const session = await auth();

    if (!session?.user?.email) {
        redirect("/auth/sign-in");
    }

    const adminEmail = process.env.ADMIN_EMAIL;

    if (session.user?.email !== adminEmail) {
        redirect("/unauthorized");
    }

    return { userId: session.user.id, user: session.user };
}