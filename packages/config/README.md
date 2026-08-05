# @kingstack/config

TypeScript configuration management for projects that need validated per-environment values, computed values, generated `.env`/TOML files, and remote secret synchronization.

## Mental model

There are three kinds of files:

1. **Schema (`config/schema.ts`)** — what values exist, how values are derived, which environments exist, and where values are emitted.
2. **Environment values (`config/local.ts`, `config/staging.ts`)** — only the inputs that differ for one environment.
3. **Generated outputs (`apps/*/.env`, `config.toml`)** — build artifacts. Never edit these directly.

TOML generation validates the existing document and patches only mapped scalar
assignments. It preserves comments, ordering, spacing, and unrelated values,
and refuses to synthesize missing assignments.

When adding or removing a configuration key, update the schema first and then run `king-config check --all`. The checker identifies every environment value file that is missing the key or still contains an obsolete key.

## Installation

```bash
yarn add -D @kingstack/config
```

The CLI currently uses Bun to load TypeScript schema and value files directly.

For a standalone project, generate a small working schema and example:

```bash
bun king-config init
bun king-config env init local
bun king-config check local
bun king-config generate local
```

`init` refuses to overwrite an existing schema. The generated files are intentionally generic and demonstrate every required concept without assuming a KingStack project layout.

## Schema

```typescript
import { defineSchema, EnvironmentMode } from "@kingstack/config";

export const schema = defineSchema({
  environments: {
    local: { mode: EnvironmentMode.Local, sync: false },
    development: { mode: EnvironmentMode.Hosted, sync: true },
    production: { mode: EnvironmentMode.Hosted, sync: true },
  },

  core: {
    API_PORT: {
      required: true,
      description: "Port used by the API",
      validate: (value) =>
        Number.isInteger(Number(value)) ? undefined : "API_PORT must be an integer",
    },
    API_HOST: { default: "localhost" },
    DEPLOY_TOKEN: {
      sensitive: true,
      requiredWhen: ({ mode }) => mode === EnvironmentMode.Hosted,
    },
  },

  computed: (core, environment) => ({
    KINGSTACK_ENVIRONMENT: environment.environment,
    API_URL:
      environment.mode === EnvironmentMode.Local
        ? `http://${core.API_HOST}:${core.API_PORT}`
        : `https://${core.API_HOST}`,
  }),

  envfiles: {
    api: {
      path: "apps/api/.env",
      keys: ["API_URL", "KINGSTACK_ENVIRONMENT"],
      // Aliases map source configuration key -> generated output key.
      aliases: { API_PORT: "PORT" },
    },
  },
});
```

Environment names are supplied by the CLI. Do not duplicate an environment-name input in every value file; derive it from `environment.environment` as shown above.

## Environment values

```typescript
import { defineValues, type ConfigValuesFor } from "@kingstack/config";
import type { schema } from "./schema.js";

export const values = defineValues({
  API_PORT: "3000",
} satisfies ConfigValuesFor<typeof schema>);
```

Defaults belong in the schema. A value file should contain only genuine environment-specific inputs.

## Commands

### Inspect environments

```bash
bun king-config env list
```

Shows declared environment names, modes, synchronization eligibility, and whether each values file exists. It never prints values.

### Create an environment

First register it in `schema.environments`:

```typescript
staging: { mode: EnvironmentMode.Hosted, sync: true }
```

Then create a skeleton containing its required inputs:

```bash
bun king-config env init staging
```

### Validate

```bash
bun king-config check local
bun king-config check --all
```

Validation reports:

- Missing required values
- Unknown or obsolete values
- Invalid runtime values
- Undeclared or missing environments
- Computed-value failures and collisions
- Unknown env-file, config-file, and service mapping keys
- Duplicate generated keys and output paths

Values are always redacted from diagnostic output.

### Detect generated-file drift

```bash
bun king-config diff local
```

Reports missing, extra, and changed generated keys without printing their values. The command exits nonzero when outputs are stale.

### Generate

```bash
bun king-config generate local
```

Generation validates and renders every output before committing changes. Existing outputs are backed up with a `.previous` suffix.

### Synchronize remote values

```bash
bun king-config sync --env development --dry-run
bun king-config sync --env development
```

When `--env` is omitted, synchronization uses environments marked `sync: true`. Dry runs perform no writes and do not require provider CLIs. GitHub and Vercel values are passed through stdin instead of interpolated into shell commands.

An actual sync requires authenticated `gh` and/or `vercel` CLIs on `PATH`.

## Adding or removing a key

1. Add or remove the input in `schema.core`, or update `schema.computed` for a derived value.
2. Add or remove its destination mappings under `envfiles`, `configs`, or `services`.
3. Run `bun king-config check --all` and update every reported environment values file.
4. Run `bun king-config diff <environment>` to inspect generated drift.
5. Run `bun king-config generate <environment>` when the plan is correct.

Unknown keys are errors rather than silently ignored values, so old configuration cannot linger unnoticed.

## License

MIT
