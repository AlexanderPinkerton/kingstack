# @kingstack/config

A powerful, TypeScript-based configuration management system designed for monorepos. It provides type safety, schema validation, computed values, and automated synchronization of secrets to external services (GitHub Actions, Vercel).

## 🚀 Features

*   **Type Safety**: Define your config schema in TypeScript.
*   **Computed Values**: Automatically derive values (like database connection strings) from base inputs.
*   **Single Source of Truth**: Manage all environment variables in one place `config/`.
*   **Automated Generation**: Generates `.env` files for all your apps/packages.
*   **Cloud Sync**: Sync secrets to GitHub and Vercel with a single command.
*   **CLI**: Comes with `king-config` CLI for easy management.

## 📦 Installation

```bash
yarn add -D @kingstack/config
# or
npm install -D @kingstack/config
# or
bun add -d @kingstack/config
```

## 🛠 Usage

### 1. Define your Schema

Create `config/schema.ts`:

```typescript
import { defineSchema } from "@kingstack/config";

export const schema = defineSchema({
  core: {
    API_PORT: { required: true, description: "Port for the API" },
    HOST: { default: "localhost" },
  },
  computed: (core) => ({
    API_URL: `http://${core.HOST}:${core.API_PORT}`,
  }),
  envfiles: {
    // Map values to your app's .env file
    app: {
      path: "apps/web/.env",
      keys: ["API_URL"],
    }
  }
});
```

### 2. Define Values

Create environment-specific files (e.g., `config/local.ts`):

```typescript
import { defineValues } from "@kingstack/config";

export const values = defineValues({
  API_PORT: "3000",
});
```

### 3. Run the CLI

Generate your configuration:

```bash
# Using bun (recommended to avoid compilation)
bun king-config generate local

# Or using node (requires pre-compiling your config files or using ts-node)
npx king-config generate local
```

## 📚 commands

*   `king-config generate <env>`: Generates `.env` files and updates compatible config files (TOML).
*   `king-config sync`: Syncs secrets to external providers (GitHub, Vercel).

## 📄 License

MIT
