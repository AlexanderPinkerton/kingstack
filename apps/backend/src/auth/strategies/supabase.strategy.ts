import { Injectable } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class SupabaseStrategy extends PassportStrategy(Strategy) {
  public constructor(private readonly configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>("SUPA_JWT_SECRET")!,
    });
  }

  // Called after authentication is successful
  async validate(payload: any): Promise<any> {
    return payload;
  }

  // Use any since we are using fastify and passport-jwt expects an express request
  authenticate(req: any) {
    super.authenticate(req);
  }
}
