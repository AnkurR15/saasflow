"use server";

import { redirect } from "next/navigation";
import { signIn, signOut } from "@/auth";
import { authServerSchema } from "./auth-schema.server";
import { ActionResult } from "@repo/types";
import { retrieveUserFromDatabaseByEmail, saveUserToDatabase } from "./auth-model";
import { hashPassword, verifyPassword } from "./auth-helpers.server";
import { safeRedirect } from "./redirect";
import { AuthError } from "next-auth";
import { Prisma } from "@repo/db";

export async function authAction(
    _previous: ActionResult,
    formData: FormData
): Promise<ActionResult> {
    const raw = Object.fromEntries(formData.entries());
    const parsed = authServerSchema.safeParse(raw);

    if (!parsed.success) {
        return { error: "Invalid Input" };
    }

    const { intent } = parsed.data

    switch (intent) {
        case "sign-in": {
            const { email, password } = parsed.data;
            const normalizedEmail = email.toLowerCase()

            const user = await retrieveUserFromDatabaseByEmail(normalizedEmail)

            if (!user) return {
                error: "Invalid email or password"
            }

            const valid = await verifyPassword(password, user.password)

            if (!valid) return {
                error: "Invalid email or password"
            }

            try { await signIn("credentials", {
                email: normalizedEmail,
                password,
                redirect: false
            }) } catch (error) {
                if (error instanceof AuthError) return { error: "Invalid email or password" };
                throw error;
            }

            redirect(safeRedirect(formData.get("redirectTo")))
        }

        case "sign-up": {
            const { email, password, confirmPassword } = parsed.data;

            if (password !== confirmPassword) return {
                error: "Passwords do not match"
            }

            const normalizedEmail = email.toLowerCase()
            const existingUser = await retrieveUserFromDatabaseByEmail(normalizedEmail)

            if (existingUser) return {
                error: "Invalid email or password"
            }

            const hashedPassword = await hashPassword(password)

            try { await saveUserToDatabase({
                email: normalizedEmail,
                password: hashedPassword
            }) } catch (error) {
                if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
                    return { error: "Unable to create account. Try signing in." };
                }
                throw error;
            }

            await signIn("credentials", {
                email: normalizedEmail,
                password,
                redirect: false
            })

            redirect(safeRedirect(formData.get("redirectTo")))
        }

        case "sign-out": {
            await signOut({ redirect: false })
            redirect("/auth/sign-in")
        }

        default: {
            return { error: "Invalid intent" }
        }
    }
}
