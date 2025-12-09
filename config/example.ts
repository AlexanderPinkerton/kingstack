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
    SUPABASE_PROJECT_ID: "kingstack-example",

    // ============================================================================
    // Application URLs (defaults are usually fine for local development)
    // ============================================================================
    NEXT_URL: "localhost",
    NEST_URL: "localhost",

    // ============================================================================
    // Application Ports Configuration
    // ============================================================================
    NEXT_PORT: "3069",
    NEST_PORT: "3420",
    SUPABASE_DB_SHADOW_PORT: "54320",
    SUPABASE_API_PORT: "54321",
    SUPABASE_DB_DIRECT_PORT: "54322",
    SUPABASE_DB_POOLER_PORT: "54322",  // Using the direct one for now since the pooler one doesn't work for some reason.
    SUPABASE_STUDIO_PORT: "54324",
    SUPABASE_ANALYTICS_PORT: "54325",
    SUPABASE_EMAIL_PORT: "54326",

    // ============================================================================
    // Supabase Configuration
    // ============================================================================
    // For remote Supabase (production/development):
    SUPABASE_PROJECT_REF: "iytsajmbfqriqylrmruy",  // Your project ref from Supabase dashboard
    SUPABASE_REGION: "aws-1-us-east-1",             // Your region from Supabase dashboard

    // For local Supabase:
    // SUPABASE_PROJECT_REF: "local",
    // SUPABASE_REGION: "local",

    SUPABASE_ANON_KEY: "sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH",
    SUPABASE_SERVICE_ROLE_KEY: "sb_secret_N7UND0UgjKTVK-Uodkm0Hg_xSvEMPvz",
    SUPA_JWT_SECRET: "super-secret-jwt-token-with-at-least-32-characters-long",
    SUPABASE_DB_PASSWORD: "your-database-password",

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

    // ============================================================================
    // Stripe
    // ============================================================================
    STRIPE_PUBLIC_KEY: "pk_test_REPLACEME",
    STRIPE_SECRET_KEY: "sk_test_REPLACEME",
    STRIPE_WEBHOOK_SECRET: "whsec_REPLACEME",

    // ============================================================================
    // Resend (Email)
    // ============================================================================
    RESEND_API_KEY: "re_REPLACEME",

    // ============================================================================
    // Ecommerce: Inventory
    // ============================================================================
    NEXT_PUBLIC_INVENTORY_POOL_ID: "REPLACEME",

    // ============================================================================
    // Environment Type
    // ============================================================================
    // Set to "local" for http://localhost:PORT URLs
    // Set to "remote" for https://DOMAIN URLs (no ports)
    ENVIRONMENT_TYPE: "local",
});
