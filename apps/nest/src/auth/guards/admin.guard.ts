import {
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { JwtAuthGuard } from "./jwt.auth.guard";
import { PrismaClient } from "@prisma/client";
import { FastifyRequest } from "fastify";

@Injectable()
export class AdminGuard extends JwtAuthGuard {
  private prisma: PrismaClient;

  constructor() {
    super();
    this.prisma = new PrismaClient();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // First ensure the user is authenticated (JWT valid)
    const isAuthenticated = await super.canActivate(context);
    if (!isAuthenticated) {
      return false;
    }

    // Get the request and user from JWT payload
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const user = request.user as any;

    // Extract email from JWT payload (Supabase JWT has email in payload)
    const email = user?.email;
    if (!email) {
      throw new ForbiddenException("User email not found in token");
    }

    // Check if email exists in admin_emails table
    const adminRecord = await this.prisma.admin_emails.findUnique({
      where: { email },
      select: { id: true, email: true },
    });

    if (!adminRecord) {
      throw new ForbiddenException("Admin access required");
    }

    return true;
  }
}
