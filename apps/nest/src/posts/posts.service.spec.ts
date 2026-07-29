import { Test, TestingModule } from "@nestjs/testing";
import { beforeEach, describe, expect, it } from "vitest";
import { PostsService } from "./posts.service";

describe("PostsService", () => {
  let service: PostsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PostsService],
    }).compile();

    service = module.get<PostsService>(PostsService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });
});
