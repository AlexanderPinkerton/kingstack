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
    // Application Configuration
    // ============================================================================
    NEXT_HOST: "http://localhost",
    NEST_HOST: "http://localhost",
    NEXT_PORT: "3069",
    NEST_PORT: "3000",

    // ============================================================================
    // Supabase Configuration
    // ============================================================================
    SUPABASE_URL: "https://REPLACEME.supabase.co",
    SUPABASE_ANON_KEY: "REPLACEME",
    SUPABASE_SERVICE_ROLE_KEY: "REPLACEME",
    SUPA_JWT_SECRET: "REPLACEME",

    // ============================================================================
    // Database Configuration
    // ============================================================================
    SUPABASE_POOLER_HOST: "aws-1-us-east-2.pooler.supabase.com",
    SUPABASE_POOLER_USER: "postgres.REPLACEME",
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
