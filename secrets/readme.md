# Secrets Management

This directory contains environment-specific configuration files for the KingStack project. Instead of relying on dotenv's environment detection, this repo uses a centralized approach where all secrets are stored in this directory and swapped in as needed.

## Directory Structure

```
secrets/
├── README.md                    # This file
├── _example/                    # Template files for new developers
│   ├── .env.next           # Next app environment variables
│   ├── .env.nest            # Nest app environment variables
│   └── .env.prisma             # Database connection variables
├── development/                 # Development environment secrets
│   ├── .env.next
│   ├── .env.nest
│   └── .env.prisma
└── production/                  # Production environment secrets
    ├── .env.next
    ├── .env.nest
    └── .env.prisma
```

## How It Works

The system uses a custom `swap-env.ts` script that:

1. **Copies** environment-specific `.env.*` files from `secrets/[environment]/` to their target locations
2. **Backs up** any existing `.env` files as `.env.previous` before overwriting
3. **Detects** the currently active environment by comparing file contents

### Target Locations

The script maps files to these destinations:

| Source File | Target Location |
|-------------|----------------|
| `.env.next` | `apps/next/.env` |
| `.env.nest` | `apps/nest/.env` |
| `.env.prisma` | `packages/prisma/.env` |

## Usage

### Check Current Environment
```bash
bun scripts/swap-env.ts --current
# or
bun scripts/swap-env.ts status
```

### Switch to Development
```bash
bun scripts/swap-env.ts development
```

### Switch to Production
```bash
bun scripts/swap-env.ts production
```

## Environment Variables

### NextJS App (.env.next)
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anonymous key
- `NEXT_PUBLIC_NEST_URL` - Nest API URL for frontend to use
- `NEXT_PUBLIC_API_URL` - Public API URL
- `GOOGLE_CLIENT_SECRET` - Google OAuth client secret (optional)
- `GOOGLE_CLIENT_ID` - Google OAuth client ID (optional)
- `SUPABASE_DB_POOL_URL` - Database connection pool URL
- `SUPABASE_DB_DIRECT_URL` - Direct database connection URL
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key

### NestJS App (.env.nest)
- `NEXT_URL` - Frontend URL for CORS
- `SUPABASE_POOLER_HOST` - Supabase pooler hostname
- `SUPABASE_POOLER_USER` - Database pooler username
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_ANON_KEY` - Supabase anonymous key
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key
- `SUPABASE_DB_POOL_URL` - Database connection pool URL
- `SUPABASE_DB_DIRECT_URL` - Direct database connection URL
- `SUPABASE_DB_USER` - Database username
- `SUPABASE_DB_PASSWORD` - Database password
- `SUPA_JWT_SECRET` - JWT secret for authentication

### Prisma (.env.prisma)
- `SUPABASE_DB_POOL_URL` - Database connection pool URL for Prisma
- `SUPABASE_DB_DIRECT_URL` - Direct database connection URL for migrations

## Getting Started

### For New Developers

1. **Copy the example files:**
   ```bash
   cp -r secrets/_example/* secrets/development/
   ```

2. **Fill in your values:**
   - Replace all `REPLACEME` placeholders with actual values
   - Get Supabase credentials from your Supabase dashboard
   - Configure Google OAuth if needed

3. **Switch to development environment:**
   ```bash
   bun scripts/swap-env.ts development
   ```

### For Production Deployment

1. **Create production secrets:**
   ```bash
   cp -r secrets/_example/* secrets/production/
   ```

2. **Update with production values:**
   - Use production Supabase project credentials
   - Set production URLs and domains
   - Use secure, production-ready secrets

3. **Deploy with production environment:**
   ```bash
   bun scripts/swap-env.ts production
   ```

## Security Notes

- **Never commit actual secrets** to version control
- The `secrets/` directory (except `_example/`) is gitignored
- Always use the `_example/` files as templates
- Rotate secrets regularly in production
- Use different Supabase projects for development and production

## Troubleshooting

### Environment Detection Issues
If the current environment shows as "unknown":
- Check that all required `.env.*` files exist in the target environment directory
- Verify that the files in `secrets/[env]/` match the files in the target locations
- Run the swap script to ensure files are properly synchronized

### Missing Files
If you get "does not exist" errors:
- Ensure you've copied the example files to your target environment directory
- Check that all three files (`.env.next`, `.env.nest`, `.env.prisma`) exist
- Verify the file names match exactly (case-sensitive)

### Backup Files
Previous `.env` files are automatically backed up as `.env.previous` when swapping environments. You can restore them manually if needed:
```bash
mv apps/next/.env.previous apps/next/.env
mv apps/nest/.env.previous apps/nest/.env
mv packages/prisma/.env.previous packages/prisma/.env
```