import { type NextRequest } from "next/server";
import { UsernameGenerator } from "@kingstack/shared";
import prisma from "@/lib/prisma";
import {
  authenticateBearerRequest,
  bearerAuthenticationErrorResponse,
} from "@/lib/auth/server-auth";
import { createRequestLogger } from "@/lib/logger";

export async function POST(request: NextRequest) {
  const logger = createRequestLogger(request, "UsernameChangeRoute");
  try {
    const authentication = await authenticateBearerRequest(request);
    if (!authentication.ok) {
      return bearerAuthenticationErrorResponse(authentication);
    }

    const { username } = await request.json();

    if (!username || typeof username !== "string") {
      return Response.json({ error: "Username is required" }, { status: 400 });
    }

    // Validate username format
    const validation = UsernameGenerator.validateUsername(username);
    if (!validation.isValid) {
      return Response.json({ error: validation.error }, { status: 400 });
    }

    // Get current user data
    const currentUser = await prisma.user.findUnique({
      where: { id: authentication.userId },
      select: {
        username: true,
        username_changed_at: true,
        previous_usernames: true,
      },
    });

    if (!currentUser) {
      return Response.json({ error: "User not found" }, { status: 404 });
    }

    // Check if username is already taken by another user
    const existingUser = await prisma.user.findUnique({
      where: { username },
      select: { id: true },
    });

    if (existingUser && existingUser.id !== authentication.userId) {
      return Response.json(
        { error: "Username is already taken" },
        { status: 409 },
      );
    }

    // Check if user can change username (30-day restriction)
    if (currentUser.username_changed_at) {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      if (currentUser.username_changed_at > thirtyDaysAgo) {
        const daysRemaining = Math.ceil(
          (currentUser.username_changed_at.getTime() +
            30 * 24 * 60 * 60 * 1000 -
            Date.now()) /
            (24 * 60 * 60 * 1000),
        );

        return Response.json(
          {
            error: `You can only change your username once per month. Try again in ${daysRemaining} days.`,
          },
          { status: 429 },
        );
      }
    }

    // Update username
    const now = new Date();
    const previousUsernames = currentUser.previous_usernames || [];

    // Add current username to previous usernames if it exists
    if (currentUser.username) {
      previousUsernames.push(currentUser.username);
    }

    await prisma.user.update({
      where: { id: authentication.userId },
      data: {
        username,
        username_changed_at: now,
        previous_usernames: previousUsernames,
      },
    });

    return Response.json(
      { message: "Username updated successfully" },
      { status: 200 },
    );
  } catch (error) {
    logger.error("username.change_failed", { error });
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
