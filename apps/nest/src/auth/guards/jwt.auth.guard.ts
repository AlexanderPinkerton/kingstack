import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import type { FastifyRequest } from "fastify";
import { extractBearerToken } from "@kingstack/shared";
import { SupabaseTokenVerifier } from "../services/supabase-token-verifier";

export { extractBearerToken } from "@kingstack/shared";

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
