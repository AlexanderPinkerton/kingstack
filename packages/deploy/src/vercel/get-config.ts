import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createInterface, type Interface } from "node:readline/promises";
import {
  loadUserSchema,
  renderEnvironmentValues,
  writeEnvironmentFile,
  type ConfigSchema,
} from "@kingstack/config";
import {
  formatGetVercelConfigHelp,
  parseGetVercelConfigCliArgs,
  type GetVercelConfigCliOptions,
} from "./get-config-options.js";
import type { KingStackProject } from "../project.js";

export interface VercelProjectLink {
  projectId: string;
  orgId: string;
  projectName?: string;
}

export interface VercelProjectDomain {
  name: string;
  verified: boolean;
  redirect?: string;
  gitBranch?: string;
  customEnvironmentId?: string;
}

export type VercelConfigValues = {
  NEXT_HOST: string;
  VERCEL_ORG_ID: string;
  VERCEL_PROJECT_ID: string;
};

export interface VercelConfigResult {
  projectId: string;
  organizationId: string;
  host: string;
  environment?: string;
  configChanged: boolean;
}

interface Destination {
  kind: "file" | "print";
  environment?: string;
}

interface Choice<T> {
  label: string;
  value: T;
}

const VALUES_DESCRIPTION =
  "Environment-specific values populated from a linked Vercel project.";

export function parseProjectLink(value: string): VercelProjectLink {
  const parsed = parseJson(value, "project link");
  if (!isRecord(parsed)) {
    throw new Error(".vercel/project.json has an unexpected shape.");
  }
  const projectId = stringValue(parsed.projectId);
  const orgId = stringValue(parsed.orgId);
  if (!projectId || !orgId) {
    throw new Error(
      ".vercel/project.json must contain non-empty projectId and orgId values.",
    );
  }
  return {
    projectId,
    orgId,
    projectName: stringValue(parsed.projectName),
  };
}

export function parseProjectDomains(value: string): VercelProjectDomain[] {
  const parsed = parseJson(value, "project domain");
  if (!isRecord(parsed) || !Array.isArray(parsed.domains)) {
    throw new Error(
      "Vercel CLI returned an unexpected project domain response.",
    );
  }

  return parsed.domains.flatMap((candidate): VercelProjectDomain[] => {
    if (!isRecord(candidate)) return [];
    const name = stringValue(candidate.name);
    if (!name || typeof candidate.verified !== "boolean") return [];
    return [
      {
        name: name.toLowerCase(),
        verified: candidate.verified,
        redirect: stringValue(candidate.redirect),
        gitBranch: stringValue(candidate.gitBranch),
        customEnvironmentId: stringValue(candidate.customEnvironmentId),
      },
    ];
  });
}

export function productionDomains(
  domains: readonly VercelProjectDomain[],
): VercelProjectDomain[] {
  return domains
    .filter(
      ({ verified, gitBranch, customEnvironmentId }) =>
        verified && !gitBranch && !customEnvironmentId,
    )
    .sort((left, right) => {
      const score = domainPreferenceScore(left) - domainPreferenceScore(right);
      return score || left.name.localeCompare(right.name);
    });
}

export function selectRequestedDomain(
  domains: readonly VercelProjectDomain[],
  requestedHost: string,
): VercelProjectDomain {
  const selected = domains.find(({ name }) => name === requestedHost);
  if (!selected) {
    throw new Error(
      `Hostname "${requestedHost}" is not a verified production domain for the linked Vercel project. Available domains: ${domains.map(({ name }) => name).join(", ") || "none"}.`,
    );
  }
  return selected;
}

