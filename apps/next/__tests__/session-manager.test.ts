import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SessionManager } from "../src/lib/session-manager";
import { isSupabaseBrowserConfigured } from "../src/lib/supabase/browserClient";

const originalSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const originalSupabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

describe("Supabase-free session initialization", () => {
  beforeEach(() => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  });

  afterEach(() => {
    restoreEnv("NEXT_PUBLIC_SUPABASE_URL", originalSupabaseUrl);
    restoreEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", originalSupabaseAnonKey);
  });

  it("reports that the browser client is not configured", () => {
    expect(isSupabaseBrowserConfigured()).toBe(false);

    process.env.NEXT_PUBLIC_SUPABASE_URL = "http://localhost:54321";
    expect(isSupabaseBrowserConfigured()).toBe(false);

    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
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

function restoreEnv(key: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[key];
  } else {
    process.env[key] = value;
  }
}
