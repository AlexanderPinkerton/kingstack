#!/usr/bin/env bun

import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createInterface } from "node:readline/promises";
import { setTimeout as delay } from "node:timers/promises";

const BOOTSTRAP_VERSION = "0.0.0";
const BOOTSTRAP_TAG = "bootstrap";
const NPM_CLI_VERSION = "11.18.0";
const NPM_REGISTRY = "https://registry.npmjs.org";
const TRUST_REPOSITORY = "AlexanderPinkerton/kingstack";
const TRUST_WORKFLOW = "release-changeset.yml";
const TRUST_PUBLISH_PERMISSION = "createPackage";
const NPM_AUTH_TIMEOUT_MS = 5 * 60 * 1000;
const NPM_AUTH_POLL_MS = 1000;

interface NpmWebAuthChallenge {
  authUrl: string;
  doneUrl: string;
}

const DEPENDENCY_FIELDS = [
  "dependencies",
  "devDependencies",
  "optionalDependencies",
  "peerDependencies",
] as const;
const LOCAL_DEPENDENCY_PROTOCOLS = ["file:", "link:", "portal:", "workspace:"];

export interface BootstrapCliOptions {
  dryRun: boolean;
  help: boolean;
  packageName?: string;
  yes: boolean;
}

export interface PackageManifest {
  name?: string;
  private?: boolean;
  publishConfig?: { access?: string };
  repository?: string | { directory?: string; type?: string; url?: string };
  scripts?: Record<string, string>;
  version?: string;
  [field: string]: unknown;
}

export interface ValidatedWorkspace {
  directory: string;
  manifest: PackageManifest & { name: string; version: string };
}

export interface TrustConfiguration {
  environment?: string;
  file?: string;
  id?: string;
  package?: string;
  permissions?: string[];
  repository?: string;
  type?: string;
}

export type ChangesetReleaseType = "major" | "minor" | "patch";

interface CommandResult {
  stderr: string;
  stdout: string;
  status: number;
}

export function parseBootstrapArgs(args: string[]): BootstrapCliOptions {
  const options: BootstrapCliOptions = {
    dryRun: false,
    help: false,
    yes: false,
  };

  for (const argument of args) {
    if (argument === "--dry-run") {
      options.dryRun = true;
    } else if (argument === "--yes") {
      options.yes = true;
    } else if (argument === "--help" || argument === "-h") {
      options.help = true;
    } else if (argument.startsWith("-")) {
      throw new Error(`Unknown option: ${argument}`);
    } else if (options.packageName) {
      throw new Error(`Unexpected argument: ${argument}`);
    } else {
      options.packageName = argument;
    }
  }

  return options;
}

export function repositorySlug(
  repository: PackageManifest["repository"],
): string | undefined {
  const repositoryUrl =
    typeof repository === "string" ? repository : repository?.url;
  if (!repositoryUrl) return undefined;

  const match = /github\.com(?::|\/)([^/]+)\/([^/]+?)(?:\.git)?$/.exec(
    repositoryUrl,
  );
  return match ? `${match[1]}/${match[2]}` : undefined;
}

export function validateWorkspaceManifest(
  manifest: PackageManifest,
  requestedName: string,
  directory: string,
): ValidatedWorkspace {
  if (manifest.name !== requestedName) {
    throw new Error(
      `Workspace manifest name mismatch: expected ${requestedName}, received ${manifest.name ?? "no name"}.`,
    );
  }
  if (!/^@kingstack\/[a-z0-9][a-z0-9._-]*$/.test(requestedName)) {
    throw new Error(
      `Only literal @kingstack/* package names can be bootstrapped; received ${requestedName}.`,
    );
  }
  if (manifest.private === true) {
    throw new Error(`${requestedName} is private and cannot be published.`);
  }
  if (manifest.publishConfig?.access !== "public") {
    throw new Error(
      `${requestedName} must declare publishConfig.access as public.`,
    );
  }
  if (
    typeof manifest.version !== "string" ||
    !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?$/.test(
      manifest.version,
    )
  ) {
    throw new Error(`${requestedName} must declare a valid semantic version.`);
  }
  if (repositorySlug(manifest.repository) !== TRUST_REPOSITORY) {
    throw new Error(
      `${requestedName} must point its repository at ${TRUST_REPOSITORY}.`,
    );
  }
  if (!manifest.scripts?.build) {
    throw new Error(`${requestedName} must declare a build script.`);
  }

  return {
    directory,
    manifest: manifest as PackageManifest & { name: string; version: string },
  };
}

