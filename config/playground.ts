import { defineValues } from "./utils";

/**
 * Playground mode values - safe mock data for development without a backend.
 * 
 * This file can be checked into version control since it contains no real secrets.
 */
export const values = defineValues({
    // ============================================================================
    // Application Configuration
    // ============================================================================
    NEXT_HOST: "localhost",
    NEST_HOST: "localhost",
    NEXT_PORT: "3069",
    NEST_PORT: "3000",

    // ============================================================================
    // Supabase Configuration (Mock)
    // ============================================================================
    SUPABASE_API_URL: "https://playground.supabase.co",
    SUPABASE_ANON_KEY: "mock-anon-key-for-playground",
    SUPABASE_SERVICE_ROLE_KEY: "mock-service-role-key-for-playground",
    SUPA_JWT_SECRET: "mock-jwt-secret-for-playground",

    // ============================================================================
    // Database Configuration (Mock)
    // ============================================================================
    SUPABASE_POOLER_HOST: "localhost",
    SUPABASE_POOLER_USER: "postgres.playground",
    SUPABASE_DB_PASSWORD: "playground",

    // ============================================================================
    // Optional: OAuth (Empty for playground)
    // ============================================================================
    GOOGLE_CLIENT_ID: "",
    GOOGLE_CLIENT_SECRET: "",

    // ============================================================================
    // Optional: Deployment (Empty for playground)
    // ============================================================================
    VERCEL_TOKEN: "",
    VERCEL_ORG_ID: "",
    VERCEL_PROJECT_ID: "",

    // ============================================================================
    // Optional: AI Providers (Empty for playground)
    // ============================================================================
    OPENAI_API_KEY: "",
    ANTHROPIC_API_KEY: "",
    GEMINI_API_KEY: "",
});
