import "server-only";

import type { AppLogger } from "@kingstack/logger";
import {
  authenticateBearerRequest,
  bearerAuthenticationErrorResponse,
  type RequestWithHeaders,
} from "@/lib/auth/server-auth";
import { FixedWindowRateLimiter } from "@/lib/server/fixed-window-rate-limiter";

export type AiRequestKind = "image" | "text";

export type AiRequestIdentity =
  { ok: true; userId: string } | { ok: false; response: Response };

const textLimiter = new FixedWindowRateLimiter({
  limit: 20,
  windowMs: 60_000,
});
const imageLimiter = new FixedWindowRateLimiter({
  limit: 3,
  windowMs: 60_000,
});

export async function authenticateAiRequest(
  request: RequestWithHeaders,
): Promise<AiRequestIdentity> {
  const authentication = await authenticateBearerRequest(request);
  if (!authentication.ok) {
    return {
      ok: false,
      response: bearerAuthenticationErrorResponse(authentication),
    };
  }

  return { ok: true, userId: authentication.userId };
}

export function authorizeAiUsage(
  userId: string,
  kind: AiRequestKind,
  logger: Pick<AppLogger, "warn">,
): { ok: true } | { ok: false; response: Response } {
  const rateLimit = (kind === "image" ? imageLimiter : textLimiter).consume(
    userId,
  );
  if (rateLimit.allowed) {
    return { ok: true };
  }

  logger.warn("ai.request_rate_limited", {
    kind,
    userId,
    retryAfterSeconds: rateLimit.retryAfterSeconds,
  });

  return {
    ok: false,
    response: Response.json(
      { error: "AI request limit reached. Try again shortly." },
      {
        status: 429,
        headers: {
          "Retry-After": String(rateLimit.retryAfterSeconds),
          "X-RateLimit-Limit": String(rateLimit.limit),
          "X-RateLimit-Remaining": String(rateLimit.remaining),
          "X-RateLimit-Reset": String(Math.ceil(rateLimit.resetAt / 1_000)),
        },
      },
    ),
  };
}
