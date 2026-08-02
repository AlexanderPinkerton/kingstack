#!/usr/bin/env bun
/**
 * create-workbranch.ts
 *
 * Creates a new git branch + worktree outside the main repo directory,
 * so agents (or you) can work in parallel without affecting the current branch.
 *
 * Usage:  bun run scripts/create-workbranch <branch-name>
 *
 * Result: ../cyclearena-<branch-name>/  ← a full worktree on a new branch
 */

import { execSync } from "child_process";
import path from "path";
import fs from "fs";

const branchName = process.argv[2];

if (!branchName) {
    console.error("❌  Usage: bun run scripts/create-workbranch <branch-name>");
    process.exit(1);
}

// Resolve repo root (the directory containing this script's parent)
const repoRoot = execSync("git rev-parse --show-toplevel", { encoding: "utf-8" }).trim();
const repoParent = path.dirname(repoRoot);
const repoBasename = path.basename(repoRoot);
const worktreeDir = path.join(repoParent, `${repoBasename}-${branchName}`);

// ── Preflight checks ───────────────────────────────────────────────
if (fs.existsSync(worktreeDir)) {
    console.error(`❌  Directory already exists: ${worktreeDir}`);
    console.error("    Remove it or choose a different branch name.");
    process.exit(1);
}

// Check if branch already exists (local)
const existingBranches = execSync("git branch --list", { encoding: "utf-8", cwd: repoRoot });
if (existingBranches.split("\n").some((b) => b.trim().replace("* ", "") === branchName)) {
    console.error(`❌  Branch "${branchName}" already exists locally.`);
    console.error("    If you want to resume work on it, use:  git worktree add <path> <branch>");
    process.exit(1);
}

// ── Create branch + worktree in one shot ────────────────────────────
// `git worktree add -b <branch> <path>` creates a new branch at HEAD
// and checks it out in the worktree — all without touching the current branch.
console.log(`\n🌿  Creating branch "${branchName}" at current HEAD...`);
console.log(`📂  Worktree path: ${worktreeDir}\n`);

try {
    execSync(`git worktree add -b "${branchName}" "${worktreeDir}"`, {
        cwd: repoRoot,
        stdio: "inherit",
    });
} catch {
    console.error("\n❌  Failed to create worktree. See error above.");
    process.exit(1);
}

console.log(`\n✅  Done!`);
console.log(`    Branch:   ${branchName}`);
console.log(`    Worktree: ${worktreeDir}`);
console.log(`\n    cd ${worktreeDir}`);
console.log(`    # Then install deps: yarn install\n`);
