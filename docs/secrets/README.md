# 🔐 Secrets Management v2

KingStack uses a **TypeScript-based secrets management system** that provides type safety, computed values, and centralized configuration.

## The Problem

Traditional `.env` file management often leads to:
- ❌ Duplicated values across multiple files
- ❌ Manual construction of connection strings
- ❌ No type safety or validation
- ❌ Difficult to understand what values are derived from others

## The Solution

All secrets are defined in a centralized TypeScript configuration:

```
secrets/
├── schema.ts          # Schema definition (checked in)
├── utils.ts           # Type definitions and validation (checked in)
├── example.ts         # Example values (checked in)
├── playground.ts      # Mock values for playground mode (checked in)
├── local.ts           # Your local environment values (gitignored)
├── development.ts     # Development environment values (gitignored)
└── production.ts      # Production environment values (gitignored)
```

## Quick Start

### 1. Create Your Environment File

Copy the example file to create your environment configuration:

```bash
cp secrets/example.ts secrets/local.ts
```

Edit `secrets/local.ts` and replace all `REPLACEME` values with your actual secrets.

### 2. Generate .env Files

Run the generation script for your environment:

```bash
yarn env:local          # Generate from secrets/local.ts
yarn env:development    # Generate from secrets/development.ts
yarn env:production     # Generate from secrets/production.ts
yarn env:playground     # Generate from secrets/playground.ts
```

This will:
- ✅ Validate all required secrets are present
- ✅ Apply default values where appropriate
- ✅ Compute derived values (like database URLs)
- ✅ Generate `.env` files for each app
- ✅ Backup previous `.env` files as `.env.previous`

### 3. Start Development

```bash
yarn dev
```

## How It Works

### 1. Schema Definition (`secrets/schema.ts`)

The schema defines:
- **Core secrets**: The input values you must provide
- **Computed secrets**: Values automatically derived from core secrets
- **Project mappings**: Which secrets go to which `.env` files

Example:
```typescript
export const schema = defineSchema({
  core: {
    SUPABASE_URL: { required: true },
    SUPABASE_POOLER_USER: { required: true },
    SUPABASE_DB_PASSWORD: { required: true },
  },
  computed: (core) => ({
    // Automatically build connection string
    SUPABASE_DB_POOL_URL: `postgresql://${core.SUPABASE_POOLER_USER}:${core.SUPABASE_DB_PASSWORD}@...`,
  }),
  projects: {
    next: { path: "apps/next/.env", keys: ["SUPABASE_URL", ...] },
    nest: { path: "apps/nest/.env", keys: ["SUPABASE_DB_POOL_URL", ...] },
  }
});
```

### 2. Environment Values (`secrets/[env].ts`)

Each environment has its own values file:

```typescript
// secrets/development.ts
export const values = defineValues({
  SUPABASE_URL: "https://your-project.supabase.co",
  SUPABASE_POOLER_USER: "postgres.xxxxx",
  SUPABASE_DB_PASSWORD: "your-password",
  // ... other values
});
```

### 3. Generation Script (`scripts/generate-env.ts`)

The script:
1. Loads your environment values
2. Validates against the schema
3. Computes derived values
4. Generates `.env` files for each project

## Benefits

✅ **Type Safety** - TypeScript validates your configuration  
✅ **DRY** - Define values once, use everywhere  
✅ **Computed Values** - Automatically build connection strings and URLs  
✅ **Validation** - Catch missing secrets before runtime  
✅ **Centralized** - All secrets in one place  
✅ **Safe** - Environment-specific files are gitignored  

## Available Environments

- **local**: For local Supabase instance (`supabase start`)
- **development**: For remote development Supabase project
- **production**: For production Supabase project
- **playground**: Mock data for UI development (no backend needed)

## Common Tasks

### Add a New Secret

1. Add to `secrets/schema.ts` core section:
```typescript
core: {
  MY_NEW_SECRET: { required: true, description: "My new secret" },
}
```

2. Add to your environment files:
```typescript
// secrets/local.ts
export const values = defineValues({
  MY_NEW_SECRET: "my-value",
  // ...
});
```

3. Add to project mappings:
```typescript
projects: {
  next: {
    keys: ["MY_NEW_SECRET", ...],
  }
}
```

4. Regenerate:
```bash
yarn env:local
```

### Add a Computed Value

Add to the `computed` section in `secrets/schema.ts`:

```typescript
computed: (core) => ({
  MY_COMPUTED_VALUE: `${core.BASE_URL}/api/${core.VERSION}`,
})
```

No need to define it in environment files - it's automatically computed!

### Check Current Environment

The old `env:current` command still works with the legacy system:

```bash
yarn env:current
```

## Migration from v1

The old system (`.env.*` files in `secrets/[env]/`) still exists for backward compatibility. To migrate:

1. Create your environment TypeScript file (e.g., `secrets/local.ts`)
2. Copy values from `secrets/local/.env.*` files into the TypeScript file
3. Run `yarn env:local` to generate the new `.env` files
4. Verify everything works
5. (Optional) Remove old `secrets/local/` directory

## Security Notes

- **Never commit** `secrets/local.ts`, `secrets/development.ts`, or `secrets/production.ts`
- These files are gitignored by default
- The `secrets/example.ts` file is safe to commit (contains only placeholders)
- The `secrets/playground.ts` file is safe to commit (contains only mock data)

## Troubleshooting

### "Required secret is missing"

You forgot to define a required value in your environment file. Check the error message for which key is missing.

### "Project references unknown key"

You referenced a key in a project mapping that doesn't exist in either `core` or `computed`. Check for typos.

### TypeScript import errors

Make sure you're using Bun to run the scripts:
```bash
bun scripts/generate-env.ts local
```

## Testing

Run the test suite to verify the secrets system:

```bash
bun scripts/test-secrets.ts
```

This validates:
- Default value application
- Required value validation
- Computed value generation
- Project key validation
