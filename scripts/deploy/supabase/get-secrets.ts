#!/usr/bin/env bun

import type { ReadStream } from "node:tty";
import { emitKeypressEvents } from "node:readline";
import { createInterface, type Interface } from "node:readline/promises";
import { schema } from "../../../config/schema.js";
import {
  renderEnvironmentValues as renderConfigEnvironmentValues,
  updateEnvironmentValues as updateConfigEnvironmentValues,
  writeEnvironmentFile as writeConfigEnvironmentFile,
} from "../environment-file.js";
import {
  formatGetSecretsHelp,
  normalizePoolerRegion,
  parseGetSecretsCliArgs,
  type GetSecretsCliOptions,
} from "./get-secrets-options.js";
import { assertSupabaseCli, choose, promptText, runYarn } from "./provision.js";

export interface HostedProject {
  ref: string;
  name: string;
  region: string;
  status: string;
  linked: boolean;
}

export type SupabaseConfigValues = {
  SUPABASE_PROJECT_REF: string;
  SUPABASE_REGION: string;
  SUPABASE_PUBLISHABLE_KEY: string;
  SUPABASE_SECRET_KEY: string;
  SUPABASE_DB_PASSWORD: string;
};

interface ApiKeyRecord {
  apiKey: string;
  name: string;
}

interface Destination {
  kind: "file" | "print";
  environment?: string;
}

interface Keypress {
  name?: string;
  ctrl?: boolean;
  meta?: boolean;
}

export function parseProjects(value: string): HostedProject[] {
  const parsed = parseJson(value, "project");
  if (!Array.isArray(parsed)) {
    throw new Error("Supabase CLI returned an unexpected project response.");
  }

  const projects = parsed.flatMap((candidate): HostedProject[] => {
    if (!isRecord(candidate)) return [];
    const ref = stringValue(candidate.ref) || stringValue(candidate.id);
    const name = stringValue(candidate.name);
    const region = stringValue(candidate.region);
    if (!ref || !name || !region) return [];
    return [
      {
        ref,
        name,
        region,
        status: stringValue(candidate.status) || "UNKNOWN",
        linked: candidate.linked === true,
      },
    ];
  });

  if (projects.length === 0) {
    throw new Error("No accessible hosted Supabase projects were found.");
  }
  return projects;
}

export function parseModernApiKeys(
  value: string,
  requestedName?: string,
): { publishableKey: string; secretKey: string } {
  const parsed = parseJson(value, "API key");
  if (!Array.isArray(parsed)) {
    throw new Error("Supabase CLI returned an unexpected API key response.");
  }

  const keys = parsed.flatMap((candidate): ApiKeyRecord[] => {
    if (!isRecord(candidate)) return [];
    const apiKey = stringValue(candidate.api_key);
    if (!apiKey) return [];
    return [
      {
        apiKey,
        name: stringValue(candidate.name) || "unnamed",
      },
    ];
  });
  const modern = keys.filter(
    ({ apiKey }) =>
      apiKey.startsWith("sb_publishable_") || apiKey.startsWith("sb_secret_"),
  );

  if (modern.length === 0) {
    throw new Error(
      "This project has only legacy anon/service_role API keys. Create a modern publishable and secret key pair in Supabase Dashboard → Settings → API Keys, then rerun this command.",
    );
  }

  const pairNames = [...new Set(modern.map(({ name }) => name))].filter(
    (name) =>
      modern.some(
        ({ apiKey, name: candidateName }) =>
          candidateName === name && apiKey.startsWith("sb_publishable_"),
      ) &&
      modern.some(
        ({ apiKey, name: candidateName }) =>
          candidateName === name && apiKey.startsWith("sb_secret_"),
      ),
  );
  const selectedName = requestedName
    ? requestedName
    : pairNames.includes("default")
      ? "default"
      : pairNames.length === 1
        ? pairNames[0]
        : undefined;
  if (!selectedName || !pairNames.includes(selectedName)) {
    const available = pairNames.length > 0 ? pairNames.join(", ") : "none";
    throw new Error(
      `No complete modern API key pair named "${requestedName || "default"}" was found. Available pairs: ${available}. Create that pair in Supabase Dashboard or select one with --api-key-name.`,
    );
  }
  const candidates = modern.filter(({ name }) => name === selectedName);
  const publishable = selectKey(
    candidates.filter(({ apiKey }) => apiKey.startsWith("sb_publishable_")),
    "publishable",
    selectedName,
  );
  const secret = selectKey(
    candidates.filter(({ apiKey }) => apiKey.startsWith("sb_secret_")),
    "secret",
    selectedName,
  );

  return { publishableKey: publishable.apiKey, secretKey: secret.apiKey };
}

