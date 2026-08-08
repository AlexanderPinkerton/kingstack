/**
 * Marks a request as intentionally unauthenticated. Protected requests must
 * use `fetchWithAuth` instead.
 */
export function fetchPublic(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  return fetch(input, init);
}
