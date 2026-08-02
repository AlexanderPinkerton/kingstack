import { createCapturingLogger } from "@kingstack/logger/testing";
import { describe, expect, it, vi } from "vitest";
import type { PrismaService } from "../prisma/prisma.service";
import { PostsService } from "./posts.service";

describe("PostsService", () => {
  it("deletes all posts and records the cleanup result", async () => {
    const deleteMany = vi.fn().mockResolvedValue({ count: 3 });
    const prisma = { post: { deleteMany } } as unknown as PrismaService;
    const capture = createCapturingLogger();
    const service = new PostsService(prisma, capture.logger);

    await service.handleCron();

    expect(deleteMany).toHaveBeenCalledWith({});
    expect(capture.records).toEqual([
      {
        level: "debug",
        event: "posts.cleanup_started",
        context: { component: "PostsService" },
        error: undefined,
      },
      {
        level: "info",
        event: "posts.cleanup_completed",
        context: { component: "PostsService", deletedCount: 3 },
        error: undefined,
      },
    ]);
  });
});
