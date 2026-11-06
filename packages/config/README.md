# @kingstack/config

TypeScript configuration management for projects that need validated per-environment values, computed values, generated `.env`/TOML/JSON files, and remote configuration/secret synchronization.

## Mental model

There are three kinds of files:

1. **Schema (`config/schema.ts`)** — what values exist, how values are derived, which environments exist, and where values are emitted.
2. **Environment values (`config/local.ts`, `config/staging.ts`)** — only the inputs that differ for one environment.
3. **Generated outputs (`apps/*/.env`, `config.toml`)** — build artifacts. Never edit these directly.

TOML generation validates the existing document and patches only mapped scalar
assignments. It preserves comments, ordering, spacing, and unrelated values,
and refuses to synthesize missing assignments.

JSON outputs merge mapped string fields into an existing object while preserving
unmapped metadata. Use `createIfMissing: true` to create a new file and its parent
directory. Invalid JSON, non-object roots, unsafe paths, and mappings that would
replace a non-string value fail before any outputs are written. Formatting is
normalized to two spaces. Optional `environments` limits generation and drift
checking to those environment names; omission applies to every environment.

```typescript
configs: {
  vercel: {
    path: ".vercel/project.json",
    format: "json",
    createIfMissing: true,
    environments: ["development", "production"],
    mappings: {
      projectId: "VERCEL_PROJECT_ID",
      orgId: "VERCEL_ORG_ID",
    },
  },
}
```

Keep deployment IDs required for hosted environments. Local generation leaves
the last hosted Vercel link unchanged; it does not select a deployment target.
Secret-sync dry runs never modify this link or invoke provider commands. Actual
sync uses the selected environment's IDs and preserves other link metadata.
Actual Vercel sync detects the installed CLI version: CLI 49 uses positional
environment arguments, while CLI 65 uses named environment and public-key flags.

Service `keys` must all be populated before sync. Use `optionalKeys` for optional
integrations: populated values are sent, while empty/missing values are skipped
without deleting existing remote settings. Both lists receive the same key and
duplicate validation. Keep essential credentials in `keys`.

TOML mappings can address existing scalar array elements, such as
`auth.additional_redirect_urls.0`; comments and unmapped elements stay intact.

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

When `--env` is omitted, synchronization uses environments marked `sync: true`.
All services declared in `schema.services` are included by default; `--target`
selects one declared service. Dry runs perform no writes, credential lookups, or
network requests and do not require provider CLIs. GitHub and Vercel values are
passed through stdin instead of interpolated into shell commands.

An actual sync requires authenticated `gh` and/or `vercel` CLIs on `PATH`.

### Supabase configuration and templates

Declare a Supabase service to include its supported hosted settings and any
configured email templates in normal sync. KingStack renders the selected
environment's existing TOML mapping and calls the installed Supabase CLI's
`config push`. Authenticate with `yarn supabase login` or
`SUPABASE_ACCESS_TOKEN`; KingStack does not implement another Management API client.

```ts
services: {
  supabase: {
    provider: "supabase",
    description: "Hosted Supabase configuration",
    projectRef: "SUPABASE_PROJECT_REF",
    configFile: "supabase", // schema.configs.supabase: supabase/config.toml
  },
}
```

The CLI receives a temporary copy of the Supabase directory with TOML rendered
for the requested environment. The original TOML, app env files, and selected
local environment stay unchanged. Environment references such as
`env(RESEND_API_KEY)` use resolved configuration passed to the child process;
stale local dotenv files are not copied. Keep other referenced Supabase assets
inside the Supabase directory. Project-relative email templates outside that
directory are copied too. Temporary files are removed after success or failure.

Email setup is optional. With no SMTP section or template sections, no custom
SMTP credentials or email package is needed and those hosted fields remain
unchanged. An explicit `smtp.enabled = false` disables hosted custom SMTP;
omitting the section leaves it alone. Configured template paths must exist.
Render changed email components with `king-email auth export` before sync.

```sh
bun king-config sync --env production --dry-run
bun king-config sync --env production
# Same engine, limited to Supabase:
bun king-config sync --env production --target supabase
```

Dry runs validate KingStack mappings and referenced template files offline;
they are not a remote diff or a substitute for Supabase CLI validation. Apply
pushes every hosted setting supported by that CLI, including configured
templates. CLI failures make sync fail; independent providers may already have
completed. Roll back by restoring configuration/template files and syncing again.

Use the same input keys for generated local settings and hosted sync. TOML
booleans, numbers, strings, comments, and template blocks are preserved. Disable
custom SMTP locally to retain Mailpit. For an initial rollout, configure delivery
and templates with verification disabled, test, then enable verification in the
same configuration and sync again.

With Vercel CLI 65.10.x, valid Stripe publishable keys (`pk_test_...` or
`pk_live_...`) mapped to `NEXT_PUBLIC_` variables are explicitly synced with
`--type config`. This authorizes their intended browser exposure. Private keys,
malformed publishable keys, and unrelated values retain Vercel's default
credential checks; the sync command never opts all public-prefixed values into
public config. Each KingStack environment still targets its configured Vercel
project's `production` environment through `--environment production`.

## Adding or removing a key

1. Add or remove the input in `schema.core`, or update `schema.computed` for a derived value.
2. Add or remove its destination mappings under `envfiles`, `configs`, or `services`.
3. Run `bun king-config check --all` and update every reported environment values file.
4. Run `bun king-config diff <environment>` to inspect generated drift.
5. Run `bun king-config generate <environment>` when the plan is correct.

Unknown keys are errors rather than silently ignored values, so old configuration cannot linger unnoticed.

## License

MIT
