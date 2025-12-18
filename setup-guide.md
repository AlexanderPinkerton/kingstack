# KingStack Project Setup Guide

## Quick Start

```bash
npx create-kingstack my-project
```

The CLI handles everything:
1. Downloads the template
2. Renames `@kingstack` → `@my-project`
3. Generates configuration
4. Installs dependencies
5. Starts the dev server
6. Opens your browser

You'll be prompted to choose between **Playground** (no database) or **Full Setup** (with Supabase).

---

## Manual Setup

If you prefer to set up manually without the CLI:

### 1. Clone and Rename

```bash
git clone https://github.com/kingstack-org/kingstack.git my-project
cd my-project
rm -rf .git
git init
```

### 2. Find and Replace Namespace

Replace all `@kingstack/` occurrences with `@my-project/` across the codebase.

### 3. Create Configuration

```bash
cp config/example.ts config/local.ts
```

Edit `config/local.ts` to set your project name and ports.

### 4. Install and Run

```bash
yarn install

# For Playground mode (no database):
yarn env:playground
yarn dev

# For Full Setup (with Supabase):
yarn env:local
yarn supabase:start
bun scripts/setup-shadow-db.ts
yarn prisma:migrate
yarn dev
```

---

## Port Configuration

Default ports (can be customized during setup):

| Service | Port |
|---------|------|
| Next.js | 3069 |
| NestJS | 3420 |
| Supabase API | 54321 |
| Supabase Studio | 54324 |

---

## Requirements

- **Node.js 20+**
- **Bun** - for running TypeScript scripts
- **Docker** - only needed for Full Setup mode
