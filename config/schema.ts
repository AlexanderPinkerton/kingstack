import { defineSchema, type ConfigValuesFor } from "@kingstack/config";

function validatePort(value: string): string | undefined {
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    return `Expected a port between 1 and 65535, received "${value}"`;
  }
  return undefined;
}

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
  environments: {
    local: {
      mode: "local",
      sync: false,
      description: "Local development using local services",
    }
  },

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
      validate: validatePort,
    },
    NEXT_PORT: {
      required: true,
      description: "Next.js frontend port",
      validate: validatePort,
    },

    // Supabase Configuration
    SUPABASE_PROJECT_REF: {
      required: true,
      description:
        "Supabase project reference ID (e.g., 'iktsajmbfqriqylrmruy'). Find in project settings.",
    },
    SUPABASE_REGION: {
      required: true,
      description:
        "Supabase region (e.g., 'aws-1-us-east-2'). Find in project settings.",
    },
    SUPABASE_ANON_KEY: {
      required: true,
      description: "Supabase anonymous key for client-side auth",
    },
    SUPABASE_SERVICE_ROLE_KEY: {
      required: true,
      description: "Supabase service role key for server-side operations",
      sensitive: true,
    },
    SUPA_JWT_SECRET: {
      required: true,
      description: "JWT secret from Supabase dashboard for token validation",
      sensitive: true,
    },
    SUPABASE_DB_PASSWORD: {
      required: true,
      description: "Database password",
      sensitive: true,
    },
    SUPABASE_DB_SHADOW_PORT: {
      required: false,
      default: "54320",
      description: "Supabase shadow port",
      validate: validatePort,
    },
    SUPABASE_API_PORT: {
      required: false,
      default: "54321",
      description: "Supabase API port",
      validate: validatePort,
    },
    SUPABASE_DB_DIRECT_PORT: {
      required: false,
      default: "54322",
      description: "Supabase database direct port",
      validate: validatePort,
    },
    SUPABASE_DB_POOLER_PORT: {
      required: false,
      default: "54322", // Using the direct one for now since the pooler one doesn't work for some reason.
      description: "Supabase database pooler port",
      validate: validatePort,
    },
    SUPABASE_STUDIO_PORT: {
      required: false,
      default: "54324",
      description: "Supabase studio port",
      validate: validatePort,
    },
    SUPABASE_ANALYTICS_PORT: {
      required: false,
      default: "54325",
      description: "Supabase analytics port",
      validate: validatePort,
    },
    SUPABASE_EMAIL_PORT: {
      required: false,
      default: "54326",
      description: "Supabase email port",
      validate: validatePort,
    },
    SUPABASE_EDGE_RUNTIME_INSPECTOR_PORT: {
      required: false,
      default: "54327",
      description: "Supabase Edge Runtime inspector port",
      validate: validatePort,
    },

    // Deployment values are required only for hosted environments.
    VERCEL_TOKEN: {
      requiredWhen: ({ mode }) => mode === "hosted",
      description: "Vercel deployment token",
      sensitive: true,
    },
    VERCEL_ORG_ID: {
      requiredWhen: ({ mode }) => mode === "hosted",
      description: "Vercel organization ID",
    },
    VERCEL_PROJECT_ID: {
      requiredWhen: ({ mode }) => mode === "hosted",
      description: "Vercel project ID",
    },

    // Optional: AI Providers
    OPENAI_API_KEY: {
      default: "",
      description: "OpenAI API key",
      sensitive: true,
    },
    ANTHROPIC_API_KEY: {
      default: "",
      description: "Anthropic API key",
      sensitive: true,
    },
    GEMINI_API_KEY: {
      default: "",
      description: "Google Gemini API key",
      sensitive: true,
    },

    // Runtime logging. The config generator declares these values; each
    // application validates them again when its logger starts.
    LOG_LEVEL: {
      default: "info",
      description:
        "Minimum runtime log level: trace, debug, info, warn, error, fatal, or silent",
      validate: (value) =>
        ["trace", "debug", "info", "warn", "error", "fatal", "silent"].includes(
          value,
        )
          ? undefined
          : `Unknown log level "${value}"`,
    },
    LOG_FORMAT: {
      default: "json",
      description: "Runtime log format: json or pretty (pretty is local-only)",
      validate: (value, { mode }) => {
        if (value !== "json" && value !== "pretty") {
          return `Unknown log format "${value}"`;
        }
        if (mode === "hosted" && value === "pretty") {
          return "Hosted environments require LOG_FORMAT=json";
        }
        return undefined;
      },
    },
  },

  // ============================================================================
  // Computed Values (Derived from Core Configuration)
  // ============================================================================
  computed: (core, environment) => {
    // Local uses localhost and explicit ports. Development and production use
    // hosted HTTPS endpoints.
    const isLocal = environment.mode === "local";

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
    const dbPoolerPort = isLocal
      ? core.SUPABASE_DB_POOLER_PORT || "54322"
      : "6543";
    const dbDirectPort = isLocal
      ? core.SUPABASE_DB_DIRECT_PORT || "54322"
      : "5432";

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
      SUPABASE_DB_POOL_URL: `postgresql://${encodeURIComponent(dbUser)}:${encodeURIComponent(core.SUPABASE_DB_PASSWORD)}@${dbPoolerHost}:${dbPoolerPort}/postgres?pgbouncer=true`,

      // Direct connection (for migrations)
      SUPABASE_DB_DIRECT_URL: `postgresql://${encodeURIComponent(dbUser)}:${encodeURIComponent(core.SUPABASE_DB_PASSWORD)}@${dbDirectHost}:${dbDirectPort}/postgres`,

      // Shadow DB connection (for migrations)
      SUPABASE_DB_SHADOW_URL: `postgresql://${encodeURIComponent(dbUser)}:${encodeURIComponent(core.SUPABASE_DB_PASSWORD)}@${dbDirectHost}:${dbDirectPort}/shadow_db`,

      // Environment identity comes from the CLI argument, never duplicated in values files.
      KINGSTACK_ENVIRONMENT: environment.environment,

      // Public-facing URLs for Next.js
      NEXT_PUBLIC_SUPABASE_URL: supabaseApiUrl,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: core.SUPABASE_ANON_KEY,
      NEXT_PUBLIC_NEST_BACKEND_URL: nestUrl,
      NEXT_PUBLIC_API_URL: nextUrl,

      // NestJS config
      NEXT_URL: nextUrl,

      // Project-specific cookie name for session isolation
      NEXT_PUBLIC_SUPABASE_COOKIE_NAME: `sb-${core.SUPABASE_PROJECT_REF}-auth-token`,
    };
  },

  // ============================================================================
  // Environment File Mappings (Which Values Go to Which .env Files)
  // ============================================================================
  envfiles: {
    next: {
      path: "apps/next/.env",
      keys: [
        // NestJS config
        "NEXT_PUBLIC_NEST_BACKEND_URL",

        // Public Supabase config
        "NEXT_PUBLIC_SUPABASE_URL",
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

        // Runtime logging
        "LOG_LEVEL",
        "LOG_FORMAT",
        "KINGSTACK_ENVIRONMENT",

        // Cookie name for session isolation
        "NEXT_PUBLIC_SUPABASE_COOKIE_NAME",
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
        "SUPABASE_API_URL",
        "SUPABASE_ANON_KEY",
        "SUPABASE_SERVICE_ROLE_KEY",
        "SUPABASE_DB_POOL_URL",
        "SUPABASE_DB_DIRECT_URL",
        "SUPABASE_DB_PASSWORD",
        "SUPA_JWT_SECRET",

        // Runtime logging
        "LOG_LEVEL",
        "LOG_FORMAT",
        "KINGSTACK_ENVIRONMENT",
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
        "SUPABASE_DB_SHADOW_URL",
      ],
    },
  },

  // ============================================================================
  // Config File Mappings (Which Values Update Which Config Files)
  // ============================================================================
  configs: {
    supabase: {
      path: "supabase/config.toml",
      format: "toml",
      mappings: {
        project_id: "SUPABASE_PROJECT_REF",
        "api.port": "SUPABASE_API_PORT",
        "db.port": "SUPABASE_DB_DIRECT_PORT",
        "db.shadow_port": "SUPABASE_DB_SHADOW_PORT",
        "db.pooler.port": "SUPABASE_DB_POOLER_PORT",
        "studio.port": "SUPABASE_STUDIO_PORT",
        "inbucket.port": "SUPABASE_EMAIL_PORT",
        "analytics.port": "SUPABASE_ANALYTICS_PORT",
        "edge_runtime.inspector_port": "SUPABASE_EDGE_RUNTIME_INSPECTOR_PORT",
        "auth.site_url": "NEXT_URL",
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
        "NEXT_PUBLIC_SUPABASE_URL",
        "NEXT_PUBLIC_SUPABASE_ANON_KEY",
        "VERCEL_TOKEN",
        "VERCEL_ORG_ID",
        "VERCEL_PROJECT_ID",
      ],
    },
    vercel: {
      description: "Vercel environment variables for runtime",
      keys: [
        "NEXT_PUBLIC_SUPABASE_URL",
        "NEXT_PUBLIC_SUPABASE_ANON_KEY",
        "NEXT_PUBLIC_NEST_BACKEND_URL",
        "NEXT_PUBLIC_API_URL",
        "SUPABASE_SERVICE_ROLE_KEY",
        "SUPABASE_DB_POOL_URL",
        "SUPABASE_DB_DIRECT_URL",
        "LOG_LEVEL",
        "LOG_FORMAT",
        "KINGSTACK_ENVIRONMENT",
      ],
    },
  },
});

export type ConfigValues = ConfigValuesFor<typeof schema>;
