export interface SupabaseUserClaims {
  aud?: unknown;
  email?: unknown;
  sub?: unknown;
  [claim: string]: unknown;
}

export type AuthenticatedSupabaseUserClaims<
  TClaims extends SupabaseUserClaims = SupabaseUserClaims,
> = TClaims & {
  email?: string;
  sub: string;
};

export class InvalidSupabaseAccessTokenError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "InvalidSupabaseAccessTokenError";
  }
}

export function extractBearerToken(
  authorization: string | null | undefined,
): string | null {
  const match = /^Bearer\s+(\S+)$/i.exec(authorization?.trim() ?? "");
  return match?.[1] ?? null;
}

export function validateSupabaseUserClaims<TClaims extends SupabaseUserClaims>(
  claims: TClaims,
): AuthenticatedSupabaseUserClaims<TClaims> {
  if (typeof claims.sub !== "string" || claims.sub.length === 0) {
    throw new InvalidSupabaseAccessTokenError(
      "Supabase access token is missing a user subject",
    );
  }

  if (!hasAuthenticatedAudience(claims.aud)) {
    throw new InvalidSupabaseAccessTokenError(
      "Supabase access token does not have the authenticated audience",
    );
  }

  if (claims.email !== undefined && typeof claims.email !== "string") {
    throw new InvalidSupabaseAccessTokenError(
      "Supabase access token has an invalid email claim",
    );
  }

  return claims as AuthenticatedSupabaseUserClaims<TClaims>;
}

function hasAuthenticatedAudience(audience: unknown): boolean {
  return (
    audience === "authenticated" ||
    (Array.isArray(audience) && audience.includes("authenticated"))
  );
}
