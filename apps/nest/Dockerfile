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
COPY packages/shapes/package.json packages/shapes/package.json
# └─ if you have more workspaces, repeat: COPY packages/foo/package.json packages/foo/package.json

# 4) Activate the vendored Yarn (no network fetch)
RUN corepack enable \
    && corepack prepare yarn@stable --activate

# 5) Now Yarn sees the full workspace graph — the immutable check will pass
RUN yarn install --immutable

# 6) Copy the rest of your source
COPY . .

# Build the shared code package
RUN yarn workspace @kingstack/shapes build

# 👇 Generate the Prisma client using the shared schema
RUN yarn workspace @kingstack/prisma prisma generate

# 👇 Build the nestjs app
WORKDIR /app/apps/nest
RUN yarn build

# Stage 2: Runtime
FROM node:20-slim

# 👇 Install OpenSSL (required by Prisma Client)
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=build /app/apps/nest/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/nest/package.json ./
COPY --from=build /app/packages/shapes ./packages/shapes

CMD ["node", "dist/main"]