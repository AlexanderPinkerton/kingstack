# Stage 1: Build
FROM node:20 AS build
WORKDIR /app

COPY . .

RUN corepack enable && yarn install --immutable

WORKDIR /app/apps/frontend
RUN yarn build

# Stage 2: Run
FROM node:20-slim
WORKDIR /app

COPY --from=build /app/apps/frontend/.next ./.next
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/frontend/public ./public
COPY --from=build /app/apps/frontend/package.json ./

ENV NODE_ENV=production
EXPOSE 3000
CMD ["node_modules/.bin/next", "start"]
