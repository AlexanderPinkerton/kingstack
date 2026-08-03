import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

export function initSchemaCommand(options: { cwd?: string }): boolean {
  const cwd = options.cwd ? resolve(options.cwd) : process.cwd();
  const schemaPath = resolve(cwd, "config/schema.ts");
  const examplePath = resolve(cwd, "config/example.ts");
  const existing = [schemaPath, examplePath].filter(existsSync);

  if (existing.length > 0) {
    console.error("❌ Refusing to overwrite existing configuration files:");
    for (const path of existing) console.error(`  - ${path}`);
    return false;
  }

  mkdirSync(resolve(cwd, "config"), { recursive: true });
  writeFileSync(schemaPath, SCHEMA_TEMPLATE, { flag: "wx" });
  writeFileSync(examplePath, EXAMPLE_TEMPLATE, { flag: "wx" });

  console.log("✅ Created config/schema.ts");
  console.log("✅ Created config/example.ts");
  console.log("\nNext:");
  console.log("  bun king-config env init local");
  console.log("  bun king-config check local");
  console.log("  bun king-config generate local");
  return true;
}

const SCHEMA_TEMPLATE = `import {
  defineSchema,
  EnvironmentMode,
  type ConfigValuesFor,
} from "@kingstack/config";

function validatePort(value: string): string | undefined {
  const port = Number(value);
  return Number.isInteger(port) && port >= 1 && port <= 65_535
    ? undefined
    : "Expected a port between 1 and 65535";
}

export const schema = defineSchema({
  environments: {
    local: {
      mode: EnvironmentMode.Local,
      sync: false,
      description: "Local development",
    },
    production: {
      mode: EnvironmentMode.Hosted,
      sync: false,
      description: "Hosted production",
    },
  },

  core: {
    APP_PORT: {
      default: "3000",
      description: "Application port",
      validate: validatePort,
    },
    APP_HOST: {
      requiredWhen: ({ mode }) => mode === EnvironmentMode.Hosted,
      description: "Public application hostname",
    },
  },

  computed: (core, environment) => ({
    APP_ENVIRONMENT: environment.environment,
    APP_ORIGIN:
      environment.mode === EnvironmentMode.Local
        ? \`http://localhost:\${core.APP_PORT}\`
        : \`https://\${core.APP_HOST}\`,
  }),

  envfiles: {
    app: {
      path: ".env",
      keys: ["APP_ENVIRONMENT", "APP_ORIGIN"],
      aliases: { APP_PORT: "PORT" },
    },
  },
});

export type ConfigValues = ConfigValuesFor<typeof schema>;
`;

const EXAMPLE_TEMPLATE = `import { defineValues } from "@kingstack/config";
import type { ConfigValues } from "./schema.js";

/** Copy to config/local.ts or another declared environment. */
export const values = defineValues({
  APP_PORT: "3000",
  APP_HOST: "example.com",
} satisfies ConfigValues);
`;