function selectKey(
  keys: ApiKeyRecord[],
  kind: "publishable" | "secret",
  requestedName: string,
): ApiKeyRecord {
  if (keys.length === 0) {
    throw new Error(
      `No modern ${kind} key named "${requestedName}" was found. Create that key in Supabase Dashboard or select another pair with --api-key-name.`,
    );
  }
  if (keys.length > 1) {
    throw new Error(
      `Multiple modern ${kind} keys named "${requestedName}" were found. Remove the duplicate or choose another pair with --api-key-name.`,
    );
  }
  return keys[0];
}

export function renderEnvironmentValues(values: SupabaseConfigValues): string {
  return renderConfigEnvironmentValues(
    values,
    "Environment-specific values populated from a hosted Supabase project.",
  );
}

export function updateEnvironmentValues(
  content: string,
  values: SupabaseConfigValues,
): string {
  return updateConfigEnvironmentValues(content, values);
}

async function getSecrets(options: GetSecretsCliOptions): Promise<void> {
  assertSupabaseCli();
  const interactive = Boolean(process.stdin.isTTY && process.stdout.isTTY);
  const interface_ = interactive
    ? createInterface({ input: process.stdin, output: process.stdout })
    : undefined;

  let project: HostedProject;
  let destination: Destination;
  let poolerRegion: string;
  try {
    project = await resolveProject(options, interface_);
    destination = await resolveDestination(options, interface_);
    assertHostedEnvironment(destination);
    const defaultPoolerRegion = normalizePoolerRegion(
      `aws-0-${project.region}`,
    );
    poolerRegion =
      options.poolerRegion ||
      (interface_
        ? normalizePoolerRegion(
            await promptText(
              interface_,
              "Pooler region from the Supabase Connect string",
              defaultPoolerRegion,
            ),
          )
        : defaultPoolerRegion);

    printImportPlan(project, destination, poolerRegion);
    await confirmImport(interface_, options.yes, destination);
  } finally {
    interface_?.close();
  }

  const apiKeys = getProjectApiKeys(project.ref, options.apiKeyName);
  const databasePassword = await resolveDatabasePassword(interactive);
  const values: SupabaseConfigValues = {
    SUPABASE_PROJECT_REF: project.ref,
    SUPABASE_REGION: poolerRegion,
    SUPABASE_PUBLISHABLE_KEY: apiKeys.publishableKey,
    SUPABASE_SECRET_KEY: apiKeys.secretKey,
    SUPABASE_DB_PASSWORD: databasePassword,
  };

  if (destination.kind === "print") {
    console.log();
    console.log(
      "Sensitive output follows. Do not paste it into source control or logs.",
    );
    console.log();
    console.log(renderEnvironmentValues(values));
    return;
  }

  const environment = destination.environment;
  if (!environment) throw new Error("Config environment is missing.");
  const relativePath = writeEnvironmentFile(environment, values);
  console.log();
  console.log(`Wrote the Supabase values to ${relativePath}.`);
  console.log("The secret key and database password were not printed.");
  console.log();
  console.log("Next:");
  console.log(
    `1. Validate runtime config: yarn king-config check ${environment}`,
  );
  console.log(`2. Generate service files: yarn env:${environment}`);
  console.log(
    `3. Before CI deployment, add its provider credentials to ${relativePath}.`,
  );
  console.log(
    `4. Validate provider readiness: yarn king-config sync --env ${environment} --dry-run`,
  );
  console.log(
    `5. After NEXT_HOST is configured, run: yarn supabase:auth:configure ${environment}`,
  );
}

