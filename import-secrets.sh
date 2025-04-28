#!/bin/bash
# Usage: ./import-secrets.sh /path/to/kingstack-secrets
# Copies env files from the secrets folder into the correct locations in the repo

if [ -z "$1" ]; then
  echo "Usage: $0 /path/to/kingstack-secrets"
  exit 1
fi
SECRETS_DIR="$1"

cp "$SECRETS_DIR/env.frontend" ./apps/frontend/.env # must be named .env or it will not be loaded
cp "$SECRETS_DIR/env.backend" ./apps/backend/.env.backend # explicit name set in nestjs config service
cp "$SECRETS_DIR/env.docker.backend" ./apps/backend/.env.docker.backend # explicit name set in docker-compose
cp "$SECRETS_DIR/env.prisma" ./packages/prisma/.env # must be .env or it will not be loaded
echo "Environment files copied into place."