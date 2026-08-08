# Local Supabase development

KingStack runs an isolated Supabase stack through the checked-in CLI and Docker.
The configuration source of truth is `config/local.ts`; generated `.env` files
must not be edited directly.

## Requirements

- Node.js, Yarn, and Bun versions supported by the root `package.json`
- Docker Desktop or another reachable Docker daemon
- the Supabase CLI installed through this repository's Yarn dependencies

## Fast path

For a generated frontend draft or a checkout whose backend has not been
prepared, run:

```bash
yarn backend:enable
```

The command validates Docker, generates local environment files, starts or
reuses this project's Supabase stack, prepares Prisma, and applies migrations.
It is safe to rerun after fixing an interrupted setup.

Then start the complete development runtime yourself:

```bash
yarn dev
```

## Manual setup

Create the ignored local configuration if it does not exist:

```bash
cp config/example.ts config/local.ts
yarn king-config check local
yarn env:local
```

Start Supabase and apply the current schema:

```bash
yarn supabase:start
yarn prisma:migrate
```

`yarn local` is a convenience command that regenerates local environment files
and starts Supabase. It does not replace Prisma migration work.

## Local credentials

KingStack uses these canonical configuration names in every environment:

- `SUPABASE_PUBLISHABLE_KEY` for untrusted browser and token-verification use;
- `SUPABASE_SECRET_KEY` for trusted NestJS Supabase integration; and
- `SUPABASE_DB_PASSWORD` for database connections.

Hosted projects should use `sb_publishable_...` and `sb_secret_...` API keys.
The local Supabase stack may expose its development anon and service-role JWT
values instead; those values still belong under KingStack's canonical
publishable/secret configuration names. They are local API credentials, not a
JWT signing secret that application code should copy or verify directly.

Run `yarn supabase:status` to print the exact URLs and development credentials
for the active local stack. Keep the values in `config/local.ts`, regenerate
with `yarn env:local`, and never hand-edit the generated app `.env` files.

## Daily lifecycle

```bash
# Generate current local config and start Supabase
yarn local

# Inspect this project's status and endpoints
yarn supabase:status

# Find all local Supabase instances
yarn supabase:list

# Stop this project's instance without deleting its data
yarn supabase:stop
```

Each KingStack project reserves a distinct port block and has a unique
`project_id` in `supabase/config.toml`, so multiple projects can run together.
See [multi-project setup](./supabase/multi-project-setup.md).

## Schema and auth user projection

Prisma migrations own application tables, grants, RLS defaults, realtime
publication setup, and the `auth.users` to `public.user` projection trigger.

Use migration commands intentionally:

```bash
# Create/apply development migrations
yarn prisma:migrate

# Apply existing migrations without creating one
yarn prisma:deploy

# Destroy local data and rebuild from migrations
yarn supabase:reset
```

`supabase:reset` is destructive. It is appropriate only when the local data can
be discarded.

Projection repair commands load the generated Nest environment:

```bash
yarn supabase:auth:trigger:install
yarn supabase:auth:backfill
```

See [KingStack authentication](./auth/README.md) before changing session or
projection behavior.

## Troubleshooting

### Docker access is unavailable

`yarn supabase:status` reports an unknown state when its process cannot access
the Docker socket; it does not falsely report the stack as stopped. Run it from
a terminal with Docker access.

### Ports do not match

Validate the configuration and compare it with the running stack:

```bash
yarn king-config check local
yarn supabase:check
yarn supabase:status
```

Regenerate with `yarn env:local` after correcting `config/local.ts`.

### Wrong project or conflicting containers

Use `yarn supabase:list` to identify every running project. Confirm the current
repository's `SUPABASE_PROJECT_REF` matches `project_id` in
`supabase/config.toml`, then stop only the conflicting project from its own
directory.

### Auth email is not delivered

Local Supabase routes confirmation and recovery messages to its local mail UI.
Find the active Mailpit/Inbucket URL in `yarn supabase:status`.

## Related documentation

- [Configuration management](../config/readme.md)
- [Authentication](./auth/README.md)
- [Supabase management](./supabase/README.md)
- [Supabase Data API security](./supabase/security.md)
