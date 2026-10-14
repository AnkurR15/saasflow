import { retrieveOrganizationWithMembersAndProjectsFromDatabase } from "@/features/organizations/organization.model";
import { notFound } from "next/navigation";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function AdminOrganizationPage({ params }: Props) {
  const { id } = await params;

  const org = await retrieveOrganizationWithMembersAndProjectsFromDatabase(id);

  if (!org) notFound();

  return (
    <div className="max-w-4xl mx-auto py-12 px-4 space-y-10">
      <div>
        <h1 className="text-2xl font-semibold">{org.name}</h1>
        <p className="text-muted-foreground text-sm">/{org.slug}</p>
      </div>

      {/* Members */}
      <div>
        <h2 className="text-lg font-semibold mb-4">
          Members ({org.memberships.length})
        </h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left">
              <th className="pb-2">Email</th>
              <th className="pb-2">Name</th>
              <th className="pb-2">Role</th>
            </tr>
          </thead>
          <tbody>
            {org.memberships.map((m) => (
              <tr key={m.id} className="border-b">
                <td className="py-3">{m.user.email}</td>
                <td className="py-3">{m.user.name ?? "—"}</td>
                <td className="py-3">{m.role}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Projects */}
      <div>
        <h2 className="text-lg font-semibold mb-4">
          Projects ({org.projects.length})
        </h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left">
              <th className="pb-2">Name</th>
              <th className="pb-2">Description</th>
              <th className="pb-2">Created</th>
            </tr>
          </thead>
          <tbody>
            {org.projects.map((p) => (
              <tr key={p.id} className="border-b">
                <td className="py-3 font-medium">{p.name}</td>
                <td className="py-3 text-muted-foreground">
                  {p.description ?? "—"}
                </td>
                <td className="py-3 text-muted-foreground">
                  {p.createdAt.toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}