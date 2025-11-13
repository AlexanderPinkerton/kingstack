import { describe, it, beforeEach, expect, vi, type Mock } from "vitest";
import { GET as getPosts } from "../src/app/api/post/route";
import { PrismaClient } from "@prisma/client";
import { getUserAuthDetails } from "@/lib/admin-utils";

// --- Prisma Mock ---
vi.mock("@prisma/client", () => {
  const mockPrisma = {
    post: {
      findMany: vi.fn(),
    },
  };
  return {
    PrismaClient: vi.fn(() => mockPrisma),
  };
});

// --- Admin Utils Mock ---
vi.mock("@/lib/admin-utils", () => ({
  getUserAuthDetails: vi.fn(),
}));

// --- Test Data ---
const fakePosts = [
  {
    id: "post1",
    title: "Test Post 1",
    content: "This is test content 1",
    published: true,
    author_id: "user1",
    created_at: "2023-01-01T00:00:00.000Z",
  },
  {
    id: "post2",
    title: "Test Post 2",
    content: "This is test content 2",
    published: false,
    author_id: "user2",
    created_at: "2023-01-02T00:00:00.000Z",
  },
];

const fakeUser = {
  id: "user1",
  email: "user1@example.com",
  aud: "authenticated",
  role: "authenticated",
};

const fakeAuthDetails = {
  isAuthenticated: true,
  userId: "user1",
  userEmail: "user1@example.com",
  isAdmin: false,
};

function mockRequest(headers: Record<string, string> = {}) {
  return {
    headers: {
      get: (key: string) => headers[key],
    },
  } as any;
}

describe("GET /api/post", () => {
  let mockPrisma: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Get the mocked Prisma instance
    mockPrisma = new PrismaClient();

    // Setup default mock behavior for getUserAuthDetails
    (getUserAuthDetails as any).mockResolvedValue({
      isAuthenticated: false,
      error: "No JWT token provided",
    });
  });

  it("successfully returns posts when user is authenticated", async () => {
    // Mock successful authentication
    (getUserAuthDetails as any).mockResolvedValue(fakeAuthDetails);

    // Mock successful database query
    mockPrisma.post.findMany.mockResolvedValue(fakePosts);

    const req = mockRequest({ Authorization: "Bearer mocktoken" });
    const res = await getPosts(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toEqual(fakePosts);
    expect(getUserAuthDetails).toHaveBeenCalledWith("mocktoken");
    expect(mockPrisma.post.findMany).toHaveBeenCalledTimes(1);
  });

  it("returns 401 when user is not authenticated", async () => {
    // Mock failed authentication
    (getUserAuthDetails as any).mockResolvedValue({
      isAuthenticated: false,
      error: "Invalid user data",
    });

    const req = mockRequest({ Authorization: "Bearer invalidtoken" });
    const res = await getPosts(req);
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json).toEqual({ error: "Invalid user data" });
    expect(getUserAuthDetails).toHaveBeenCalledWith("invalidtoken");
    expect(mockPrisma.post.findMany).not.toHaveBeenCalled();
  });

  it("returns 401 when no authorization header is provided", async () => {
    const req = mockRequest();
    const res = await getPosts(req);
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json).toEqual({ error: "No JWT token provided" });
    expect(getUserAuthDetails).toHaveBeenCalledWith(null);
    expect(mockPrisma.post.findMany).not.toHaveBeenCalled();
  });

  it("returns 401 when authorization header is malformed", async () => {
    (getUserAuthDetails as any).mockResolvedValue({
      isAuthenticated: false,
      error: "Invalid user data",
    });

    const req = mockRequest({ Authorization: "InvalidFormat" });
    const res = await getPosts(req);
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json).toEqual({ error: "Invalid user data" });
    expect(getUserAuthDetails).toHaveBeenCalledWith("InvalidFormat");
    expect(mockPrisma.post.findMany).not.toHaveBeenCalled();
  });

  it("returns empty array when no posts exist", async () => {
    // Mock successful authentication
    (getUserAuthDetails as any).mockResolvedValue(fakeAuthDetails);

    // Mock empty database result
    mockPrisma.post.findMany.mockResolvedValue([]);

    const req = mockRequest({ Authorization: "Bearer mocktoken" });
    const res = await getPosts(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toEqual([]);
    expect(getUserAuthDetails).toHaveBeenCalledWith("mocktoken");
    expect(mockPrisma.post.findMany).toHaveBeenCalledTimes(1);
  });

  it("handles database errors gracefully", async () => {
    // Mock successful authentication
    (getUserAuthDetails as any).mockResolvedValue(fakeAuthDetails);

    // Mock database error
    const dbError = new Error("Database connection failed");
    mockPrisma.post.findMany.mockRejectedValue(dbError);

    const req = mockRequest({ Authorization: "Bearer mocktoken" });
    const res = await getPosts(req);
    const json = await res.json();

    expect(res.status).toBe(500);
    expect(json).toEqual({ error: "Internal server error" });
    expect(getUserAuthDetails).toHaveBeenCalledWith("mocktoken");
    expect(mockPrisma.post.findMany).toHaveBeenCalledTimes(1);
  });

  it("handles auth errors gracefully", async () => {
    // Mock auth error
    (getUserAuthDetails as any).mockResolvedValue({
      isAuthenticated: false,
      error: "Supabase auth error",
    });

    const req = mockRequest({ Authorization: "Bearer mocktoken" });
    const res = await getPosts(req);
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json).toEqual({ error: "Supabase auth error" });
    expect(getUserAuthDetails).toHaveBeenCalledWith("mocktoken");
    expect(mockPrisma.post.findMany).not.toHaveBeenCalled();
  });

  it("correctly extracts JWT token from Authorization header", async () => {
    // Mock successful authentication
    (getUserAuthDetails as any).mockResolvedValue(fakeAuthDetails);

    // Mock successful database query
    mockPrisma.post.findMany.mockResolvedValue(fakePosts);

    const req = mockRequest({
      Authorization: "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    });
    const res = await getPosts(req);

    expect(res.status).toBe(200);
    expect(getUserAuthDetails).toHaveBeenCalledWith(
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    );
  });

  it("handles case when posts array is null", async () => {
    // Mock successful authentication
    (getUserAuthDetails as any).mockResolvedValue(fakeAuthDetails);

    // Mock null database result
    mockPrisma.post.findMany.mockResolvedValue(null);

    const req = mockRequest({ Authorization: "Bearer mocktoken" });
    const res = await getPosts(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toBeNull();
    expect(getUserAuthDetails).toHaveBeenCalledWith("mocktoken");
    expect(mockPrisma.post.findMany).toHaveBeenCalledTimes(1);
  });
});
