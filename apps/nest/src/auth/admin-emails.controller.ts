import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  UseGuards,
  ConflictException,
} from "@nestjs/common";
import { AdminGuard } from "./guards/admin.guard";
import { AdminService } from "./services/admin.service";
import { PrismaClient } from "@prisma/client";

export interface CreateAdminEmailDto {
  email: string;
}

export interface UpdateAdminEmailDto {
  email: string;
}

@Controller("admin/emails")
@UseGuards(AdminGuard) // Only admins can manage admin emails
export class AdminEmailsController {
  private prisma: PrismaClient;

  constructor(private readonly adminService: AdminService) {
    this.prisma = new PrismaClient();
  }

  /**
   * Get all admin emails
   */
  @Get()
  async getAllAdmins() {
    return this.adminService.getAllAdmins();
  }

  /**
   * Create a new admin email
   */
  @Post()
  async createAdmin(@Body() createDto: CreateAdminEmailDto) {
    // Check if email already exists
    const existing = await this.prisma.admin_emails.findUnique({
      where: { email: createDto.email },
    });

    if (existing) {
      throw new ConflictException("Admin email already exists");
    }

    // Create new admin email
    const admin = await this.prisma.admin_emails.create({
      data: {
        email: createDto.email.toLowerCase().trim(),
      },
    });

    return admin;
  }

  /**
   * Update an admin email
   */
  @Put(":id")
  async updateAdmin(
    @Param("id") id: string,
    @Body() updateDto: UpdateAdminEmailDto,
  ) {
    // Check if new email already exists (excluding current record)
    const existing = await this.prisma.admin_emails.findFirst({
      where: {
        email: updateDto.email.toLowerCase().trim(),
        NOT: { id },
      },
    });

    if (existing) {
      throw new ConflictException("Admin email already exists");
    }

    // Update admin email
    const admin = await this.prisma.admin_emails.update({
      where: { id },
      data: {
        email: updateDto.email.toLowerCase().trim(),
      },
    });

    return admin;
  }

  /**
   * Delete an admin email
   */
  @Delete(":id")
  async deleteAdmin(@Param("id") id: string) {
    await this.prisma.admin_emails.delete({
      where: { id },
    });

    return { id };
  }
}
