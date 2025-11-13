import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { PassportModule } from "@nestjs/passport";
import { JwtModule } from "@nestjs/jwt";
import { JwtAuthGuard } from "./guards/jwt.auth.guard";
import { AdminGuard } from "./guards/admin.guard";
import { SupabaseStrategy } from "./strategies/supabase.strategy";

@Module({
  imports: [
    PassportModule,
    ConfigModule,
    JwtModule.registerAsync({
      useFactory: (configService: ConfigService) => {
        return {
          global: true,
          secret: configService.get<string>("SUPA_JWT_SECRET"),
          signOptions: { expiresIn: 40000 },
        };
      },
      inject: [ConfigService],
    }),
  ],
  providers: [JwtAuthGuard, AdminGuard, SupabaseStrategy],
  exports: [JwtAuthGuard, AdminGuard, JwtModule],
})
export class AuthModule {}
