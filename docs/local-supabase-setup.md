# Local Supabase Development Setup

This guide walks you through setting up an isolated local Supabase instance for development, ensuring complete database isolation from other projects and perfect parity with cloud deployments.

## Table of Contents
- [Why Local Supabase?](#why-local-supabase)
- [Prerequisites](#prerequisites)
- [Initial Setup](#initial-setup)
- [Environment Configuration](#environment-configuration)
- [Database Schema Setup](#database-schema-setup)
- [Verification](#verification)
- [Daily Workflow](#daily-workflow)
- [Troubleshooting](#troubleshooting)

## Why Local Supabase?

Running a local Supabase instance provides:

- **Complete Isolation**: Each project has its own database, preventing conflicts and data pollution
- **Prisma Migration Safety**: Your migrations only affect your project's database
- **Cloud Parity**: Local setup mirrors exactly what will deploy to cloud Supabase
- **Offline Development**: Work without internet connection
- **Fast Iteration**: No network latency, instant database operations

## Prerequisites

1. **Docker Desktop** - Supabase CLI uses Docker to run the local stack
2. **Supabase CLI** - Already installed in this project (`yarn add -D supabase`)
3. **Node.js & Yarn** - For running scripts and Prisma commands

## Initial Setup

### Step 1: Check for Existing Supabase Instances

Before starting, check if Supabase is already running from another project:

```bash
docker ps | grep supabase
```

If you see containers like `supabase_db_turborepo` or similar, you have another instance running.

### Step 2: Stop Other Instances (if needed)

To ensure proper isolation, stop any running Supabase instances:

```bash
# Navigate to the other project directory
cd /path/to/other/project

# Stop Supabase
supabase stop

# Return to this project
cd /path/to/minium-agent
```

### Step 3: Initialize Supabase in This Project

If not already initialized (check for `supabase/config.toml`):

```bash
supabase init
```

This creates a `supabase/` directory with configuration files.

### Step 4: Start Local Supabase

```bash
supabase start
```

This command will:
- Pull necessary Docker images (first time only)
- Start all Supabase services (Postgres, GoTrue, PostgREST, etc.)
- Display connection details and keys

**Important**: Save the output! It contains your local instance keys.

Example output:
```
Started supabase local development setup.

         API URL: http://127.0.0.1:54321
     GraphQL URL: http://127.0.0.1:54321/graphql/v1
  S3 Storage URL: http://127.0.0.1:54321/storage/v1/s3
         MCP URL: http://127.0.0.1:54321/mcp
    Database URL: postgresql://postgres:postgres@127.0.0.1:54322/postgres
      Studio URL: http://127.0.0.1:54323
     Mailpit URL: http://127.0.0.1:54324
 Publishable key: sb_publishable_...
      Secret key: sb_secret_...
```

## Environment Configuration

### Understanding the Keys

Supabase CLI provides two key formats:

1. **JWT Format Keys** (what your app uses):
   - `ANON_KEY`: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
   - `SERVICE_ROLE_KEY`: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
   - These are **standard for all local instances** and already configured

2. **New Format Keys** (reference only):
   - `sb_publishable_...`
   - `sb_secret_...`
   - Documented in env files for reference

### Switch to Local Environment

The `local` environment is pre-configured with the correct keys and URLs:

```bash
# Using the convenient script
yarn env:local

# Or directly
bun scripts/swap-env.ts local
```

This swaps in the environment files from `secrets/local/` to:
- `apps/next/.env`
- `apps/nest/.env`
- `packages/prisma/.env`

### Verify Active Environment

```bash
yarn env:current
```

Should output: `Current environment: local`

## Database Schema Setup

### Understanding Your Schema

Your Prisma schema (`packages/prisma/schema.prisma`) includes:

- **user** - Users with email, username, posts, todos
- **post** - Blog posts linked to users
- **todo** - Todo items for users
- **test** - Test table
- **checkbox** - Realtime checkboxes (0-199)
- **admin_emails** - Admin email allowlist

### Apply Migrations to Local Database

Run this command to set up your database:

```bash
# From project root
yarn prisma:migrate

# Or from prisma package
cd packages/prisma
yarn prisma migrate reset --force
```

This will:
1. ✅ Drop and recreate the public schema (clean slate)
2. ✅ Apply all 7 existing migrations in order
3. ✅ Create migration tracking table (`_prisma_migrations`)
4. ✅ Generate Prisma Client
5. ✅ Run seed files (if configured)

**Expected migrations applied:**
- `20250921183700_init` - Initial setup
- `20250921183730_essentials` - Core tables
- `20250921201216_setup_realtime` - Supabase realtime configuration
- `20250922192555_add_todo_table` - Todo functionality
- `20250924002942_add_checkbox_table` - Checkbox demo
- `20250925234850_add_checkbox_realtime` - Realtime subscriptions
- `20251113164418_add_admin_emails_table` - Admin allowlist

### If You Get "Database Not Empty" Error

If you see `Error: P3005 - The database schema is not empty`:

```bash
# Force reset and apply migrations
cd packages/prisma
yarn prisma migrate reset --force
```

This is safe for local development and ensures a clean slate.

## Verification

### 1. Check Supabase Status

```bash
supabase status
```

Should show all services running with no stopped services.

### 2. Verify Tables Created

```bash
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres \
  -c "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;"
```

Expected tables:
- `_prisma_migrations`
- `admin_emails`
- `checkbox`
- `post`
- `test`
- `todo`
- `user`

### 3. Verify Migration History

```bash
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres \
  -c "SELECT migration_name, finished_at FROM _prisma_migrations ORDER BY finished_at;"
```

Should show all 7 migrations with timestamps.

### 4. Access Supabase Studio

Open your browser to [http://127.0.0.1:54323](http://127.0.0.1:54323)

You can:
- Browse tables and data
- Run SQL queries
- View realtime subscriptions
- Test authentication

## Daily Workflow

### Starting Your Dev Session

```bash
# 1. Start Supabase
supabase start

# 2. Switch to local environment (if not already)
yarn env:local

# 3. Start your app
yarn dev
```

### Stopping Your Dev Session

```bash
# Stop your app (Ctrl+C)

# Stop Supabase (keeps data)
supabase stop

# Or stop and remove all data (fresh start next time)
supabase stop --no-backup
```

### Making Schema Changes

1. **Edit** `packages/prisma/schema.prisma`
2. **Create migration**:
   ```bash
   cd packages/prisma
   yarn prisma migrate dev --name descriptive_name
   ```
3. **Commit** the new migration file to git
4. **Deploy to cloud** when ready:
   ```bash
   yarn env:development  # or production
   yarn prisma:migrate
   ```

### Switching Between Projects

If you need to work on multiple projects with local Supabase:

```bash
# Stop current project
supabase stop

# Switch to other project
cd /path/to/other/project
supabase start

# When returning to this project
cd /path/to/minium-agent
supabase start
```

## Troubleshooting

### Port Already in Use

If ports 54321-54324 are in use:

```bash
# Find what's using the ports
lsof -i :54321
lsof -i :54322

# Stop the conflicting Supabase instance
supabase stop
```

### Docker Issues

```bash
# Restart Docker Desktop
# Then try again
supabase start
```

### Migration Conflicts

If migrations fail or you want a completely fresh start:

```bash
# Reset everything
cd packages/prisma
yarn prisma migrate reset --force

# This will:
# - Drop all tables
# - Re-apply all migrations
# - Generate client
```

### Environment Not Switching

```bash
# Check current environment
yarn env:current

# Force swap to local
yarn env:local

# Verify .env files were updated
cat apps/next/.env | grep SUPABASE_URL
# Should show: http://127.0.0.1:54321
```

### Database Connection Errors

1. **Check Supabase is running**:
   ```bash
   supabase status
   ```

2. **Verify environment variables**:
   ```bash
   cat packages/prisma/.env
   ```
   Should contain: `postgresql://postgres:postgres@127.0.0.1:54322/postgres`

3. **Test connection directly**:
   ```bash
   psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -c "SELECT 1;"
   ```

## Key Differences: Local vs Development vs Production

| Aspect | Local | Development | Production |
|--------|-------|-------------|------------|
| **Database** | Docker (127.0.0.1:54322) | Remote Supabase Dev Project | Remote Supabase Prod Project |
| **Isolation** | Complete isolation per project | Shared team database | Live user data |
| **Data Persistence** | Lost on `supabase stop --no-backup` | Persisted in cloud | Persisted in cloud |
| **Migrations** | Apply freely, reset anytime | Apply carefully, team coordination | Apply with extreme care |
| **Cost** | Free (local resources) | Supabase free tier or paid | Supabase paid plan |
| **Internet Required** | No | Yes | Yes |
| **Use Case** | Feature development, testing | Team collaboration, staging | Live application |

## Best Practices

1. **Always use `local` environment for feature development** - Complete isolation prevents accidents
2. **Reset database frequently** - `yarn prisma migrate reset --force` keeps things clean
3. **Commit migrations to git** - Ensures team has consistent schema
4. **Test migrations locally first** - Before applying to development or production
5. **Stop Supabase when not in use** - Frees up Docker resources
6. **One Supabase instance at a time** - Prevents port conflicts between projects

## Additional Resources

- [Supabase Local Development Docs](https://supabase.com/docs/guides/local-development)
- [Prisma Migrations Guide](https://www.prisma.io/docs/concepts/components/prisma-migrate)
- [Project Secrets Management](../secrets/readme.md)
- [Environment Swap Script](../scripts/swap-env.ts)

## Need Help?

If you encounter issues not covered here:
1. Check `supabase logs` for detailed error messages
2. Review Docker Desktop for container status
3. Consult the Supabase CLI docs: `supabase --help`
