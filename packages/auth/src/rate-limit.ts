import arcjet, { fixedWindow } from "@arcjet/next";
import { prisma } from "@repo/db";
import { createHmac } from "node:crypto";
import { isIP } from "node:net";

const policies = {
  signIn: { max: 10, seconds: 60 },
  signUp: { max: 5, seconds: 600 },
  createShare: { max: 30, seconds: 60 },
  manageShare: { max: 60, seconds: 60 },
  uploadChunk: { max: 160, seconds: 10 },
  listFiles: { max: 60, seconds: 60 },
  download: { max: 240, seconds: 60 },
} as const;
export type RateLimitScope = keyof typeof policies;
type Rejection = { status: 429 | 503; message: string; retryAfter: number };

function arcjetLimiter(key: string, scope: RateLimitScope) {
  const { max, seconds } = policies[scope];
  return arcjet({
    key, characteristics: ["bucket"],
    rules: [fixedWindow({ mode: "LIVE", max, window: seconds })],
  });
}
const clients = new Map<RateLimitScope, ReturnType<typeof arcjetLimiter>>();

function clientAddress(headers: Headers) {
  // Only a header overwritten by the deployment's trusted ingress is usable.
  const header = process.env.RATE_LIMIT_IP_HEADER;
  const value = header && headers.get(header)?.trim();
  if (!value || !isIP(value) || value.includes("%")) return "shared";
  return isIP(value) === 6 ? new URL(`http://[${value}]/`).hostname : value;
}

export async function checkRateLimit(scope: RateLimitScope, headers: Headers, userId?: string): Promise<Rejection | null> {
  const { max, seconds } = policies[scope];
  const denied = { status: 429, retryAfter: seconds, message: "Too many requests. Please try again later." } as const;
  const unavailable = { status: 503, retryAfter: 5, message: "Request protection is temporarily unavailable." } as const;
  try {
    const secret = process.env.AUTH_SECRET || (process.env.NODE_ENV !== "production" && "local-development");
    if (!secret) return unavailable;
    const subject = userId ? `user:${userId}` : `ip:${clientAddress(headers)}`;
    const bucket = createHmac("sha256", secret).update(`${scope}:${subject}`).digest("hex");
    const key = process.env.ARCJET_KEY;
    if (key) {
      const client = clients.get(scope) ?? arcjetLimiter(key, scope);
      clients.set(scope, client);
      // Only a policy name and pseudonymous bucket go to the decision service.
      const decision = await client.protect({ method: "POST", url: `/${scope}` }, { bucket, ipSrc: "0.0.0.0" });
      if (decision.isErrored() || decision.results.some(result => result.conclusion === "ERROR" || result.reason.isError())) return unavailable;
      if (decision.isDenied()) return denied;
      return decision.conclusion === "ALLOW" ? null : unavailable;
    }

    // A single DB statement admits at most 'max' callers across all instances.
    // A denied attempt neither increments the count nor extends the window.
    const admitted = await prisma.$executeRaw`
      INSERT INTO "RequestRateLimit" ("bucket", "hits", "expiresAt")
      VALUES (${bucket}, 1, statement_timestamp() + ${seconds}::int * interval '1 second')
      ON CONFLICT ("bucket") DO UPDATE SET
        "hits" = CASE WHEN "RequestRateLimit"."expiresAt" <= statement_timestamp() THEN 1 ELSE "RequestRateLimit"."hits" + 1 END,
        "expiresAt" = CASE WHEN "RequestRateLimit"."expiresAt" <= statement_timestamp() THEN EXCLUDED."expiresAt" ELSE "RequestRateLimit"."expiresAt" END
      WHERE "RequestRateLimit"."expiresAt" <= statement_timestamp() OR "RequestRateLimit"."hits" < ${max}
    `;
    return admitted === 1 ? null : denied;
  } catch {
    return unavailable;
  }
}
