import { signOut } from "@/auth";

export default function UnauthorizedPage() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-semibold">Unauthorized</h1>
        <p className="text-muted-foreground mt-2">
          You do not have permission to access this page.
        </p>
        <form action={async () => { "use server"; await signOut({ redirectTo: "/auth/sign-in" }); }}>
          <button className="mt-6 underline" type="submit">Sign out and use another account</button>
        </form>
      </div>
    </div>
  );
}
