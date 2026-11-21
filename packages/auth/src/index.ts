import { prisma } from "@repo/db";
import NextAuth, { CredentialsSignin } from "next-auth";
import bcrypt from "bcryptjs";
import Credentials from "next-auth/providers/credentials";
import { checkRateLimit } from "./rate-limit";

export async function verifyPassword(
    password: string,
    hash: string,
): Promise<boolean> {
    return bcrypt.compare(password, hash)
}

export const { handlers, auth, signIn, signOut } = NextAuth({
    session: { strategy: "jwt" },
    providers: [
        Credentials({
            credentials: {
                email: { label: "Email", type: "email" },
                password: { label: "Password", type: "password" },
            },
            async authorize(credentials, request) {
                const rejected = await checkRateLimit("signIn", request.headers);
                if (rejected) {
                    const error = new CredentialsSignin();
                    error.code = rejected.status === 429 ? "rate_limit" : "unavailable";
                    throw error;
                }
                if (typeof credentials?.email !== "string" || typeof credentials?.password !== "string") return null;

                const email = String(credentials.email).toLowerCase().trim();
                const password = credentials.password;

                const user = await prisma.user.findUnique({
                    where: {
                        email,
                    },
                });

                if (!user) return null;

                const ok = await verifyPassword(password, user.password);

                if (!ok) return null;

                return {
                    id: user.id,
                    email: user.email,
                    name: user.name ?? undefined,
                }
            }
        })
    ],
    pages: {
        signIn: "/auth/sign-in",
        newUser: "/auth/sign-up"
    },
    callbacks: {
        jwt({ token, user }) {
            if (user) token.id = user.id;
            return token;
        },
        session({ session, token }) {
            if (token.id) session.user.id = token.id as string;
            return session;
        }
    }
})
