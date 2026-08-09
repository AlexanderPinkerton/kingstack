import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  isAnonymousSession,
  SessionManager,
  type SupabaseSession,
} from "../src/lib/session-manager";
import { isSupabaseBrowserConfigured } from "../src/lib/supabase/browserClient";

const originalSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const originalSupabasePublishableKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

describe("Supabase-free session initialization", () => {
  beforeEach(() => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  });

  afterEach(() => {
    restoreEnv("NEXT_PUBLIC_SUPABASE_URL", originalSupabaseUrl);
    restoreEnv(
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
      originalSupabasePublishableKey,
    );
  });

  it("reports that the browser client is not configured", () => {
    expect(isSupabaseBrowserConfigured()).toBe(false);

    process.env.NEXT_PUBLIC_SUPABASE_URL = "http://localhost:54321";
    expect(isSupabaseBrowserConfigured()).toBe(false);

    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "test-publishable-key";
    expect(isSupabaseBrowserConfigured()).toBe(true);
  });

  it("initializes an anonymous session without constructing a client", () => {
    const onSessionChange = vi.fn();
    const sessionManager = new SessionManager(onSessionChange);

    expect(() => sessionManager.initialize()).not.toThrow();
    expect(sessionManager.getSession()).toBeNull();
    expect(onSessionChange).toHaveBeenCalledOnce();
    expect(onSessionChange).toHaveBeenCalledWith(
      null,
      "SUPABASE_NOT_CONFIGURED",
    );

    sessionManager.dispose();
  });
});

describe("isAnonymousSession", () => {
  it("distinguishes a temporary guest from a permanent session", () => {
    const permanentSession = {
      access_token: "permanent-token",
      user: { id: "user-123", is_anonymous: false },
    } as SupabaseSession;
    const guestSession = {
      access_token: "guest-token",
      user: { id: "guest-123", is_anonymous: true },
    } as SupabaseSession;

    expect(isAnonymousSession(null)).toBe(false);
    expect(isAnonymousSession(permanentSession)).toBe(false);
    expect(isAnonymousSession(guestSession)).toBe(true);
  });
});

function restoreEnv(key: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[key];
  } else {
    process.env[key] = value;
  }
}
