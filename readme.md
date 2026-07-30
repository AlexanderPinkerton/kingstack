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

For UI exploration before a backend exists, use
**[backend-free frontend drafts →](./docs/frontend-drafts.md)**. Drafts keep the
real optimistic store pattern and swap only the repository adapter.

### Tackling Common Annoyances

KingStack takes an **explicit approach** to avoid hidden pitfalls:

#### 🔐 Explicit Configuration Management
No more guessing which `.env` file is active or dealing with dotenv detection issues. All configuration is organized in `config/` with TypeScript-based generation of both `.env` files and config files.

📖 **[Configuration Management Guide →](./config/readme.md)** (Powered by `@kingstack/config`)

#### 🎫 Explicit JWT Authentication
No cookie/localStorage magic. Tokens are explicitly passed and validated, making auth predictable and debuggable.

📖 **[Authentication Documentation →](./docs/auth/README.md)**

#### 📜 TypeScript Scripts with Bun
Write scripts in TypeScript without transpilation headaches. Bun handles execution natively.

📖 **[Scripts & Automation →](./docs/scripts/README.md)**

#### 🚀 GitHub Actions CI/CD
Automated PR checks and deployments linked to explicit branch names (`development` and `production`).

📖 **[Deployment Guide →](./docs/deployment/README.md)**

#### 📋 Centralized Metadata & SEO
All metadata, SEO, and PWA configuration in one place. No more scattered meta tags or duplicate configuration.

📖 **[Metadata & SEO Guide →](./docs/metadata/README.md)**

---

## 📁 Folder Structure

```
kingstack/
├── apps/
│   ├── next/                    # Next.js app (frontend + serverless API)
│   └── nest/                     # NestJS app (API, logic, jobs, realtime)
├── packages/
│   ├── eslint-config/              # Shared ESLint configuration
│   ├── prisma/                     # Schema + generated client
│   ├── shared/                     # Shared TS code (@kingstack/shared)
│   └── ts-config/                  # Shared TypeScript configuration
├── scripts/                    # TypeScript scripts (config generation, setup)
├── config/                     # Configuration management (development/production)
├── docs/                       # Documentation
│   ├── auth/                   # Authentication architecture
│   ├── deployment/            # CI/CD and deployment guides
│   ├── metadata/               # Metadata, SEO & PWA configuration
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

## 🚀 Getting Started

### Prerequisites

- **Node.js 20+** - For running the applications
- **Yarn 4** - Package manager (comes with the repo)
- **Bun** - For running TypeScript scripts
- **Supabase CLI** (optional) - For local Supabase development

### Quick Start

To generate a project and begin with frontend drafts immediately:

```bash
npx create-kingstack my-app --draft
```

This creates the complete stack but starts only Next.js. The root page provides
clear links to backend-free drafts and the Supabase-backed full-stack showcase.
Use `--full` when you want the CLI to start Supabase and run migrations during
initial setup.

<!-- create-kingstack:contributor-only:start -->
Contributors can test the compiled CLI against uncommitted template changes
without touching `main`:

```bash
bun scripts/test-create-kingstack my-draft-check
```

Smoke projects are retained under `~/kingstack-smoke-tests`. See the
[create-kingstack testing guide](./packages/create-kingstack/README.md#testing-local-cli-and-template-changes)
for full-stack, no-start, and custom-output examples.
<!-- create-kingstack:contributor-only:end -->

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-username/kingstack.git
   cd kingstack
   ```

2. **Install dependencies**
   ```bash
   yarn install
   ```

3. **Set up configuration**
   ```bash
   # Copy the example configuration
   cp config/example.ts config/local.ts
   
   # Edit config/local.ts with your values
   # (For local development, the defaults usually work fine)
   ```

4. **Generate environment files**
   ```bash
   yarn env:local
   ```
   
   This generates:
   - `.env` files for Next.js, NestJS, and Prisma
   - Updates `supabase/config.toml` with your port configuration

5. **Start Supabase**
   ```bash
   yarn supabase:start
   ```

