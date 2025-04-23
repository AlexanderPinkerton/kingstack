# apps/backend/Dockerfile

# Stage 1: Build
FROM node:20 AS build
WORKDIR /app

# 👇 Copy the whole monorepo context
COPY . .

# 👇 Install everything (monorepo-wide)
RUN corepack enable && yarn install --immutable

# 👇 Generate the Prisma client using the shared schema
RUN yarn prisma generate --schema=packages/prisma/schema.prisma

# 👇 Build the backend app
WORKDIR /app/apps/backend
RUN yarn build

# Stage 2: Runtime
FROM node:20-slim
WORKDIR /app

COPY --from=build /app/apps/backend/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/backend/package.json ./

CMD ["node", "dist/main"]


## THIS DOES NOT WORK YET