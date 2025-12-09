# 🚀 Deployment & CI/CD

KingStack uses GitHub Actions for automated PR checks and deployments, with explicit branch-based deployment workflows.

## Branch Strategy

Deployments are linked to **explicitly named branches**:

- **`development`** → Deploys to development environment
- **`main`** (or `production`) → Deploys to production environment

This makes it crystal clear which branch triggers which deployment, avoiding confusion about environment mappings.

## GitHub Actions Workflows

### PR Checks (`checks-prod.yml`)

Runs on pull requests targeting `main`:

```yaml
on:
  pull_request:
    branches: [main]
```

**What it does:**
- ✅ Lints all code (`yarn lint`)
- ✅ Runs all tests (`yarn test`)
- ✅ Builds Next.js app (`yarn turbo build --filter=@kingstack/next`)

**Environment:** Uses `production` environment secrets for realistic testing

### Development Deployment (`deploy-dev.yml`)

Triggers on push to `development` branch:

```yaml
on:
  push:
    branches: [development]
```

**What it does:**
1. **Run Migrations** - Deploys Prisma migrations to development database
2. **Deploy Next.js** - Deploys to Vercel (development environment)

**Environment:** Uses `development` GitHub environment secrets

### Production Deployment (`deploy-prod.yml`)

Triggers on push to `main` branch:

```yaml
on:
  push:
    branches: [main]
```

**What it does:**
1. **Run Migrations** - Deploys Prisma migrations to production database
2. **Deploy Next.js** - Deploys to Vercel (production environment)

**Environment:** Uses `production` GitHub environment secrets

## Deployment Flow

```
┌─────────────────┐
│  Push to Branch │
└────────┬────────┘
         │
         ├─→ development branch
         │   └─→ Deploy Dev Workflow
         │       ├─→ Run Migrations (dev DB)
         │       └─→ Deploy to Vercel (dev)
         │
         └─→ main branch
             └─→ Deploy Prod Workflow
                 ├─→ Run Migrations (prod DB)
                 └─→ Deploy to Vercel (prod)
```

## Required GitHub Secrets

### Development Environment
- `SUPABASE_DB_DIRECT_URL`
- `SUPABASE_DB_POOL_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`

### Production Environment
- `SUPABASE_DB_DIRECT_URL`
- `SUPABASE_DB_POOL_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`

## Migration Strategy

Migrations run **before** deployment to ensure database schema is up-to-date:

1. Checkout code
2. Install dependencies
3. Run `prisma migrate deploy` (production-ready, no prompts)
4. Deploy application

This ensures:
- ✅ Database is always in sync with code
- ✅ Migrations run in correct order
- ✅ Failed migrations block deployment

## Vercel Deployment

Next.js app is deployed to Vercel with:

- **Automatic linking** - Project is linked using Vercel CLI
- **Production builds** - Uses `vercel deploy --prod`
- **Environment variables** - Injected from GitHub Secrets

## Benefits

✅ **Explicit** - Branch names clearly indicate deployment target  
✅ **Automated** - No manual deployment steps  
✅ **Safe** - Migrations run before deployment  
✅ **Tested** - PR checks ensure code quality  
✅ **Separated** - Dev and prod environments are isolated  

## Manual Deployment

If you need to deploy manually:

```bash
# Development
git checkout development
git push origin development

# Production
git checkout main
git push origin main
```

## Troubleshooting

### Migration Failures
- Check database connection strings
- Verify migration files are valid
- Review migration logs in GitHub Actions

### Vercel Deployment Failures
- Verify Vercel tokens are valid
- Check project IDs match
- Review build logs for errors

### Environment Mismatches
- Ensure GitHub Secrets match environment
- Verify branch names are correct
- Check workflow file triggers

