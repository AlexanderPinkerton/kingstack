import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { AdminService } from "./auth/services/admin.service";
import type { PrismaService } from "./prisma/prisma.service";
import { describe, it, expect, beforeEach } from "vitest";

describe("AppController", () => {
  let appController: AppController;
  let appService: AppService;

  beforeEach(() => {
    appService = new AppService();
    const adminService = new AdminService({} as PrismaService);
    appController = new AppController(appService, adminService);
  });

  describe("root", () => {
    it('should return "Hello World!"', () => {
      expect(appController.getHello()).toBe("Hello World!");
    });

    it("should have appService injected", () => {
      expect(appService).toBeDefined();
      expect(appService.getHello()).toBe("Hello World!");
    });
  });
});
