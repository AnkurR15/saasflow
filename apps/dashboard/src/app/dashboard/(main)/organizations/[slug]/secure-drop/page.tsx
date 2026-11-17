import { prisma } from "@repo/db";
import { requireOrganizationMembership } from "@/features/organizations/organization-helpers.server";
import { DropManager } from "@/features/secure-drop/drop-manager";

export default async function SecureDropPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { organization, userId, currentMembership, members } = await requireOrganizationMembership(slug);
  const isAdmin = currentMembership.role === "ADMIN";
  const scope = { organizationId: organization.id, ...(isAdmin ? {} : { createdById: userId }) };
  const [projects, shares, legacy] = await Promise.all([
    prisma.project.findMany({ where: { organizationId: organization.id }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.secureShare.findMany({ where: { ...scope, publishedAt: { not: null } }, orderBy: { createdAt: "desc" }, take: 100,
      include: { project: { select: { name: true } }, files: { select: { path: true, size: true, downloadedAt: true, downloadCount: true } } } }),
    prisma.fileDrop.findMany({ where: scope, orderBy: { createdAt: "desc" }, take: 100,
      select: { id: true, fileName: true, size: true, expiresAt: true, createdAt: true, downloadedAt: true, revokedAt: true, createdById: true } }),
  ]);
  const now = new Date();
  const sender = (id: string) => members.find(member => member.userId === id)?.user.name || members.find(member => member.userId === id)?.user.email || "Former member";
  const items = [
    ...shares.map(share => {
      const downloaded = share.files.filter(file => file.downloadedAt).length;
      const status = share.revokedAt ? "Revoked" : share.expiresAt <= now ? "Expired" : share.downloadOnce && downloaded === share.files.length ? "Downloaded" : downloaded ? (share.downloadOnce ? "Partially downloaded" : "Accessed") : "Ready";
      return { id: share.id, title: share.files.length === 1 ? share.files[0].path : `${share.files.length} files`, size: share.files.reduce((sum, file) => sum + Number(file.size), 0),
        expiresAt: share.expiresAt.toISOString(), createdAt: share.createdAt.toISOString(), status, canRevoke: !share.revokedAt && share.expiresAt > now,
        project: share.project?.name, sender: sender(share.createdById), mode: share.downloadOnce ? "Once per file" : "Multiple downloads", legacy: false,
        downloads: share.files.reduce((sum, file) => sum + file.downloadCount, 0) };
    }),
    ...legacy.map(drop => {
      const status = drop.revokedAt ? "Revoked" : drop.downloadedAt ? "Downloaded" : drop.expiresAt <= now ? "Expired" : "Ready";
      return { id: drop.id, title: drop.fileName, size: drop.size, expiresAt: drop.expiresAt.toISOString(), createdAt: drop.createdAt.toISOString(), status,
        canRevoke: status === "Ready", project: undefined, sender: sender(drop.createdById), mode: "Once per file", legacy: true, downloads: drop.downloadedAt ? 1 : 0 };
    }),
  ].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return <main className="mx-auto w-full max-w-5xl space-y-6 px-4 py-6 sm:p-6">
    <div><h1 className="text-3xl font-semibold">Secure Drop</h1>
      <p className="mt-2 text-muted-foreground">Share files and folders for {organization.name} with an expiring link.</p>
    </div>
    <DropManager organizationId={organization.id} organizationName={organization.name} projects={projects} drops={items} isAdmin={isAdmin} />
  </main>;
}
