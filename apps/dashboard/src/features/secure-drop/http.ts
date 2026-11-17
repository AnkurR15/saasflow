export class DropError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export const privateHeaders = {
  "Cache-Control": "no-store",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
};

export function sameOrigin(request: Request) {
  const origin = process.env.SECURE_DROP_APP_ORIGIN || new URL(request.url).origin;
  if (request.headers.get("origin") !== origin) {
    throw new DropError(403, "Request origin is not allowed.");
  }
}

// Enforce the limit while reading, including requests with no Content-Length.
export async function readLimited(request: Request, limit: number) {
  if (Number(request.headers.get("content-length")) > limit) throw new DropError(413, "File is too large.");
  const reader = request.body?.getReader();
  if (!reader) throw new DropError(400, "Request body is required.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > limit) {
        await reader.cancel();
        throw new DropError(413, "File is too large.");
      }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  return Buffer.concat(chunks);
}

export function failure(error: unknown) {
  if (error instanceof DropError) return Response.json({ error: error.message }, { status: error.status, headers: privateHeaders });
  // Never log request bodies, bearer tokens, or Prisma errors containing payloads.
  return Response.json({ error: "Secure Drop is temporarily unavailable. Check server configuration or try again." }, { status: 503, headers: privateHeaders });
}
