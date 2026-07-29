// Mock Supabase client for playground mode
// This provides a no-op implementation that doesn't require real Supabase credentials
export function createPlaygroundClient() {
  console.log("🎮 Creating mock Supabase client for playground mode");

  return {
    auth: {
      // Mock auth methods that return promises but don't do anything
      signInWithPassword: () =>
        Promise.resolve({
          data: { user: null, session: null },
          error: { message: "Authentication disabled in playground mode" },
        }),

      signInWithOAuth: () =>
        Promise.resolve({
          data: { provider: null, url: null },
          error: { message: "OAuth disabled in playground mode" },
        }),

      signUp: () =>
        Promise.resolve({
          data: { user: null, session: null },
          error: { message: "Registration disabled in playground mode" },
        }),

      signOut: () => Promise.resolve({ error: null }),

      onAuthStateChange: (
        _callback: (event: string, session: any) => void,
      ) => ({
        data: { subscription: { unsubscribe: () => {} } },
      }),

      getSession: () =>
        Promise.resolve({
          data: { session: null },
          error: null,
        }),

      getUser: () =>
        Promise.resolve({
          data: { user: null },
          error: null,
        }),
    },

    // Mock other Supabase services as needed
    from: (_table: string) => ({
      select: () => ({
        eq: () => ({
          single: () => Promise.resolve({ data: null, error: null }),
          maybeSingle: () => Promise.resolve({ data: null, error: null }),
        }),
        insert: () => ({
          select: () => ({
            single: () => Promise.resolve({ data: null, error: null }),
          }),
        }),
        update: () => ({
          eq: () => ({
            select: () => ({
              single: () => Promise.resolve({ data: null, error: null }),
            }),
          }),
        }),
        delete: () => ({
          eq: () => ({
            select: () => ({
              single: () => Promise.resolve({ data: null, error: null }),
            }),
          }),
        }),
      }),
    }),
  };
}
