import { SidebarProvider, SidebarTrigger } from "@repo/ui/components/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { requireAdminIsAuthenticated } from "@/features/auth/auth-helpers.server";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = await requireAdminIsAuthenticated();

  return (
    <SidebarProvider>
      <AppSidebar userEmail={user.email ?? ""} />
      <main className="flex flex-col flex-1 min-h-svh">
        <div className="flex items-center gap-2 p-2 border-b">
          <SidebarTrigger />
        </div>
        {children}
      </main>
    </SidebarProvider>
  );
}