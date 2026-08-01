import type { IncomingMessage } from "node:http";
import { describe, expect, it } from "vitest";
import { getOrCreateRequestId } from "./logging";

function request(headers: IncomingMessage["headers"] = {}): IncomingMessage {
  return { headers } as IncomingMessage;
}

describe("request ID resolution", () => {
  it("accepts a bounded inbound request ID", () => {
    const rawRequest = request({ "x-request-id": "upstream-id" });

    expect(getOrCreateRequestId(rawRequest)).toBe("upstream-id");
    expect((rawRequest as IncomingMessage & { id?: string }).id).toBe(
      "upstream-id",
    );
  });

  it("generates one ID and reuses it across logging layers", () => {
    const rawRequest = request();

    const fastifyId = getOrCreateRequestId(rawRequest);
    const pinoHttpId = getOrCreateRequestId(rawRequest);

    expect(fastifyId).toMatch(/^[0-9a-f-]{36}$/);
    expect(pinoHttpId).toBe(fastifyId);
  });

  it("replaces malformed inbound IDs", () => {
    const rawRequest = request({ "x-request-id": "not a safe id" });

    expect(getOrCreateRequestId(rawRequest)).not.toBe("not a safe id");
  });
});
