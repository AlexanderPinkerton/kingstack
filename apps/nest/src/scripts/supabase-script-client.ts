import postgres from "postgres";

export interface SupabaseScriptConnection {
  sql: ReturnType<typeof postgres>;
  target: string;
}

/**
 * Creates a short-lived administrative connection for Supabase maintenance
 * scripts. Prefer the direct URL so the scripts work for both local Supabase
 * and hosted projects without hard-coded hosts or ports.
 */
export function createSupabaseScriptConnection(): SupabaseScriptConnection {
  const connectionString =
    process.env.SUPABASE_DB_DIRECT_URL ?? process.env.SUPABASE_DB_POOL_URL;

  if (!connectionString) {
    throw new Error(
      "SUPABASE_DB_DIRECT_URL or SUPABASE_DB_POOL_URL must be configured",
    );
  }

  const url = new URL(connectionString);
  const isLocal =
    url.hostname === "localhost" ||
    url.hostname === "127.0.0.1" ||
    url.hostname === "::1";

  return {
    sql: postgres(connectionString, {
      ssl: isLocal ? false : "require",
      max: 1,
      idle_timeout: 10,
      connect_timeout: 10,
      prepare: false,
    }),
    target: `${url.hostname}:${url.port || "5432"}/${url.pathname.slice(1) || "postgres"}`,
  };
}
