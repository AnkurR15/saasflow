import { auth } from "@/auth";
import { prisma } from "@repo/db";
import { encryptFile, hashToken, MAX_FILE_BYTES, newToken } from "@/features/secure-drop/crypto";
import { DropError, failure, parseFileName, privateHeaders, readLimited, sameOrigin } from "@/features/secure-drop/http";

export const runtime = "nodejs";
type Context = { params: Promise<{ organizationId: string }> };

async function authorize(request: Request, context: Context) {
  sameOrigin(request);
  const session = await auth();
  if (!session?.user?.id) throw new DropError(401, "Sign in to manage drops.");
  const { organizationId } = await context.params;
  const membership = await prisma.organizationMembership.findUnique({
    where: { userId_organizationId: { userId: session.user.id, organizationId } },
  });
  if (!membership) throw new DropError(404, "Organization not found.");
  return membership;
}

export async function POST(request: Request, context: Context) {
  try {
    const membership = await authorize(request, context);
    const fileName = parseFileName(request.headers.get("x-file-name"));
    const hours = Number(request.headers.get("x-expires-hours"));
    if (![1, 24, 168].includes(hours)) throw new DropError(400, "Choose a valid expiry.");
    const bytes = await readLimited(request, MAX_FILE_BYTES);
    if (!bytes.length) throw new DropError(400, "Empty files are not supported.");
    const token = newToken();
    const tokenHash = hashToken(token);
    const ciphertext = encryptFile(bytes, tokenHash);
    const drop = await prisma.$transaction(async (tx) => {
      // Serialize quota checks for each organization, including concurrent uploads.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${membership.organizationId}))`;
      const now = new Date();
      await tx.fileDrop.updateMany({ where: { organizationId: membership.organizationId, expiresAt: { lte: now } }, data: { ciphertext: Buffer.alloc(0) } });
      const count = await tx.fileDrop.count({ where: { organizationId: membership.organizationId, expiresAt: { gt: now }, downloadedAt: null, revokedAt: null } });
      if (count >= 20) throw new DropError(409, "This organization has 20 active drops. Revoke a drop before uploading another.");
      return tx.fileDrop.create({ data: {
        organizationId: membership.organizationId, createdById: membership.userId,
        fileName, size: bytes.length, tokenHash, ciphertext,
        expiresAt: new Date(now.getTime() + hours * 3_600_000),
      }, select: { id: true } });
    });
    return Response.json({ id: drop.id, token }, { status: 201, headers: privateHeaders });
  } catch (error) { return failure(error); }
}

export async function DELETE(request: Request, context: Context) {
  try {
    const membership = await authorize(request, context);
    const id = new URL(request.url).searchParams.get("id");
    if (!id) throw new DropError(400, "Drop ID is required.");
    const result = await prisma.fileDrop.updateMany({ where: {
      id, organizationId: membership.organizationId,
      ...(membership.role === "ADMIN" ? {} : { createdById: membership.userId }),
      downloadedAt: null, revokedAt: null,
    }, data: { revokedAt: new Date(), ciphertext: Buffer.alloc(0) } });
    if (!result.count) throw new DropError(404, "Drop not found or you cannot revoke it.");
    return new Response(null, { status: 204, headers: privateHeaders });
  } catch (error) { return failure(error); }
}
