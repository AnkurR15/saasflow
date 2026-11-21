"use server";

import { redirect } from "next/navigation";
import { signIn, signOut } from "@/auth";
import { authServerSchema } from "./auth-schema.server";
import { ActionResult } from "@repo/types";
import { retrieveUserFromDatabaseByEmail, saveUserToDatabase } from "./auth-model";
import { hashPassword } from "./auth-helpers.server";
import { safeRedirect } from "./redirect";
import { AuthError, CredentialsSignin } from "next-auth";
import { headers } from "next/headers";
import { checkRateLimit } from "@repo/auth/rate-limit";
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

            try { await signIn("credentials", {
                email: normalizedEmail,
                password,
                redirect: false
            }) } catch (error) {
                if (error instanceof CredentialsSignin && error.code === "rate_limit") return { error: "Too many sign-in attempts. Try again in a minute." };
                if (error instanceof CredentialsSignin && error.code === "unavailable") return { error: "Sign-in is temporarily unavailable." };
                if (error instanceof AuthError) return { error: "Invalid email or password" };
                throw error;
            }

            redirect(safeRedirect(formData.get("redirectTo")))
        }

        case "sign-up": {
            const { email, password, confirmPassword } = parsed.data;
            const rejected = await checkRateLimit("signUp", await headers());
            if (rejected) return { error: rejected.message };

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

            try {
                await signIn("credentials", { email: normalizedEmail, password, redirect: false });
            } catch (error) {
                if (error instanceof AuthError) return { error: "Account created. Please sign in again in a minute." };
                throw error;
            }

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
