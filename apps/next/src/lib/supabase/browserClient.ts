import { createBrowserClient } from "@supabase/ssr";

export function isSupabaseBrowserConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are required",
    );
  }

  const cookieName = process.env.NEXT_PUBLIC_SUPABASE_COOKIE_NAME;

  return createBrowserClient(supabaseUrl, supabaseAnonKey, {
    cookieOptions: cookieName ? { name: cookieName } : undefined,
  });
}