function listProjects(): HostedProject[] {
  const output = runYarn(
    ["exec", "supabase", "projects", "list", "--output", "json"],
    {
      capture: true,
      display: "yarn exec supabase projects list --output json",
    },
  );
  return parseProjects(output);
}

async function resolveProject(
  options: GetSecretsCliOptions,
  interface_: Interface | undefined,
): Promise<HostedProject> {
  const projects = listProjects();
  if (options.projectRef) {
    const project = projects.find(({ ref }) => ref === options.projectRef);
    if (!project) {
      throw new Error(
        `Project ${options.projectRef} is not accessible through the current Supabase login.`,
      );
    }
    return project;
  }
  if (!interface_) {
    throw new Error("Non-interactive use requires --project-ref.");
  }

  const defaultIndex = Math.max(
    0,
    projects.findIndex(({ linked }) => linked),
  );
  return choose(
    interface_,
    "Choose the hosted Supabase project:",
    projects.map((project) => ({
      label: `${project.name} (${project.ref}, ${project.region}, ${project.status})`,
      value: project,
    })),
    defaultIndex,
  );
}

async function resolveDestination(
  options: GetSecretsCliOptions,
  interface_: Interface | undefined,
): Promise<Destination> {
  if (options.print) return { kind: "print" };
  if (options.environment) {
    return { kind: "file", environment: options.environment };
  }
  if (!interface_) {
    throw new Error(
      "Non-interactive use requires a config environment or --print.",
    );
  }

  const hostedEnvironments = Object.entries(schema.environments)
    .filter(([, definition]) => definition.mode === "hosted")
    .map(([environment]) => ({
      label: `Write config/${environment}.ts`,
      value: { kind: "file", environment } satisfies Destination,
    }));
  if (hostedEnvironments.length === 0) {
    throw new Error(
      "No hosted environments are declared in config/schema.ts. Add one before importing credentials.",
    );
  }
  return choose<Destination>(interface_, "Choose the credential destination:", [
    ...hostedEnvironments,
    {
      label: "Print a TypeScript values block (reveals secrets)",
      value: { kind: "print" } satisfies Destination,
    },
  ]);
}

function assertHostedEnvironment(destination: Destination): void {
  if (destination.kind !== "file" || !destination.environment) return;
  const environments: Readonly<Record<string, { mode: string }>> =
    schema.environments;
  const definition = environments[destination.environment];
  if (!definition) {
    throw new Error(
      `Environment "${destination.environment}" is not declared in config/schema.ts.`,
    );
  }
  if (definition.mode !== "hosted") {
    throw new Error(
      `Environment "${destination.environment}" is not a hosted environment.`,
    );
  }
}

function printImportPlan(
  project: HostedProject,
  destination: Destination,
  poolerRegion: string,
): void {
  console.log();
  console.log("KingStack Supabase credential import");
  console.log(`Project:       ${project.name} (${project.ref})`);
  console.log(`AWS region:    ${project.region}`);
  console.log(`Pooler region: ${poolerRegion}`);
  console.log(
    `Destination:   ${destination.kind === "print" ? "terminal (reveals secrets)" : `config/${destination.environment}.ts`}`,
  );
  if (project.status !== "ACTIVE_HEALTHY") {
    console.log(
      `Project state: ${project.status} (API keys may not be ready yet)`,
    );
  }
  console.log();
  console.log(
    "The importer retrieves modern API keys and asks for the database password without echoing it.",
  );
  console.log(
    "Verify the pooler region against the hostname shown in Supabase Dashboard → Connect.",
  );
}

