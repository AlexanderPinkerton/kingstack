# Running Multiple Supabase Projects Locally

This guide explains how to run multiple KingStack projects (or any Supabase projects) simultaneously on your local machine without conflicts.

## How It Works

Supabase CLI uses two mechanisms to isolate projects:

1. **`project_id`** in `config.toml` - Used to name Docker containers uniquely
2. **Port configuration** - Each project can use different ports to avoid conflicts

## Quick Setup for Multiple Projects

### Option 1: Default Setup (One Project at a Time)

By default, all projects use the same ports (54321-54324). Only one can run at a time:

```bash
# Project A
cd /path/to/project-a
yarn supabase:start

# Project B (must stop A first)
cd /path/to/project-b
yarn supabase:stop  # Stops project A if running
yarn supabase:start
```

**Pros:**
- ✅ No configuration needed
- ✅ Works out of the box
- ✅ Simple workflow

**Cons:**
- ❌ Can only run one project at a time
- ❌ Must stop/start when switching projects

### Option 2: Custom Ports (Multiple Projects Simultaneously)

To run multiple projects at the same time, configure different ports in each project's `supabase/config.toml`:

#### Project A (`supabase/config.toml`)
```toml
project_id = "project-a"

[api]
port = 54321

[db]
port = 54322
shadow_port = 54320

[studio]
port = 54323

[inbucket]
port = 54324
```

#### Project B (`supabase/config.toml`)
```toml
project_id = "project-b"

[api]
port = 54325  # Different port

[db]
port = 54326  # Different port
shadow_port = 54327  # Different shadow port

[studio]
port = 54328  # Different port

[inbucket]
port = 54329  # Different port
```

**Important:** After changing ports, you must:
1. Update your environment files (`secrets/local/.env.*`) with the new ports
2. Restart Supabase: `yarn supabase:stop && yarn supabase:start`

#### Port Mapping Reference

For each project, you need to update these environment variables:

```env
# API URL
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54325  # Use your custom API port
SUPABASE_URL=http://127.0.0.1:54325

# Database URLs
SUPABASE_DB_POOL_URL=postgresql://postgres:postgres@127.0.0.1:54326/postgres
SUPABASE_DB_DIRECT_URL=postgresql://postgres:postgres@127.0.0.1:54326/postgres

# Studio URL (for reference)
# http://127.0.0.1:54328
```

**Pros:**
- ✅ Run multiple projects simultaneously
- ✅ No need to stop/start when switching
- ✅ Complete isolation

**Cons:**
- ❌ Requires manual port configuration
- ❌ Must remember which ports belong to which project
- ❌ Environment files must match port configuration

## Helper Commands

KingStack provides several helper commands to manage Supabase:

```bash
# Check current project's Supabase status
yarn supabase:status

# List all running Supabase instances across all projects
yarn supabase:list

# Verify your project's Supabase configuration
yarn supabase:check

# Start Supabase (uses config.toml automatically)
yarn supabase:start

# Stop Supabase
yarn supabase:stop

# Reset database (drops all data, re-runs migrations)
yarn supabase:reset
```

## Recommended Workflow

### For Single Project Development

```bash
# Start your day
yarn env:local
yarn supabase:start
yarn dev

# End your day
yarn supabase:stop
```

### For Multiple Projects

1. **Configure unique ports** in each project's `config.toml`
2. **Update environment files** with matching ports
3. **Start each project** independently:

```bash
# Terminal 1 - Project A
cd /path/to/project-a
yarn env:local
yarn supabase:start
yarn dev

# Terminal 2 - Project B
cd /path/to/project-b
yarn env:local
yarn supabase:start
yarn dev
```

4. **Check what's running**:
```bash
yarn supabase:list
```

## Troubleshooting

### Port Already in Use

If you see "port already in use" errors:

```bash
# Find what's using the port
lsof -i :54321

# List all Supabase instances
yarn supabase:list

# Stop the conflicting instance
cd /path/to/other/project
yarn supabase:stop
```

### Wrong Project ID

If containers have conflicting names:

1. Check your `project_id` in `supabase/config.toml`
2. Ensure each project has a unique `project_id`
3. Restart: `yarn supabase:stop && yarn supabase:start`

### Environment Mismatch

If your app can't connect to Supabase:

1. Check current environment: `yarn env:current`
2. Verify ports match: `yarn supabase:check`
3. Compare with your `.env` files
4. Update environment: `yarn env:local`

## Best Practices

1. **Use descriptive `project_id` values** - Makes it easier to identify containers
2. **Document your port assignments** - Keep a note of which ports each project uses
3. **Use `yarn supabase:list` regularly** - Know what's running before starting new instances
4. **Stop unused instances** - Free up Docker resources
5. **Keep environment files in sync** - Ports in `config.toml` must match `.env` files

## How Config.toml is Used

The Supabase CLI automatically:
- ✅ Reads `supabase/config.toml` when you run commands from the project root
- ✅ Uses `project_id` to name Docker containers (e.g., `supabase_kingstack_db`)
- ✅ Applies port settings from the config file
- ✅ No need to specify config file path explicitly

**You don't need to do anything special** - just ensure `config.toml` exists in `supabase/` and run commands from the project root!

