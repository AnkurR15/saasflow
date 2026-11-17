import { SignUpForm } from "@/features/auth/components/sign-up-form";
import { safeRedirect } from "@/features/auth/redirect";
import Link from "next/link";

export default async function SignUpPage({ searchParams }: { searchParams: Promise<{ redirectTo?: string }> }) {
  const redirectTo = safeRedirect((await searchParams).redirectTo);
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-full max-w-md p-8 space-y-6">
        <h1 className="text-2xl font-semibold text-center">Create account</h1>
        <SignUpForm redirectTo={redirectTo} />
        <Link className="block text-center underline" href={`/auth/sign-in?redirectTo=${encodeURIComponent(redirectTo)}`}>Already have an account? Sign in</Link>
      </div>
    </div>
  );
}
