import { ForbiddenException, type ExecutionContext } from "@nestjs/common";
import type { FastifyRequest } from "fastify";
import { describe, expect, it, vi } from "vitest";
import type { SupabaseTokenVerifier } from "../services/supabase-token-verifier";
import { PermanentUserGuard } from "./permanent-user.guard";

function createContext(): {
  context: ExecutionContext;
  request: FastifyRequest;
} {
  const request = {
    headers: { authorization: "Bearer signed-token" },
  } as FastifyRequest;
  const context = {
    switchToHttp: () => ({ getRequest: () => request }),
  } as ExecutionContext;
  return { context, request };
}

describe("PermanentUserGuard", () => {
  it("accepts a verified permanent user", async () => {
    const tokenVerifier = {
      verifyAccessToken: vi.fn().mockResolvedValue({
        aud: "authenticated",
        is_anonymous: false,
        sub: "user-123",
      }),
    } as unknown as SupabaseTokenVerifier;
    const guard = new PermanentUserGuard(tokenVerifier);
    const { context } = createContext();

    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it("rejects a verified anonymous user", async () => {
    const tokenVerifier = {
      verifyAccessToken: vi.fn().mockResolvedValue({
        aud: "authenticated",
        is_anonymous: true,
        sub: "guest-123",
      }),
    } as unknown as SupabaseTokenVerifier;
    const guard = new PermanentUserGuard(tokenVerifier);
    const { context } = createContext();

    await expect(guard.canActivate(context)).rejects.toEqual(
      new ForbiddenException("A permanent account is required"),
    );
  });
});
