#!/usr/bin/env bun

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync } from "node:fs";
import { basename, dirname, join, resolve, sep } from "node:path";

interface CliOptions {
  baseRef: string;
  branchName?: string;
  help: boolean;
  install: boolean;
  resume: boolean;
}

interface CommandResult {
  output: string;
  status: number;
}

interface Worktree {
  branch?: string;
  path: string;
}

const LOCAL_BRANCH_PREFIX = "refs/heads/";

export function parseCliArgs(args: string[]): CliOptions {
  const options: CliOptions = {
    baseRef: "HEAD",
    help: false,
    install: false,
    resume: false,
  };

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];

    if (argument === "--help" || argument === "-h") {
      options.help = true;
    } else if (argument === "--resume") {
      options.resume = true;
    } else if (argument === "--install") {
      options.install = true;
    } else if (argument === "--from") {
      const baseRef = args[index + 1];
      if (!baseRef || baseRef.startsWith("--")) {
        throw new Error("--from requires a Git ref.");
      }
      options.baseRef = baseRef;
      index += 1;
    } else if (argument.startsWith("--from=")) {
      const baseRef = argument.slice("--from=".length);
      if (!baseRef) throw new Error("--from requires a Git ref.");
      options.baseRef = baseRef;
    } else if (argument.startsWith("-")) {
      throw new Error(`Unknown option: ${argument}`);
    } else if (options.branchName) {
      throw new Error(`Unexpected argument: ${argument}`);
    } else {
      options.branchName = argument;
    }
  }

  if (options.resume && options.baseRef !== "HEAD") {
    throw new Error("--from cannot be combined with --resume.");
  }

  return options;
}

export function slugifyBranchName(branchName: string): string {
  const slug = branchName
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^[.-]+|[.-]+$/g, "");
  const hash = createHash("sha256")
    .update(branchName)
    .digest("hex")
    .slice(0, 8);

  if (!slug) return `branch-${hash}`;
  if (slug.length <= 100) return slug;

  return `${slug.slice(0, 91).replace(/[.-]+$/g, "")}-${hash}`;
}

export function getWorktreePath(repoRoot: string, branchName: string): string {
  const worktreeRoot = resolve(
    dirname(repoRoot),
    `${basename(repoRoot)}-worktrees`,
  );
  const worktreePath = resolve(worktreeRoot, slugifyBranchName(branchName));

  if (!worktreePath.startsWith(`${worktreeRoot}${sep}`)) {
    throw new Error("Could not derive a safe worktree path.");
  }

  return worktreePath;
}

export function parseWorktrees(output: string): Worktree[] {
  const worktrees: Worktree[] = [];
  let current: Partial<Worktree> = {};

  for (const field of output.split("\0")) {
    if (!field) {
      if (current.path) worktrees.push(current as Worktree);
      current = {};
    } else if (field.startsWith("worktree ")) {
      current.path = field.slice("worktree ".length);
    } else if (field.startsWith("branch ")) {
      const branchRef = field.slice("branch ".length);
      current.branch = branchRef.startsWith(LOCAL_BRANCH_PREFIX)
        ? branchRef.slice(LOCAL_BRANCH_PREFIX.length)
        : branchRef;
    }
  }

  if (current.path) worktrees.push(current as Worktree);
  return worktrees;
}

function printHelp(): void {
  console.log(`
Create an isolated Git branch and worktree for parallel development.

Usage:
  yarn workbranch <branch-name> [--from <ref>] [--install]
  yarn workbranch <branch-name> --resume [--install]

Options:
  --from <ref>  Create the branch from this ref instead of HEAD.
  --resume      Open an existing local or known remote-tracking branch.
  --install     Run yarn install in the resulting worktree.
  -h, --help    Show this help.

Examples:
  yarn workbranch feature/config-checks
  yarn workbranch feature/config-checks --from origin/main
  yarn workbranch feature/config-checks --resume
`);
}

function inspect(command: string, args: string[], cwd: string): CommandResult {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf-8",
    stdio: "pipe",
  });

  if (result.error) {
    throw new Error(`Could not run ${command}: ${result.error.message}`, {
      cause: result.error,
    });
  }

  return {
    output: [result.stdout, result.stderr].filter(Boolean).join("\n").trim(),
    status: result.status ?? 1,
  };
}

