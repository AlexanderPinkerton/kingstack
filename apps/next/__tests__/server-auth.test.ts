import { describe, expect, it, vi } from "vitest";
import type { SupabaseClaimsAuth } from "../src/lib/auth/server-auth";
import {
  authenticateBearerRequestWith,
  authenticatePermanentBearerRequestWith,
} from "../src/lib/auth/server-auth";

function request(authorization?: string) {
  const headers = new Headers();
  if (authorization) headers.set("Authorization", authorization);
  return { headers };
}

function authWithClaims(claims: Record<string, unknown>): SupabaseClaimsAuth {
  return {
    getClaims: vi.fn().mockResolvedValue({
      data: { claims },
      error: null,
    }),
  };
}

describe("authenticateBearerRequestWith", () => {
  it("returns the verified identity for a strict bearer header", async () => {
    const auth = authWithClaims({
      aud: "authenticated",
      email: "user@example.com",
      sub: "user-123",
    });

    const result = await authenticateBearerRequestWith(
      auth,
      request("bearer signed-token"),
    );

    expect(result).toMatchObject({
      accessToken: "signed-token",
      email: "user@example.com",
      ok: true,
      userId: "user-123",
    });
    expect(auth.getClaims).toHaveBeenCalledWith("signed-token");
  });

  it.each([undefined, "", "Basic value", "Bearer token extra"])(
    "rejects a missing or malformed authorization header: %s",
    async (authorization) => {
      const auth = authWithClaims({ aud: "authenticated", sub: "user-123" });

      const result = await authenticateBearerRequestWith(
        auth,
        request(authorization),
      );

      expect(result).toEqual({
        error: "Bearer token is required",
        ok: false,
        status: 401,
      });
      expect(auth.getClaims).not.toHaveBeenCalled();
    },
  );

  it.each([
    { aud: "authenticated", sub: "" },
    { aud: "anon", sub: "user-123" },
    { aud: "authenticated", email: 123, sub: "user-123" },
  ])("rejects invalid user claims", async (claims) => {
    const result = await authenticateBearerRequestWith(
      authWithClaims(claims),
      request("Bearer signed-token"),
    );

    expect(result).toEqual({
      error: "Invalid or expired bearer token",
      ok: false,
      status: 401,
    });
  });
});

describe("authenticatePermanentBearerRequestWith", () => {
  it("rejects an anonymous Supabase user after verifying the token", async () => {
    const result = await authenticatePermanentBearerRequestWith(
      authWithClaims({
        aud: "authenticated",
        is_anonymous: true,
        sub: "guest-123",
      }),
      request("Bearer signed-token"),
    );

    expect(result).toEqual({
      error: "A permanent account is required",
      ok: false,
      status: 403,
    });
  });

  it("accepts a permanent Supabase user", async () => {
    const result = await authenticatePermanentBearerRequestWith(
      authWithClaims({
        aud: "authenticated",
        is_anonymous: false,
        sub: "user-123",
      }),
      request("Bearer signed-token"),
    );

    expect(result).toMatchObject({ ok: true, userId: "user-123" });
  });
});
