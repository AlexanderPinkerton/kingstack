export class HttpResponseError extends Error {
  constructor(
    readonly status: number,
    readonly statusText: string,
    message: string,
  ) {
    super(message);
    this.name = "HttpResponseError";
  }
}

/**
 * The only browser HTTP helper for authenticated KingStack service calls.
 * Public endpoints should use `fetchPublic` instead.
 */
export function fetchWithAuth(
  accessToken: string,
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  if (accessToken.trim().length === 0) {
    throw new Error("An access token is required for an authenticated request");
  }

  const headers = new Headers(init?.headers);
  headers.set("Authorization", `Bearer ${accessToken}`);

  if (init?.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  if (!headers.has("Accept")) {
    headers.set("Accept", "application/json");
  }

  return fetch(input, {
    ...init,
    headers,
  });
}

export async function readJsonResponse<T>(response: Response): Promise<T> {
  const body = await response.text();

  if (!response.ok) {
    throw new HttpResponseError(
      response.status,
      response.statusText,
      errorMessage(body, response),
    );
  }

  if (body.length === 0) {
    return undefined as T;
  }

  return JSON.parse(body) as T;
}

function errorMessage(body: string, response: Response): string {
  if (body.length > 0) {
    try {
      const parsed = JSON.parse(body) as { error?: unknown; message?: unknown };
      if (typeof parsed.error === "string") return parsed.error;
      if (typeof parsed.message === "string") return parsed.message;
    } catch {
      return body;
    }
  }

  return `Request failed with status ${response.status}${
    response.statusText ? ` ${response.statusText}` : ""
  }`;
}
