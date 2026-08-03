import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { resolveConfig, validateSchemaMappings } from "../core";
import { renderEnvFile, renderTomlFile } from "../render";
import { loadUserSchema, loadUserValues } from "./utils";

interface OutputPlan {
  content: string;
  destination: string;
  relativePath: string;
  temporaryPath: string;
}

export async function generateCommand(
  environment: string,
  options: { cwd?: string },
): Promise<boolean> {
  const cwd = options.cwd ? resolve(options.cwd) : process.cwd();
  console.log(
    `🔧 Generating configuration for environment: ${environment} (in ${cwd})\n`,
  );

  const schema = await loadUserSchema(cwd);
  const values = await loadUserValues(environment, cwd);
  const { config, errors } = resolveConfig(schema, values, { environment });

  if (errors.length > 0) {
    printErrors("Validation errors", errors);
    return false;
  }

  const mappingErrors = validateSchemaMappings(
    schema,
    new Set(Object.keys(config.all)),
  );
  if (mappingErrors.length > 0) {
    printErrors("Output mapping errors", mappingErrors);
    return false;
  }

  const plans: OutputPlan[] = [];
  for (const definition of Object.values(schema.envfiles)) {
    plans.push(
      createPlan(
        cwd,
        definition.path,
        renderEnvFile(environment, config.all, definition),
      ),
    );
  }

  for (const definition of Object.values(schema.configs ?? {})) {
    const destination = resolveOutputPath(cwd, definition.path);
    if (!existsSync(destination)) {
      console.log(`⚠️  Skipping ${definition.path} (file does not exist)`);
      continue;
    }
    const currentContent = readFileSync(destination, "utf8");
    plans.push(
      createPlan(
        cwd,
        definition.path,
        renderTomlFile(currentContent, config.all, definition),
      ),
    );
  }

  stagePlans(plans);
  try {
    commitPlans(plans);
  } catch (error: unknown) {
    cleanupPlans(plans);
    throw error;
  }

  for (const plan of plans) console.log(`✅ Generated ${plan.relativePath}`);
  console.log(
    `\n🎉 Successfully generated configuration for ${environment} environment!`,
  );
  return true;
}

function createPlan(
  cwd: string,
  relativePath: string,
  content: string,
): OutputPlan {
  const destination = resolveOutputPath(cwd, relativePath);
  return {
    content,
    destination,
    relativePath,
    temporaryPath: `${destination}.king-config-${process.pid}.tmp`,
  };
}

function resolveOutputPath(cwd: string, configuredPath: string): string {
  const destination = resolve(cwd, configuredPath);
  const pathFromRoot = relative(cwd, destination);
  if (
    isAbsolute(configuredPath) ||
    pathFromRoot === ".." ||
    pathFromRoot.startsWith(`..${sep}`)
  ) {
    throw new Error(
      `Output path must stay inside the project: ${configuredPath}`,
    );
  }
  return destination;
}

function stagePlans(plans: OutputPlan[]): void {
  try {
    for (const plan of plans) {
      mkdirSync(dirname(plan.destination), { recursive: true });
      writeFileSync(plan.temporaryPath, plan.content, { flag: "wx" });
    }
  } catch (error: unknown) {
    cleanupPlans(plans);
    throw error;
  }
}

function commitPlans(plans: OutputPlan[]): void {
  for (const plan of plans) {
    if (existsSync(plan.destination)) {
      renameSync(plan.destination, `${plan.destination}.previous`);
    }
    renameSync(plan.temporaryPath, plan.destination);
  }
}

function cleanupPlans(plans: OutputPlan[]): void {
  for (const plan of plans) {
    if (existsSync(plan.temporaryPath)) unlinkSync(plan.temporaryPath);
  }
}

function printErrors(
  heading: string,
  errors: Array<{ key: string; message: string }>,
): void {
  console.error(`❌ ${heading}:`);
  for (const error of errors) {
    console.error(`  - ${error.key}: ${error.message}`);
  }
}
