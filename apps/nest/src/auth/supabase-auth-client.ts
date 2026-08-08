import { ConfigService } from "@nestjs/config";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export const SUPABASE_AUTH_CLIENT = Symbol("SUPABASE_AUTH_CLIENT");

export interface SupabaseClaimsClient {
  auth: Pick<SupabaseClient["auth"], "getClaims">;
}

export function createSupabaseAuthClient(
  configService: ConfigService,
): SupabaseClient {
  return createClient(
    configService.getOrThrow<string>("SUPABASE_API_URL"),
    configService.getOrThrow<string>("SUPABASE_PUBLISHABLE_KEY"),
    {
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: false,
      },
    },
  );
}
