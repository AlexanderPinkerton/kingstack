/**
 * Browser ID utility
 * Generates and persists a stable browser ID across page reloads
 * Used for filtering out self-originated realtime events
 */

const STORAGE_KEY = "kingstack_browser_id";

/**
 * Get or create a stable browser ID
 * - Returns "server" on server-side
 * - Creates and stores a unique ID in sessionStorage on client-side
 */
export function getBrowserId(): string {
  if (typeof window === "undefined") {
    return "server";
  }

  let browserId = sessionStorage.getItem(STORAGE_KEY);

  if (!browserId) {
    browserId = `browser-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
    sessionStorage.setItem(STORAGE_KEY, browserId);
  }

  return browserId;
}
