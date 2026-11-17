import { requireOrganizationMembership } from "@/features/organizations/organization-helpers.server";
import Link from "next/link";

type Props = {
  params: Promise<{ slug: string }>;
};

export default async function OrganizationPage({ params }: Props) {
  const { slug } = await params;
  const { organization, currentMembership } = await requireOrganizationMembership(slug);

  return (
    <div className="max-w-2xl mx-auto py-12 px-4">
      <h1 className="text-2xl font-semibold">{organization.name}</h1>
      <p className="text-muted-foreground text-sm mt-1">/{organization.slug}</p>
      <p className="text-xs text-muted-foreground mt-1">
        Your role: {currentMembership.role}
      </p>
      <nav aria-label="Organization features" className="mt-8 grid gap-4 sm:grid-cols-3">
        <Link className="rounded-lg border p-5 hover:bg-muted" href={`/dashboard/organizations/${slug}/projects`}>Manage projects</Link>
        <Link className="rounded-lg border p-5 hover:bg-muted" href={`/dashboard/organizations/${slug}/members`}>Team members</Link>
        <Link className="rounded-lg border p-5 hover:bg-muted" href={`/dashboard/organizations/${slug}/secure-drop`}>Share a file</Link>
      </nav>
    </div>
  );
}
