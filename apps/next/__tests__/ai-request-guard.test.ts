import { describe, expect, it, vi } from "vitest";
import { authorizeAiUsage } from "../src/lib/ai/ai-request-guard";

describe("authorizeAiUsage", () => {
  it("limits expensive image requests per authenticated user", async () => {
    const logger = { warn: vi.fn() };

    expect(authorizeAiUsage("image-user", "image", logger).ok).toBe(true);
    expect(authorizeAiUsage("image-user", "image", logger).ok).toBe(true);
    expect(authorizeAiUsage("image-user", "image", logger).ok).toBe(true);

    const blocked = authorizeAiUsage("image-user", "image", logger);
    expect(blocked.ok).toBe(false);
    if (blocked.ok) throw new Error("Expected the image request to be limited");

    expect(blocked.response.status).toBe(429);
    expect(blocked.response.headers.get("Retry-After")).toBeTruthy();
    await expect(blocked.response.json()).resolves.toEqual({
      error: "AI request limit reached. Try again shortly.",
    });
    expect(logger.warn).toHaveBeenCalledWith(
      "ai.request_rate_limited",
      expect.objectContaining({ kind: "image", userId: "image-user" }),
    );
  });
});