export function validatePackedManifest(
  manifest: PackageManifest,
  expectedName: string,
  expectedVersion: string,
): void {
  if (manifest.name !== expectedName || manifest.version !== expectedVersion) {
    throw new Error(
      `Packed manifest identity mismatch: expected ${expectedName}@${expectedVersion}, received ${manifest.name ?? "no name"}@${manifest.version ?? "no version"}.`,
    );
  }

  for (const field of DEPENDENCY_FIELDS) {
    const dependencies = manifest[field];
    if (!isStringRecord(dependencies)) continue;

    for (const [dependency, range] of Object.entries(dependencies)) {
      const protocol = LOCAL_DEPENDENCY_PROTOCOLS.find((candidate) =>
        range.startsWith(candidate),
      );
      if (protocol) {
        throw new Error(
          `Packed ${field}.${dependency} uses the local-only ${protocol} protocol.`,
        );
      }
    }
  }
}

export function parseTrustConfiguration(
  output: string,
): TrustConfiguration | undefined {
  const trimmed = output.trim();
  if (!trimmed) return undefined;

  const jsonStart = trimmed.indexOf("{");
  const jsonEnd = trimmed.lastIndexOf("}");
  if (jsonStart === -1 || jsonEnd < jsonStart) {
    throw new Error("npm trust list returned an unreadable response.");
  }

  const parsed = JSON.parse(trimmed.slice(jsonStart, jsonEnd + 1)) as unknown;
  if (!isObject(parsed)) {
    throw new Error("npm trust list returned an invalid response.");
  }
  return parsed;
}

export function hasExpectedTrust(configuration: TrustConfiguration): boolean {
  const permissions = configuration.permissions;
  const allowsPublishing =
    permissions === undefined || permissions.includes(TRUST_PUBLISH_PERMISSION);

  return (
    configuration.type === "github" &&
    configuration.repository === TRUST_REPOSITORY &&
    configuration.file === TRUST_WORKFLOW &&
    configuration.environment === undefined &&
    allowsPublishing
  );
}

export function parseNpmWebAuthChallenge(
  output: string,
): NpmWebAuthChallenge | undefined {
  let parsed: unknown;
  try {
    parsed = JSON.parse(output);
  } catch {
    return undefined;
  }
  if (!isObject(parsed) || !isObject(parsed.error)) return undefined;
  const error = parsed.error;
  if (error.code !== "EOTP") return undefined;
  if (typeof error.authUrl !== "string" || typeof error.doneUrl !== "string") {
    return undefined;
  }

  const authUrl = new URL(error.authUrl);
  const doneUrl = new URL(error.doneUrl);
  if (
    authUrl.origin !== "https://www.npmjs.com" ||
    !authUrl.pathname.startsWith("/auth/cli/") ||
    doneUrl.origin !== NPM_REGISTRY ||
    doneUrl.pathname !== "/-/v1/done" ||
    authUrl.username ||
    authUrl.password ||
    doneUrl.username ||
    doneUrl.password
  ) {
    throw new Error("npm returned an unexpected browser authentication URL.");
  }
  return { authUrl: authUrl.href, doneUrl: doneUrl.href };
}

export async function waitForNpmWebAuth(
  challenge: NpmWebAuthChallenge,
  request: (url: string, init: RequestInit) => Promise<Response> = fetch,
  signal = AbortSignal.timeout(NPM_AUTH_TIMEOUT_MS),
): Promise<string> {
  // npm-profile uses the same 202/retry-after protocol. This token is an OTP,
  // not a persistent login credential; never print it or save it to npm config.
  while (true) {
    signal.throwIfAborted();
    const response = await request(challenge.doneUrl, {
      signal,
      redirect: "error",
      headers: { "cache-control": "no-store" },
    });
    if (response.status === 200) {
      const body: unknown = await response.json();
      if (isObject(body) && typeof body.token === "string" && body.token) {
        return body.token;
      }
      throw new Error("npm authentication returned no one-time password.");
    }
    if (response.status !== 202) {
      throw new Error(
        `npm authentication failed (HTTP ${response.status}); rerun bootstrap for a fresh link.`,
      );
    }
    await response.body?.cancel();
    let pollMs = Number(response.headers.get("retry-after")) * 1000;
    if (!Number.isFinite(pollMs) || pollMs <= 0) pollMs = NPM_AUTH_POLL_MS;
    await delay(pollMs, undefined, { signal });
  }
}

export function verificationScripts(manifest: PackageManifest): string[] {
  const scripts: string[] = [];
  for (const script of [
    "lint",
    "typecheck",
    "test",
    "build",
    "test:package",
    "test:pack",
  ]) {
    if (manifest.scripts?.[script]) {
      scripts.push(script);
    }
  }
  return scripts;
}

