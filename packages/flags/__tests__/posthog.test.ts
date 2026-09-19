import { afterEach, describe, expect, it, vi } from "vitest";
import { OpenFeature } from "@openfeature/server-sdk";
import { PostHogServerProvider } from "@posthog/openfeature-node-provider";
import { PostHog } from "posthog-node";
import { createFlagEvaluator } from "../src/server.js";
import { DecisionStatuses } from "../src/index.js";
import { flags } from "./fixtures.js";

afterEach(async () => {
  await OpenFeature.close();
});

describe("PostHog provider contract (mock HTTP, real SDKs)", () => {
  it("measures two remote requests for two flags, suppresses automatic exposure, and preserves ownership", async () => {
    const requests: { url: string; body: unknown }[] = [];
    const posthog = new PostHog("phc_test_only", {
      host: "https://posthog.test",
      featureFlagsRequestTimeoutMs: 1000,
      featureFlagsRequestMaxRetries: 0,
      fetchRetryCount: 0,
      fetch: (url, options) => {
        requests.push({ url, body: JSON.parse(String(options.body)) });
        return Promise.resolve({
          status: 200,
          text: () => Promise.resolve("{}"),
          json: () =>
            Promise.resolve({
              flags: {
                "new-dashboard": {
                  key: "new-dashboard",
                  enabled: false,
                  variant: null,
                },
                layout: { key: "layout", enabled: true, variant: "compact" },
              },
              errorsWhileComputingFlags: false,
            }),
        });
      },
    });
    const capture = vi.spyOn(posthog, "capture");
    const shutdown = vi.spyOn(posthog, "shutdown");
    try {
      await OpenFeature.setProviderAndWait(
        "posthog-test",
        new PostHogServerProvider(posthog, { sendFeatureFlagEvents: false }),
      );
      const evaluator = createFlagEvaluator({
        client: OpenFeature.getClient("posthog-test"),
      });
      const snapshot = await evaluator.snapshot(flags, {
        scope: "a:pro",
        context: { targetingKey: "a", plan: "pro" },
      });
      expect(snapshot.flags.layout).toEqual({
        value: "compact",
        status: DecisionStatuses.Resolved,
      });
      expect(snapshot.flags["new-dashboard"].value).toBe(false);
      expect(requests).toHaveLength(2);
      for (const request of requests) {
        expect(request.url).toContain("/flags/");
        expect(request.body).toMatchObject({
          distinct_id: "a",
          person_properties: { plan: "pro" },
        });
      }
      expect(capture).not.toHaveBeenCalled();
      await OpenFeature.close();
      expect(shutdown).not.toHaveBeenCalled();
    } finally {
      await posthog.shutdown();
    }
  });
});
