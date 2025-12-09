# Configuration Management

KingStack uses a **TypeScript-based configuration system** that provides type safety, computed values, centralized configuration, and automatic generation of both `.env` files and config files.

## 🎯 Quick Start

### 1. Create Your Environment File

```bash
cp config/example.ts config/local.ts
```

Edit `config/local.ts` and customize the values for your local environment.

### 2. Generate Configuration

```bash
yarn env:local          # Generate from config/local.ts
# or
yarn env:development    # Generate from config/development.ts
yarn env:production     # Generate from config/production.ts
yarn env:playground     # Generate from config/playground.ts (mock data)
```

This single command generates:
- ✅ `.env` files for all projects
- ✅ Updates `supabase/config.toml` with ports and project_id

### 3. Start Development

```bash
yarn dev
```

## 📁 Directory Structure

```
config/
├── schema.ts          # Schema definition (checked in)
├── utils.ts           # Type definitions and validation (checked in)
├── example.ts         # Example values template (checked in)
├── playground.ts      # Mock values for playground mode (checked in)
├── local.ts           # Your local environment values (gitignored)
├── development.ts     # Development environment values (gitignored)
├── production.ts      # Production environment values (gitignored)
└── scripts/           # Configuration management scripts
    ├── generate-env.ts              # Generate .env files and update configs
    └── sync-deployment-secrets.ts   # Sync secrets to GitHub and Vercel
```

## 🔧 How It Works

### 1. Schema Definition (`schema.ts`)

The schema defines four things:

**Core Configuration** - The input values you provide:
```typescript
core: {
  SUPABASE_PROJECT_ID: { default: "kingstack" },
  SUPABASE_HOST: { required: true },
  SUPABASE_DB_PASSWORD: { required: true },
  NEST_PORT: { required: true },
}
```

**Computed Values** - Values automatically derived from core configuration:
```typescript
computed: (core) => ({
  // Automatically build database connection strings
  SUPABASE_DB_POOL_URL: `postgresql://${core.SUPABASE_DB_USER}:${core.SUPABASE_DB_PASSWORD}@${core.SUPABASE_HOST}:${core.SUPABASE_DB_POOLER_PORT}/postgres?pgbouncer=true`,
  SUPABASE_DB_DIRECT_URL: `postgresql://${core.SUPABASE_DB_USER}:${core.SUPABASE_DB_PASSWORD}@${core.SUPABASE_HOST}:${core.SUPABASE_DB_DIRECT_PORT}/postgres`,
  
  // Mirror values for frontend
  NEXT_PUBLIC_SUPABASE_API_URL: `http://${core.SUPABASE_HOST}:${core.SUPABASE_API_PORT}`,
})
```

**Environment File Mappings** - Which values go to which `.env` files:
```typescript
envfiles: {
  next: { path: "apps/next/.env", keys: ["NEXT_PUBLIC_SUPABASE_API_URL", ...] },
  nest: { path: "apps/nest/.env", keys: ["SUPABASE_DB_POOL_URL", ...] },
  prisma: { path: "packages/prisma/.env", keys: ["SUPABASE_DB_POOL_URL", ...] }
}
```

**Config File Mappings** - Which values update which config files:
```typescript
configs: {
  supabase: {
    path: "supabase/config.toml",
    format: "toml",
    mappings: {
      "project_id": "SUPABASE_PROJECT_ID",
      "api.port": "SUPABASE_API_PORT",
      "db.port": "SUPABASE_DB_DIRECT_PORT",
      "db.shadow_port": "SUPABASE_DB_SHADOW_PORT",
      // ... more port mappings
    }
  }
}
```

**Service Mappings** - Which values sync to external services:
```typescript
services: {
  github: {
    description: "GitHub environment secrets for CI/CD workflows",
    keys: ["SUPABASE_DB_DIRECT_URL", "VERCEL_TOKEN", ...]
  },
  vercel: {
    description: "Vercel environment variables for runtime",
    keys: ["NEXT_PUBLIC_SUPABASE_API_URL", "SUPABASE_SERVICE_ROLE_KEY", ...]
  }
}
```

### 2. Environment Values (`[env].ts`)

Each environment has its own values file:

```typescript
// config/local.ts
import { defineValues } from "./utils";

