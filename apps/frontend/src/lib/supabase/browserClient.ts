import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Check if we have the required environment variables
  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn(
      "⚠️ Supabase client: Missing environment variables - returning null",
    );
    return null;
  }

  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}
