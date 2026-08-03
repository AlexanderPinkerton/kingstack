import { afterEach, describe, expect, it } from "bun:test";
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  getWorktreePath,
  parseCliArgs,
  parseWorktrees,
  slugifyBranchName,
} from "./create-workbranch.js";

const scriptPath = fileURLToPath(
  new URL("./create-workbranch.ts", import.meta.url),
);
const temporaryRoots: string[] = [];

interface ProcessResult {
  output: string;
  status: number;
}

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) {
    rmSync(root, { force: true, recursive: true });
  }
});

function run(command: string, args: string[], cwd: string): ProcessResult {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf-8",
    stdio: "pipe",
  });

  if (result.error) throw result.error;
  return {
    output: [result.stdout, result.stderr].filter(Boolean).join("\n"),
    status: result.status ?? 1,
  };
}

function git(repo: string, args: string[]): ProcessResult {
  return run("git", args, repo);
}

function createRepository(): { repo: string; root: string } {
  const root = mkdtempSync(join(tmpdir(), "kingstack-workbranch-test-"));
  temporaryRoots.push(root);
  const repo = join(root, "sample");
  mkdirSync(repo);

  expect(git(repo, ["init", "--quiet", "--initial-branch=main"]).status).toBe(
    0,
  );
  expect(git(repo, ["config", "user.name", "Workbranch Test"]).status).toBe(0);
  expect(
    git(repo, ["config", "user.email", "workbranch@example.com"]).status,
  ).toBe(0);
  writeFileSync(join(repo, "tracked.txt"), "committed\n");
  expect(git(repo, ["add", "tracked.txt"]).status).toBe(0);
  expect(git(repo, ["commit", "--quiet", "-m", "Initial commit"]).status).toBe(
    0,
  );

  return { repo, root };
}

function workbranch(repo: string, args: string[]): ProcessResult {
  return run(process.execPath, [scriptPath, ...args], repo);
}

describe("workbranch CLI helpers", () => {
  it("parses creation and resume options", () => {
    expect(
      parseCliArgs([
        "feature/config-checks",
        "--from",
        "origin/main",
        "--install",
      ]),
    ).toEqual({
      baseRef: "origin/main",
      branchName: "feature/config-checks",
      help: false,
      install: true,
      resume: false,
    });
    expect(parseCliArgs(["--resume", "feature/config-checks"]).resume).toBe(
      true,
    );
    expect(() =>
      parseCliArgs(["feature/config-checks", "--resume", "--from", "main"]),
    ).toThrow("cannot be combined");
  });

  it("derives a bounded sibling path from nested and unusual branch names", () => {
    expect(slugifyBranchName("Feature/Config Checks")).toBe(
      "feature-config-checks",
    );
    expect(slugifyBranchName("修复/配置")).toMatch(/^branch-[a-f0-9]{8}$/);
    expect(slugifyBranchName("a".repeat(200))).toHaveLength(100);
    expect(getWorktreePath("/projects/kingstack", "feature/config")).toBe(
      "/projects/kingstack-worktrees/feature-config",
    );
  });

  it("parses null-delimited worktree plumbing output", () => {
    expect(
      parseWorktrees(
        "worktree /repo\0HEAD abc\0branch refs/heads/main\0\0" +
          "worktree /repo-worktrees/feature\0HEAD def\0branch refs/heads/feature/x\0\0",
      ),
    ).toEqual([
      { branch: "main", path: "/repo" },
      { branch: "feature/x", path: "/repo-worktrees/feature" },
    ]);
  });
});

describe("workbranch CLI integration", () => {
  it("creates nested and shell-significant branch names without invoking a shell", () => {
    const { repo } = createRepository();

    const nested = workbranch(repo, ["feature/config-checks"]);
    expect(nested.status).toBe(0);
    expect(
      existsSync(getWorktreePath(repo, "feature/config-checks")),
    ).toBeTrue();

    const hostileBranch = 'feature/x";touch${IFS}pwned;#';
    const hostile = workbranch(repo, [hostileBranch]);
    expect(hostile.status).toBe(0);
    expect(existsSync(join(repo, "pwned"))).toBeFalse();
    expect(
      git(repo, [
        "show-ref",
        "--verify",
        "--quiet",
        `refs/heads/${hostileBranch}`,
      ]).status,
    ).toBe(0);
  });

  it("requires explicit resume and reuses an existing worktree", () => {
    const { repo } = createRepository();
    expect(workbranch(repo, ["feature/resume"]).status).toBe(0);

    const duplicate = workbranch(repo, ["feature/resume"]);
    expect(duplicate.status).toBe(1);
    expect(duplicate.output).toContain("Use --resume");

    const resumed = workbranch(repo, ["feature/resume", "--resume"]);
    expect(resumed.status).toBe(0);
    expect(resumed.output).toContain("already checked out");
  });

  it("warns that dirty source changes are not copied", () => {
    const { repo } = createRepository();
    writeFileSync(join(repo, "tracked.txt"), "uncommitted\n");

    const result = workbranch(repo, ["feature/dirty-source"]);
    expect(result.status).toBe(0);
    expect(result.output).toContain("uncommitted changes");
    expect(
      readFileSync(
        join(getWorktreePath(repo, "feature/dirty-source"), "tracked.txt"),
        "utf-8",
      ),
    ).toBe("committed\n");
  });

  it("leaves no worktree directory or branch after a failed base preflight", () => {
    const { repo } = createRepository();
    const path = getWorktreePath(repo, "feature/missing-base");

    const result = workbranch(repo, [
      "feature/missing-base",
      "--from",
      "missing-ref",
    ]);
    expect(result.status).toBe(1);
    expect(result.output).toContain("Cannot resolve --from ref");
    expect(existsSync(dirname(path))).toBeFalse();
    expect(
      git(repo, [
        "show-ref",
        "--verify",
        "--quiet",
        "refs/heads/feature/missing-base",
      ]).status,
    ).toBe(1);
  });

  it("resumes a unique remote branch with tracking configured", () => {
    const { repo, root } = createRepository();
    const remote = join(root, "remote.git");
    mkdirSync(remote);
    expect(git(remote, ["init", "--quiet", "--bare"]).status).toBe(0);
    expect(git(repo, ["remote", "add", "origin", remote]).status).toBe(0);
    expect(git(repo, ["branch", "feature/remote"]).status).toBe(0);
    expect(
      git(repo, ["push", "--quiet", "origin", "feature/remote"]).status,
    ).toBe(0);
    expect(git(repo, ["branch", "-D", "feature/remote"]).status).toBe(0);

    const result = workbranch(repo, ["feature/remote", "--resume"]);
    const path = getWorktreePath(repo, "feature/remote");
    expect(result.status).toBe(0);
    expect(
      git(path, [
        "rev-parse",
        "--abbrev-ref",
        "--symbolic-full-name",
        "@{upstream}",
      ]).output.trim(),
    ).toBe("origin/feature/remote");
  });

  it("does not create a branch when its destination path is occupied", () => {
    const { repo } = createRepository();
    const destination = getWorktreePath(repo, "feature/collision");
    mkdirSync(destination, { recursive: true });

    const result = workbranch(repo, ["feature/collision"]);
    expect(result.status).toBe(1);
    expect(result.output).toContain("already exists");
    expect(
      git(repo, [
        "show-ref",
        "--verify",
        "--quiet",
        "refs/heads/feature/collision",
      ]).status,
    ).toBe(1);
  });
});
