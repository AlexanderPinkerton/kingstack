import { createCapturingLogger } from "@kingstack/logger/testing";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PrismaService } from "./prisma.service";

const originalConnectOnStart = process.env.PRISMA_CONNECT_ON_START;

afterEach(() => {
  if (originalConnectOnStart === undefined) {
    delete process.env.PRISMA_CONNECT_ON_START;
  } else {
    process.env.PRISMA_CONNECT_ON_START = originalConnectOnStart;
  }
  vi.restoreAllMocks();
});

describe("PrismaService", () => {
  it("connects during startup by default", async () => {
    delete process.env.PRISMA_CONNECT_ON_START;
    const service = new PrismaService(createCapturingLogger().logger);
    const connect = vi.spyOn(service, "$connect").mockResolvedValue();

    await service.onModuleInit();

    expect(connect).toHaveBeenCalledOnce();
  });

  it("can skip the startup connection for a database-free deployment", async () => {
    process.env.PRISMA_CONNECT_ON_START = "false";
    const capture = createCapturingLogger();
    const service = new PrismaService(capture.logger);
    const connect = vi.spyOn(service, "$connect").mockResolvedValue();

    await service.onModuleInit();

    expect(connect).not.toHaveBeenCalled();
    expect(capture.records).toEqual([
      {
        level: "warn",
        event: "prisma.startup_connection_skipped",
        context: {
          component: PrismaService.name,
          databaseBackedEndpointsAvailable: false,
        },
        error: undefined,
      },
    ]);
  });
});
