# apps/backend/Dockerfile

# Stage 1: Build
FROM node:20 AS build
WORKDIR /app

# 👇 Copy the whole monorepo context
COPY . .

# 👇 Install everything (monorepo-wide)
RUN corepack enable && yarn install --immutable

# 👇 Generate the Prisma client using the shared schema
RUN yarn workspace @kingstack/prisma prisma generate

# 👇 Build the backend app
WORKDIR /app/apps/backend
RUN yarn build

# Stage 2: Runtime
FROM node:20-slim

# 👇 Install OpenSSL (required by Prisma Client)
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=build /app/apps/backend/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/backend/package.json ./

# Expose the application port
EXPOSE 3000

CMD ["node", "dist/main"]