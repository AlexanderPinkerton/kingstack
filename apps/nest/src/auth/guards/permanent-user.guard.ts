import {
  ForbiddenException,
  type ExecutionContext,
  Injectable,
} from "@nestjs/common";
import type { FastifyRequest } from "fastify";
import { isAnonymousSupabaseUserClaims } from "@kingstack/shared";
import { SupabaseTokenVerifier } from "../services/supabase-token-verifier";
import { JwtAuthGuard } from "./jwt.auth.guard";

/** Requires a verified Supabase user with a durable login identity. */
@Injectable()
export class PermanentUserGuard extends JwtAuthGuard {
  constructor(tokenVerifier: SupabaseTokenVerifier) {
    super(tokenVerifier);
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    await super.canActivate(context);

    const request = context.switchToHttp().getRequest<FastifyRequest>();
    if (request.user && isAnonymousSupabaseUserClaims(request.user)) {
      throw new ForbiddenException("A permanent account is required");
    }

    return true;
  }
}
