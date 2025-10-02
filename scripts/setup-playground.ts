#!/usr/bin/env bun
// Setup script for playground mode
// This creates the necessary environment files for playground mode

import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

const PLAYGROUND_ENV = `# Playground Mode - No Supabase Required
# This configuration allows KingStack to run as a UI playground
# without requiring authentication or database setup

# Disable Supabase integration
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=

# Backend URL (will use mock data in playground mode)
NEXT_PUBLIC_NEST_BACKEND_URL=http://localhost:3001
NEXT_PUBLIC_API_URL=http://localhost:3001

# Playground mode flag
NEXT_PUBLIC_PLAYGROUND_MODE=true

# Optional: Google OAuth (disabled in playground)
GOOGLE_CLIENT_SECRET=
GOOGLE_CLIENT_ID=

# Database URLs (not used in playground mode)
SUPABASE_DB_POOL_URL=
SUPABASE_DB_DIRECT_URL=
SUPABASE_SERVICE_ROLE_KEY=
`;

const BACKEND_PLAYGROUND_ENV = `# Backend Playground Mode
# This configuration allows the backend to run in playground mode
# without requiring database connections

# Disable database connections
SUPABASE_DB_POOL_URL=
SUPABASE_DB_DIRECT_URL=
SUPABASE_DB_USER=
SUPABASE_DB_PASSWORD=

# Disable Supabase
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Playground mode flag
PLAYGROUND_MODE=true

# CORS settings
FRONTEND_URL=http://localhost:3000
`;

const PRISMA_PLAYGROUND_ENV = `# Prisma Playground Mode
# This configuration disables database connections for playground mode

# Disable database connections
SUPABASE_DB_POOL_URL=
SUPABASE_DB_DIRECT_URL=
`;

async function main() {
  console.log('🎮 Setting up KingStack Playground Mode...');

  // Create playground environment files
  const frontendEnvPath = join('apps', 'frontend', '.env');
  const backendEnvPath = join('apps', 'backend', '.env');
  const prismaEnvPath = join('packages', 'prisma', '.env');

  // Write frontend environment
  writeFileSync(frontendEnvPath, PLAYGROUND_ENV);
  console.log('✅ Created frontend playground environment');

  // Write backend environment
  writeFileSync(backendEnvPath, BACKEND_PLAYGROUND_ENV);
  console.log('✅ Created backend playground environment');

  // Write prisma environment
  writeFileSync(prismaEnvPath, PRISMA_PLAYGROUND_ENV);
  console.log('✅ Created prisma playground environment');

  console.log('\n🎉 Playground mode setup complete!');
  console.log('\nTo start the playground:');
  console.log('  yarn dev');
  console.log('\nTo switch back to development mode:');
  console.log('  bun scripts/swap-env.ts development');
  console.log('\nTo switch back to production mode:');
  console.log('  bun scripts/swap-env.ts production');
}

main().catch(console.error);
