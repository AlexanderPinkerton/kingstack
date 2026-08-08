import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import type { FastifyRequest } from "fastify";
import { SupabaseTokenVerifier } from "../services/supabase-token-verifier";

export function extractBearerToken(
  authorization: string | undefined,
): string | null {
  const match = /^Bearer\s+(\S+)$/i.exec(authorization?.trim() ?? "");
  return match?.[1] ?? null;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly tokenVerifier: SupabaseTokenVerifier) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const token = extractBearerToken(request.headers.authorization);

    if (!token) {
      throw new UnauthorizedException("Bearer token is required");
    }

    try {
      request.user = await this.tokenVerifier.verifyAccessToken(token);
      return true;
    } catch {
      throw new UnauthorizedException("Invalid or expired bearer token");
    }
  }
}
