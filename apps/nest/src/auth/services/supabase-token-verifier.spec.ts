import type { JwtPayload } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import type { SupabaseClaimsClient } from "../supabase-auth-client";
import {
  InvalidSupabaseAccessTokenError,
  SupabaseTokenVerifier,
  validateSupabaseUserClaims,
} from "./supabase-token-verifier";

const validClaims = {
  iss: "https://example.supabase.co/auth/v1",
  sub: "user-123",
  aud: "authenticated",
  exp: 2_000_000_000,
  iat: 1_900_000_000,
  role: "authenticated",
  aal: "aal1",
  session_id: "session-123",
} as JwtPayload;

function createVerifier(result: unknown): SupabaseTokenVerifier {
  const client = {
    auth: {
      getClaims: vi.fn().mockResolvedValue(result),
    },
  } as unknown as SupabaseClaimsClient;

  return new SupabaseTokenVerifier(client);
}

describe("validateSupabaseUserClaims", () => {
  it("accepts an authenticated user token", () => {
    expect(validateSupabaseUserClaims(validClaims)).toBe(validClaims);
  });

  it("accepts authenticated within an audience array", () => {
    const claims = { ...validClaims, aud: ["other", "authenticated"] };

    expect(validateSupabaseUserClaims(claims).sub).toBe("user-123");
  });

  it("rejects a token without a user subject", () => {
    expect(() =>
      validateSupabaseUserClaims({ ...validClaims, sub: "" }),
    ).toThrow(InvalidSupabaseAccessTokenError);
  });

  it("rejects a token outside the authenticated audience", () => {
    expect(() =>
      validateSupabaseUserClaims({ ...validClaims, aud: "anon" }),
    ).toThrow(InvalidSupabaseAccessTokenError);
  });

  it("accepts a boolean anonymous-user claim and rejects malformed values", () => {
    expect(
      validateSupabaseUserClaims({ ...validClaims, is_anonymous: true })
        .is_anonymous,
    ).toBe(true);
    expect(() =>
      validateSupabaseUserClaims({
        ...validClaims,
        is_anonymous: "true",
      }),
    ).toThrow(InvalidSupabaseAccessTokenError);
  });
});

describe("SupabaseTokenVerifier", () => {
  it("returns claims verified by Supabase", async () => {
    const verifier = createVerifier({
      data: { claims: validClaims, header: {}, signature: new Uint8Array() },
      error: null,
    });

    await expect(verifier.verifyAccessToken("token")).resolves.toBe(
      validClaims,
    );
  });

  it("rejects errors returned by Supabase", async () => {
    const verifier = createVerifier({
      data: null,
      error: new Error("bad token"),
    });

    await expect(verifier.verifyAccessToken("token")).rejects.toBeInstanceOf(
      InvalidSupabaseAccessTokenError,
    );
  });
});
