export class DropError extends Error {
  constructor(public status: number, message: string, public retryAfter?: number) { super(message); }
}

export const privateHeaders = {
  "Cache-Control": "no-store",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
};

export function sameOrigin(request: Request, options?: { allowSameOriginForm?: boolean }) {
  const configured = process.env.SECURE_DROP_APP_ORIGIN;
  if (process.env.NODE_ENV === "production" && !configured) {
    throw new DropError(503, "Secure Drop origin is not configured.");
  }
  const origin = configured || new URL(request.url).origin;
  const parsed = new URL(origin);
  if (parsed.origin !== origin || !["http:", "https:"].includes(parsed.protocol)
    || (process.env.NODE_ENV === "production" && parsed.protocol !== "https:")) {
    throw new DropError(503, "Secure Drop origin must be an exact HTTPS origin in production.");
  }
  const requestOrigin = request.headers.get("origin");
  // A no-referrer page can submit a same-origin form with a null Origin.
  // Fetch Metadata is set by the browser and cross-site forms cannot set it
  // to same-origin. This exception is only used for bearer-token downloads.
  const sameOriginForm = options?.allowSameOriginForm
    && (!requestOrigin || requestOrigin === "null")
    && request.headers.get("sec-fetch-site") === "same-origin";
  if (requestOrigin !== origin && !sameOriginForm) {
    throw new DropError(403, "Request origin is not allowed.");
  }
}

export function parseFileName(encoded: string | null) {
  let name: string;
  try { name = decodeURIComponent(encoded ?? "").normalize("NFC"); }
  catch { throw new DropError(400, "Invalid filename."); }
  // Reject path/control characters and bidirectional overrides that disguise extensions.
  if (!name.trim() || name === "." || name === ".." || name.length > 180
    || /[\x00-\x1f\x7f/\\\u202a-\u202e\u2066-\u2069]/.test(name)) {
    throw new DropError(400, "Use a filename of 1–180 characters without path separators, control characters, or direction overrides.");
  }
  return name;
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
  if (error instanceof DropError) {
    const headers = new Headers(privateHeaders);
    if (error.retryAfter) headers.set("Retry-After", String(error.retryAfter));
    return Response.json({ error: error.message }, { status: error.status, headers });
  }
  // Never log request bodies, bearer tokens, or Prisma errors containing payloads.
  return Response.json({ error: "Secure Drop is temporarily unavailable. Check server configuration or try again." }, { status: 503, headers: privateHeaders });
}
