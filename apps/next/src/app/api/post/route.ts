import { type NextRequest, NextResponse } from "next/server";

import { PrismaClient } from "@prisma/client";

import { getUserAuthDetails } from "@/lib/admin-utils";
import { createRequestLogger } from "@/lib/logger";

const prisma: PrismaClient = new PrismaClient();

export async function GET(request: NextRequest) {
  const logger = createRequestLogger(request, "PostRoute");
  try {
    // Get the session JWT token from the request headers
    const jwt =
      request.headers.get("Authorization")?.replace("Bearer ", "") || null;

    const authDetails = await getUserAuthDetails(jwt, logger);

    if (!authDetails.isAuthenticated) {
      return NextResponse.json(
        { error: authDetails.error || "Unauthorized" },
        { status: 401 },
      );
    }

    const posts = await prisma.post.findMany({
      orderBy: {
        created_at: "desc",
      },
    });

    return Response.json(posts, { status: 200 });
  } catch (error) {
    logger.error("posts.fetch_failed", { error });

    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const logger = createRequestLogger(request, "PostRoute");
  try {
    // Get the session JWT token from the request headers
    const jwt =
      request.headers.get("Authorization")?.replace("Bearer ", "") || null;

    const authDetails = await getUserAuthDetails(jwt, logger);

    if (!authDetails.isAuthenticated || !authDetails.userId) {
      return NextResponse.json(
        { error: authDetails.error || "Unauthorized" },
        { status: 401 },
      );
    }

    // Parse the request body
    const body = await request.json();
    const { title, content, published = false } = body;

    if (!title) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }

    // Create the post
    const post = await prisma.post.create({
      data: {
        title,
        content: content || null,
        published,
        author_id: authDetails.userId,
      },
    });

    return Response.json(post, { status: 201 });
  } catch (error) {
    logger.error("post.create_failed", { error });

    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
