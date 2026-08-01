import { type NextRequest } from "next/server";
import { UsernameGenerator } from "@kingstack/shared";
import prisma from "@/lib/prisma";
import { createRequestLogger } from "@/lib/logger";

export async function GET(request: NextRequest) {
  const logger = createRequestLogger(request, "UsernameSuggestionsRoute");
  try {
    const { searchParams } = new URL(request.url);
    const count = parseInt(searchParams.get("count") || "5", 10);

    // Limit suggestions to reasonable number
    const suggestionCount = Math.min(Math.max(count, 1), 10);

    const suggestions = UsernameGenerator.generateSuggestions(suggestionCount);

    // Check which suggestions are available
    const availabilityChecks = await Promise.all(
      suggestions.map(async (username) => {
        const existingUser = await prisma.user.findUnique({
          where: { username },
          select: { id: true },
        });
        return { username, available: !existingUser };
      }),
    );

    // Filter to only available suggestions
    const availableSuggestions = availabilityChecks
      .filter((check) => check.available)
      .map((check) => check.username);

    // If we don't have enough available suggestions, generate more
    if (availableSuggestions.length < suggestionCount) {
      const additionalSuggestions = UsernameGenerator.generateSuggestions(
        suggestionCount * 2,
      );
      const additionalChecks = await Promise.all(
        additionalSuggestions.map(async (username) => {
          const existingUser = await prisma.user.findUnique({
            where: { username },
            select: { id: true },
          });
          return { username, available: !existingUser };
        }),
      );

      const additionalAvailable = additionalChecks
        .filter((check) => check.available)
        .map((check) => check.username);

      availableSuggestions.push(...additionalAvailable);
    }

    return Response.json(
      { suggestions: availableSuggestions.slice(0, suggestionCount) },
      { status: 200 },
    );
  } catch (error) {
    logger.error("username.suggestions_failed", { error });
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
