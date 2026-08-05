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

| Flag                    | Description                                                               |
| ----------------------- | ------------------------------------------------------------------------- |
| `-d, --dir <path>`      | Base directory for the new project (default: current directory)           |
| `--draft`               | Start Next.js only and skip local backend infrastructure                  |
| `--full`                | Start Supabase, run migrations, and launch the full stack                 |
| `--port-base <port>`    | Request a specific ten-port project block instead of automatic allocation |
| `--template-dir <path>` | Copy a local dirty Git working tree instead of downloading `main`         |
| `--no-start`            | Finish generation without starting a development server                   |
| `-y, --yes`             | Accept the default setup and automatic port selection                     |
| `-h, --help`            | Show help message                                                         |

## Automatic port allocation

Every project receives one available ten-port block. The assignment covers
Next.js, NestJS, the Supabase API, database and shadow database, Studio,
Inbucket, Analytics, and the Edge Runtime inspector. Draft projects reserve the
complete block so enabling their backend later does not require reconfiguration.

Assignments are stored in `~/.kingstack/port-allocations.json`. The allocator
avoids both listening ports and blocks belonging to other generated projects,
including projects that are currently stopped. It also excludes ports blocked
by browsers and Next.js, such as `10080`. Entries for missing project directories
are reclaimed after a short pending period.

### Existing project port management

Run the latest utility from any directory inside an existing KingStack project:

```bash
# Compare config/local.ts with the machine registry and listening ports
yarn dlx @kingstack/create-kingstack ports status

# Register an existing project that already uses a standard ten-port block
yarn dlx @kingstack/create-kingstack ports register

# Move a legacy or existing project to a newly selected standard block
yarn dlx @kingstack/create-kingstack ports assign

# Request a particular block
yarn dlx @kingstack/create-kingstack ports assign --port-base 17420

# Inspect all active machine-local allocations
yarn dlx @kingstack/create-kingstack ports list

# Release this project's claim without changing its config
yarn dlx @kingstack/create-kingstack ports release
```

`ports assign` updates only the known port properties in `config/local.ts`,
preserving every other local value, and then runs `yarn env:local` to regenerate
application environment files and `supabase/config.toml`. A legacy project with
split port ranges must use `ports assign`; `ports register` accepts only the
current contiguous layout.

The registry is machine-local and is not a runtime source of configuration.
After assignment, `config/local.ts` remains the project source of truth. Stop or
restart running services so they load reassigned ports.

## Requirements

- **Node.js `>=24.18.0 <25`**
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
│   ├── eslint-config/ # Project-owned ESLint configuration
│   ├── ts-config/     # Project-owned TypeScript configuration
│   ├── shared/        # Shared TypeScript code
│   ├── prisma/        # Database schema & migrations
├── config/
│   └── local.ts       # Your local configuration
└── ...
```

Reusable KingStack primitives are regular npm dependencies, not copied
workspace source. This includes `@kingstack/config`,
`@kingstack/advanced-optimistic-store`, `@kingstack/comment-tree`, and
`@kingstack/dnd-tree`.

The CLI uses an explicit template allowlist. Upstream release tooling,
`create-kingstack` source, Changesets, and future unclassified packages are
excluded from generated projects by default.

## After Creation

The browser opens the generated project's root guide. It explains the two
development workflows:

- **Frontend drafts** run without Supabase or NestJS and use documented
  in-memory repository patterns.
- **The application** lives at `/app`, initializes the Supabase-backed runtime,
  and uses the configured NestJS and database services.

The no-index `/drafts/posts` route is retained as an agent-facing implementation
reference and is intentionally absent from the primary navigation.

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
typechecks, and tests a timestamped project directly under the output root:

```text
~/kingstack-smoke-tests/my-draft-check-<timestamp>
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
