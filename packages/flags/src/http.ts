import type { SnapshotLoader } from "./snapshot.js";

/** Supply the host's authenticated fetch. Tokens are resolved for each request, not captured here. */
export function createHttpSnapshotLoader(options: {
  url: string;
  fetch?: typeof globalThis.fetch;
}): SnapshotLoader {
  return async ({ signal }) => {
    const response = await (options.fetch ?? globalThis.fetch)(options.url, {
      method: "GET",
      cache: "no-store",
      signal,
      headers: { Accept: "application/json" },
    });
    if (!response.ok)
      throw new Error(`Feature flag snapshot HTTP ${response.status}`);
    return response.json() as Promise<unknown>;
  };
}
