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
7. Find and reserve an available ten-port block
8. Start the appropriate development server
9. Open the backend-free project gateway

Both choices generate the complete KingStack project. The choice only controls
which services the installer starts immediately.

## Interactive Prompts

```
? Project name: my-project
? How would you like to start? Frontend draft (no backend services)
? Choose a specific port block? No
```

## Command Line Arguments

```bash
# Specify project name
npx create-kingstack my-project

# Start Next.js without Docker, Supabase, NestJS, or migrations
npx create-kingstack my-project --draft

# Configure and start the complete local stack
npx create-kingstack my-project --full

# Request a particular ten-port block instead of automatic allocation
npx create-kingstack my-project --port-base 17420

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
| `--port-base <port>` | Request a specific ten-port project block instead of automatic allocation |
| `--template-dir <path>` | Copy a local dirty Git working tree instead of downloading `main` |
| `--no-start` | Finish generation without starting a development server |
| `-y, --yes` | Accept the default setup and automatic port selection |
| `-h, --help` | Show help message |

## Automatic port allocation

Every project receives one available ten-port block. The assignment covers
Next.js, NestJS, the Supabase API, database and shadow database, Studio,
Inbucket, Analytics, and the Edge Runtime inspector. Draft projects reserve the
complete block so enabling their backend later does not require reconfiguration.

Assignments are stored in `~/.kingstack/port-allocations.json`. The allocator
avoids both listening ports and blocks belonging to other generated projects,
including projects that are currently stopped. Entries for missing project
directories are reclaimed after a short pending period.

## Requirements

- **Node.js 20+**
- **Yarn** (installed automatically via corepack)
- **Bun** (for running scripts)
- **Docker** (full-stack setup only)

## What Gets Created

```
my-project/
├── apps/
│   ├── next/          # Next.js frontend (allocated automatically)
│   └── nest/          # NestJS backend (allocated automatically)
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
yarn backend:enable
yarn dev
```

`backend:enable` validates Docker, refreshes the generated environment files,
starts or reuses the project's reserved Supabase instance, prepares the Prisma
shadow database, and applies all migrations. It is safe to rerun after fixing
an interrupted setup.

## Testing local CLI and template changes

From the KingStack repository root, use the packaged smoke-test helper:

```bash
bun scripts/test-create-kingstack my-draft-check
```

It builds the compiled CLI, copies the current Git working tree—including
uncommitted tracked changes and non-ignored untracked files—and generates,
typechecks, and tests a timestamped project under:

```text
~/kingstack-smoke-tests/<timestamp>/my-draft-check
```

Without a setup flag, the helper presents the real `create-kingstack` setup and
port-block prompts. After verification, it starts the development server for
the selected setup. Useful variants:

```bash
# Select draft setup without prompts, verify, and retain the project
bun scripts/test-create-kingstack my-draft-check --draft --no-start

# Select full setup without prompts and exercise Supabase plus migrations
bun scripts/test-create-kingstack my-full-check --full

# Put smoke projects somewhere else
bun scripts/test-create-kingstack my-draft-check \
  --output-dir /path/to/smoke-projects
```

The helper never writes generated output inside the source repository and does
not automatically delete smoke projects.

## License

MIT
