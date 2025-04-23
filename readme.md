# 👑 kingstack

A modern full-stack TypeScript monorepo powered by:

- 🧵 Yarn v4 Workspaces
- ⚡️ Turborepo
- 🧠 NestJS (API backend)
- 🌐 Next.js (frontend)
- 🎨 ShadCN with Tailwind CSS
- 🧬 Prisma (ORM)
- ☁️ Supabase (auth + Postgres)
- 🔨 Bun (local scripts)

---

## 📁 Folder Structure

```
king-stack/
├── apps/
│   ├── frontend/        # Next.js app (public website + auth UI)
│   └── backend/         # NestJS app (API, logic, jobs)
├── packages/
│   └── prisma/          # Shared Prisma schema + generated client
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
  yarn workspace @kingstack/frontend dev
  yarn workspace @kingstack/prisma prisma generate
  ```

### ⚡️ Turborepo Pipelines
- Defined in `turbo.json`
- Handles `dev`, `build`, `lint`, `test` across all workspaces
- Example:
  ```bash
  yarn dev       # Starts frontend + backend
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
- Backend connects using `postgres` library
- Auth flows via Supabase client + JWT headers (to backend)

---

## 🛊 Local Development

### Start Dev Servers
```bash
yarn dev
```
This runs both `frontend` and `backend` in parallel.

### Run Individual App
```bash
yarn workspace @kingstack/frontend dev
yarn workspace @kingstack/backend dev
```

### Run Prisma Migration
```bash
yarn workspace @kingstack/prisma prisma migrate dev
```

### Run Scripts with Bun
```bash
bun run apps/backend/scripts/backfill-user-data.ts
```

---

## 🧠 Points of Interest

### 🔄 Supabase Auth Sync

- A Supabase **trigger** automatically syncs users from the `auth.users` table into the `public.user` table (managed by Prisma).
- This ensures internal application logic can use a fully controlled `user` model while still leveraging Supabase Auth.

### ⚠️ User Schema Changes Require Trigger Updates

- The `user` table is updated by Supabase using a **custom SQL trigger**.
- Any changes to the Prisma `user` model **must be reflected** in the trigger script.
- 🔥 Failing to update the trigger when modifying `user` will break authentication and signup flows.

### 🛠️ Bun Scripts Use Internal DB

- Bun scripts (like `backfill-user-data.ts`) operate on the `public.user` table, not `auth.users`.
- Ensure the trigger is installed and working before running any backfills or jobs that interact with `user`.

---

🌟 Let the kingdom reign. Long live the stack!

