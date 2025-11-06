import { type NextRequest } from "next/server";
import { UsernameGenerator } from "@kingstack/shapes";
import prisma from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const { username } = await request.json();

    if (!username || typeof username !== "string") {
      return Response.json({ error: "Username is required" }, { status: 400 });
    }

    // Validate username format
    const validation = UsernameGenerator.validateUsername(username);
    if (!validation.isValid) {
      return Response.json({ error: validation.error }, { status: 400 });
    }

    // Check if username is available
    const existingUser = await prisma.user.findUnique({
      where: { username },
      select: { id: true },
    });

    if (existingUser) {
      return Response.json(
        { error: "Username is already taken" },
        { status: 409 },
      );
    }

    return Response.json({ available: true }, { status: 200 });
  } catch (error) {
    console.error("Username validation error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
