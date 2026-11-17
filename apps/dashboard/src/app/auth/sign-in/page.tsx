import { SignInForm } from "@/features/auth/components/sign-in-form";
import { safeRedirect } from "@/features/auth/redirect";
import Link from "next/link";

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ redirectTo?: string }> }) {
  const redirectTo = safeRedirect((await searchParams).redirectTo);
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-full max-w-md p-8 space-y-6">
        <h1 className="text-2xl font-semibold text-center">Sign in</h1>
        <SignInForm redirectTo={redirectTo} />
        <Link className="block text-center underline" href={`/auth/sign-up?redirectTo=${encodeURIComponent(redirectTo)}`}>Create an account</Link>
      </div>
    </div>
  );
}
