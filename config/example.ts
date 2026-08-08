import { defineValues } from "@kingstack/config";
import type { ConfigValues } from "./schema.js";

/**
 * Example secret values for KingStack.
 *
 * Copy this file to create your own environment-specific values:
 * - config/local.ts (for local Supabase)
 * - config/development.ts (for development environment)
 * - config/production.ts (for production environment)
 *
 * Replace all "REPLACEME" values with your actual secrets.
 */
export const values = defineValues({
  // ============================================================================
  // Application URLs (defaults are usually fine for local development)
  // ============================================================================
  NEXT_HOST: "localhost",
  NEST_HOST: "localhost",

  // ============================================================================
  // Application Ports Configuration
  // ============================================================================
  NEXT_PORT: "3069",
  NEST_PORT: "3420",
  SUPABASE_DB_SHADOW_PORT: "54320",
  SUPABASE_API_PORT: "54321",
  SUPABASE_DB_DIRECT_PORT: "54322",
  SUPABASE_DB_POOLER_PORT: "54322", // Using the direct one for now since the pooler one doesn't work for some reason.
  SUPABASE_STUDIO_PORT: "54324",
  SUPABASE_ANALYTICS_PORT: "54325",
  SUPABASE_EMAIL_PORT: "54326",
  SUPABASE_EDGE_RUNTIME_INSPECTOR_PORT: "54327",

  // ============================================================================
  // Supabase Configuration
  // ============================================================================
  SUPABASE_PROJECT_REF: "kingstack-local",
  SUPABASE_REGION: "local",
  SUPABASE_PUBLISHABLE_KEY:
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0",
  SUPABASE_SECRET_KEY:
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJsdJsyH-qQwv8Hdp7fsn3W0YpN81IU",
  SUPABASE_DB_PASSWORD: "postgres",

  // ============================================================================
  // Optional: CI deployment automation (validated when secrets are synced)
  // ============================================================================
  VERCEL_TOKEN: "",
  VERCEL_ORG_ID: "",
  VERCEL_PROJECT_ID: "",

  // ============================================================================
  // Optional: AI Providers (leave empty if not using)
  // ============================================================================
  OPENAI_API_KEY: "",
  ANTHROPIC_API_KEY: "",
  GEMINI_API_KEY: "",

  // ============================================================================
  // Runtime Environment and Logging
  // ============================================================================
  // The CLI derives KINGSTACK_ENVIRONMENT from the selected environment name.
  LOG_LEVEL: "debug",
  LOG_FORMAT: "pretty",
} satisfies ConfigValues);
