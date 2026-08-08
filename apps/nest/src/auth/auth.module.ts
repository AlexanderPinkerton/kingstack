import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { JwtAuthGuard } from "./guards/jwt.auth.guard";
import { AdminGuard } from "./guards/admin.guard";
import { AdminService } from "./services/admin.service";
import { AdminEmailsController } from "./admin-emails.controller";
import {
  createSupabaseAuthClient,
  SUPABASE_AUTH_CLIENT,
} from "./supabase-auth-client";
import { SupabaseTokenVerifier } from "./services/supabase-token-verifier";

@Module({
  imports: [ConfigModule],
  controllers: [AdminEmailsController],
  providers: [
    {
      provide: SUPABASE_AUTH_CLIENT,
      inject: [ConfigService],
      useFactory: createSupabaseAuthClient,
    },
    SupabaseTokenVerifier,
    JwtAuthGuard,
    AdminGuard,
    AdminService,
  ],
  exports: [JwtAuthGuard, AdminGuard, AdminService, SupabaseTokenVerifier],
})
export class AuthModule {}
