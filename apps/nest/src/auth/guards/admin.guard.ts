import {
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { JwtAuthGuard } from "./jwt.auth.guard";
import { AdminService } from "../services/admin.service";
import { FastifyRequest } from "fastify";

@Injectable()
export class AdminGuard extends JwtAuthGuard {
  constructor(private readonly adminService: AdminService) {
    super();
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

    // Check if user is an admin using the AdminService
    const isAdmin = await this.adminService.isAdmin(email);

    if (!isAdmin) {
      throw new ForbiddenException("Admin access required");
    }

    return true;
  }
}
