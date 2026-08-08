import { Inject, Injectable } from "@nestjs/common";
import type { JwtPayload } from "@supabase/supabase-js";
import {
  InvalidSupabaseAccessTokenError,
  validateSupabaseUserClaims,
  type AuthenticatedSupabaseUserClaims,
} from "@kingstack/shared";
import {
  SUPABASE_AUTH_CLIENT,
  type SupabaseClaimsClient,
} from "../supabase-auth-client";

export {
  InvalidSupabaseAccessTokenError,
  validateSupabaseUserClaims,
} from "@kingstack/shared";

export type SupabaseUserClaims = AuthenticatedSupabaseUserClaims<JwtPayload>;

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
