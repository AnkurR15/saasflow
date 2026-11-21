import { checkRateLimit, type RateLimitScope } from "@repo/auth/rate-limit";
import { DropError } from "./http";

export async function limitDropRequest(request: Request, scope: RateLimitScope, userId?: string) {
  const rejected = await checkRateLimit(scope, request.headers, userId);
  if (rejected) throw new DropError(rejected.status, rejected.message, rejected.retryAfter);
}
