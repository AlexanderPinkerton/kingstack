# Scripts and automation

KingStack exposes normal workflows through root Yarn commands. Implementation
scripts are TypeScript executed by Bun, but contributors should prefer the Yarn
entry point so command names and working-directory assumptions stay stable.

## Configuration

```bash
yarn king-config env list
yarn king-config check local
yarn king-config check --all
yarn king-config diff local
yarn env:local
yarn env:development
yarn env:production
```

`config/<environment>.ts` is the input. Generated `.env` and TOML files are
outputs and must not be edited directly. See
[configuration management](../../config/readme.md).

## Backend and Supabase

```bash
# Prepare a draft or incomplete checkout for the full local runtime
yarn backend:enable

# Local lifecycle and diagnostics
yarn supabase:start
yarn supabase:status
yarn supabase:list
yarn supabase:check
yarn supabase:stop

# Destructive local database rebuild
yarn supabase:reset

# Hosted project creation with cost confirmation
yarn supabase:provision

# Hosted credential import into config/<environment>.ts
yarn supabase:provision:get-secrets development
```

Auth user projection maintenance:

```bash
yarn supabase:auth:trigger:install
yarn supabase:auth:backfill
yarn supabase:auth:trigger:remove
```

These commands load generated service configuration and do not log database
credentials. See [Supabase management](../supabase/README.md) and
[authentication](../auth/README.md).

## Prisma

```bash
yarn prisma:generate
yarn prisma:migrate
yarn prisma:deploy
```

Use `prisma:migrate` while creating local development migrations and
`prisma:deploy` when applying existing migrations to a deployed environment.

## Deployment

```bash
# Inspect secret synchronization without external writes
yarn deploy:sync-secrets:dry-run

# Synchronize configured hosted environments
yarn deploy:sync-secrets:dev
yarn deploy:sync-secrets:prod

# Provision or deploy NestJS infrastructure
yarn deploy:nest provision production --region nyc3
yarn deploy:nest deploy production

# Deploy Next.js through Vercel
yarn vercel
yarn vercel:prod

# Import the linked Vercel host and project IDs into KingStack config
yarn vercel:config:pull production
```

Provisioning and deployment remain separate so an ordinary release cannot
silently create billable infrastructure. See the
[deployment guide](../deployment/README.md).

## Parallel feature work

Create an isolated Git worktree without changing the current checkout:

```bash
yarn workbranch feature/config-checks
yarn workbranch feature/config-checks --from origin/main
yarn workbranch feature/config-checks --resume
yarn workbranch feature/config-checks --install
```

The command does not fetch, copy secrets, reserve new ports, or start services.
Initialize `config/local.ts` and allocate distinct runtime resources before
running multiple worktrees simultaneously.

## Adding a script

1. Put TypeScript implementation under `scripts/` or the owning application.
2. Keep the script non-interactive unless interaction is intrinsic to its task.
3. Validate targets before any destructive or billable operation.
4. Redact credentials from output and errors.
5. Exit nonzero on failure.
6. Add a stable Yarn command to the owning `package.json`.
7. Add focused tests beside the script when it contains parsing, planning, or
   destructive-target logic.

Use Node's `spawn`/`spawnSync` with argument arrays rather than constructing
shell command strings from user input.
