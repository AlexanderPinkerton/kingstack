# 📜 Scripts & Automation

KingStack uses **TypeScript scripts with Bun** to avoid common pitfalls with transpilation, linting, and script execution.

## Why Bun + TypeScript?

Traditional Node.js scripts often require:
- ❌ Transpilation setup (ts-node, tsx, etc.)
- ❌ Separate build steps
- ❌ Complex configuration
- ❌ Slow startup times

**Bun solves this** by natively executing TypeScript:
- ✅ No transpilation needed
- ✅ Fast execution
- ✅ Built-in TypeScript support
- ✅ Simple execution: `bun script.ts`

## Available Scripts

### Environment Management

```bash
# Swap to development environment
bun scripts/swap-env.ts development

# Swap to production environment
bun scripts/swap-env.ts production

# Setup playground mode
bun scripts/setup-playground.ts

# Check current environment
bun scripts/swap-env.ts --current
```

**Yarn shortcuts:**
```bash
yarn env:development
yarn env:production
yarn env:playground
yarn env:current
```

### Script Structure

All scripts are in the `scripts/` directory:

```
scripts/
├── swap-env.ts          # Environment file swapping
└── setup-playground.ts   # Playground mode setup
```

## Writing Scripts

### Basic Script Template

```typescript
#!/usr/bin/env bun
// Your script description

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

async function main() {
  // Your script logic here
  console.log('Script executed!');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

### Key Features

1. **Shebang** - `#!/usr/bin/env bun` allows direct execution
2. **TypeScript** - Full type safety and IntelliSense
3. **Async/Await** - Modern async patterns
4. **Error Handling** - Proper error catching and exit codes

### Example: Environment Swapper

```typescript
// swap-env.ts
import { existsSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";

const ENVIRONMENTS = ["development", "production", "playground"];

async function main() {
  const envArg = process.argv[2];
  
  if (!ENVIRONMENTS.includes(envArg)) {
    console.error(`Unknown environment: ${envArg}`);
    process.exit(1);
  }

  // Swap logic here...
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

## Benefits

✅ **No Build Step** - Run TypeScript directly  
✅ **Fast** - Bun's native execution is fast  
✅ **Type Safe** - Full TypeScript support  
✅ **Simple** - Just `bun script.ts`  
✅ **Reliable** - No transpilation errors  

## Adding New Scripts

1. Create script in `scripts/` directory:
   ```bash
   touch scripts/my-script.ts
   ```

2. Add shebang and implement:
   ```typescript
   #!/usr/bin/env bun
   // My script
   ```

3. Make executable (optional):
   ```bash
   chmod +x scripts/my-script.ts
   ```

4. Run directly:
   ```bash
   bun scripts/my-script.ts
   ```

5. (Optional) Add yarn shortcut in root `package.json`:
   ```json
   {
     "scripts": {
       "my-script": "bun scripts/my-script.ts"
     }
   }
   ```

## Common Patterns

### File Operations

```typescript
import { readFileSync, writeFileSync, existsSync } from 'fs';

if (existsSync('file.txt')) {
  const content = readFileSync('file.txt', 'utf8');
  writeFileSync('file.txt', 'new content');
}
```

### Environment Variables

```typescript
const env = process.env.NODE_ENV || 'development';
const apiUrl = process.env.API_URL;
```

### Path Handling

```typescript
import { join, dirname } from 'path';

const filePath = join('apps', 'next', '.env');
const dir = dirname(filePath);
```

### Command Line Arguments

```typescript
const args = process.argv.slice(2);
const firstArg = args[0];
```

## Best Practices

1. **Use TypeScript** - Leverage type safety
2. **Handle Errors** - Always catch and handle errors
3. **Exit Codes** - Use proper exit codes (0 = success, 1 = error)
4. **Logging** - Use console.log/error for output
5. **Shebang** - Include `#!/usr/bin/env bun` for direct execution
6. **Documentation** - Add comments explaining what scripts do

## NestJS Scripts

NestJS-specific scripts live in `apps/nest/src/scripts/`:

```bash
# Example: Backfill user data
bun run apps/nest/src/scripts/backfill-user-data.ts
```

These scripts have access to:
- Prisma client
- NestJS modules
- Full application context

## Troubleshooting

### Script Not Found
- Ensure script is in `scripts/` directory
- Check file permissions
- Verify Bun is installed: `bun --version`

### Type Errors
- Ensure TypeScript is properly configured
- Check imports are correct
- Verify file paths are valid

### Execution Errors
- Check error messages for clues
- Verify required files exist
- Ensure environment variables are set

