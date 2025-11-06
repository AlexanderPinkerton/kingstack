import { Controller, Get, Req, UseGuards } from "@nestjs/common";
import { AppService } from "./app.service";
import { JwtAuthGuard } from "./auth/guards/jwt.auth.guard";
import { FastifyRequest } from "fastify";

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get("/protected")
  @UseGuards(JwtAuthGuard)
  protected(@Req() req: FastifyRequest) {
    return {
      message: "AuthGuard works 🎉",
      authenticated_user: req.user,
    };
  }
}
