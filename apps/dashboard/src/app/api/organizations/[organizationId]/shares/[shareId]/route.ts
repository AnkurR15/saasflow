import { prisma } from "@repo/db";
import { authorizeShare, lockShareMembership } from "@/features/secure-drop/share-auth";
import { newToken, hashToken } from "@/features/secure-drop/crypto";
import { DropError, failure, privateHeaders } from "@/features/secure-drop/http";

export const runtime = "nodejs";
type Context = { params: Promise<{ organizationId: string; shareId: string }> };

export async function POST(request: Request, context: Context) {
  try {
    const { organizationId, shareId } = await context.params;
    const member = await authorizeShare(request, organizationId, "manageShare");
    const token = newToken();
    await prisma.$transaction(async tx => {
      // Use the same lock order as reservation creation before extending expiry.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`secure-share-org:${organizationId}`}))`;
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`secure-share:${shareId}`}))`;
      await lockShareMembership(tx, member.id);
      const share = await tx.secureShare.findFirst({ where: { id: shareId, organizationId, createdById: member.userId, revokedAt: null, publishedAt: null, expiresAt: { gt: new Date() } }, include: { files: true } });
      if (!share) throw new DropError(404, "Upload not found or no longer available.");
      if (!share.files.length || share.files.some(file => file.uploadedSize !== file.size)) throw new DropError(409, "All files must finish uploading before creating a link.");
      const now = new Date();
      await tx.secureShare.update({ where: { id: share.id }, data: { tokenHash: hashToken(token), publishedAt: now, expiresAt: new Date(now.getTime() + share.expiryHours * 3_600_000) } });
    });
    return Response.json({ id: shareId, token }, { headers: privateHeaders });
  } catch (error) { return failure(error); }
}

export async function DELETE(request: Request, context: Context) {
  try {
    const { organizationId, shareId } = await context.params;
    const member = await authorizeShare(request, organizationId, "manageShare");
    await prisma.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`secure-share:${shareId}`}))`;
      const role = await lockShareMembership(tx, member.id);
      const result = await tx.secureShare.updateMany({ where: { id: shareId, organizationId, revokedAt: null, ...(role === "ADMIN" ? {} : { createdById: member.userId }) }, data: { revokedAt: new Date() } });
      if (!result.count) throw new DropError(404, "Share not found or you cannot revoke it.");
    });
    return new Response(null, { status: 204, headers: privateHeaders });
  } catch (error) { return failure(error); }
}
