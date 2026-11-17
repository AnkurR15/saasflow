import { prisma } from "@repo/db";
import { authorizeShare } from "@/features/secure-drop/share-auth";
import { DropError, failure, privateHeaders, readLimited } from "@/features/secure-drop/http";
import { MAX_ORGANIZATION_BYTES, MAX_SHARE_BYTES, MAX_SHARE_FILE_BYTES, MAX_SHARE_FILES, parseRelativePath, prepareStorage } from "@/features/secure-drop/storage";

export const runtime = "nodejs";
type Context = { params: Promise<{ organizationId: string }> };

export async function POST(request: Request, context: Context) {
  try {
    const { organizationId } = await context.params;
    const member = await authorizeShare(request, organizationId);
    let input: { files?: { path?: unknown; size?: unknown }[]; projectId?: unknown; hours?: unknown; downloadOnce?: unknown };
    try { input = JSON.parse((await readLimited(request, 256 * 1024)).toString("utf8")); }
    catch (error) { if (error instanceof DropError) throw error; throw new DropError(400, "Invalid share details."); }
    if (!input || !Array.isArray(input.files) || !input.files.length || input.files.length > MAX_SHARE_FILES) throw new DropError(400, `Select between 1 and ${MAX_SHARE_FILES} files.`);
    if (![1, 24, 168].includes(Number(input.hours)) || typeof input.downloadOnce !== "boolean") throw new DropError(400, "Choose a valid expiry and download option.");
    const files = input.files.map(file => {
      if (!file || !Number.isSafeInteger(file.size) || Number(file.size) <= 0 || Number(file.size) > MAX_SHARE_FILE_BYTES) throw new DropError(400, "Each file must be non-empty and no larger than 5 GiB.");
      return { path: parseRelativePath(file.path), size: BigInt(Number(file.size)) };
    });
    if (new Set(files.map(file => file.path)).size !== files.length) throw new DropError(400, "Each file must have a unique path.");
    const total = files.reduce((sum, file) => sum + file.size, BigInt(0));
    if (total > BigInt(MAX_SHARE_BYTES)) throw new DropError(400, "A share can contain up to 20 GiB in total.");
    if (input.projectId != null && (typeof input.projectId !== "string" || !input.projectId)) throw new DropError(400, "Invalid project.");
    await prepareStorage();
    const share = await prisma.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`secure-share-org:${organizationId}`}))`;
      if (input.projectId && !await tx.project.findFirst({ where: { id: input.projectId as string, organizationId }, select: { id: true } })) throw new DropError(400, "Project does not belong to this organization.");
      const now = new Date();
      const active = { organizationId, revokedAt: null, expiresAt: { gt: now } };
      const [count, reserved] = await Promise.all([
        tx.secureShare.count({ where: active }),
        tx.secureShareFile.aggregate({ where: { share: active }, _sum: { size: true } }),
      ]);
      if (count >= 20) throw new DropError(409, "This organization has 20 active shares or uploads. Revoke a share or try later.");
      if ((reserved._sum.size ?? BigInt(0)) + total > BigInt(MAX_ORGANIZATION_BYTES)) throw new DropError(409, "The organization has reached its 50 GiB active storage limit.");
      return tx.secureShare.create({ data: {
        organizationId, createdById: member.userId, projectId: (input.projectId as string) || null,
        expiryHours: Number(input.hours), downloadOnce: input.downloadOnce as boolean,
        expiresAt: new Date(now.getTime() + 24 * 3_600_000), files: { create: files },
      }, select: { id: true, files: { select: { id: true, path: true } } } });
    });
    return Response.json(share, { status: 201, headers: privateHeaders });
  } catch (error) { return failure(error); }
}
