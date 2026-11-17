import Link from "next/link";
import { notFound } from "next/navigation";
import { requireOrganizationMembership } from "@/features/organizations/organization-helpers.server";
import { retrieveProjectFromDatabase } from "@/features/projects/project.model";
import { CreateProjectForm } from "@/features/projects/components/create-project-form";

export default async function EditProjectPage({ params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params;
  const { organization } = await requireOrganizationMembership(slug);
  const project = await retrieveProjectFromDatabase(id);
  if (!project || project.organizationId !== organization.id) notFound();
  return <div className="mx-auto w-full max-w-md space-y-6 px-4 py-12">
    <Link className="underline" href={`/dashboard/organizations/${slug}/projects`}>Back to projects</Link>
    <h1 className="text-2xl font-semibold">Edit project</h1>
    <CreateProjectForm organizationId={organization.id} project={project} />
  </div>;
}