export function pendingChangesetRelease(
  changesets: string[],
  packageName: string,
): ChangesetReleaseType | undefined {
  const escapedName = packageName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const declaration = new RegExp(
    `^["']?${escapedName}["']?:\\s*(patch|minor|major)\\s*$`,
    "m",
  );
  const priority: Record<ChangesetReleaseType, number> = {
    patch: 1,
    minor: 2,
    major: 3,
  };
  let result: ChangesetReleaseType | undefined;

  for (const changeset of changesets) {
    const release = declaration.exec(changeset)?.[1] as
      ChangesetReleaseType | undefined;
    if (release && (!result || priority[release] > priority[result])) {
      result = release;
    }
  }

  return result;
}

export function assertNewPackageContract(
  packageName: string,
  version: string,
  release: ChangesetReleaseType | undefined,
): void {
  if (version !== BOOTSTRAP_VERSION) {
    throw new Error(
      `New Changesets packages must start at ${BOOTSTRAP_VERSION}; ${packageName} is ${version}.`,
    );
  }
  if (release !== "minor") {
    throw new Error(
      `${packageName} must have a pending minor Changeset so its first real release becomes 0.1.0.`,
    );
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringRecord(value: unknown): value is Record<string, string> {
  return (
    isObject(value) &&
    Object.values(value).every((entry) => typeof entry === "string")
  );
}

function printHelp(): void {
  console.log(`
Bootstrap a new public KingStack package and its npm trusted publisher.

Usage:
  yarn package:bootstrap @kingstack/<package>
  yarn package:bootstrap @kingstack/<package> --dry-run

Options:
  --dry-run  Validate and pack without publishing or changing npm trust.
  --yes      Skip the typed local confirmation. npm may still require 2FA.
  -h, --help Show this help.

New packages must start at 0.0.0. The command publishes that version under the
non-default "bootstrap" tag, configures release-changeset.yml as the trusted
publisher, and leaves the first real release to Changesets.
`);
}

function findWorkspace(
  repoRoot: string,
  requestedName: string,
): ValidatedWorkspace {
  const packagesRoot = join(repoRoot, "packages");
  const candidates: string[] = [];

  for (const entry of readdirSync(packagesRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const directory = join(packagesRoot, entry.name);
    const manifestPath = join(directory, "package.json");
    let manifest: PackageManifest;

    try {
      manifest = JSON.parse(
        readFileSync(manifestPath, "utf8"),
      ) as PackageManifest;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Could not read ${manifestPath}: ${message}`, {
        cause: error,
      });
    }

    if (manifest.name) candidates.push(manifest.name);
    if (manifest.name === requestedName) {
      return validateWorkspaceManifest(manifest, requestedName, directory);
    }
  }

  throw new Error(
    `No packages/* workspace named ${requestedName} was found. Known workspaces: ${candidates.sort().join(", ")}.`,
  );
}

function inspect(
  command: string,
  args: string[],
  cwd: string,
  env = process.env,
): CommandResult {
  const result = spawnSync(command, args, {
    cwd,
    env,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

  if (result.error) {
    throw new Error(`Could not run ${command}: ${result.error.message}`, {
      cause: result.error,
    });
  }

  return {
    stderr: result.stderr || "",
    stdout: result.stdout || "",
    status: result.status ?? 1,
  };
}

function run(command: string, args: string[], cwd: string): void {
  const result = spawnSync(command, args, { cwd, stdio: "inherit" });
  if (result.error) {
    throw new Error(`Could not run ${command}: ${result.error.message}`, {
      cause: result.error,
    });
  }
  if (result.status !== 0) {
    throw new Error(
      `${command} ${args.join(" ")} exited with status ${result.status ?? "unknown"}.`,
    );
  }
}

function requireOutput(command: string, args: string[], cwd: string): string {
  const result = inspect(command, args, cwd);
  if (result.status !== 0) {
    throw new Error(
      result.stderr.trim() ||
        result.stdout.trim() ||
        `${command} ${args.join(" ")} exited with status ${result.status}.`,
    );
  }
  return result.stdout.trim();
}

function assertPublishCheckout(repoRoot: string): void {
  const status = requireOutput("git", ["status", "--porcelain"], repoRoot);
  if (status) {
    throw new Error(
      "Initial package publication requires a clean checkout; commit or stash all changes first.",
    );
  }

  const branch = requireOutput(
    "git",
    ["symbolic-ref", "--quiet", "--short", "HEAD"],
    repoRoot,
  );
  if (branch !== "main") {
    throw new Error(
      `Initial package publication must run from main; current branch is ${branch}.`,
    );
  }

  const head = requireOutput("git", ["rev-parse", "HEAD"], repoRoot);
  let upstream: string;
  try {
    upstream = requireOutput("git", ["rev-parse", "@{upstream}"], repoRoot);
  } catch {
    throw new Error(
      "main must have an upstream branch before publishing. Push or configure its upstream first.",
    );
  }
  if (head !== upstream) {
    throw new Error(
      "Local main must exactly match its upstream before publishing. Pull or push the pending commits first.",
    );
  }
}

async function registryPackageExists(packageName: string): Promise<boolean> {
  const response = await fetch(
    `${NPM_REGISTRY}/${encodeURIComponent(packageName)}`,
    { headers: { accept: "application/vnd.npm.install-v1+json" } },
  );
  if (response.status === 404) return false;
  if (!response.ok) {
    throw new Error(
      `npm registry lookup for ${packageName} failed with HTTP ${response.status}.`,
    );
  }

  return true;
}

function readPendingChangesetRelease(
  packageName: string,
  repoRoot: string,
): ChangesetReleaseType | undefined {
  const changesetRoot = join(repoRoot, ".changeset");
  const changesets = readdirSync(changesetRoot, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
    .filter((entry) => entry.name !== "README.md")
    .map((entry) => readFileSync(join(changesetRoot, entry.name), "utf8"));
  return pendingChangesetRelease(changesets, packageName);
}

function npmCliArgs(args: string[]): string[] {
  return ["dlx", "--quiet", `npm@${NPM_CLI_VERSION}`, ...args];
}

function assertNpmAuthentication(repoRoot: string): void {
  const result = inspect(
    "yarn",
    npmCliArgs(["whoami", "--registry", NPM_REGISTRY]),
    repoRoot,
  );
  if (result.status !== 0) {
    throw new Error(
      [
        "The npm CLI is not authenticated for registry administration.",
        `Run: yarn dlx npm@${NPM_CLI_VERSION} login --auth-type=web`,
        "Then rerun the bootstrap command. The trust operation also requires account-level 2FA.",
      ].join("\n"),
    );
  }
}

async function readTrustConfiguration(
  packageName: string,
  repoRoot: string,
): Promise<TrustConfiguration | undefined> {
  const args = npmCliArgs([
    "trust",
    "list",
    packageName,
    "--json",
    "--registry",
    NPM_REGISTRY,
  ]);
  let result = inspect("yarn", args, repoRoot);
  if (result.status !== 0) {
    const challenge = parseNpmWebAuthChallenge(result.stdout);
    if (challenge) {
      console.log(`\nAuthenticate npm trust access at:\n${challenge.authUrl}`);
      const otp = await waitForNpmWebAuth(challenge);
      result = inspect("yarn", args, repoRoot, {
        ...process.env,
        npm_config_otp: otp,
      });
    }
  }
  if (result.status !== 0) {
    throw new Error(
      result.stderr.trim() ||
        result.stdout.trim() ||
        `Could not inspect npm trusted publishing for ${packageName}.`,
    );
  }
  return parseTrustConfiguration(result.stdout);
}

function configureTrust(packageName: string, repoRoot: string): void {
  run(
    "yarn",
    npmCliArgs([
      "trust",
      "github",
      packageName,
      "--repository",
      TRUST_REPOSITORY,
      "--file",
      TRUST_WORKFLOW,
      "--allow-publish",
      "--yes",
      "--registry",
      NPM_REGISTRY,
    ]),
    repoRoot,
  );
}

async function confirm(expected: string): Promise<void> {
  const readline = createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  try {
    const answer = await readline.question(
      `Type "${expected}" to perform these npm changes: `,
    );
    if (answer !== expected) throw new Error("Package bootstrap cancelled.");
  } finally {
    readline.close();
  }
}

function runPackageChecks(
  workspace: ValidatedWorkspace,
  repoRoot: string,
): void {
  for (const script of verificationScripts(workspace.manifest)) {
    console.log(`\nRunning ${workspace.manifest.name} ${script}...`);
    run("yarn", ["workspace", workspace.manifest.name, script], repoRoot);
  }
}

function createPackageArchive(
  workspace: ValidatedWorkspace,
  repoRoot: string,
  temporaryRoot: string,
): string {
  const archive = join(temporaryRoot, "package.tgz");
  run(
    "yarn",
    ["workspace", workspace.manifest.name, "pack", "--out", archive],
    repoRoot,
  );

  const packedJson = requireOutput(
    "tar",
    ["-xOf", archive, "package/package.json"],
    repoRoot,
  );
  const packedManifest = JSON.parse(packedJson) as PackageManifest;
  validatePackedManifest(
    packedManifest,
    workspace.manifest.name,
    workspace.manifest.version,
  );
  return archive;
}

function publishBootstrapArchive(archive: string, repoRoot: string): void {
  run(
    "yarn",
    npmCliArgs([
      "publish",
      archive,
      "--access",
      "public",
      "--tag",
      BOOTSTRAP_TAG,
      "--registry",
      NPM_REGISTRY,
    ]),
    repoRoot,
  );
}

function assertTrustCanBeCreated(
  packageName: string,
  configuration: TrustConfiguration | undefined,
): void {
  if (!configuration || hasExpectedTrust(configuration)) return;

  throw new Error(
    [
      `${packageName} already has a different trusted publisher:`,
      JSON.stringify(configuration, null, 2),
      "This script will not revoke it automatically. Inspect and replace it deliberately with npm trust list/revoke.",
    ].join("\n"),
  );
}

export async function main(args: string[]): Promise<void> {
  const options = parseBootstrapArgs(args);
  if (options.help) {
    printHelp();
    return;
  }
  if (!options.packageName) {
    printHelp();
    throw new Error("A package name is required.");
  }

  const repoRoot = resolve(import.meta.dir, "..");
  const workspace = findWorkspace(repoRoot, options.packageName);
  const packageName = workspace.manifest.name;
  const version = workspace.manifest.version;
  const packageExists = await registryPackageExists(packageName);

  console.log(`\nPackage: ${packageName}@${version}`);
  console.log(
    packageExists
      ? "Registry: package already exists; no package version will be published."
      : `Registry: new package; ${BOOTSTRAP_VERSION} will be published with the non-default "${BOOTSTRAP_TAG}" tag.`,
  );
  console.log(
    `Trust:    GitHub ${TRUST_REPOSITORY} / ${TRUST_WORKFLOW} / npm publish`,
  );

  if (!packageExists) {
    assertNewPackageContract(
      packageName,
      version,
      readPendingChangesetRelease(packageName, repoRoot),
    );
  }

  let temporaryRoot: string | undefined;
  let archive: string | undefined;
  try {
    if (!packageExists) {
      if (!options.dryRun) assertPublishCheckout(repoRoot);
      runPackageChecks(workspace, repoRoot);
      temporaryRoot = mkdtempSync(
        join(tmpdir(), "kingstack-package-bootstrap-"),
      );
      archive = createPackageArchive(workspace, repoRoot, temporaryRoot);
      console.log("Packed manifest passed registry-safety validation.");
    }

    if (options.dryRun) {
      console.log(
        "\nDry run complete. No registry or trusted-publisher state changed.",
      );
      return;
    }

    assertNpmAuthentication(repoRoot);

    if (packageExists) {
      const currentTrust = await readTrustConfiguration(packageName, repoRoot);
      assertTrustCanBeCreated(packageName, currentTrust);
      if (currentTrust && hasExpectedTrust(currentTrust)) {
        console.log("Trusted publisher is already configured correctly.");
        return;
      }
    }

    if (!options.yes) {
      await confirm(`${packageName}@${version}`);
    }

    if (!packageExists) {
      if (!archive) throw new Error("Package archive was not created.");
      console.log(`\nPublishing ${packageName}@${version}...`);
      publishBootstrapArchive(archive, repoRoot);
    }

    const trustAfterPublish = await readTrustConfiguration(
      packageName,
      repoRoot,
    );
    assertTrustCanBeCreated(packageName, trustAfterPublish);
    if (!trustAfterPublish) {
      console.log(`\nConfiguring npm trusted publishing for ${packageName}...`);
      configureTrust(packageName, repoRoot);
    }

    const verifiedTrust = await readTrustConfiguration(packageName, repoRoot);
    if (!verifiedTrust || !hasExpectedTrust(verifiedTrust)) {
      throw new Error(
        `npm did not return the expected trusted-publisher configuration for ${packageName}.`,
      );
    }

    console.log(`\n${packageName} bootstrap complete.`);
    if (!packageExists) {
      console.log(
        "Merge the Changesets version PR to publish the first real release through OIDC.",
      );
    }
  } finally {
    if (temporaryRoot) {
      rmSync(temporaryRoot, { force: true, recursive: true });
    }
  }
}

if (import.meta.main) {
  main(process.argv.slice(2)).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Package bootstrap failed:\n${message}`);
    process.exitCode = 1;
  });
}
