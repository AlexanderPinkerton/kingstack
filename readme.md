# 👑 kingstack

A modern full-stack TypeScript monorepo powered by:

- 🧵 Yarn v4 Workspaces
- ⚡️ Turborepo (monorepo)
- ✅ ESLint 9 (shared config)
- 🧠 NestJS (API backend with Fastify)
- 🌐 Next.js 15 (frontend & serverless API)
- 🎨 ShadCN with Tailwind CSS
- 🧬 Prisma (ORM)
- ☁️ Supabase (auth + db)
- 🔄 Socket.io (realtime)
- 🗄️ MobX + TanStack Query (state management)
- 🧪 Vitest (testing)
- 🔨 Bun (local scripts)

---

## 📁 Folder Structure

```
kingstack/
├── apps/
│   ├── next/                    # Next.js app (frontend + serverless API)
│   └── nest/                     # NestJS app (API, logic, jobs, realtime)
├── packages/
│   ├── advanced-optimistic-store/  # Optimistic updates with MobX + TanStack Query
│   ├── eslint-config/              # Shared ESLint configuration
│   ├── prisma/                     # Schema + generated client
│   ├── shapes/                     # Shared TS code (@kingstack/shared)
│   └── ts-config/                  # Shared TypeScript configuration
├── scripts/                    # Utility scripts (env swapping, setup)
├── secrets/                    # Environment configs (development/production)
├── docs/                       # Documentation
├── .yarn/                      # Yarn plugins, version, patches, etc.
├── .turbo/                     # Turborepo local task cache (gitignored)
├── .gitignore
├── .yarnrc.yml                 # Yarn v4 (Berry) config
├── turbo.jsonc                 # Turborepo pipeline config
└── README.md
```

---

## 🔗 Workspace Wiring

### 🧵 Yarn Workspaces
- Defined in root `package.json`
- Hoisted deps, deduped installs
- Example:
  ```bash
  yarn workspace @kingstack/next dev
  yarn workspace @kingstack/prisma prisma generate
  ```

### ⚡️ Turborepo Pipelines
- Defined in `turbo.jsonc`
- Handles `dev`, `build`, `lint`, `test` across all workspaces
- Automatically builds dependencies (e.g., `@kingstack/shared` and Prisma client before dev)
- Example:
  ```bash
  yarn dev       # Starts next + nest
  yarn build     # Builds all packages
  yarn lint      # Lints everything
  yarn test      # Runs tests across all workspaces
  ```

---

## 🔄 Prisma Integration

- Schema lives in `packages/prisma/schema.prisma`
- Client is shared via the standard `@prisma/client` package
- Usage:
  ```ts
  import { PrismaClient } from "@prisma/client" // works everywhere
  ```
- Commands:
  ```bash
  yarn prisma:generate    # Generate Prisma client
  yarn prisma:migrate     # Run migrations
  # Or using workspace directly:
  yarn workspace @kingstack/prisma prisma generate
  yarn workspace @kingstack/prisma prisma migrate dev
  ```

---

## 📃 Supabase Setup

- Used for Auth and Postgres database
- Requires a `.env` with:
  ```env
  SUPABASE_DB_HOST=...
  SUPABASE_DB_PASSWORD=...
  SUPABASE_PROJECT_HOST=...
  ```
---

## 🛊 Local Development

### Start Dev Servers
```bash
yarn dev
```
This runs both Next.js (port 3069) and NestJS in parallel.

### 🎮 Playground Mode
For UI development and demos without Supabase:
```bash
yarn env:playground
yarn dev
```
This runs KingStack with mock data - perfect for UI development and demos!

### Environment Management
```bash
yarn env:development    # Switch to development environment
yarn env:production     # Switch to production environment
yarn env:playground     # Setup playground mode
yarn env:current        # Show current environment
```

### Run Individual App
```bash
yarn workspace @kingstack/next dev    # Next.js on port 3069
yarn workspace @kingstack/nest dev    # NestJS API
```

### Docker Commands
```bash
yarn docker:build-nest      # Build NestJS Docker image
yarn docker:run-nest        # Run NestJS container
yarn docker:compose         # Start all services via docker-compose
yarn docker:compose:down    # Stop docker-compose services
```

### Supabase Shadow Database
```bash
yarn shadow:start    # Start Supabase shadow DB (minimal services)
yarn shadow:stop     # Stop shadow DB
```

---

## 🧠 Points of Interest

### 🔄 Supabase Auth Sync

- A Supabase **trigger** automatically syncs users from the `auth.users` (managed by Supabase) table into the `public.user` table (managed by Prisma).
- This ensures internal application logic can use a fully controlled `user` model while still leveraging Supabase Auth.
- This trigger will be automatically installed when running the migrations via `20250921183730_essentials`
- Any new required fields added to the `user` model will require a new migration which updates the trigger to handle the new fields.
- 🔥 Failing to update the trigger when modifying `user` **will** break authentication and signup flows.

### 📦 Packages

- **`@kingstack/shared`** (in `packages/shapes/`): Shared TypeScript types and utilities used by both Next.js and NestJS
- **`@kingstack/advanced-optimistic-store`**: Framework-agnostic optimistic updates with MobX + TanStack Query Core + optional realtime
- **`@kingstack/eslint-config`**: Shared ESLint configuration for consistent code quality
- **`@kingstack/ts-config`**: Shared TypeScript configuration
- **`@kingstack/prisma`**: Prisma schema and migrations

### 🛠️ Bun Scripts Use Internal DB

- Existing Supabase users which "missed the boat" can be copied over with the `backfill-user-data.ts` script.
- Ensure the trigger is installed and working before running any backfills or jobs that interact with `user`.
```bash
bun run apps/nest/src/scripts/backfill-user-data.ts
```

---

🌟 Let the kingdom reign. Long live the stack!