import { defineValues } from "./utils";

/**
 * Example secret values for KingStack.
 * 
 * Copy this file to create your own environment-specific values:
 * - secrets/local.ts (for local Supabase)
 * - secrets/development.ts (for development environment)
 * - secrets/production.ts (for production environment)
 * - secrets/playground.ts (for playground mode)
 * 
 * Replace all "REPLACEME" values with your actual secrets.
 */
export const values = defineValues({
    // ============================================================================
    // Application URLs (defaults are usually fine for local development)
    // ============================================================================
    NEXT_URL: "REPLACEME",
    NEST_URL: "REPLACEME",

    // ============================================================================
    // Application Ports Configuration
    // ============================================================================
    NEXT_PORT: "3000",
    NEST_PORT: "3001",

    // ============================================================================
    // Supabase Configuration
    // ============================================================================
    SUPABASE_HOST: "REPLACEME",
    SUPABASE_ANON_KEY: "REPLACEME",
    SUPABASE_SERVICE_ROLE_KEY: "REPLACEME",
    SUPA_JWT_SECRET: "REPLACEME",

    // ============================================================================
    // Database Configuration
    // ============================================================================
    SUPABASE_DB_POOLER_PORT: "REPLACEME",
    SUPABASE_DB_DIRECT_PORT: "REPLACEME",
    SUPABASE_DB_USER: "REPLACEME",
    SUPABASE_DB_PASSWORD: "REPLACEME",

    // ============================================================================
    // Optional: OAuth (leave empty if not using)
    // ============================================================================
    GOOGLE_CLIENT_ID: "",
    GOOGLE_CLIENT_SECRET: "",

    // ============================================================================
    // Optional: Deployment (leave empty if not deploying)
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
});
