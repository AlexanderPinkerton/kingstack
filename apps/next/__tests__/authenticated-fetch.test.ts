import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fetchWithAuth,
  HttpResponseError,
  readJsonResponse,
} from "../src/lib/auth/authenticated-fetch";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchWithAuth", () => {
  it("sets the bearer token while preserving caller headers", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);

    await fetchWithAuth("signed-token", "/api/example", {
      headers: { "X-Feature": "example" },
      method: "GET",
    });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = new Headers(init.headers);
    expect(headers.get("Authorization")).toBe("Bearer signed-token");
    expect(headers.get("X-Feature")).toBe("example");
    expect(headers.get("Accept")).toBe("application/json");
  });

  it("fails before making a request when the token is empty", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    expect(() => fetchWithAuth("  ", "/api/example")).toThrow(
      "An access token is required",
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("readJsonResponse", () => {
  it("decodes a successful JSON response", async () => {
    const response = Response.json({ id: "example" });

    await expect(readJsonResponse<{ id: string }>(response)).resolves.toEqual({
      id: "example",
    });
  });

  it("throws a typed error containing the safe API error", async () => {
    const response = Response.json(
      { error: "Bearer token expired" },
      { status: 401, statusText: "Unauthorized" },
    );

    const promise = readJsonResponse(response);
    await expect(promise).rejects.toBeInstanceOf(HttpResponseError);
    await expect(promise).rejects.toMatchObject({
      message: "Bearer token expired",
      status: 401,
    });
  });
});
