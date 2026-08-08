import { type NextRequest, NextResponse } from "next/server";

import { PrismaClient } from "@prisma/client";

import {
  authenticatePermanentBearerRequest,
  bearerAuthenticationErrorResponse,
} from "@/lib/auth/server-auth";
import { createRequestLogger } from "@/lib/logger";

const prisma: PrismaClient = new PrismaClient();

export async function GET(request: NextRequest) {
  const logger = createRequestLogger(request, "PostRoute");
  try {
    const authentication = await authenticatePermanentBearerRequest(request);
    if (!authentication.ok) {
      return bearerAuthenticationErrorResponse(authentication);
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
    const authentication = await authenticatePermanentBearerRequest(request);
    if (!authentication.ok) {
      return bearerAuthenticationErrorResponse(authentication);
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
        author_id: authentication.userId,
      },
    });

    return Response.json(post, { status: 201 });
  } catch (error) {
    logger.error("post.create_failed", { error });

    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
