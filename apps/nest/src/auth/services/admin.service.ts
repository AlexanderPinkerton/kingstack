import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Check if a user email is an admin
   * @param email - User email to check
   * @returns Promise<boolean> - True if user is an admin
   */
  async isAdmin(email: string): Promise<boolean> {
    if (!email) {
      return false;
    }

    const adminRecord = await this.prisma.admin_emails.findUnique({
      where: { email },
      select: { id: true, email: true },
    });

    return !!adminRecord;
  }

  /**
   * Get admin record for a user email
   * @param email - User email to check
   * @returns Promise with admin record or null
   */
  async getAdminRecord(email: string) {
    if (!email) {
      return null;
    }

    return await this.prisma.admin_emails.findUnique({
      where: { email },
      select: { id: true, email: true, created_at: true },
    });
  }

  /**
   * Get all admin emails
   * @returns Promise with array of admin records
   */
  async getAllAdmins() {
    return await this.prisma.admin_emails.findMany({
      orderBy: { created_at: "desc" },
    });
  }
}
