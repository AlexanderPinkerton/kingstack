import "server-only";

import {
  createClient,
  type JwtPayload,
  type SupabaseClient,
} from "@supabase/supabase-js";
import {
  extractBearerToken,
  validateSupabaseUserClaims,
  type AuthenticatedSupabaseUserClaims,
} from "@kingstack/shared";

export interface RequestWithHeaders {
  headers: {
    get(name: string): string | null;
  };
}

export type AuthenticatedBearerRequest = {
  accessToken: string;
  claims: AuthenticatedSupabaseUserClaims<JwtPayload>;
  email?: string;
  ok: true;
  userId: string;
};

export type BearerAuthenticationFailure = {
  error: string;
  ok: false;
  status: 401;
};

export type BearerAuthenticationResult =
  AuthenticatedBearerRequest | BearerAuthenticationFailure;

export type SupabaseClaimsAuth = Pick<SupabaseClient["auth"], "getClaims">;

let authClient: SupabaseClient | null = null;

export async function authenticateBearerRequest(
  request: RequestWithHeaders,
): Promise<BearerAuthenticationResult> {
  return authenticateBearerRequestWith(getAuthClient().auth, request);
}

/** Dependency-injected entry point for exercising the real verifier in tests. */
export async function authenticateBearerRequestWith(
  auth: SupabaseClaimsAuth,
  request: RequestWithHeaders,
): Promise<BearerAuthenticationResult> {
  const accessToken = extractBearerToken(request.headers.get("Authorization"));

  if (!accessToken) {
    return authenticationFailure("Bearer token is required");
  }

  try {
    const { data, error } = await auth.getClaims(accessToken);
    if (error || !data) {
      return authenticationFailure("Invalid or expired bearer token");
    }

    const claims = validateSupabaseUserClaims(data.claims);
    return {
      accessToken,
      claims,
      email: claims.email,
      ok: true,
      userId: claims.sub,
    };
  } catch {
    return authenticationFailure("Invalid or expired bearer token");
  }
}

export function bearerAuthenticationErrorResponse(
  failure: BearerAuthenticationFailure,
): Response {
  return Response.json({ error: failure.error }, { status: failure.status });
}

function authenticationFailure(error: string): BearerAuthenticationFailure {
  return { error, ok: false, status: 401 };
}

function getAuthClient(): SupabaseClient {
  if (authClient) return authClient;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabasePublishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabasePublishableKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY are required",
    );
  }

  authClient = createClient(supabaseUrl, supabasePublishableKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });
  return authClient;
}
