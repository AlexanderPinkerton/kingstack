# create-kingstack

CLI to scaffold a new project from the [KingStack](https://github.com/kingstack-org/kingstack) template.

## Usage

```bash
npx create-kingstack my-project
```

That's it! The CLI will:

1. Download the KingStack template
2. Rename the namespace to `@my-project/*`
3. Generate configuration files
4. Initialize git
5. Install dependencies
6. Ask whether to start with frontend drafts or the complete local stack
7. Start the appropriate development server
8. Open the backend-free project gateway

Both choices generate the complete KingStack project. The choice only controls
which services the installer starts immediately.

## Interactive Prompts

```
? Project name: my-project
? How would you like to start? Frontend draft (no backend services)
? Customize ports? No
```

## Command Line Arguments

```bash
# Specify project name
npx create-kingstack my-project

# Start Next.js without Docker, Supabase, NestJS, or migrations
npx create-kingstack my-project --draft

# Configure and start the complete local stack
npx create-kingstack my-project --full

# Specify a different base directory (instead of cwd)
npx create-kingstack my-project --dir ~/Projects

# Just specify base directory, prompt for project name
npx create-kingstack --dir /tmp
```

## Options

| Flag | Description |
|------|-------------|
| `-d, --dir <path>` | Base directory for the new project (default: current directory) |
| `--draft` | Start Next.js only and skip local backend infrastructure |
| `--full` | Start Supabase, run migrations, and launch the full stack |
| `-h, --help` | Show help message |

## Requirements

- **Node.js 20+**
- **Yarn** (installed automatically via corepack)
- **Bun** (for running scripts)
- **Docker** (full-stack setup only)

## What Gets Created

```
my-project/
├── apps/
│   ├── next/          # Next.js frontend (port 3069)
│   └── nest/          # NestJS backend (port 3420)
├── packages/
│   ├── shared/        # Shared TypeScript code
│   ├── prisma/        # Database schema & migrations
│   └── ...
├── config/
│   └── local.ts       # Your local configuration
└── ...
```

## After Creation

The browser opens the generated project's root gateway. From there:

- **Frontend drafts** run without Supabase or NestJS and use in-memory
  repositories with the production store pattern.
- **Full-stack showcase** initializes the Supabase-backed runtime and uses the
  configured NestJS and database services.

If you initially choose draft setup, connect the backend later with:

```bash
yarn supabase:start
bun scripts/setup-shadow-db.ts
yarn prisma:migrate
yarn dev
```

## License

MIT
