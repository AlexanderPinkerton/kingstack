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

### Supabase Auth configuration

Declare a service with `provider: "supabase-auth"` to include Auth settings in
the same sync command. It uses the Supabase Management API because Auth settings
are stored in Supabase, not in the application's environment variables.
Authenticate with `yarn supabase login` (macOS CLI Keychain or legacy token file)
or supply `SUPABASE_ACCESS_TOKEN`. The application anon/service-role keys cannot
authorize project configuration changes.

```typescript
services: {
  // Keep existing github/vercel services here.
  supabase: {
    provider: "supabase-auth",
    description: "Hosted Auth configuration",
    projectRef: "SUPABASE_PROJECT_REF",
    mappings: {
      site_url: "SUPABASE_AUTH_SITE_URL",
      smtp_host: "SMTP_HOST",
      smtp_port: "SMTP_PORT",
      smtp_user: "SMTP_USER",
      smtp_pass: "RESEND_API_KEY",
      smtp_admin_email: "EMAIL_FROM_ADDRESS",
      smtp_sender_name: "EMAIL_FROM_NAME",
      rate_limit_email_sent: "AUTH_EMAIL_HOURLY_LIMIT",
      mailer_autoconfirm: "AUTH_AUTOCONFIRM",
      mailer_allow_unverified_email_sign_ins: "ALLOW_UNVERIFIED_SIGN_INS",
      mailer_secure_email_change_enabled: "CONFIRM_OLD_EMAIL",
    },
  },
}
```

Mapping values reference declared core/computed keys. Boolean inputs must be
`"true"` or `"false"`; limits use integer strings. Exported
`SupabaseAuthSetting` lists the supported settings. Unknown fields, including
template content, fail validation before any provider is contacted. Only mapped
fields are updated. Local environments cannot target hosted Auth.

Use the same source keys in `configs` mappings for local Supabase settings.
TOML generation preserves existing boolean/numeric/string types and comments.
For example, derive `AUTH_AUTOCONFIRM` from `REQUIRE_VERIFICATION` and map the
latter to `auth.email.enable_confirmations`. Keep custom SMTP disabled locally
to use Mailpit. A TOML SMTP password can use `env(RESEND_API_KEY)`; supply its
value through an ignored `.env` output rather than writing the secret into a
committed TOML file.

```sh
bun king-config sync --env production --dry-run
bun king-config sync --env production
# Optional: only the declared Supabase service
bun king-config sync --env production --target supabase
```

An apply reads current Auth settings, saves affected prior values with mode
0600 under `.local/config-backups/`, patches the configured fields, and verifies
nonsecret values afterward. **Ignore `.local/` in Git**: backups can contain SMTP
credentials. A masked old password requires the original credential to restore.
The backup directory also gets a Git ignore rule. Dry runs show policy and
limit values while keeping credentials and string settings redacted.
The desired SMTP password is reapplied because the API can conceal its value.
An enabled Send Email hook blocks SMTP changes. Authentication, API, and
verification failures produce a failed command, not a successful partial result;
other providers may already have applied their independent changes.

Email HTML and subjects are outside this provider. Render/check them with
`king-email auth export` and publish them with `king-email auth templates`.
For an initial rollout, configure delivery with verification disabled, publish
and test the templates, then enable verification in config and sync again.

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
