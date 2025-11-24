# Supabase Management

This directory contains documentation for managing Supabase in your KingStack project.

## Quick Reference

### Commands

```bash
# Start/Stop
yarn supabase:start      # Start local Supabase
yarn supabase:stop        # Stop local Supabase

# Status & Info
yarn supabase:status      # Check current project's status
yarn supabase:list        # List all running instances (all projects)
yarn supabase:check       # Verify configuration

# Database
yarn supabase:reset       # Reset database (drops data, re-runs migrations)
```

### Configuration

- **Config file**: `supabase/config.toml`
- **Auto-detected**: Supabase CLI automatically uses `config.toml` when run from project root
- **Project ID**: Set in `config.toml` to uniquely identify this project's Docker containers

## Documentation

- **[Multi-Project Setup](./multi-project-setup.md)** - Run multiple Supabase projects simultaneously
- **[Local Development Setup](../local-supabase-setup.md)** - Complete guide to local Supabase development

## Key Features

### ✅ Config.toml is Automatically Respected

The Supabase CLI automatically reads `supabase/config.toml` when you run commands from the project root. No special flags or paths needed!

**What this means:**
- ✅ `yarn supabase:start` uses your `config.toml` settings
- ✅ Ports, project_id, and all settings are applied automatically
- ✅ No need to specify `--config` or `-c` flags

### ✅ Multiple Projects Support

You can run multiple KingStack projects (or any Supabase projects) simultaneously by:

1. **Setting unique `project_id`** in each `config.toml`
2. **Configuring different ports** for each project
3. **Updating environment files** to match the new ports

See the [Multi-Project Setup Guide](./multi-project-setup.md) for detailed instructions.

### ✅ Helper Scripts

Three TypeScript scripts make Supabase management easier:

1. **`supabase-status.ts`** - Shows running services and connection info
2. **`supabase-list-instances.ts`** - Lists all Supabase instances across all projects
3. **`supabase-check-config.ts`** - Validates and displays your configuration

## Common Workflows

### Daily Development

```bash
# Start your day
yarn env:local
yarn supabase:start
yarn dev

# Check status anytime
yarn supabase:status

# End your day
yarn supabase:stop
```

### Working with Multiple Projects

```bash
# Check what's running
yarn supabase:list

# Verify your project's config
yarn supabase:check

# Start/stop as needed
yarn supabase:start
yarn supabase:stop
```

### Database Reset

```bash
# Reset everything (drops all data, re-runs migrations)
yarn supabase:reset
```

## Troubleshooting

### Port Conflicts

If you see "port already in use" errors:

```bash
# See what's running
yarn supabase:list

# Stop conflicting instance
cd /path/to/other/project
yarn supabase:stop
```

### Configuration Issues

```bash
# Verify your config
yarn supabase:check

# Ensure config.toml exists
ls supabase/config.toml
```

### Wrong Project

If containers have wrong names or you're connecting to the wrong instance:

1. Check `project_id` in `supabase/config.toml`
2. Verify with `yarn supabase:check`
3. Restart: `yarn supabase:stop && yarn supabase:start`

## Best Practices

1. **Always use `yarn supabase:*` commands** - They ensure proper directory context
2. **Check status before starting** - Use `yarn supabase:list` to see what's running
3. **Use unique project_ids** - Makes it easier to identify containers
4. **Document port assignments** - If using custom ports, keep notes
5. **Stop unused instances** - Free up Docker resources

## How It Works

### Config.toml Location

The Supabase CLI looks for `config.toml` in the `supabase/` directory relative to where you run the command. Since all commands are run from the project root, it automatically finds `supabase/config.toml`.

### Project Isolation

Each project is isolated by:
- **Docker container names** - Based on `project_id` (e.g., `supabase_kingstack_db`)
- **Port assignments** - Each service uses configured ports
- **Data volumes** - Separate Docker volumes per project

### Environment Files

Your environment files (`secrets/local/.env.*`) must match the ports configured in `config.toml`:

- `SUPABASE_URL` → API port
- `SUPABASE_DB_*_URL` → Database port
- Studio URL → Studio port (for manual access)

Use `yarn env:local` to ensure your environment matches your Supabase configuration.

