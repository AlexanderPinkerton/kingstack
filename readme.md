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

## 🎯 Why KingStack?

KingStack is designed to solve common pain points in modern full-stack development by providing a **unified, explicit, and powerful** architecture that makes it easy to build production-ready applications.

### The Two-App Architecture

KingStack uses **two main applications** working in harmony:

#### 🌐 Next.js (`apps/next`)
- **Modern React UI** with Next.js 15, ShadCN UI, and Tailwind CSS
- **Serverless API routes** for lightweight, scalable endpoints
- Perfect for: UI rendering, static pages, API routes that don't need persistent connections

#### 🧠 NestJS (`apps/nest`)
- **Mature API framework** with powerful dependency injection and modular architecture
- **Persistent backend** for long-running processes
- Perfect for: WebSockets, cron jobs, background workers, complex business logic

**Why both?** Many projects need both serverless flexibility and persistent backend capabilities. KingStack makes it trivial to use both in unison with:
- ✅ Shared code (`@kingstack/shared`)
- ✅ Shared linting (`@kingstack/eslint-config`)
- ✅ Shared authentication (same JWT across both)
- ✅ Shared Prisma schema and client
- ✅ Unified development workflow

### Core Strengths

KingStack excels at making common tasks **easy**:

- ✅ **Easy Frontend** - Modern React/Next.js with ShadCN UI components
- ✅ **Easy Serverless** - Next.js API routes with zero config
- ✅ **Easy Dedicated Backend** - NestJS for complex APIs and business logic
- ✅ **Easy WebSockets** - Socket.io integration with shared auth
- ✅ **Easy Cron Jobs** - NestJS scheduler for background tasks
- ✅ **Easy State Management** - MobX + TanStack Query with optimistic updates
- ✅ **Easy Realtime** - Built-in realtime extensions for stores

📖 **[State Management Architecture →](./docs/state-management/README.md)**

### Tackling Common Annoyances

KingStack takes an **explicit approach** to avoid hidden pitfalls:

#### 🔐 Explicit Secrets Management
No more guessing which `.env` file is active or dealing with dotenv detection issues. All secrets are organized in `secrets/` with simple swap commands.

📖 **[Secrets Management Guide →](./docs/secrets/README.md)**

#### 🎫 Explicit JWT Authentication
No cookie/localStorage magic. Tokens are explicitly passed and validated, making auth predictable and debuggable.

📖 **[Authentication Documentation →](./docs/auth/README.md)**

#### 📜 TypeScript Scripts with Bun
Write scripts in TypeScript without transpilation headaches. Bun handles execution natively.

📖 **[Scripts & Automation →](./docs/scripts/README.md)**

#### 🚀 GitHub Actions CI/CD
Automated PR checks and deployments linked to explicit branch names (`development` and `production`).

📖 **[Deployment Guide →](./docs/deployment/README.md)**

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
│   ├── shared/                     # Shared TS code (@kingstack/shared)
│   └── ts-config/                  # Shared TypeScript configuration
├── scripts/                    # TypeScript scripts (env swapping, setup)
├── secrets/                    # Environment configs (development/production)
├── docs/                       # Documentation
│   ├── auth/                   # Authentication architecture
│   ├── deployment/            # CI/CD and deployment guides
│   ├── secrets/                # Secrets management guide
│   ├── scripts/                # Scripts and automation guide
│   └── state-management/       # State management architecture
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

## 🗄️ Database & ORM

KingStack is **designed to use Supabase** as the database backend and authentication provider. Prisma is used as the ORM layer to make schema modeling, migrations, and querying easy and type-safe.

### Supabase + Prisma Architecture

**Supabase** provides:
- ☁️ **PostgreSQL database** - Managed Postgres with connection pooling
- 🔐 **Authentication** - Built-in auth with JWT tokens
- 🔄 **Realtime** - Database change subscriptions (optional)

**Prisma** provides:
- 📐 **Schema modeling** - Type-safe schema definitions
- 🔄 **Migrations** - Version-controlled database changes
- 🔍 **Type-safe queries** - Generated TypeScript client
- 🛠️ **Developer experience** - Great tooling and IntelliSense

### Configuration

Supabase is configured by populating the relevant environment variables in your secrets configuration:

```env
# Database connections
SUPABASE_DB_POOL_URL=postgresql://...
SUPABASE_DB_DIRECT_URL=postgresql://...

# Supabase API
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# JWT secret for token validation
SUPA_JWT_SECRET=your-jwt-secret
```

📖 **[Secrets Management Guide →](./docs/secrets/README.md)**

### Prisma Usage

**Schema location:** `packages/prisma/schema.prisma`

**Import Prisma Client:**
```ts
import { PrismaClient } from "@prisma/client" // works everywhere
```

**Commands:**
```bash
yarn prisma:generate    # Generate Prisma client
yarn prisma:migrate     # Run migrations
# Or using workspace directly:
yarn workspace @kingstack/prisma prisma generate
yarn workspace @kingstack/prisma prisma migrate dev
```

### Playground Mode

The stack can be used **without a Supabase backend** via Playground mode for:
- 🎨 **Vibe coding** - Quick prototyping without setup
- 🖼️ **Frontend development** - UI work with mock data
- 💻 **Local apps** - Apps that don't need a database

```bash
yarn env:playground
yarn dev
```

Playground mode uses mock data and doesn't require Supabase configuration.

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

## Deployments

### NextJS App
- Ensure the vercel cli is installed and authenticated
- Run `vercel` command and follow prompts to deploy
- To enable auto-deployments, you need to add vercel details to github action secrets
  - VERCEL_PROJECT_ID - Get this from the project vercel generated on step 1
  - VERCEL_TOKEN - Create one from your Vercel account settings -> Tokens
  - VERCEL_ORG_ID - This is your "Team ID" which you can get from your team settings.
  - Code pushed to main will be deployed to production, all other branches will go to preview

## 🧠 Points of Interest

### 🔄 Supabase Auth Sync

- A Supabase **trigger** automatically syncs users from the `auth.users` (managed by Supabase) table into the `public.user` table (managed by Prisma).
- This ensures internal application logic can use a fully controlled `user` model while still leveraging Supabase Auth.
- This trigger will be automatically installed when running the migrations via `20250921183730_essentials`
- Any new required fields added to the `user` model will require a new migration which updates the trigger to handle the new fields.
- 🔥 Failing to update the trigger when modifying `user` **will** break authentication and signup flows.
- Existing Supabase users which "missed the boat" can be copied over with the `backfill-user-data.ts` script.
- Ensure the trigger is installed and working before running any backfills or jobs that interact with `user`.
```bash
bun run apps/nest/src/scripts/backfill-user-data.ts
```

### 📦 Packages

- **`@kingstack/shared`** (in `packages/shared/`): Shared TypeScript types and utilities used by both Next.js and NestJS
- **`@kingstack/advanced-optimistic-store`**: Framework-agnostic optimistic updates with MobX + TanStack Query Core + optional realtime
- **`@kingstack/eslint-config`**: Shared ESLint configuration for consistent code quality
- **`@kingstack/ts-config`**: Shared TypeScript configuration
- **`@kingstack/prisma`**: Prisma schema and migrations

---

🌟 Let the kingdom reign. Long live the stack!