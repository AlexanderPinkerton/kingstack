import { UnauthorizedException, type ExecutionContext } from "@nestjs/common";
import type { FastifyRequest } from "fastify";
import { describe, expect, it, vi } from "vitest";
import type { SupabaseTokenVerifier } from "../services/supabase-token-verifier";
import { extractBearerToken, JwtAuthGuard } from "./jwt.auth.guard";

function createContext(authorization?: string): {
  context: ExecutionContext;
  request: FastifyRequest;
} {
  const request = {
    headers: { authorization },
  } as FastifyRequest;
  const context = {
    switchToHttp: () => ({ getRequest: () => request }),
  } as ExecutionContext;

  return { context, request };
}

describe("extractBearerToken", () => {
  it("extracts a case-insensitive bearer token", () => {
    expect(extractBearerToken("bearer signed-token")).toBe("signed-token");
  });

  it("rejects missing and malformed authorization headers", () => {
    expect(extractBearerToken(undefined)).toBeNull();
    expect(extractBearerToken("Basic value")).toBeNull();
    expect(extractBearerToken("Bearer token extra")).toBeNull();
  });
});

describe("JwtAuthGuard", () => {
  it("attaches verified claims to the request", async () => {
    const claims = { sub: "user-123", aud: "authenticated" };
    const tokenVerifier = {
      verifyAccessToken: vi.fn().mockResolvedValue(claims),
    } as unknown as SupabaseTokenVerifier;
    const guard = new JwtAuthGuard(tokenVerifier);
    const { context, request } = createContext("Bearer signed-token");

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.user).toBe(claims);
  });

  it("returns an unauthorized response without exposing verifier errors", async () => {
    const tokenVerifier = {
      verifyAccessToken: vi
        .fn()
        .mockRejectedValue(new Error("internal detail")),
    } as unknown as SupabaseTokenVerifier;
    const guard = new JwtAuthGuard(tokenVerifier);
    const { context } = createContext("Bearer bad-token");

    await expect(guard.canActivate(context)).rejects.toEqual(
      new UnauthorizedException("Invalid or expired bearer token"),
    );
  });
});
