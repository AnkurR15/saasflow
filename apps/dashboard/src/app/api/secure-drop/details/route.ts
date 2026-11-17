import { prisma } from "@repo/db";
import { hashToken, TOKEN_PATTERN } from "@/features/secure-drop/crypto";
import { DropError, failure, privateHeaders, readLimited, sameOrigin } from "@/features/secure-drop/http";

export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const token = (await readLimited(request, 100)).toString("utf8");
    if (!TOKEN_PATTERN.test(token)) throw new DropError(404, "This share is unavailable.");
    const tokenHash = hashToken(token);
    const now = new Date();
    const share = await prisma.secureShare.findUnique({ where: { tokenHash }, include: { files: { orderBy: { path: "asc" } }, organization: { select: { name: true } } } });
    if (share && share.publishedAt && !share.revokedAt && share.expiresAt > now) {
      return Response.json({ organization: share.organization.name, expiresAt: share.expiresAt.toISOString(), downloadOnce: share.downloadOnce,
        files: share.files.map(file => ({ id: file.id, path: file.path, size: Number(file.size), downloaded: share.downloadOnce && !!file.downloadedAt })) }, { headers: privateHeaders });
    }
    const legacy = await prisma.fileDrop.findUnique({ where: { tokenHash }, select: { id: true, fileName: true, size: true, downloadedAt: true, revokedAt: true, expiresAt: true, organization: { select: { name: true } } } });
    if (!legacy || legacy.revokedAt || legacy.downloadedAt || legacy.expiresAt <= now) throw new DropError(404, "This share has expired, was revoked, or is unavailable.");
    return Response.json({ organization: legacy.organization.name, expiresAt: legacy.expiresAt.toISOString(), downloadOnce: true, legacy: true,
      files: [{ id: legacy.id, path: legacy.fileName, size: legacy.size, downloaded: false }] }, { headers: privateHeaders });
  } catch (error) { return failure(error); }
}
