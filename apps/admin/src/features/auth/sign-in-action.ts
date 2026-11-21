"use server";

import { AuthError, CredentialsSignin } from "next-auth";
import { signIn } from "@/auth";
import { redirect } from "next/navigation";

export async function adminSignIn(formData: FormData) {
  try {
    await signIn("credentials", { email: formData.get("email"), password: formData.get("password"), redirectTo: "/" });
  } catch (error) {
    if (error instanceof CredentialsSignin && error.code === "rate_limit") redirect("/auth/sign-in?error=rate_limit");
    if (error instanceof CredentialsSignin && error.code === "unavailable") redirect("/auth/sign-in?error=unavailable");
    if (error instanceof AuthError) redirect("/auth/sign-in?error=credentials");
    throw error;
  }
}
