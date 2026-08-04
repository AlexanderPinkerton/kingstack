import { createCapturingLogger } from "@kingstack/logger/testing";
import { describe, expect, it, vi } from "vitest";
import type { PrismaService } from "../prisma/prisma.service";
import { PostsService } from "./posts.service";

describe("PostsService", () => {
  it("records how many posts exist without modifying them", async () => {
    const count = vi.fn().mockResolvedValue(3);
    const deleteMany = vi.fn();
    const prisma = { post: { count, deleteMany } } as unknown as PrismaService;
    const capture = createCapturingLogger();
    const service = new PostsService(prisma, capture.logger);

    await service.handleCron();

    expect(count).toHaveBeenCalled();
    // The example job must stay read-only: an open client is showing this data.
    expect(deleteMany).not.toHaveBeenCalled();
    expect(capture.records).toEqual([
      {
        level: "debug",
        event: "posts.census_started",
        context: { component: "PostsService" },
        error: undefined,
      },
      {
        level: "info",
        event: "posts.census_completed",
        context: { component: "PostsService", postCount: 3 },
        error: undefined,
      },
    ]);
  });
});