export async function getConfig(
  options: GetVercelConfigCliOptions,
  projectContext: KingStackProject,
): Promise<VercelConfigResult> {
  assertVercelCli(projectContext.root);
  const schema = await loadUserSchema(projectContext.root);
  const project = readProjectLink(projectContext.root);
  const domains = listProjectDomains(project, projectContext.root);
  const candidates = productionDomains(domains);
  if (candidates.length === 0) {
    throw new Error(
      "The linked Vercel project has no verified production domain. Deploy it to production or add and verify a project domain, then retry.",
    );
  }

  const interactive = Boolean(process.stdin.isTTY && process.stdout.isTTY);
  const interface_ = interactive
    ? createInterface({ input: process.stdin, output: process.stdout })
    : undefined;

  let destination: Destination;
  let domain: VercelProjectDomain;
  try {
    destination = await resolveDestination(options, interface_, schema);
    assertHostedEnvironment(destination, schema);
    domain = await resolveDomain(options, candidates, interface_);
    printImportPlan(project, domain, destination);
    await confirmImport(interface_, options.yes, destination);
  } finally {
    interface_?.close();
  }

  const values: VercelConfigValues = {
    NEXT_HOST: domain.name,
    VERCEL_ORG_ID: project.orgId,
    VERCEL_PROJECT_ID: project.projectId,
  };

  if (destination.kind === "print") {
    console.log();
    console.log(renderEnvironmentValues(values, VALUES_DESCRIPTION));
    return {
      projectId: project.projectId,
      organizationId: project.orgId,
      host: domain.name,
      configChanged: false,
    };
  }

  const environment = destination.environment;
  if (!environment) throw new Error("Config environment is missing.");
  const relativePath = writeEnvironmentFile(
    environment,
    values,
    VALUES_DESCRIPTION,
    { cwd: projectContext.root },
  );
  console.log();
  console.log(`Wrote the Vercel project values to ${relativePath}.`);
  console.log("Existing Supabase and application values were preserved.");
  console.log(
    "VERCEL_TOKEN was not changed; Vercel cannot return a token after it is created.",
  );
  console.log();
  console.log("Next:");
  console.log(`1. Validate config: yarn king-config check ${environment}`);
  console.log(`2. Generate service files: yarn env:${environment}`);
  console.log(
    `3. Preview outbound provider sync: yarn king-config sync --env ${environment} --dry-run`,
  );
  console.log(
    `4. Configure hosted Auth redirects: yarn supabase:auth:configure ${environment}`,
  );
  return {
    projectId: project.projectId,
    organizationId: project.orgId,
    host: domain.name,
    environment,
    configChanged: true,
  };
}

function assertVercelCli(projectRoot: string): void {
  let version: string;
  try {
    version = runVercel(["--version"], {
      cwd: projectRoot,
      quiet: true,
    });
  } catch {
    throw new Error(
      "Vercel CLI is unavailable. Run `yarn install` from the repository root.",
    );
  }
  if (!isSupportedVercelCliVersion(version)) {
    throw new Error(
      `Vercel CLI >=58.1.0 <59 is required for the project API command; found ${version || "an unknown version"}. Run \`yarn install\` from the repository root.`,
    );
  }
}

export function isSupportedVercelCliVersion(value: string): boolean {
  const match = /(?:^|\s)(\d+)\.(\d+)\.(\d+)(?:\s|$)/.exec(value.trim());
  if (!match) return false;
  const major = Number(match[1]);
  const minor = Number(match[2]);
  const patch = Number(match[3]);
  return major === 58 && (minor > 1 || (minor === 1 && patch >= 0));
}

function readProjectLink(projectRoot: string): VercelProjectLink {
  const path = resolve(projectRoot, ".vercel/project.json");
  if (!existsSync(path)) {
    throw new Error(
      "No linked Vercel project was found at .vercel/project.json. Run `yarn vercel` or `yarn exec vercel link` first.",
    );
  }
  return parseProjectLink(readFileSync(path, "utf8"));
}

