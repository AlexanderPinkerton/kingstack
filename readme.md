# 👑 KingStack

KingStack is a full-stack TypeScript starter for building frontend ideas
quickly and adding a serious backend without replacing the application's state
or UI architecture.

It combines:

- Next.js and React for the frontend and route handlers
- NestJS with Fastify for persistent APIs, WebSockets, cron jobs, and workers
- Supabase for local PostgreSQL, authentication, storage, and realtime
- Prisma for schema modeling, migrations, and server-side database access
- MobX, TanStack Query, and `@kingstack/advanced-optimistic-store` for
  repository-backed client state
- Yarn workspaces and Turborepo for the monorepo
- TypeScript, ESLint, Prettier, Vitest, and Bun for development tooling

The `create-kingstack` CLI generates the complete codebase every time. You
choose only how much infrastructure to start on day one.

## Source repository versus generated projects

This upstream monorepo is both the development home for KingStack's published
libraries and the source of the application template. A generated KingStack
project is a deliberate subset, not a clone of every upstream workspace.

| Upstream category        | Examples                                                          | Generated-project behavior                           |
| ------------------------ | ----------------------------------------------------------------- | ---------------------------------------------------- |
| Published primitives     | `config`, `advanced-optimistic-store`, `comment-tree`, `dnd-tree` | Installed from npm; implementation source excluded   |
| Project-owned workspaces | `prisma`, `shared`, `eslint-config`, `ts-config`                  | Source included and renamed to the project namespace |
| Maintainer tooling       | `create-kingstack`, Changesets, release and smoke-test tooling    | Excluded                                             |

The CLI uses an explicit template allowlist, so adding a new upstream package
or maintainer file does not silently add it to future applications. Generated
projects also receive their own application-focused README.

## Create a project

### Requirements

- Node.js `>=24.18.0 <25`
- Git
- Yarn
- Bun
- Docker Desktop or another Docker daemon when using the full backend

Start the interactive installer:

```bash
npx create-kingstack my-app
```

The CLI asks whether to begin as a frontend draft or with the full local stack.
It installs dependencies, generates typed local configuration, initializes a
Git repository, assigns an available port block, and starts the selected
development runtime.

To choose directly:

```bash
# Next.js only; Docker and backend services are not required
npx create-kingstack my-app --draft

# Configure Supabase, apply migrations, and start the complete stack
npx create-kingstack my-app --full
```

Use `--no-start` to generate the project without starting its development
server. See the
[complete CLI reference](./packages/create-kingstack/README.md) for custom
directories and port selection.

## Two starting paths, one project

|                      | Frontend draft       | Full stack                    |
| -------------------- | -------------------- | ----------------------------- |
| Start with           | `--draft`            | `--full`                      |
| Development command  | `yarn dev:frontend`  | `yarn dev`                    |
| Services             | Next.js only         | Next.js, NestJS, and Supabase |
| Data adapter         | In-memory repository | HTTP/database repository      |
| Store and UI pattern | Production pattern   | Production pattern            |
| Docker required      | No                   | Yes                           |

Both choices contain the complete KingStack source. Draft mode is not a
separate template and does not delete backend code.

The generated root page provides two explicit routes:

- `/drafts` contains backend-free examples.
- `/full-stack` contains the authenticated, database-backed, and realtime
  showcase.

### Why drafts can become real features

Domain stores depend on repository contracts rather than directly importing a
database client:

```text
Shared React feature
        │
        ▼
Domain store + optimistic behavior
        │
        ▼
Repository contract
   ┌────┴──────────────┐
   ▼                   ▼
In-memory adapter   HTTP adapter
Frontend draft      NestJS → Prisma → PostgreSQL
```

The draft path therefore exercises the real MobX projections, TanStack Query
lifecycle, transformations, optimistic mutations, reconciliation, and
rollback behavior. Moving the feature to a backend changes its composition,
not its UI or domain store.

Draft fixture data resets when the page reloads and is not automatically copied
into PostgreSQL. A project that needs browser persistence can add a
local-storage or IndexedDB repository without changing the store contract.

Read [Frontend drafts without Supabase](./docs/frontend-drafts.md) and the
[state-management architecture](./docs/state-management/README.md) for the
reference implementation.

