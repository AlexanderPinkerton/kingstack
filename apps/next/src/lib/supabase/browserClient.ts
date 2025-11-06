import { createBrowserClient } from "@supabase/ssr";
import { createPlaygroundClient } from "./playgroundClient";
import { isPlaygroundMode } from "@kingstack/shared";

export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Check if we're in playground mode or missing environment variables
  if (isPlaygroundMode() || !supabaseUrl || !supabaseAnonKey) {
    console.log("🎮 Supabase client: Using mock client for playground mode");
    return createPlaygroundClient();
  }

  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}
