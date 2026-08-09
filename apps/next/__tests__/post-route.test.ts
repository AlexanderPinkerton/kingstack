import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findMany: vi.fn(),
  getClaims: vi.fn(),
}));

vi.mock("@prisma/client", () => ({
  PrismaClient: vi.fn(() => ({
    post: { findMany: mocks.findMany },
  })),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    auth: { getClaims: mocks.getClaims },
  })),
}));

import { GET as getPosts } from "../src/app/api/post/route";

const fakePosts = [
  {
    id: "post1",
    title: "Test Post 1",
    content: "This is test content 1",
    published: true,
    author_id: "user1",
    created_at: "2023-01-01T00:00:00.000Z",
  },
];

function request(authorization?: string) {
  const headers = new Headers();
  if (authorization) headers.set("Authorization", authorization);

  return {
    headers,
    url: "http://localhost/api/post",
  } as Parameters<typeof getPosts>[0];
}

describe("GET /api/post", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "publishable-key";
    mocks.getClaims.mockImplementation((accessToken: string) => {
      if (accessToken !== "valid-token" && accessToken !== "guest-token") {
        return Promise.resolve({
          data: null,
          error: new Error("invalid token"),
        });
      }

      return Promise.resolve({
        data: {
          claims: {
            aud: "authenticated",
            email:
              accessToken === "guest-token" ? undefined : "user@example.com",
            is_anonymous: accessToken === "guest-token",
            sub: accessToken === "guest-token" ? "guest1" : "user1",
          },
        },
        error: null,
      });
    });
  });

  it("returns posts after the real bearer verifier authenticates the request", async () => {
    mocks.findMany.mockResolvedValue(fakePosts);

    const response = await getPosts(request("Bearer valid-token"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(fakePosts);
    expect(mocks.getClaims).toHaveBeenCalledWith("valid-token");
    expect(mocks.findMany).toHaveBeenCalledOnce();
  });

  it("rejects a request without a bearer token", async () => {
    const response = await getPosts(request());

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: "Bearer token is required",
    });
    expect(mocks.getClaims).not.toHaveBeenCalled();
    expect(mocks.findMany).not.toHaveBeenCalled();
  });

  it("rejects a malformed authorization scheme before verification", async () => {
    const response = await getPosts(request("Basic credentials"));

    expect(response.status).toBe(401);
    expect(mocks.getClaims).not.toHaveBeenCalled();
  });

  it("rejects an invalid bearer token", async () => {
    const response = await getPosts(request("Bearer invalid-token"));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: "Invalid or expired bearer token",
    });
    expect(mocks.findMany).not.toHaveBeenCalled();
  });

  it("rejects an anonymous user before querying persisted posts", async () => {
    const response = await getPosts(request("Bearer guest-token"));

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: "A permanent account is required",
    });
    expect(mocks.findMany).not.toHaveBeenCalled();
  });

  it("returns an empty list when the database has no posts", async () => {
    mocks.findMany.mockResolvedValue([]);

    const response = await getPosts(request("Bearer valid-token"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual([]);
  });

  it("does not expose database errors", async () => {
    mocks.findMany.mockRejectedValue(new Error("database credentials leaked"));

    const response = await getPosts(request("Bearer valid-token"));

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "Internal server error",
    });
  });
});
