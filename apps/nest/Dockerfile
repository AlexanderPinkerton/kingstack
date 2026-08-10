# apps/nest/Dockerfile

# Stage 1: Build
FROM node:24.18.0-bookworm AS build
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
COPY packages/deploy/package.json packages/deploy/package.json
COPY packages/advanced-optimistic-store/package.json packages/advanced-optimistic-store/package.json
COPY packages/comment-tree/package.json packages/comment-tree/package.json
COPY packages/create-kingstack/package.json packages/create-kingstack/package.json
COPY packages/dnd-tree/package.json packages/dnd-tree/package.json
COPY packages/logger/package.json packages/logger/package.json
# └─ if you have more workspaces, repeat: COPY packages/foo/package.json packages/foo/package.json

# 4) Install only Nest and its workspace dependencies with vendored Yarn.
RUN YARN_ENABLE_IMMUTABLE_INSTALLS=true \
    node .yarn/releases/yarn-4.10.2.cjs workspaces focus @kingstack/nest

# 6) Copy the rest of your source
COPY . .

# 👇 Generate the Prisma client using the shared schema
RUN node .yarn/releases/yarn-4.10.2.cjs workspace @kingstack/prisma prisma generate

# 👇 Build the nestjs app
RUN node .yarn/releases/yarn-4.10.2.cjs workspace @kingstack/shared build
RUN node .yarn/releases/yarn-4.10.2.cjs workspace @kingstack/logger build
RUN node .yarn/releases/yarn-4.10.2.cjs workspace @kingstack/nest build

# Remove build and test tooling before copying dependencies into the runtime image.
RUN YARN_ENABLE_IMMUTABLE_INSTALLS=true \
    node .yarn/releases/yarn-4.10.2.cjs workspaces focus @kingstack/nest --production

# Stage 2: Runtime
FROM node:24.18.0-bookworm-slim

# 👇 Install OpenSSL (required by Prisma Client)
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=build /app/apps/nest/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=build /app/packages/shared/dist ./packages/shared/dist
COPY --from=build /app/packages/logger/package.json ./packages/logger/package.json
COPY --from=build /app/packages/logger/dist ./packages/logger/dist
COPY --from=build /app/apps/nest/package.json ./

CMD ["node", "dist/main"]
