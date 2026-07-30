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
6. Start the dev server
7. Open your browser to the running app

## Interactive Prompts

```
? Project name: my-project
? Target directory: my-project
? Customize ports? No
```

## Command Line Arguments

```bash
# Specify project name
npx create-kingstack my-project

# Specify a different base directory (instead of cwd)
npx create-kingstack my-project --dir ~/Projects

# Just specify base directory, prompt for project name
npx create-kingstack --dir /tmp
```

## Options

| Flag | Description |
|------|-------------|
| `-d, --dir <path>` | Base directory for the new project (default: current directory) |
| `-h, --help` | Show help message |

## Requirements

- **Node.js 20+**
- **Yarn** (installed automatically via corepack)
- **Docker**
- **Bun** (for running scripts)

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

Your app will be running at `http://localhost:3069`

The generated project includes:
- Supabase Studio at `http://localhost:54324`
- PostgreSQL database ready
- Auth system configured

## License

MIT
