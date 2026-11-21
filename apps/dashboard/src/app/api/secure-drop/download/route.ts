import { prisma } from "@repo/db";
import { decryptFile, hashToken, TOKEN_PATTERN } from "@/features/secure-drop/crypto";
import { DropError, failure, privateHeaders, readLimited, sameOrigin } from "@/features/secure-drop/http";

import { limitDropRequest } from "@/features/secure-drop/rate-limit";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    sameOrigin(request);
    await limitDropRequest(request, "download");
    const token = (await readLimited(request, 100)).toString("utf8");
    if (!TOKEN_PATTERN.test(token)) throw new DropError(404, "This drop is unavailable.");
    const tokenHash = hashToken(token);
    const result = await prisma.$transaction(async (tx) => {
      const drop = await tx.fileDrop.findUnique({ where: { tokenHash } });
      if (!drop || drop.revokedAt || drop.downloadedAt || drop.expiresAt <= new Date()) throw new DropError(404, "This drop has expired, was revoked, or was already downloaded.");
      // Decrypt before claiming so a configuration error does not consume the link.
      const bytes = decryptFile(drop.ciphertext, tokenHash);
      const claimed = await tx.fileDrop.updateMany({
        where: { id: drop.id, downloadedAt: null, revokedAt: null, expiresAt: { gt: new Date() } },
        data: { downloadedAt: new Date(), ciphertext: Buffer.alloc(0) },
      });
      if (claimed.count !== 1) throw new DropError(404, "This drop is unavailable.");
      return { bytes, fileName: drop.fileName };
    });
    return new Response(new Uint8Array(result.bytes), { headers: {
      ...privateHeaders,
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename="download"; filename*=UTF-8''${encodeURIComponent(result.fileName).replace(/['()*]/g, c => `%${c.charCodeAt(0).toString(16)}`)}`,
    } });
  } catch (error) { return failure(error); }
}
