import { prisma } from "@repo/db";
import { authorizeShare, lockShareMembership } from "@/features/secure-drop/share-auth";
import { readChunk, writeChunk } from "@/features/secure-drop/storage";
import { CHUNK_BYTES } from "@repo/types";
import { DropError, failure, privateHeaders, readLimited } from "@/features/secure-drop/http";

export const runtime = "nodejs";
type Context = { params: Promise<{ organizationId: string; shareId: string; fileId: string }> };

export async function PUT(request: Request, context: Context) {
  try {
    const { organizationId, shareId, fileId } = await context.params;
    const member = await authorizeShare(request, organizationId, "uploadChunk");
    const indexText = request.headers.get("x-chunk-index");
    if (!indexText || !/^(0|[1-9]\d*)$/.test(indexText) || !Number.isSafeInteger(Number(indexText))) throw new DropError(400, "Invalid chunk index.");
    const index = Number(indexText);
    const bytes = await readLimited(request, CHUNK_BYTES);
    await prisma.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`secure-share:${shareId}`}))`;
      await lockShareMembership(tx, member.id);
      const file = await tx.secureShareFile.findFirst({ where: { id: fileId, shareId, share: { organizationId, createdById: member.userId, publishedAt: null, revokedAt: null, expiresAt: { gt: new Date() } } } });
      if (!file) throw new DropError(404, "Upload not found or no longer available.");
      const offset = BigInt(index) * BigInt(CHUNK_BYTES);
      const remaining = file.size - offset;
      const expected = Number(remaining > BigInt(CHUNK_BYTES) ? BigInt(CHUNK_BYTES) : remaining);
      // A response can be lost after the chunk was committed. Accept an exact
      // retry, but never let a retry replace data already acknowledged.
      if (remaining > 0 && bytes.length === expected && file.uploadedSize >= offset + BigInt(expected)) {
        const chunk = await tx.secureShareChunk.findUnique({ where: { fileId_index: { fileId, index } } });
        if (!(await readChunk(shareId, fileId, index, chunk?.storageKey)).equals(bytes)) throw new DropError(409, "The uploaded chunk does not match the earlier upload.");
        return;
      }
      if (file.uploadedSize !== offset || remaining <= 0 || bytes.length !== expected) throw new DropError(409, "Upload chunk is out of order or has an invalid size.");
      const storageKey = await writeChunk(shareId, fileId, index, bytes);
      await tx.secureShareChunk.create({ data: { fileId, index, storageKey } });
      await tx.secureShareFile.update({ where: { id: file.id }, data: { uploadedSize: { increment: bytes.length } } });
    }, { timeout: 30_000 });
    return new Response(null, { status: 204, headers: privateHeaders });
  } catch (error) { return failure(error); }
}
