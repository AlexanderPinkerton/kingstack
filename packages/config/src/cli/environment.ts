import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { getResolveContext, type ConfigSchema } from "../core";
import {
  assertEnvironmentName,
  listEnvironmentNames,
  loadUserSchema,
  valuesFileExists,
} from "./utils";

export async function listEnvironmentsCommand(options: {
  cwd?: string;
}): Promise<boolean> {
  const cwd = options.cwd ? resolve(options.cwd) : process.cwd();
  const schema = await loadUserSchema(cwd);
  const names = listEnvironmentNames(schema, cwd);

  if (names.length === 0) {
    console.log("No environments are declared or discovered.");
    return true;
  }

  console.log("Environment  Mode       Sync  Values file");
  console.log("-----------  ---------  ----  -----------");
  for (const name of names) {
    const definition = schema.environments?.[name];
    const mode = definition?.mode ?? "undeclared";
    const sync = definition ? (definition.sync ? "yes" : "no") : "—";
    const file = valuesFileExists(name, cwd) ? "present" : "missing";
    console.log(
      `${name.padEnd(11)}  ${mode.padEnd(9)}  ${sync.padEnd(4)}  ${file}`,
    );
  }
  return true;
}

export async function initEnvironmentCommand(
  environment: string,
  options: { cwd?: string },
): Promise<boolean> {
  assertEnvironmentName(environment);
  const cwd = options.cwd ? resolve(options.cwd) : process.cwd();
  const schema = await loadUserSchema(cwd);

  if (valuesFileExists(environment, cwd)) {
    console.error(`❌ config/${environment}.ts already exists`);
    return false;
  }
  if (schema.environments && !schema.environments[environment]) {
    console.error(
      `❌ Declare "${environment}" in schema.environments before creating its values file.`,
    );
    console.error(`   Example: ${environment}: { mode: "hosted", sync: true }`);
    return false;
  }

  const content = renderEnvironmentSkeleton(schema, environment);
  const path = resolve(cwd, `config/${environment}.ts`);
  writeFileSync(path, content, { flag: "wx" });
  console.log(`✅ Created config/${environment}.ts`);
  console.log(
    `   Fill the required values, then run: king-config check ${environment}`,
  );
  return true;
}

function renderEnvironmentSkeleton(
  schema: ConfigSchema,
  environment: string,
): string {
  const { context } = getResolveContext(schema, environment);
  const lines = [
    'import { defineValues } from "@kingstack/config";',
    'import type { ConfigValuesFor } from "@kingstack/config";',
    'import type { schema } from "./schema.js";',
    "",
    `/** Values specific to the ${environment} environment. */`,
    "export const values = defineValues({",
  ];

  for (const [key, definition] of Object.entries(schema.core)) {
    let required = definition.required === true;
    try {
      required = definition.requiredWhen?.(context) === true || required;
    } catch {
      required = true;
    }
    if (!required || definition.default !== undefined) continue;

    if (definition.description) lines.push(`  // ${definition.description}`);
    lines.push(`  ${key}: "",`);
  }

  lines.push("} satisfies ConfigValuesFor<typeof schema>);", "");
  return lines.join("\n");
}
