# Secrets Management v2

KingStack uses a **TypeScript-based secrets management system** that provides type safety, computed values, and centralized configuration.

## 🎯 Quick Start

### 1. Create Your Environment File

```bash
cp secrets/example.ts secrets/local.ts
```

Edit `secrets/local.ts` and replace all `REPLACEME` values with your actual secrets.

### 2. Generate .env Files

```bash
yarn env:local          # Generate from secrets/local.ts
# or
yarn env:development    # Generate from secrets/development.ts
yarn env:production     # Generate from secrets/production.ts
yarn env:playground     # Generate from secrets/playground.ts (mock data)
```

### 3. Start Development

```bash
yarn dev
```

## 📁 Directory Structure

```
secrets/
├── schema.ts          # Schema definition (checked in)
├── utils.ts           # Type definitions and validation (checked in)
├── example.ts         # Example values template (checked in)
├── playground.ts      # Mock values for playground mode (checked in)
├── local.ts           # Your local environment values (gitignored)
├── development.ts     # Development environment values (gitignored)
├── production.ts      # Production environment values (gitignored)
└── _example/          # Legacy .env files (for backward compatibility)
```

## 🔧 How It Works

### 1. Schema Definition (`schema.ts`)

The schema defines three things:

**Core Secrets** - The input values you provide:
```typescript
core: {
  SUPABASE_URL: { required: true },
  SUPABASE_POOLER_USER: { required: true },
  SUPABASE_DB_PASSWORD: { required: true },
  PORT: { default: "3000" },  // Optional with default
}
```

**Computed Secrets** - Values automatically derived from core secrets:
```typescript
computed: (core) => ({
  // Automatically build database connection strings
  SUPABASE_DB_POOL_URL: `postgresql://${core.SUPABASE_POOLER_USER}:${core.SUPABASE_DB_PASSWORD}@${core.SUPABASE_POOLER_HOST}:6543/postgres?pgbouncer=true`,
  SUPABASE_DB_DIRECT_URL: `postgresql://${core.SUPABASE_POOLER_USER}:${core.SUPABASE_DB_PASSWORD}@${core.SUPABASE_POOLER_HOST}:5432/postgres`,
  
  // Mirror values for frontend
  NEXT_PUBLIC_SUPABASE_API_URL: core.SUPABASE_API_URL,
})
```

**Project Mappings** - Which secrets go to which `.env` files:
```typescript
projects: {
  next: { path: "apps/next/.env", keys: ["NEXT_PUBLIC_SUPABASE_API_URL", ...] },
  nest: { path: "apps/nest/.env", keys: ["SUPABASE_DB_POOL_URL", ...] },
  prisma: { path: "packages/prisma/.env", keys: ["SUPABASE_DB_POOL_URL", ...] }
}
```

### 2. Environment Values (`[env].ts`)

Each environment has its own values file:

```typescript
// secrets/local.ts
import { defineValues } from "./utils";

export const values = defineValues({
  SUPABASE_URL: "https://your-project.supabase.co",
  SUPABASE_POOLER_USER: "postgres.xxxxx",
  SUPABASE_DB_PASSWORD: "your-password",
  // ... other values
  
  // No need to define computed values - they're automatic!
});
```

### 3. Generation Script

When you run `yarn env:local`, the script:
1. ✅ Loads `secrets/local.ts`
2. ✅ Validates all required secrets are present
3. ✅ Applies default values
4. ✅ Computes derived values (database URLs, etc.)
5. ✅ Generates `.env` files for each project
6. ✅ Backs up previous `.env` files as `.env.previous`

## ✨ Key Benefits

### DRY Principle
Define database credentials **once**, connection strings are computed automatically:
```typescript
// You define:
SUPABASE_POOLER_USER: "postgres.abc123"
SUPABASE_DB_PASSWORD: "mypassword"
SUPABASE_POOLER_HOST: "aws-1-us-east-2.pooler.supabase.com"

// System computes:
SUPABASE_DB_POOL_URL: "postgresql://postgres.abc123:mypassword@aws-1-us-east-2.pooler.supabase.com:6543/postgres?pgbouncer=true"
SUPABASE_DB_DIRECT_URL: "postgresql://postgres.abc123:mypassword@aws-1-us-east-2.pooler.supabase.com:5432/postgres"
```

### Type Safety
TypeScript validates your configuration at compile time.

### Validation
Missing required secrets are caught before runtime:
```
❌ Validation errors:
  - SUPABASE_URL: Required secret "SUPABASE_URL" is missing
```

### Centralized
All secrets for an environment in one file, not scattered across multiple `.env` files.

## 📝 Common Tasks

### Add a New Secret

1. **Add to schema** (`secrets/schema.ts`):
```typescript
core: {
  MY_NEW_SECRET: { required: true, description: "My new secret" },
}
```

2. **Add to environment files**:
```typescript
// secrets/local.ts
export const values = defineValues({
  MY_NEW_SECRET: "my-value",
  // ...
});
```

3. **Add to project mapping** (if needed):
```typescript
projects: {
  next: {
    keys: ["MY_NEW_SECRET", ...],
  }
}
```

4. **Regenerate**:
```bash
yarn env:local
```

### Add a Computed Value

Just add to the `computed` section in `secrets/schema.ts`:

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

Run the test suite to verify the secrets system:

```bash
bun scripts/test-secrets.ts
```

## 🔄 Migration from v1 (Legacy System)

The old system (`.env.*` files in `secrets/[env]/` directories) still works for backward compatibility.

To migrate:
1. Create `secrets/local.ts` from `secrets/example.ts`
2. Copy values from `secrets/local/.env.*` files into the TypeScript file
3. Run `yarn env:local` to generate new `.env` files
4. Verify apps start correctly with `yarn dev`
5. (Optional) Remove old `secrets/local/` directory

## 🐛 Troubleshooting

### "Required secret is missing"
You forgot to define a required value in your environment file. Check the error message for which key is missing.

### "Project references unknown key"
You referenced a key in a project mapping that doesn't exist in either `core` or `computed`. Check for typos in `schema.ts`.

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
```

## 📚 Full Documentation

For more details, see [docs/secrets/README.md](../docs/secrets/README.md)