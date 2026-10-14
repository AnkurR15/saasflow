import Link from "next/link";

import { retrieveAllOrganizationsFromDatabase } from "@/features/organizations/organization.model";

export default async function AdminOrganizationsPage() {
  const organizations = await retrieveAllOrganizationsFromDatabase();

  return (
    <div className="max-w-4xl mx-auto py-12 px-4">
      <h1 className="text-2xl font-semibold mb-6">Organizations</h1>

      {organizations.length === 0 ? (
        <p className="text-muted-foreground">No organizations yet.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left">
              <th className="pb-2">Name</th>
              <th className="pb-2">Members</th>
              <th className="pb-2">Projects</th>
              <th className="pb-2">Created</th>
            </tr>
          </thead>
          <tbody>
            {organizations.map((org) => (
              <tr key={org.id} className="border-b">
                <td className="py-3">
                  <Link
                    href={`/organizations/${org.id}`}
                    className="font-medium hover:underline"
                  >
                    {org.name}
                  </Link>
                </td>
                <td className="py-3">{org._count.memberships}</td>
                <td className="py-3">{org._count.projects}</td>
                <td className="py-3 text-muted-foreground">
                  {org.createdAt.toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}