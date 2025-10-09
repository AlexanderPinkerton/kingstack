import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { isPlaygroundMode } from "@kingstack/shapes";
import { createPlaygroundClient } from "./playgroundClient";

export async function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Check if we're in playground mode or missing environment variables
  if (isPlaygroundMode() || !supabaseUrl || !supabaseAnonKey) {
    console.log("🎮 Supabase client: Using mock client for playground mode");
    return createPlaygroundClient();
  }

  const cookieStore = await cookies();

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // The `setAll` method was called from a Server Component.
          // This can be ignored if you have middleware refreshing
          // user sessions.
        }
      },
    },
  });
}
