import { Inject, Injectable } from "@nestjs/common";
import type { JwtPayload } from "@supabase/supabase-js";
import {
  SUPABASE_AUTH_CLIENT,
  type SupabaseClaimsClient,
} from "../supabase-auth-client";

export type SupabaseUserClaims = JwtPayload & {
  sub: string;
  email?: string;
};

export class InvalidSupabaseAccessTokenError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "InvalidSupabaseAccessTokenError";
  }
}

function hasAuthenticatedAudience(audience: unknown): boolean {
  return (
    audience === "authenticated" ||
    (Array.isArray(audience) && audience.includes("authenticated"))
  );
}

export function validateSupabaseUserClaims(
  claims: JwtPayload,
): SupabaseUserClaims {
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

  return claims;
}

@Injectable()
export class SupabaseTokenVerifier {
  constructor(
    @Inject(SUPABASE_AUTH_CLIENT)
    private readonly supabase: SupabaseClaimsClient,
  ) {}

  async verifyAccessToken(token: string): Promise<SupabaseUserClaims> {
    if (token.length === 0) {
      throw new InvalidSupabaseAccessTokenError(
        "Supabase access token is empty",
      );
    }

    try {
      const { data, error } = await this.supabase.auth.getClaims(token);

      if (error || !data) {
        throw new InvalidSupabaseAccessTokenError(
          error?.message ?? "Supabase access token could not be verified",
        );
      }

      return validateSupabaseUserClaims(data.claims);
    } catch (error: unknown) {
      if (error instanceof InvalidSupabaseAccessTokenError) {
        throw error;
      }

      throw new InvalidSupabaseAccessTokenError(
        "Supabase access token verification failed",
        { cause: error },
      );
    }
  }
}
