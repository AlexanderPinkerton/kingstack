import { type NextRequest, NextResponse } from "next/server";

import { PrismaClient } from "@prisma/client";

import { getUserAuthDetails } from "@/lib/admin-utils";

const prisma: PrismaClient = new PrismaClient();

export async function GET(request: NextRequest) {
  try {
    // Get the session JWT token from the request headers
    const jwt =
      request.headers.get("Authorization")?.replace("Bearer ", "") || null;

    const authDetails = await getUserAuthDetails(jwt);

    if (!authDetails.isAuthenticated) {
      return NextResponse.json(
        { error: authDetails.error || "Unauthorized" },
        { status: 401 },
      );
    }

    const posts = await prisma.post.findMany();

    return Response.json(posts, { status: 200 });
  } catch (error) {
    console.log(error);

    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