6. **Generate Prisma client**
   ```bash
   yarn prisma:generate
   ```

7. **Start development servers**
   ```bash
   yarn dev
   ```
   
   This starts:
   - Next.js on `http://localhost:3069`
   - NestJS API on `http://localhost:3420`

### Next Steps

- 📖 Read the [Configuration Guide](./config/readme.md) to understand the config system
- 🎨 Explore the [State Management Architecture](./docs/state-management/README.md)
- 🔐 Learn about [Authentication](./docs/auth/README.md)
- 🚀 Check out [Deployment](./docs/deployment/README.md)

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

📖 **[Configuration Management Guide →](./config/readme.md)**

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

## 🛊 Local Development

### Start Dev Servers
```bash
yarn dev
```
This runs both Next.js (port 3069) and NestJS in parallel.

### Environment Management
```bash
yarn env:local          # Generate config for local environment
yarn env:development    # Generate config for development environment
yarn env:production     # Generate config for production environment
```

Each command generates:
- `.env` files for all projects
- Updates `supabase/config.toml` with ports and project_id

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

### Supabase Management
```bash
yarn supabase:start      # Start local Supabase instance
yarn supabase:stop       # Stop local Supabase instance
yarn supabase:status     # Check Supabase status and connection info
yarn supabase:list       # List all running Supabase instances (all projects)
yarn supabase:check      # Verify Supabase configuration
yarn supabase:reset      # Reset database (drops data, re-runs migrations)
yarn shadow:start        # Start Supabase shadow DB (minimal services)
yarn shadow:stop         # Stop shadow DB
```

📖 **[Multi-Project Setup Guide →](./docs/supabase/multi-project-setup.md)**

---

## Deployments

### NextJS App
- Ensure the vercel cli is installed and authenticated
- Run `vercel` command and follow prompts to deploy
- When it asks "In which directory is your code located?" you can either hit enter (./) or specify ./apps/next
  - Enter will use the root vercel.json
  - Specifying will use the one in the next folder.
- To enable auto-deployments, you need to add vercel details to github action secrets
  - VERCEL_PROJECT_ID - Get this from the project vercel generated on step 1
  - VERCEL_TOKEN - Create one from your Vercel account settings -> Tokens
  - VERCEL_ORG_ID - This is your "Team ID" which you can get from your team settings.
  - Code pushed to main will be deployed to production, all other branches will go to preview

## 🧠 Points of Interest

### 🔄 Supabase Auth Sync

- A Supabase **trigger** automatically syncs users from the `auth.users` (managed by Supabase) table into the `public.user` table (managed by Prisma).
- This ensures internal application logic can use a fully controlled `user` model while still leveraging Supabase Auth.
- The trigger is installed and maintained by the Prisma migrations; `20260729030000_repair_auth_user_sync` contains the current definition.
- Any new required fields added to the `user` model will require a new migration which updates the trigger to handle the new fields.
- 🔥 Failing to update the trigger when modifying `user` **will** break authentication and signup flows.
- The projection uses `auth.users.email` and the signup `username` metadata. If a valid username is absent, it generates a stable `user_<auth-id>` fallback.
- Existing Supabase users which "missed the boat" can be copied over without overwriting usernames changed inside the application.
- Ensure the trigger is installed and working before running any backfills or jobs that interact with `user`.
```bash
yarn supabase:auth:trigger:install
yarn supabase:auth:backfill
```

### 📦 Packages

- **`@kingstack/shared`** (in `packages/shared/`): Shared TypeScript types and utilities used by both Next.js and NestJS
- **`@kingstack/advanced-optimistic-store`**: Public MIT package for
  framework-agnostic optimistic and remote updates with MobX + TanStack Query
  Core. The upstream monorepo contains its source; generated projects install it
  from npm.
- **`@kingstack/eslint-config`**: Shared ESLint configuration for consistent code quality
- **`@kingstack/ts-config`**: Shared TypeScript configuration
- **`@kingstack/prisma`**: Prisma schema and migrations

---

🌟 Let the kingdom reign. Long live the stack!
