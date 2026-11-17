import { DeleteProjectButton } from "@/features/projects/components/delete-project-button";
import Link from "next/link";

type Project = {
  id: string;
  name: string;
  description: string | null;
  createdAt: Date;
  createdById: string | null;
};

type Props = {
  project: Project;
  userRole: "ADMIN" | "MODERATOR" | "MEMBER";
  currentUserId: string;
  organizationSlug: string;
};

export function ProjectCard({ project, userRole, currentUserId, organizationSlug }: Props) {
  const canDelete =
    userRole === "ADMIN" ||
    userRole === "MODERATOR" ||
    project.createdById === currentUserId;

  return (
    <div className="border rounded-lg p-4 flex items-start justify-between">
      <div>
        <h3 className="font-medium">{project.name}</h3>
        {project.description && (
          <p className="text-sm text-muted-foreground mt-1">
            {project.description}
          </p>
        )}
      </div>
      <div className="flex items-center gap-3">
        <Link className="text-sm underline" href={`/dashboard/organizations/${organizationSlug}/projects/${project.id}/edit`}>Edit</Link>
        <DeleteProjectButton projectId={project.id} canDelete={canDelete} />
      </div>
    </div>
  );
}
