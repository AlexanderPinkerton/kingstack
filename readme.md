# 👑 kingstack

A modern full-stack TypeScript monorepo powered by:

- 🧵 Yarn v4 Workspaces
- ⚡️ Turborepo (monorepo)
- ✅ ESLint 9 (shared config)
- 🧠 NestJS (API backend)
- 🌐 Next.js (frontend & serveless api)
- 🎨 ShadCN with Tailwind CSS
- 🧬 Prisma (ORM)
- ☁️ Supabase (auth + db)
- 🔨 Bun (local scripts)

---

## 📁 Folder Structure

```
king-stack/
├── apps/
│   ├── next/        # Next.js app (public website + auth UI)
│   └── nest/         # NestJS app (API, logic, jobs)
├── packages/
│   └── prisma/          # Schema + generated client
│   └── shared/          # Shared TS code used by both NextJS and NestJS apps
├── .yarn/               # Yarn plugins, version, patches, etc.
├── .turbo/              # Turborepo local task cache (gitignored)
├── .gitignore
├── .yarnrc.yml          # Yarn v4 (Berry) config
├── turbo.json           # Turborepo pipeline config
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
- Defined in `turbo.json`
- Handles `dev`, `build`, `lint`, `test` across all workspaces
- Example:
  ```bash
  yarn dev       # Starts next + nest
  yarn build     # Builds all packages
  yarn lint      # Lints everything
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
This runs both `frontend` and `backend` in parallel.

### 🎮 Playground Mode
For UI development and demos without Supabase:
```bash
yarn env:playground
yarn dev
```
This runs KingStack with mock data - perfect for UI development and demos!

### Run Individual App
```bash
yarn workspace @kingstack/next dev
yarn workspace @kingstack/nest dev
```

### Run Prisma Migration
```bash
yarn workspace @kingstack/prisma prisma migrate dev
```

---

## 🧠 Points of Interest

### 🔄 Supabase Auth Sync

- A Supabase **trigger** automatically syncs users from the `auth.users` (managed by Supabase) table into the `public.user` table (managed by Prisma).
- This ensures internal application logic can use a fully controlled `user` model while still leveraging Supabase Auth.
- This trigger will be automatically installed when running the migrations via `20250921183730_essentials`
- Any new required fields added to the `user` model will require a new migration which updates the trigger to handle the new fields.
- 🔥 Failing to update the trigger when modifying `user` **will** break authentication and signup flows.

### 🛠️ Bun Scripts Use Internal DB

- Existing Supabase users which "missed the boat" can be copied over with the `backfill-user-data.ts` script.
- Ensure the trigger is installed and working before running any backfills or jobs that interact with `user`.
```bash
bun run apps/nest/scripts/backfill-user-data.ts
```

---

🌟 Let the kingdom reign. Long live the stack!