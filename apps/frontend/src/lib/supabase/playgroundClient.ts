// Mock Supabase client for playground mode
// This provides a no-op implementation that doesn't require real Supabase credentials
export function createPlaygroundClient() {
  console.log("🎮 Creating mock Supabase client for playground mode");

  return {
    auth: {
      // Mock auth methods that return promises but don't do anything
      signInWithPassword: async () => ({
        data: { user: null, session: null },
        error: { message: "Authentication disabled in playground mode" },
      }),

      signInWithOAuth: async () => ({
        data: { provider: null, url: null },
        error: { message: "OAuth disabled in playground mode" },
      }),

      signUp: async () => ({
        data: { user: null, session: null },
        error: { message: "Registration disabled in playground mode" },
      }),

      signOut: async () => ({
        error: null,
      }),

      onAuthStateChange: (
        _callback: (event: string, session: any) => void,
      ) => ({
        data: { subscription: { unsubscribe: () => {} } },
      }),

      getSession: async () => ({
        data: { session: null },
        error: null,
      }),

      getUser: async () => ({
        data: { user: null },
        error: null,
      }),
    },

    // Mock other Supabase services as needed
    from: (_table: string) => ({
      select: () => ({
        eq: () => ({
          single: async () => ({ data: null, error: null }),
          maybeSingle: async () => ({ data: null, error: null }),
        }),
        insert: () => ({
          select: () => ({
            single: async () => ({ data: null, error: null }),
          }),
        }),
        update: () => ({
          eq: () => ({
            select: () => ({
              single: async () => ({ data: null, error: null }),
            }),
          }),
        }),
        delete: () => ({
          eq: () => ({
            select: () => ({
              single: async () => ({ data: null, error: null }),
            }),
          }),
        }),
      }),
    }),
  };
}
