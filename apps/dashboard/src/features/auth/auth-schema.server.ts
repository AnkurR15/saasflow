import { z } from "zod";
import { signUpSchema } from "./auth-schema.client";

export const authServerSchema = z.discriminatedUnion("intent", [
    z.object({
        intent: z.literal("sign-in"),
        email: z.string().email(),
        password: z.string().min(6),
    }),
    z.object({
        intent: z.literal("sign-up"),
        email: z.string().email(),
        password: signUpSchema.shape.password,
        confirmPassword: z.string().min(6),
    }),
    z.object({
        intent: z.literal("sign-out"),
    }),
])