## Enable a draft project's backend

When a draft needs authentication, persistent data, or backend processes, run:

```bash
yarn backend:enable
yarn dev
```

`backend:enable`:

1. verifies that Docker is available;
2. regenerates the project's local environment files;
3. starts or reuses its reserved Supabase instance;
4. prepares Prisma's shadow database;
5. applies every pending migration; and
6. prints the project's frontend, NestJS, and Supabase URLs.

The command is safe to rerun after fixing an interrupted setup. It prepares the
backend but intentionally leaves persistent development servers under your
control. Stop a draft-only `yarn dev:frontend` process before starting
`yarn dev`.

## Architecture

### Next.js and NestJS

KingStack uses two application runtimes with distinct jobs:

- `apps/next` owns React rendering, frontend routes, and lightweight route
  handlers.
- `apps/nest` owns long-running backend behavior such as authenticated APIs,
  WebSockets, scheduled jobs, and background work.

They share TypeScript code, authentication tokens, Prisma types, configuration,
and one development workflow. A feature can use either runtime without forcing
all backend responsibilities into one deployment model.

### State and data flow

`AppProviders` owns one TanStack Query client and one application `RootStore`.
The root store coordinates the Supabase session, authenticated realtime
connection, and typed domain-store managers.

Each domain store owns:

- its scoped query identity and activation rules;
- an injected repository;
- API-to-UI transformations;
- optimistic mutation behavior;
- realtime reconciliation when needed; and
- deterministic cleanup.

TanStack Query holds authoritative server-shaped data. MobX exposes the
transformed UI projection. Temporary optimistic layers remain outside the
authoritative cache until a repository confirms them.

The reusable optimistic engine is published as
`@kingstack/advanced-optimistic-store`. Generated projects also consume
`@kingstack/config`, `@kingstack/comment-tree`, and `@kingstack/dnd-tree` from
npm while keeping application-level stores and repository adapters in their
own source tree.

### Supabase and Prisma

Supabase supplies PostgreSQL and authentication. Prisma is the default
server-side access and migration layer. Browser code does not need direct table
access for ordinary application features:

```text
Browser → Next.js or NestJS → Prisma → Supabase PostgreSQL
```

The Supabase Data API remains available for KingStack's service-role realtime
integration, but application tables are private by default:

- privileges are revoked from `anon` and `authenticated`;
- RLS is enabled for existing public tables;
- PostgreSQL default privileges protect future Prisma objects; and
- an event trigger enables RLS on future public tables.

A feature that deliberately needs direct browser-to-Supabase table access must
add both grants and feature-specific RLS policies in a migration. Policies
cannot be generated safely because ownership rules differ by domain.

The optional local Edge Runtime is disabled until the project adds Supabase
Edge Functions.

See [Supabase Data API security](./docs/supabase/security.md) and
[Supabase management](./docs/supabase/README.md).

### Authentication

Supabase owns authentication identities in `auth.users`. A migration-managed
database trigger projects each identity into Prisma's `public.user` model so
application code can use a controlled domain record.

When required fields are added to the Prisma `user` model, add a migration that
updates this trigger as part of the same schema change. The current trigger
definition is in `20260729030000_repair_auth_user_sync`.

Operational helpers are available for repair and backfill work:

```bash
yarn supabase:auth:trigger:install
yarn supabase:auth:backfill
```

Read the [authentication documentation](./docs/auth/README.md) before changing
the session or user-sync flow.

## Repository layout

```text
kingstack/
├── apps/
│   ├── next/                         Next.js frontend and route handlers
│   └── nest/                         NestJS API, jobs, and realtime gateway
├── packages/
│   ├── advanced-optimistic-store/    Reusable optimistic state engine
│   ├── comment-tree/                 Reusable comment-tree feature
│   ├── config/                       Typed configuration package
│   ├── create-kingstack/             Project generator CLI
│   ├── dnd-tree/                     Reusable drag-and-drop tree
│   ├── eslint-config/                Shared lint configuration
│   ├── prisma/                       Prisma schema and migrations
│   ├── shared/                       Shared application code
│   └── ts-config/                    Shared TypeScript configuration
├── config/                           Environment value definitions and schema
├── docs/                             Architecture and operations guides
├── scripts/                          TypeScript setup and maintenance scripts
├── supabase/                         Local Supabase configuration
├── package.json                      Workspace commands
└── turbo.jsonc                       Task graph
```

