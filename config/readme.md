# Configuration Management

KingStack uses **@kingstack/config**, a powerful **TypeScript-based configuration system** that provides type safety, computed values, centralized configuration, and automatic generation of both `.env` files and config files.

## 🎯 Quick Start

### 1. Create Your Environment File

```bash
cp config/example.ts config/local.ts
```

Edit `config/local.ts` and customize the values for your local environment.

### 2. Generate Configuration

Use the `king-config` CLI to generate your environment:

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

### 3. Sync Deployment Secrets

Sync your configuration to GitHub Actions and Vercel:

```bash
# Dry run to see what will happen
yarn deploy:sync-secrets:dry-run

# Sync to development
yarn deploy:sync-secrets:dev

# Sync to production
yarn deploy:sync-secrets:prod
```

## 📁 Directory Structure

```
config/
├── schema.ts          # Schema definition (checked in)
├── example.ts         # Example values template (checked in)
├── playground.ts      # Mock values for playground mode (checked in)
├── local.ts           # Your local environment values (gitignored)
├── development.ts     # Development environment values (gitignored)
└── production.ts      # Production environment values (gitignored)
```

> **Note:** The core logic now lives in the `@kingstack/config` package. This directory only contains your configuration data.

## 🔧 How It Works

### 1. Schema Definition (`schema.ts`)

The schema defines four things:

**Core Configuration** - The input values you provide:
```typescript
core: {
  SUPABASE_PROJECT_ID: { default: "kingstack" },
  SUPABASE_HOST: { required: true },
}
```

**Computed Values** - Values automatically derived from core configuration:
```typescript
computed: (core) => ({
  // Automatically build database connection strings
  SUPABASE_DB_POOL_URL: `postgresql://${core.SUPABASE_DB_USER}:${core.SUPABASE_DB_PASSWORD}@...`,
})
```

**Environment File Mappings** - Which values go to which `.env` files:
```typescript
envfiles: {
  next: { path: "apps/next/.env", keys: ["NEXT_PUBLIC_SUPABASE_URL", ...] },
  nest: { path: "apps/nest/.env", keys: ["SUPABASE_DB_POOL_URL", ...] },
}
```

**Service Mappings** - Which values sync to external services:
```typescript
services: {
  github: {
    keys: ["SUPABASE_DB_DIRECT_URL", "VERCEL_TOKEN"]
  },
  vercel: {
    keys: ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]
  }
}
```

### 2. Environment Values (`[env].ts`)

Each environment has its own customized values file. These files import `defineValues` from `@kingstack/config`.

```typescript
// config/local.ts
import { defineValues } from "@kingstack/config";

export const values = defineValues({
  SUPABASE_PROJECT_ID: "kingstack",
  SUPABASE_HOST: "localhost",
  // ...
});
```

## ✨ Key Benefits

### Single Source of Truth
Define configuration **once** in `config/[env].ts`. The system generates everything else.

### Type Safety
TypeScript validates your configuration at compile time.

### Validation
Missing required values are caught before runtime.

### Centralized
All configuration for an environment in one file, not scattered across multiple `.env` files.

### Automated Cloud Sync
Keep your GitHub Actions secrets and Vercel environment variables in sync with your codebase using `king-config sync`.

## 📦 Package Info

This system is powered by the `@kingstack/config` package.
- **CLI**: `king-config`
- **Exports**: `defineSchema`, `defineValues`, `resolveConfig`