function gitOutput(args: string[], cwd: string): string {
  const result = inspect("git", args, cwd);
  if (result.status !== 0) {
    throw new Error(
      result.output ||
        `git ${args.join(" ")} exited with status ${result.status}.`,
    );
  }
  return result.output;
}

function gitSucceeds(args: string[], cwd: string): boolean {
  return inspect("git", args, cwd).status === 0;
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

function validateBranchName(branchName: string, repoRoot: string): void {
  const result = inspect(
    "git",
    ["check-ref-format", "--branch", branchName],
    repoRoot,
  );
  const normalizedBranchName = result.output.split("\n")[0];

  if (result.status !== 0 || normalizedBranchName !== branchName) {
    throw new Error(`Invalid literal Git branch name: ${branchName}`);
  }
}

function localBranchExists(branchName: string, repoRoot: string): boolean {
  return gitSucceeds(
    ["show-ref", "--verify", "--quiet", `${LOCAL_BRANCH_PREFIX}${branchName}`],
    repoRoot,
  );
}

function findRemoteBranches(branchName: string, repoRoot: string): string[] {
  const remotes = gitOutput(["remote"], repoRoot).split("\n").filter(Boolean);

  return remotes
    .map((remote) => `${remote}/${branchName}`)
    .filter((remoteBranch) =>
      gitSucceeds(
        ["show-ref", "--verify", "--quiet", `refs/remotes/${remoteBranch}`],
        repoRoot,
      ),
    );
}

function listWorktrees(repoRoot: string): Worktree[] {
  return parseWorktrees(
    gitOutput(["worktree", "list", "--porcelain", "-z"], repoRoot),
  );
}

function resolveCommit(ref: string, repoRoot: string): string {
  const result = inspect(
    "git",
    ["rev-parse", "--verify", "--end-of-options", `${ref}^{commit}`],
    repoRoot,
  );

  if (result.status !== 0) {
    throw new Error(`Cannot resolve --from ref to a commit: ${ref}`);
  }
  return result.output.split("\n")[0];
}

function currentBranch(repoRoot: string): string {
  const result = inspect(
    "git",
    ["symbolic-ref", "--quiet", "--short", "HEAD"],
    repoRoot,
  );
  return result.status === 0 ? result.output : "detached HEAD";
}

function assertDestinationAvailable(
  worktreePath: string,
  worktrees: Worktree[],
): void {
  if (existsSync(worktreePath)) {
    throw new Error(
      `Worktree directory already exists: ${worktreePath}\nRemove it or choose a branch name with a different directory slug.`,
    );
  }

  const registered = worktrees.find(
    (worktree) => resolve(worktree.path) === resolve(worktreePath),
  );
  if (registered) {
    throw new Error(
      `Git still registers the worktree path: ${worktreePath}\nInspect it with "git worktree list" and prune stale entries if appropriate.`,
    );
  }
}

function quoteForShell(value: string): string {
  return `'${value.replaceAll("'", `'\\''`)}'`;
}

function printNextSteps(
  repoRoot: string,
  worktreePath: string,
  branchName: string,
  installed: boolean,
): void {
  console.log();
  console.log("Worktree ready.");
  console.log(`  Branch:   ${branchName}`);
  console.log(`  Worktree: ${worktreePath}`);
  console.log();
  console.log("Next:");
  console.log(`  cd ${quoteForShell(worktreePath)}`);
  if (!installed) console.log("  yarn install");
  if (
    existsSync(join(worktreePath, "config", "example.ts")) &&
    !existsSync(join(worktreePath, "config", "local.ts"))
  ) {
    console.log("  bun king-config env init local");
  }
  console.log();
  console.log(
    "Local config, ports, containers, databases, and external services are not isolated by Git worktrees.",
  );
  console.log(
    "Use unique runtime resources before running worktrees concurrently.",
  );
  console.log();
  console.log("Cleanup after the branch is merged:");
  console.log(
    `  git -C ${quoteForShell(repoRoot)} worktree remove ${quoteForShell(worktreePath)}`,
  );
  console.log(
    `  git -C ${quoteForShell(repoRoot)} branch -d ${quoteForShell(branchName)}`,
  );
}

function installDependencies(worktreePath: string): void {
  console.log();
  console.log("Installing dependencies...");
  try {
    run("yarn", ["install"], worktreePath);
  } catch (error) {
    console.error(
      `The worktree remains available at ${worktreePath}; rerun yarn install there after resolving the error.`,
    );
    throw error;
  }
}

export function main(args: string[]): void {
  const options = parseCliArgs(args);
  if (options.help) {
    printHelp();
    return;
  }
  if (!options.branchName) {
    printHelp();
    throw new Error("A branch name is required.");
  }

  const repoRoot = gitOutput(["rev-parse", "--show-toplevel"], process.cwd());
  const branchName = options.branchName;
  validateBranchName(branchName, repoRoot);

  const worktrees = listWorktrees(repoRoot);
  const existingWorktree = worktrees.find(
    (worktree) => worktree.branch === branchName,
  );

  if (existingWorktree) {
    if (!options.resume) {
      throw new Error(
        `Branch "${branchName}" is already checked out at ${existingWorktree.path}.\nUse --resume to reuse it.`,
      );
    }

    console.log(`Branch "${branchName}" is already checked out.`);
    if (options.install) installDependencies(existingWorktree.path);
    printNextSteps(
      repoRoot,
      existingWorktree.path,
      branchName,
      options.install,
    );
    return;
  }

  const hasLocalBranch = localBranchExists(branchName, repoRoot);
  const remoteBranches = findRemoteBranches(branchName, repoRoot);

  if (!options.resume && (hasLocalBranch || remoteBranches.length > 0)) {
    const location = hasLocalBranch
      ? "locally"
      : `on ${remoteBranches.join(", ")}`;
    throw new Error(
      `Branch "${branchName}" already exists ${location}.\nUse --resume to add it as a worktree.`,
    );
  }
  if (options.resume && !hasLocalBranch && remoteBranches.length === 0) {
    throw new Error(
      `Branch "${branchName}" does not exist locally or as a known remote-tracking branch.\nFetch it first if it was created remotely.`,
    );
  }
  if (options.resume && !hasLocalBranch && remoteBranches.length > 1) {
    throw new Error(
      `Branch "${branchName}" exists on multiple remotes: ${remoteBranches.join(", ")}.\nCreate the desired local tracking branch explicitly, then rerun with --resume.`,
    );
  }

  const worktreePath = getWorktreePath(repoRoot, branchName);
  assertDestinationAvailable(worktreePath, worktrees);
  const baseCommit = options.resume
    ? undefined
    : resolveCommit(options.baseRef, repoRoot);
  const dirty = options.resume
    ? false
    : gitOutput(["status", "--porcelain"], repoRoot).length > 0;
  mkdirSync(dirname(worktreePath), { recursive: true });

  if (options.resume) {
    if (hasLocalBranch) {
      console.log(
        `Adding existing local branch "${branchName}" as a worktree.`,
      );
      run("git", ["worktree", "add", worktreePath, branchName], repoRoot);
    } else {
      const remoteBranch = remoteBranches[0];
      console.log(
        `Creating local branch "${branchName}" tracking ${remoteBranch}.`,
      );
      run(
        "git",
        [
          "worktree",
          "add",
          "--track",
          "-b",
          branchName,
          worktreePath,
          remoteBranch,
        ],
        repoRoot,
      );
    }
  } else {
    if (!baseCommit) throw new Error("Could not resolve the base commit.");

    console.log(
      `Creating branch "${branchName}" from ${options.baseRef} (${baseCommit.slice(0, 12)}).`,
    );
    console.log(`Current checkout: ${currentBranch(repoRoot)}`);
    if (dirty) {
      console.warn(
        "Warning: the current worktree has uncommitted changes; they will not be included.",
      );
    }
    console.log(`Worktree path: ${worktreePath}`);
    run(
      "git",
      ["worktree", "add", "-b", branchName, worktreePath, baseCommit],
      repoRoot,
    );
  }

  if (options.install) installDependencies(worktreePath);
  printNextSteps(repoRoot, worktreePath, branchName, options.install);
}

if (import.meta.main) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error();
    console.error(`Error: ${message}`);
    process.exitCode = 1;
  }
}