Generated projects omit the CLI, release infrastructure, and the source of
published primitives. Project-specific applications, Prisma files, shared
code, configuration workspaces, and repository adapters remain editable in the
generated monorepo.

## Common workflows

### Frontend-only development

```bash
yarn dev:frontend
```

This starts Next.js without instantiating the Supabase-backed runtime on draft
routes.

### Full local development

```bash
# First activation, or whenever local backend setup needs repair
yarn backend:enable

# Start Next.js and NestJS development processes
yarn dev

# Stop this project's local Supabase services later
yarn supabase:stop
```

Projects receive a reserved ten-port block during generation. The allocator
avoids currently listening ports and assignments belonging to other generated
projects, including stopped projects. Reservations live in:

```text
~/.kingstack/port-allocations.json
```

Use the URLs printed by the CLI or `backend:enable`; do not assume a shared
hard-coded port across KingStack projects.

### Configuration

`config/local.ts` is the local source of truth. The generator creates it with
the project's identity and allocated ports.

```bash
yarn env:local
yarn env:development
yarn env:production
```

These commands validate typed values, generate the appropriate `.env` files,
and update mapped values in `supabase/config.toml`.

Read the [configuration guide](./config/readme.md) for environment definitions
and deployment-secret synchronization.

### Database and Supabase

```bash
yarn prisma:generate       # Generate the Prisma client
yarn prisma:migrate        # Create/apply development migrations
yarn supabase:start        # Start this project's local Supabase stack
yarn supabase:status       # Report running, stopped, or inaccessible state
yarn supabase:list         # List local Supabase projects
yarn supabase:check        # Validate the project's Supabase configuration
yarn supabase:reset        # Drop local data and reapply migrations
yarn supabase:stop         # Stop this project's Supabase stack
```

`supabase:reset` is destructive to local data.

### Quality checks

```bash
yarn typecheck
yarn lint
yarn test
yarn build
```

Turborepo runs each task across the workspaces and builds required package
dependencies in graph order.

### Individual applications

```bash
yarn workspace @kingstack/next dev
yarn workspace @kingstack/nest dev
```

In generated projects, private workspace names use the project namespace chosen
during creation.

## Deployment

KingStack includes environment-aware configuration, GitHub Actions workflows,
Prisma deployment migrations, and Vercel commands for the Next.js application.
Production Supabase credentials belong in deployment environment configuration,
not `config/local.ts`.

Start with the [deployment guide](./docs/deployment/README.md) and
[secrets guide](./docs/secrets/README.md).

## Documentation

- [Frontend drafts](./docs/frontend-drafts.md)
- [State management](./docs/state-management/README.md)
- [Authentication](./docs/auth/README.md)
- [Supabase management](./docs/supabase/README.md)
- [Supabase security](./docs/supabase/security.md)
- [Configuration](./config/readme.md)
- [Scripts and automation](./docs/scripts/README.md)
- [Metadata and SEO](./docs/metadata/README.md)
- [Deployment](./docs/deployment/README.md)
- [AI assistant guide](./docs/ai-assistant-guide.md)

## Working on KingStack itself

Clone the source repository and install dependencies:

```bash
git clone https://github.com/AlexanderPinkerton/kingstack.git
cd kingstack
yarn install
```

If `config/local.ts` does not exist, create it from the example and generate
the environment files:

```bash
cp config/example.ts config/local.ts
yarn env:local
```

Test the compiled CLI against the current working tree—including uncommitted
template changes—without touching `main`:

```bash
bun scripts/test-create-kingstack my-smoke-project
```

The helper presents the real setup prompts, then typechecks and tests the
generated project. Smoke projects are retained under
`~/kingstack-smoke-tests`. See the
[create-kingstack testing guide](./packages/create-kingstack/README.md#testing-local-cli-and-template-changes)
for `--draft`, `--full`, `--no-start`, and custom-output examples.

## License

KingStack, its generated applications, and all KingStack packages are available
under the [MIT License](./LICENSE).
