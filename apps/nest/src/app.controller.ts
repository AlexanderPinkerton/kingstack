import { Controller, Get, Req, UseGuards } from "@nestjs/common";
import { AppService } from "./app.service";
import { JwtAuthGuard } from "./auth/guards/jwt.auth.guard";
import { AdminGuard } from "./auth/guards/admin.guard";
import { AdminService } from "./auth/services/admin.service";
import { FastifyRequest } from "fastify";

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly adminService: AdminService,
  ) {}

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

  @Get("/admin/example")
  @UseGuards(AdminGuard)
  adminExample(@Req() req: FastifyRequest) {
    return {
      message: "Admin access granted 🎉",
      authenticated_user: req.user,
      admin: true,
    };
  }

  @Get("/admin/check")
  @UseGuards(JwtAuthGuard)
  async checkAdminStatus(@Req() req: FastifyRequest) {
    const user = req.user as any;
    const email = user?.email;

    if (!email) {
      return {
        isAdmin: false,
        error: "User email not found in token",
      };
    }

    // Example of using AdminService directly in a controller
    const isAdmin = await this.adminService.isAdmin(email);

    console.log("isAdmin", isAdmin);

    return {
      isAdmin,
      userEmail: email,
    };
  }
}
