# Running multiple local Supabase projects

Supabase isolates local projects with a unique `project_id`, Docker resources,
data volumes, and ports. KingStack keeps these values in `config/local.ts` and
generates the matching `supabase/config.toml` and service `.env` files.

## Generated projects

`create-kingstack` reserves a complete ten-port block in
`~/.kingstack/port-allocations.json`. Generated projects therefore have unique
local Supabase, Next.js, and NestJS ports without manual editing.

For each project:

```bash
yarn king-config check local
yarn env:local
yarn supabase:start
```

Then inspect every running local stack:

```bash
yarn supabase:list
```

## A manually copied checkout

Copying a repository also copies its checked-in example port values. Before
running the copy beside the original:

1. Give `SUPABASE_PROJECT_REF` a unique local value in `config/local.ts`.
2. Assign an unused block to `NEXT_PORT`, `NEST_PORT`, and every
   `SUPABASE_*_PORT` input.
3. Generate all derived files with `yarn env:local`.
4. Validate the result with `yarn supabase:check`.
5. Start the stack with `yarn supabase:start`.

Do not edit generated `.env` files or `supabase/config.toml` independently;
the next configuration generation would correctly overwrite that drift.

## Daily workflow

```bash
# Project A
cd /path/to/project-a
yarn local
yarn dev

# Project B, in another terminal
cd /path/to/project-b
yarn local
yarn dev

# From either project
yarn supabase:list
```

Stop a project from its own directory:

```bash
yarn supabase:stop
```

Stopping preserves its data volume. `yarn supabase:reset` is different: it
destroys that project's local data and rebuilds the database from migrations.

## Troubleshooting

### Port already in use

Run `yarn supabase:list`, identify the owning project, and either stop it from
its directory or assign a different block in the new project's
`config/local.ts`. Regenerate after every port change.

### Containers have the wrong project name

Confirm `SUPABASE_PROJECT_REF` in `config/local.ts`, regenerate with
`yarn env:local`, then compare it with `project_id` in
`supabase/config.toml` using `yarn supabase:check`.

### Application URLs do not match the stack

Run:

```bash
yarn king-config diff local
yarn supabase:check
yarn supabase:status
```

Regenerate stale outputs with `yarn env:local`. The generated Next, Nest, and
Prisma environment files must all come from the same configuration run.

See [local Supabase development](../local-supabase-setup.md) for the complete
setup and schema workflow.
