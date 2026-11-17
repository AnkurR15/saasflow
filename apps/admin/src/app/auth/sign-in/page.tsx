import { adminSignIn } from "@/features/auth/sign-in-action";

export default async function AdminSignInPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-full max-w-md p-8 space-y-6">
        <h1 className="text-2xl font-semibold text-center">Admin sign in</h1>
        {error && <p role="alert">Sign in failed. Check your email and password and try again.</p>}
        <form
          action={adminSignIn}
          className="space-y-4"
        >
          <input
            name="email"
            aria-label="Email"
            autoComplete="email"
            type="email"
            placeholder="Email"
            className="w-full border rounded px-3 py-2"
            required
          />
          <input
            name="password"
            aria-label="Password"
            autoComplete="current-password"
            type="password"
            placeholder="Password"
            className="w-full border rounded px-3 py-2"
            required
          />
          <button
            type="submit"
            className="w-full bg-primary text-primary-foreground rounded px-4 py-2"
          >
            Sign in
          </button>
        </form>
      </div>
    </div>
  );
}
