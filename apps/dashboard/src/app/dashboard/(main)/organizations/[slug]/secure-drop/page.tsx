import { prisma } from "@repo/db";
import { requireOrganizationMembership } from "@/features/organizations/organization-helpers.server";
import { DropManager } from "@/features/secure-drop/drop-manager";

export default async function SecureDropPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { organization, userId, currentMembership } = await requireOrganizationMembership(slug);
  const now = new Date();
  const active = { downloadedAt: null, revokedAt: null, expiresAt: { gt: now } };
  const select = { id: true, fileName: true, size: true, expiresAt: true, downloadedAt: true, revokedAt: true, createdById: true } as const;
  const [activeDrops, history] = await Promise.all([
    prisma.fileDrop.findMany({ where: { organizationId: organization.id, ...active }, orderBy: { createdAt: "desc" }, select }),
    prisma.fileDrop.findMany({ where: { organizationId: organization.id, NOT: active }, orderBy: { createdAt: "desc" }, take: 100, select }),
  ]);
  const drops = [...activeDrops, ...history];
  return <main className="mx-auto w-full max-w-4xl space-y-6 px-4 py-6 sm:p-6">
    <div><h1 className="text-3xl font-semibold">Secure Drop</h1>
      <p className="mt-2 text-muted-foreground">Send files with expiring, one-time links for {organization.name}.</p>
    </div>
    <DropManager organizationId={organization.id} drops={drops.map(drop => {
      const status = drop.revokedAt ? "Revoked" : drop.downloadedAt ? "Downloaded" : drop.expiresAt <= new Date() ? "Expired" : "Ready";
      return { id: drop.id, fileName: drop.fileName, size: drop.size, expiresAt: drop.expiresAt.toISOString(), status,
        canRevoke: status === "Ready" && (drop.createdById === userId || currentMembership.role === "ADMIN") };
    })} />
  </main>;
}
