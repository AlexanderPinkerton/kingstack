import { defineSchema } from "./utils";

/**
 * Configuration schema for KingStack.
 * 
 * This defines:
 * 1. Core configuration values (inputs that must be provided)
 * 2. Computed values (derived from core configuration)
 * 3. Environment file mappings (which values go to which .env files)
 * 4. Config file mappings (which values update which config files)
 */
export const schema = defineSchema({
    // ============================================================================
    // Core Configuration (The Inputs)
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
        SUPABASE_PROJECT_REF: {
            required: true,
            description: "Supabase project reference ID (e.g., 'iktsajmbfqriqylrmruy'). Find in project settings.",
        },
        SUPABASE_REGION: {
            required: true,
            description: "Supabase region (e.g., 'aws-1-us-east-2'). Find in project settings.",
        },
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
        SUPABASE_DB_PASSWORD: {
            required: true,
            description: "Database password",
        },

        // Optional: Deployment
        VERCEL_TOKEN: {
            required: true,
            description: "Vercel deployment token",
        },
        VERCEL_ORG_ID: {
            required: true,
            description: "Vercel organization ID",
        },
        VERCEL_PROJECT_ID: {
            required: true,
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

        // Environment Type (determines URL format)
        ENVIRONMENT_TYPE: {
            default: "local",
            description: "Environment type: 'local' (http://localhost:PORT) or 'remote' (https://DOMAIN)",
        },
    },

    // ============================================================================
    // Computed Values (Derived from Core Configuration)
    // ============================================================================
    computed: (core) => {
        // Determine if this is a local environment
        const isLocal = core.ENVIRONMENT_TYPE === "local";

        // Supabase URLs (different patterns for local vs remote)
        const supabaseApiUrl = isLocal
            ? `http://localhost:${core.SUPABASE_API_PORT || "54321"}`
            : `https://${core.SUPABASE_PROJECT_REF}.supabase.co`;

        // Database hosts (different for local vs remote)
        const dbPoolerHost = isLocal
            ? "localhost"
            : `${core.SUPABASE_REGION}.pooler.supabase.com`;

        const dbDirectHost = isLocal
            ? "localhost"
            : `db.${core.SUPABASE_PROJECT_REF}.supabase.co`;

        // Database username (remote uses postgres.{PROJECT_REF} format)
        const dbUser = isLocal
            ? "postgres"
            : `postgres.${core.SUPABASE_PROJECT_REF}`;

        // Database ports
        const dbPoolerPort = isLocal ? (core.SUPABASE_DB_POOLER_PORT || "54322") : "6543";
        const dbDirectPort = isLocal ? (core.SUPABASE_DB_DIRECT_PORT || "54322") : "5432";

        // Application URLs
        const nestUrl = isLocal
            ? `http://${core.NEST_HOST}:${core.NEST_PORT}`
            : `https://${core.NEST_HOST}`;

        const nextUrl = isLocal
            ? `http://${core.NEXT_HOST}:${core.NEXT_PORT}`
            : `https://${core.NEXT_HOST}`;

        return {
            // Supabase API URL (for auth, storage, etc.)
            SUPABASE_API_URL: supabaseApiUrl,

            // Used by scripts
            SUPABASE_POOLER_HOST: dbPoolerHost,
            SUPABASE_POOLER_USER: dbUser,

            // Database connection strings
            // Pooler connection (for connection pooling via PgBouncer)
            SUPABASE_DB_POOL_URL: `postgresql://${dbUser}:${core.SUPABASE_DB_PASSWORD}@${dbPoolerHost}:${dbPoolerPort}/postgres?pgbouncer=true`,

            // Direct connection (for migrations)
            SUPABASE_DB_DIRECT_URL: `postgresql://${dbUser}:${core.SUPABASE_DB_PASSWORD}@${dbPoolerHost}:${dbDirectPort}/postgres`,

            // Public-facing URLs for Next.js
            NEXT_PUBLIC_SUPABASE_API_URL: supabaseApiUrl,
            NEXT_PUBLIC_SUPABASE_ANON_KEY: core.SUPABASE_ANON_KEY,
            NEXT_PUBLIC_NEST_BACKEND_URL: nestUrl,
            NEXT_PUBLIC_API_URL: nextUrl,

            // NestJS config
            NEXT_URL: nextUrl,
        };
    },

    // ============================================================================
    // Environment File Mappings (Which Values Go to Which .env Files)
    // ============================================================================
    envfiles: {
        next: {
            path: "apps/frontend/.env",
            keys: [

                // NestJS config
                "NEXT_PUBLIC_NEST_BACKEND_URL",

                // Public Supabase config
                "NEXT_PUBLIC_SUPABASE_API_URL",
                "NEXT_PUBLIC_SUPABASE_ANON_KEY",
                "NEXT_PUBLIC_API_URL",

                // Server-side Supabase config
                "SUPABASE_SERVICE_ROLE_KEY",
                "SUPABASE_DB_POOL_URL",
                "SUPABASE_DB_DIRECT_URL",

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
            path: "apps/backend/.env",
            keys: [
                // Frontend URL for CORS
                "NEXT_URL",

                // Supabase config
                "SUPABASE_POOLER_HOST",
                "SUPABASE_POOLER_USER",
                "SUPABASE_API_URL",
                "SUPABASE_ANON_KEY",
                "SUPABASE_SERVICE_ROLE_KEY",
                "SUPABASE_DB_POOL_URL",
                "SUPABASE_DB_DIRECT_URL",
                "SUPABASE_DB_PASSWORD",
                "SUPA_JWT_SECRET"
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

    // ============================================================================
    // Config File Mappings (Which Values Update Which Config Files)
    // ============================================================================
    configs: {
        supabase: {
            path: "supabase/config.toml",
            format: "toml" as const,
            mappings: {
                "project_id": "SUPABASE_PROJECT_REF",
                "api.port": "SUPABASE_API_PORT",
                "db.port": "SUPABASE_DB_DIRECT_PORT",
                "db.shadow_port": "SUPABASE_DB_SHADOW_PORT",
                "db.pooler.port": "SUPABASE_DB_POOLER_PORT",
                "studio.port": "SUPABASE_STUDIO_PORT",
                "inbucket.port": "SUPABASE_EMAIL_PORT",
                "analytics.port": "SUPABASE_ANALYTICS_PORT",
            },
        },
    },

    // ============================================================================
    // Service Mappings (Which Values Sync to External Services)
    // ============================================================================
    services: {
        github: {
            description: "GitHub environment secrets for CI/CD workflows",
            keys: [
                "SUPABASE_DB_DIRECT_URL",
                "SUPABASE_DB_POOL_URL",
                "NEXT_PUBLIC_SUPABASE_API_URL",
                "NEXT_PUBLIC_SUPABASE_ANON_KEY",
                "VERCEL_TOKEN",
                "VERCEL_ORG_ID",
                "VERCEL_PROJECT_ID",
            ],
        },
        vercel: {
            description: "Vercel environment variables for runtime",
            keys: [
                "NEXT_PUBLIC_SUPABASE_API_URL",
                "NEXT_PUBLIC_SUPABASE_ANON_KEY",
                "NEXT_PUBLIC_NEST_BACKEND_URL",
                "NEXT_PUBLIC_API_URL",
                "SUPABASE_SERVICE_ROLE_KEY",
                "SUPABASE_DB_POOL_URL",
                "SUPABASE_DB_DIRECT_URL",
            ],
        },
    },
});

export type ConfigValues = {
    [K in keyof typeof schema.core]?: string;
};
