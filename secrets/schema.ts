import { defineSchema } from "./utils";

/**
 * Secrets schema for KingStack.
 * 
 * This defines:
 * 1. Core secrets (inputs that must be provided)
 * 2. Computed secrets (derived from core secrets)
 * 3. Project mappings (which secrets go to which .env files)
 */
export const schema = defineSchema({
    // ============================================================================
    // Core Secrets (The Inputs)
    // ============================================================================
    core: {
        // Application URLs
        NEXT_HOST: {
            default: "localhost",
            description: "Next.js frontend hostname",
        },
        NEST_HOST: {
            default: "localhost",
            description: "NestJS backend hostname",
        },

        // Application Ports
        NEST_PORT: {
            required: true,
            description: "NestJS backend port",
        },
        NEXT_PORT: {
            required: true,
            description: "Next.js frontend port",
        },

        // Supabase Configuration
        SUPABASE_ANON_KEY: {
            required: true,
            description: "Supabase anonymous key for client-side auth",
        },
        SUPABASE_SERVICE_ROLE_KEY: {
            required: true,
            description: "Supabase service role key for server-side operations",
        },
        SUPA_JWT_SECRET: {
            required: true,
            description: "JWT secret from Supabase dashboard for token validation",
        },

        // Database Configuration
        SUPABASE_HOST: {
            required: true,
            description: "Supabase project hostname",
        },
        SUPABASE_DB_USER: {
            required: true,
            description: "Database username",
        },
        SUPABASE_DB_PASSWORD: {
            required: true,
            description: "Database password",
        },
        // TODO: Sync all ports supabase/config.toml
        SUPABASE_DB_SHADOW_PORT: {
            required: false,
            default: "54320",
            description: "Shadow database port"
        },
        SUPABASE_API_PORT: {
            required: false,
            default: "54321",
            description: "The port for the supabase api server"
        },
        SUPABASE_DB_DIRECT_PORT: {
            required: false,
            default: "54322",
            description: "Database direct port",
        },
        SUPABASE_DB_POOLER_PORT: {
            required: false,
            default: "54329",
            description: "Database pooler port",
        },
        SUPABASE_STUDIO_PORT: {
            required: false,
            default: "54323",
            description: "Database studio port",
        },





        // Optional: OAuth
        GOOGLE_CLIENT_ID: {
            default: "",
            description: "Google OAuth client ID (optional)",
        },
        GOOGLE_CLIENT_SECRET: {
            default: "",
            description: "Google OAuth client secret (optional)",
        },

        // Optional: Deployment
        VERCEL_TOKEN: {
            default: "",
            description: "Vercel deployment token",
        },
        VERCEL_ORG_ID: {
            default: "",
            description: "Vercel organization ID",
        },
        VERCEL_PROJECT_ID: {
            default: "",
            description: "Vercel project ID",
        },

        // Optional: AI Providers
        OPENAI_API_KEY: {
            default: "",
            description: "OpenAI API key",
        },
        ANTHROPIC_API_KEY: {
            default: "",
            description: "Anthropic API key",
        },
        GEMINI_API_KEY: {
            default: "",
            description: "Google Gemini API key",
        },
    },

    // ============================================================================
    // Computed Secrets (Derived Values)
    // ============================================================================
    computed: (core) => ({

        // Main supabase URL
        SUPABASE_URL: `https://${core.SUPABASE_HOST}`,

        // Used by scripts
        SUPABASE_POOLER_HOST: core.SUPABASE_HOST,
        SUPABASE_POOLER_USER: core.SUPABASE_DB_USER,

        // Database connection strings
        SUPABASE_DB_POOL_URL: `postgresql://${core.SUPABASE_DB_USER}:${core.SUPABASE_DB_PASSWORD}@${core.SUPABASE_HOST}:${core.SUPABASE_DB_POOLER_PORT}/postgres?pgbouncer=true`,
        SUPABASE_DB_DIRECT_URL: `postgresql://${core.SUPABASE_DB_USER}:${core.SUPABASE_DB_PASSWORD}@${core.SUPABASE_HOST}:${core.SUPABASE_DB_DIRECT_PORT}/postgres`,

        // Derived database user (same as pooler user)
        SUPABASE_DB_USER: core.SUPABASE_DB_USER,

        // Public-facing URLs for Next.js
        NEXT_PUBLIC_SUPABASE_URL: `https://${core.SUPABASE_HOST}`,
        NEXT_PUBLIC_SUPABASE_ANON_KEY: core.SUPABASE_ANON_KEY,
        NEXT_PUBLIC_NEST_URL: `http://${core.NEST_HOST}:${core.NEST_PORT}`,
        NEXT_PUBLIC_API_URL: `http://${core.NEXT_HOST}:${core.NEXT_PORT}`,

        // NestJS config
        NEXT_URL: `http://${core.NEXT_HOST}:${core.NEXT_PORT}`,
    }),

    // ============================================================================
    // Project Mappings (Where Secrets Go)
    // ============================================================================
    projects: {
        next: {
            path: "apps/next/.env",
            keys: [
                // Public Supabase config
                "NEXT_PUBLIC_SUPABASE_URL",
                "NEXT_PUBLIC_SUPABASE_ANON_KEY",
                "NEXT_PUBLIC_NEST_URL",
                "NEXT_PUBLIC_API_URL",

                // Server-side Supabase config
                "SUPABASE_SERVICE_ROLE_KEY",
                "SUPABASE_DB_POOL_URL",
                "SUPABASE_DB_DIRECT_URL",

                // OAuth
                "GOOGLE_CLIENT_ID",
                "GOOGLE_CLIENT_SECRET",

                // Deployment
                "VERCEL_TOKEN",
                "VERCEL_ORG_ID",
                "VERCEL_PROJECT_ID",

                // AI Providers
                "OPENAI_API_KEY",
                "ANTHROPIC_API_KEY",
                "GEMINI_API_KEY",
            ],
            aliases: {
                // Map NEXT_PORT to PORT for this project
                NEXT_PORT: "PORT",
            },
        },

        nest: {
            path: "apps/nest/.env",
            keys: [
                // Frontend URL for CORS
                "NEXT_URL",

                // Supabase config
                "SUPABASE_POOLER_HOST",
                "SUPABASE_POOLER_USER",
                "SUPABASE_URL",
                "SUPABASE_ANON_KEY",
                "SUPABASE_SERVICE_ROLE_KEY",
                "SUPABASE_DB_POOL_URL",
                "SUPABASE_DB_DIRECT_URL",
                "SUPABASE_DB_USER",
                "SUPABASE_DB_PASSWORD",
                "SUPA_JWT_SECRET",
            ],
            aliases: {
                // Map NEST_PORT to PORT for this project
                NEST_PORT: "PORT",
            },
        },

        prisma: {
            path: "packages/prisma/.env",
            keys: [
                "SUPABASE_DB_POOL_URL",
                "SUPABASE_DB_DIRECT_URL",
            ],
        },
    },
});

export type SecretValues = {
    [K in keyof typeof schema.core]?: string;
};
