import { prisma } from "@repo/db";
import { hashToken, TOKEN_PATTERN } from "@/features/secure-drop/crypto";
import { readChunk } from "@/features/secure-drop/storage";
import { CHUNK_BYTES } from "@repo/types";
import { DropError, failure, privateHeaders, readLimited, sameOrigin } from "@/features/secure-drop/http";

import { limitDropRequest } from "@/features/secure-drop/rate-limit";

export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    sameOrigin(request, { allowSameOriginForm: true });
    await limitDropRequest(request, "download");
    const form = new URLSearchParams((await readLimited(request, 1024)).toString("utf8"));
    const token = form.get("token") ?? "";
    const fileId = form.get("fileId") ?? "";
    if (!TOKEN_PATTERN.test(token) || !/^[a-z0-9]+$/.test(fileId)) throw new DropError(404, "This file is unavailable.");
    const tokenHash = hashToken(token);
    const initial = await prisma.secureShare.findUnique({ where: { tokenHash }, select: { id: true } });
    if (!initial) throw new DropError(404, "This file is unavailable.");
    const result = await prisma.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`secure-share:${initial.id}`}))`;
      const share = await tx.secureShare.findFirst({ where: { id: initial.id, tokenHash, publishedAt: { not: null }, revokedAt: null, expiresAt: { gt: new Date() } }, include: { files: { where: { id: fileId }, include: { chunks: true } } } });
      const file = share?.files[0];
      if (!share || !file || file.uploadedSize !== file.size || (share.downloadOnce && file.downloadedAt)) throw new DropError(404, "This file has expired, was revoked, or was already downloaded.");
      // Verify the first chunk and encryption key before claiming a one-time download.
      const chunkKeys = Object.fromEntries(file.chunks.map(chunk => [chunk.index, chunk.storageKey]));
      const first = await readChunk(share.id, file.id, 0, chunkKeys[0]);
      await tx.secureShareFile.update({ where: { id: file.id }, data: { downloadedAt: new Date(), downloadCount: { increment: 1 } } });
      return { shareId: share.id, fileId: file.id, path: file.path, size: Number(file.size), first, chunkKeys };
    }, { timeout: 30_000 });
    const count = Math.ceil(result.size / CHUNK_BYTES);
    let index = 0;
    const body = new ReadableStream<Uint8Array>({
      async pull(controller) {
        try {
          if (index >= count) { controller.close(); return; }
          const bytes = index === 0 ? result.first : await readChunk(result.shareId, result.fileId, index, result.chunkKeys[index]);
          const expected = Math.min(CHUNK_BYTES, result.size - index * CHUNK_BYTES);
          if (bytes.length !== expected) throw new Error("Invalid stored chunk length");
          index++;
          controller.enqueue(new Uint8Array(bytes));
        } catch (error) { controller.error(error); }
      },
    });
    const name = result.path.split("/").at(-1) || "download";
    return new Response(body, { headers: { ...privateHeaders, "Content-Type": "application/octet-stream", "Content-Length": String(result.size),
      "Content-Disposition": `attachment; filename="download"; filename*=UTF-8''${encodeURIComponent(name).replace(/['()*]/g, c => `%${c.charCodeAt(0).toString(16)}`)}` } });
  } catch (error) { return failure(error); }
}
