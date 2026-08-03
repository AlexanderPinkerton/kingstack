# Configuration Management

KingStack uses `@kingstack/config` as its configuration source of truth.

## What to edit

- `config/schema.ts`: available inputs, defaults, validation, computed values, environments, and output mappings.
- `config/<environment>.ts`: values that differ for one environment.
- Generated `.env` and TOML files: never edit directly.

If you are adding or removing a key, change the schema first. The checker will then tell you exactly which environment value files and output mappings require attention.

## Daily commands

```bash
# List known environments and missing value files
bun king-config env list

# Validate one environment or all environments; values stay redacted
bun king-config check local
bun king-config check --all

# Inspect stale generated files without changing them
bun king-config diff local

# Generate after validation
yarn env:local
```

`generate` completely regenerates managed `.env` files, so removed keys disappear after generation. Existing output files receive a `.previous` backup.

## Initial local setup

```bash
cp config/example.ts config/local.ts
bun king-config check local
yarn env:local
```

The example uses local Supabase development credentials. Hosted credentials belong only in ignored environment value files or a secret manager.

## Adding staging or another environment

Environment names are not hardcoded in the CLI. Register the environment in `config/schema.ts`:

```typescript
environments: {
  local: { mode: "local", sync: false },
  development: { mode: "hosted", sync: true },
  staging: { mode: "hosted", sync: true },
  production: { mode: "hosted", sync: true },
}
```

Then scaffold and validate its values:

```bash
bun king-config env init staging
bun king-config check staging
bun king-config generate staging
bun king-config sync --env staging --dry-run
```

The environment name comes from the CLI argument. Do not add `KINGSTACK_ENVIRONMENT` to `config/staging.ts`; the schema derives it automatically.

## Schema sections

- `environments`: canonical names, local/hosted behavior, and synchronization eligibility.
- `core`: values supplied by an environment file, including defaults and validation.
- `computed`: values derived from resolved core values and environment context.
- `envfiles`: generated `.env` destinations. Aliases map source key to output key.
- `configs`: mappings into structured configuration files such as TOML.
- `services`: keys synchronized to GitHub or Vercel.

## Synchronizing deployment values

```bash
yarn deploy:sync-secrets:dry-run
yarn deploy:sync-secrets:dev
yarn deploy:sync-secrets:prod
```

Without `--env`, sync processes every schema environment marked `sync: true`. Dry-run performs no writes and reports counts only.