async function confirmImport(
  interface_: Interface | undefined,
  yes: boolean,
  destination: Destination,
): Promise<void> {
  if (yes) return;
  if (!interface_) {
    throw new Error("Non-interactive credential import requires --yes.");
  }
  const action =
    destination.kind === "print"
      ? "Retrieve and print these credentials? [y/N] "
      : `Retrieve credentials and update config/${destination.environment}.ts? [y/N] `;
  const answer = (await interface_.question(action)).trim();
  if (!/^y(?:es)?$/i.test(answer)) throw new Error("Cancelled.");
}

function getProjectApiKeys(
  projectRef: string,
  apiKeyName?: string,
): { publishableKey: string; secretKey: string } {
  const args = [
    "exec",
    "supabase",
    "projects",
    "api-keys",
    "--project-ref",
    projectRef,
    "--reveal",
    "--output",
    "json",
  ];
  const output = runYarn(args, {
    capture: true,
    sensitive: true,
    display: `yarn exec supabase projects api-keys --project-ref ${projectRef} --reveal --output json`,
  });
  return parseModernApiKeys(output, apiKeyName);
}

async function resolveDatabasePassword(interactive: boolean): Promise<string> {
  const fromEnvironment = process.env.SUPABASE_DB_PASSWORD;
  if (fromEnvironment) return fromEnvironment;
  if (!interactive) {
    throw new Error(
      "Non-interactive credential import requires SUPABASE_DB_PASSWORD in the process environment.",
    );
  }
  const password = await promptSecret("Database password: ");
  if (!password) throw new Error("Database password cannot be empty.");
  return password;
}

export async function promptSecret(question: string): Promise<string> {
  const input = process.stdin as ReadStream;
  if (!input.isTTY || !process.stdout.isTTY || !input.setRawMode) {
    throw new Error(
      "A masked password prompt requires an interactive terminal.",
    );
  }

  emitKeypressEvents(input);
  const wasRaw = input.isRaw;
  const wasPaused = input.isPaused();
  process.stdout.write(question);
  input.setRawMode(true);
  input.resume();

  return new Promise<string>((resolvePassword, reject) => {
    let password = "";

    const cleanup = (): void => {
      input.off("keypress", onKeypress);
      input.setRawMode(Boolean(wasRaw));
      if (wasPaused) input.pause();
    };
    const finish = (): void => {
      process.stdout.write("\n");
      cleanup();
      resolvePassword(password);
    };
    const cancel = (): void => {
      process.stdout.write("\n");
      cleanup();
      reject(new Error("Cancelled."));
    };
    const onKeypress = (character: string, key: Keypress): void => {
      if (key.ctrl && (key.name === "c" || key.name === "d")) {
        cancel();
        return;
      }
      if (key.name === "return" || key.name === "enter") {
        finish();
        return;
      }
      if (key.name === "backspace") {
        if (password.length > 0) {
          const characters = Array.from(password);
          characters.pop();
          password = characters.join("");
          process.stdout.write("\b \b");
        }
        return;
      }
      if (!key.ctrl && !key.meta && character) {
        password += character;
        process.stdout.write("*".repeat(Array.from(character).length));
      }
    };

    input.on("keypress", onKeypress);
  });
}

function writeEnvironmentFile(
  environment: string,
  values: SupabaseConfigValues,
): string {
  return writeConfigEnvironmentFile(
    environment,
    values,
    "Environment-specific values populated from a hosted Supabase project.",
  );
}

function parseJson(value: string, kind: string): unknown {
  try {
    return JSON.parse(value) as unknown;
  } catch (error) {
    throw new Error(`Supabase CLI returned invalid ${kind} JSON.`, {
      cause: error,
    });
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value ? value : undefined;
}

async function main(): Promise<void> {
  const options = parseGetSecretsCliArgs(process.argv.slice(2));
  if (options.help) {
    console.log(formatGetSecretsHelp());
    return;
  }
  await getSecrets(options);
}

if (import.meta.main) {
  void main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error();
    console.error(`Supabase credential import stopped: ${message}`);
    process.exitCode = 1;
  });
}
