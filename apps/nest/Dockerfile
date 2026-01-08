# apps/nest/Dockerfile

# Stage 1: Build
FROM node:20 AS build
WORKDIR /app

# 1) Copy root-level manifests + Yarn config
COPY package.json        ./package.json
COPY yarn.lock           ./yarn.lock
COPY .yarnrc.yml         ./.yarnrc.yml

# 2) Copy your vendored Yarn binary & plugins
COPY .yarn/releases/     ./.yarn/releases/
# COPY .yarn/plugins/      ./.yarn/plugins/

# 3) **Copy every workspace’s package.json** so Yarn can see them, otherwise it will fail with lockfile complaints.
# This is crucial for the `--immutable` flag to work correctly.
COPY apps/nest/package.json apps/nest/package.json
COPY apps/next/package.json apps/next/package.json
COPY packages/prisma/package.json packages/prisma/package.json
COPY packages/eslint-config/package.json packages/eslint-config/package.json
COPY packages/ts-config/package.json packages/ts-config/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/config/package.json packages/config/package.json
COPY packages/advanced-optimistic-store/package.json packages/advanced-optimistic-store/package.json
COPY packages/create-kingstack/package.json packages/create-kingstack/package.json
# └─ if you have more workspaces, repeat: COPY packages/foo/package.json packages/foo/package.json

# 4) Activate the vendored Yarn (no network fetch)
RUN corepack enable \
    && corepack prepare yarn@stable --activate

# 5) Now Yarn sees the full workspace graph — the immutable check will pass
# Using BuildKit cache mount to persist yarn cache between builds
RUN --mount=type=cache,target=/root/.yarn/berry/cache \
    yarn install --immutable

# 6) Copy the rest of your source
COPY . .

# Build the shared code package
RUN yarn workspace @kingstack/shared build

# 👇 Generate the Prisma client using the shared schema
RUN yarn workspace @kingstack/prisma prisma generate

# 👇 Build the nestjs app
WORKDIR /app/apps/nest
RUN yarn build

# Stage 2: Prune for Production (Reduces Image Size)
FROM build AS prune
WORKDIR /app
RUN yarn workspaces focus --all --production

# Stage 3: Runtime
FROM node:20-slim

# 👇 Install OpenSSL (required by Prisma Client)
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=build /app/apps/nest/dist ./dist
# Copy pruned production node_modules from prune stage
COPY --from=prune /app/node_modules ./node_modules
COPY --from=build /app/apps/nest/package.json ./
COPY --from=build /app/packages/shared ./packages/shared

CMD ["node", "dist/main"]