function listProjectDomains(
  project: VercelProjectLink,
  projectRoot: string,
): VercelProjectDomain[] {
  const endpoint = `/v9/projects/${encodeURIComponent(project.projectId)}/domains?teamId=${encodeURIComponent(project.orgId)}&limit=100`;
  let output: string;
  try {
    output = runVercel(["api", endpoint, "--raw", "--non-interactive"], {
      cwd: projectRoot,
      display: "yarn exec vercel api <linked-project-domains> --raw",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Could not retrieve Vercel project domains. Run \`yarn exec vercel login\` and confirm the linked project is accessible.\n${message}`,
      { cause: error },
    );
  }
  return parseProjectDomains(output);
}

async function resolveDestination(
  options: GetVercelConfigCliOptions,
  interface_: Interface | undefined,
  schema: ConfigSchema,
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

  const hostedEnvironments = Object.entries(schema.environments ?? {})
    .filter(([, definition]) => definition.mode === "hosted")
    .map(([environment]) => ({
      label: `Write config/${environment}.ts`,
      value: { kind: "file", environment } satisfies Destination,
    }));
  if (hostedEnvironments.length === 0) {
    throw new Error(
      "No hosted environments are declared in config/schema.ts. Add one before importing Vercel configuration.",
    );
  }
  const productionIndex = Math.max(
    0,
    hostedEnvironments.findIndex(
      ({ value }) => value.environment === "production",
    ),
  );
  return choose<Destination>(
    interface_,
    "Choose the Vercel configuration destination:",
    [
      ...hostedEnvironments,
      {
        label: "Print a TypeScript values block",
        value: { kind: "print" } satisfies Destination,
      },
    ],
    productionIndex,
  );
}

function assertHostedEnvironment(
  destination: Destination,
  schema: ConfigSchema,
): void {
  if (destination.kind !== "file" || !destination.environment) return;
  const environments: Readonly<Record<string, { mode: string }>> =
    schema.environments ?? {};
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

async function resolveDomain(
  options: GetVercelConfigCliOptions,
  domains: VercelProjectDomain[],
  interface_: Interface | undefined,
): Promise<VercelProjectDomain> {
  if (options.host) return selectRequestedDomain(domains, options.host);
  if (!interface_ || domains.length === 1) return domains[0];
  return choose(
    interface_,
    "Choose the production hostname for NEXT_HOST:",
    domains.map((domain) => ({
      label: domainLabel(domain),
      value: domain,
    })),
  );
}

function printImportPlan(
  project: VercelProjectLink,
  domain: VercelProjectDomain,
  destination: Destination,
): void {
  console.log();
  console.log("KingStack Vercel configuration import");
  console.log(
    `Project:     ${project.projectName ? `${project.projectName} ` : ""}(${project.projectId})`,
  );
  console.log(`Organization: ${project.orgId}`);
  console.log(`NEXT_HOST:   ${domain.name}`);
  console.log(
    `Destination: ${destination.kind === "print" ? "terminal" : `config/${destination.environment}.ts`}`,
  );
  console.log();
  console.log(
    "This imports deployment-owned metadata only. Existing config values and VERCEL_TOKEN remain unchanged.",
  );
}

async function confirmImport(
  interface_: Interface | undefined,
  yes: boolean,
  destination: Destination,
): Promise<void> {
  if (yes) return;
  if (!interface_) {
    throw new Error(
      "Non-interactive Vercel configuration import requires --yes.",
    );
  }
  const action =
    destination.kind === "print"
      ? "Print these Vercel project values? [y/N] "
      : `Update config/${destination.environment}.ts with these Vercel project values? [y/N] `;
  const answer = (await interface_.question(action)).trim();
  if (!/^y(?:es)?$/i.test(answer)) throw new Error("Cancelled.");
}

async function choose<T>(
  interface_: Interface,
  question: string,
  choices: readonly Choice<T>[],
  defaultIndex = 0,
): Promise<T> {
  console.log();
  console.log(question);
  choices.forEach((choice, index) => {
    console.log(`  ${index + 1}. ${choice.label}`);
  });
  const answer = (
    await interface_.question(`Select [${defaultIndex + 1}]: `)
  ).trim();
  const selectedIndex = answer === "" ? defaultIndex : Number(answer) - 1;
  if (!Number.isInteger(selectedIndex) || !choices[selectedIndex]) {
    throw new Error(`Enter a number from 1 to ${choices.length}.`);
  }
  return choices[selectedIndex].value;
}

function domainPreferenceScore(domain: VercelProjectDomain): number {
  let score = 0;
  if (domain.name.startsWith("www.")) score += 1;
  if (domain.name.endsWith(".vercel.app")) score += 2;
  if (domain.redirect) score += 4;
  return score;
}

function domainLabel(domain: VercelProjectDomain): string {
  const source = domain.name.endsWith(".vercel.app")
    ? "Vercel domain"
    : "custom domain";
  const redirect = domain.redirect ? `; redirects to ${domain.redirect}` : "";
  return `${domain.name} (${source}${redirect})`;
}

function runVercel(
  args: string[],
  options: { cwd: string; display?: string; quiet?: boolean },
): string {
  if (!options.quiet) {
    console.log(`> ${options.display || `yarn exec vercel ${args.join(" ")}`}`);
  }
  const result = spawnSync("yarn", ["exec", "vercel", ...args], {
    cwd: options.cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: 10 * 1024 * 1024,
  });
  if (result.error) {
    throw new Error(`Could not run yarn: ${result.error.message}`, {
      cause: result.error,
    });
  }
  if (result.status !== 0) {
    const details = [result.stdout, result.stderr]
      .filter((value): value is string => Boolean(value))
      .join("\n")
      .trim();
    throw new Error(
      `${options.display || `yarn exec vercel ${args.join(" ")}`} exited with status ${result.status ?? "unknown"}.${details ? `\n${details}` : ""}`,
    );
  }
  return typeof result.stdout === "string" ? result.stdout.trim() : "";
}

function parseJson(value: string, kind: string): unknown {
  try {
    return JSON.parse(value) as unknown;
  } catch (error) {
    throw new Error(`Vercel CLI returned invalid ${kind} JSON.`, {
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

export async function runVercelPullCli(
  args: string[],
  project: KingStackProject,
): Promise<void> {
  const options = parseGetVercelConfigCliArgs(args);
  if (options.help) {
    console.log(formatGetVercelConfigHelp());
    return;
  }
  await getConfig(options, project);
}
