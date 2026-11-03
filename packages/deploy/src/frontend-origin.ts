type Request = (url: URL, options: RequestInit) => Promise<Response>;

/** Read-only advisory check: an unavailable frontend must not block its first deploy. */
export async function checkFrontendOrigin(
  siteUrl: string,
  request: Request = fetch,
): Promise<string | undefined> {
  let configured: URL;
  try {
    configured = new URL(siteUrl);
    if (
      !["http:", "https:"].includes(configured.protocol) ||
      configured.username ||
      configured.password
    ) {
      return "Cannot check the frontend origin: NEXT_URL must be an HTTP(S) URL without credentials.";
    }
  } catch {
    return "Cannot check the frontend origin: NEXT_URL is not a valid URL.";
  }

  let current = configured;
  const signal = AbortSignal.timeout(5000);
  try {
    for (let attempt = 0; attempt < 5; attempt++) {
      const response = await request(current, {
        method: "HEAD",
        redirect: "manual",
        signal,
      });
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get("location");
        if (!location) break;
        const destination = new URL(location, current);
        if (destination.origin !== configured.origin) {
          return `Frontend origin ${configured.origin} redirects to ${destination.origin}. Set NEXT_HOST to the final frontend hostname and regenerate/sync configuration so CORS, metadata, and Auth links agree.`;
        }
        current = destination;
        continue;
      }
      if (response.ok) return undefined;
      return `Could not verify frontend origin ${configured.origin} (HTTP ${response.status}). Check its routing after the frontend is available.`;
    }
    return `Could not verify frontend origin ${configured.origin}: unresolved redirects. Check its routing.`;
  } catch {
    return `Could not reach frontend origin ${configured.origin}. Check its routing after the frontend is available.`;
  }
}