export const values = defineValues({
  SUPABASE_PROJECT_ID: "kingstack",
  SUPABASE_HOST: "localhost",
  SUPABASE_DB_USER: "postgres",
  SUPABASE_DB_PASSWORD: "postgres",
  NEST_PORT: "3420",
  NEXT_PORT: "3069",
  // ... other values
  
  // No need to define computed values - they're automatic!
});
```

### 3. Generation Script

When you run `yarn env:local`, the script:
1. ✅ Loads `config/local.ts`
2. ✅ Validates all required configuration values are present
3. ✅ Applies default values
4. ✅ Computes derived values (database URLs, etc.)
5. ✅ Generates `.env` files for each project
6. ✅ Updates `supabase/config.toml` with ports and project_id
7. ✅ Backs up previous files as `.previous`

## ✨ Key Benefits

### Single Source of Truth
Define configuration **once**, everything else is generated:
```typescript
// You define:
SUPABASE_DB_USER: "postgres"
SUPABASE_DB_PASSWORD: "mypassword"
SUPABASE_HOST: "localhost"
SUPABASE_DB_POOLER_PORT: "54329"

// System generates:
// .env files with connection strings
SUPABASE_DB_POOL_URL: "postgresql://postgres:mypassword@localhost:54329/postgres?pgbouncer=true"

// supabase/config.toml with ports
db.pooler.port = 54329
```

### Type Safety
TypeScript validates your configuration at compile time.

### Validation
Missing required values are caught before runtime:
```
❌ Validation errors:
  - SUPABASE_HOST: Required configuration value "SUPABASE_HOST" is missing
```

### Centralized
All configuration for an environment in one file, not scattered across multiple `.env` files and config files.

### Config File Generation
Automatically updates config files like `supabase/config.toml`:
- ✅ Updates specific keys only
- ✅ Preserves other settings
- ✅ Creates backups before modifying
- ✅ No manual port synchronization needed

## 📝 Common Tasks

### Add a New Configuration Value

1. **Add to schema** (`config/schema.ts`):
```typescript
core: {
  MY_NEW_VALUE: { required: true, description: "My new configuration value" },
}
```

2. **Add to environment files**:
```typescript
// config/local.ts
export const values = defineValues({
  MY_NEW_VALUE: "my-value",
  // ...
});
```

3. **Add to environment file mapping** (if needed):
```typescript
envfiles: {
  next: {
    keys: ["MY_NEW_VALUE", ...],
  }
}
```

4. **Regenerate**:
```bash
yarn env:local
```

### Add a Computed Value

Just add to the `computed` section in `config/schema.ts`:

```typescript
computed: (core) => ({
  MY_API_ENDPOINT: `${core.BASE_URL}/api/v${core.API_VERSION}`,
})
```

No need to define it in environment files - it's automatically computed!

### Add a Default Value

```typescript
core: {
  MY_SETTING: { default: "default-value", description: "..." },
}
```

If not provided in the environment file, the default will be used.

### Add a Config File Mapping

To sync a value to a config file like `supabase/config.toml`:

```typescript
configs: {
  supabase: {
    mappings: {
      "my.config.key": "MY_CONFIG_VALUE",
    }
  }
}
```

## 🌍 Available Environments

- **local**: For local Supabase instance (`supabase start`)
- **development**: For remote development Supabase project
- **production**: For production Supabase project
- **playground**: Mock data for UI development (no backend needed)

## 🔒 Security

- ✅ Environment-specific files (`local.ts`, `development.ts`, `production.ts`) are **gitignored**
- ✅ Schema and example files are **checked in** (safe, no secrets)
- ✅ Playground file is **checked in** (only mock data)
- ❌ **Never commit** actual secrets to version control

## 🧪 Testing

Run the test suite to verify the configuration system:

```bash
bun scripts/test-config.ts
```

## 🐛 Troubleshooting

### "Required configuration value is missing"
You forgot to define a required value in your environment file. Check the error message for which key is missing.

### "Environment file references unknown key"
You referenced a key in an envfile mapping that doesn't exist in either `core` or `computed`. Check for typos in `schema.ts`.

### TypeScript import errors
Make sure you're using Bun to run the scripts:
```bash
bun scripts/generate-env.ts local
```

### Need to see what's generated?
Check the backup files:
```bash
cat apps/next/.env.previous
cat apps/nest/.env.previous
cat supabase/config.toml.previous
```

## 📚 Architecture Details

For more details on the configuration system architecture, see the [walkthrough](../.gemini/antigravity/brain/1a695d10-dfcd-4406-b34a-69ee83dc6a79/walkthrough.md).