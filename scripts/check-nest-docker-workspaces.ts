#!/usr/bin/env bun

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

interface RootPackageManifest {
  workspaces?: string[] | { packages?: string[] };
}

export function listWorkspaceDirectories(projectRoot: string): string[] {
  const packagePath = join(projectRoot, "package.json");
  const manifest = JSON.parse(
    readFileSync(packagePath, "utf8"),
  ) as RootPackageManifest;
  const patterns = Array.isArray(manifest.workspaces)
    ? manifest.workspaces
    : manifest.workspaces?.packages;

  if (!patterns || patterns.length === 0) {
    throw new Error("package.json declares no Yarn workspaces.");
  }

  const workspaces = new Set<string>();
  for (const pattern of patterns) {
    const normalizedPattern = normalizePath(pattern);
    const wildcard = /^(.*)\/\*$/.exec(normalizedPattern);

    if (wildcard && !wildcard[1].includes("*")) {
      const parent = wildcard[1];
      const parentPath = join(projectRoot, parent);
      if (!existsSync(parentPath)) continue;

      for (const entry of readdirSync(parentPath, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue;
        const workspace = `${parent}/${entry.name}`;
        if (existsSync(join(projectRoot, workspace, "package.json"))) {
          workspaces.add(workspace);
        }
      }
      continue;
    }

    if (normalizedPattern.includes("*")) {
      throw new Error(
        `Unsupported workspace pattern "${pattern}". This lint check supports exact paths and one-level /* patterns.`,
      );
    }

    if (existsSync(join(projectRoot, normalizedPattern, "package.json"))) {
      workspaces.add(normalizedPattern);
    }
  }

  return [...workspaces].sort();
}

export function listCopiedWorkspaceManifests(dockerfile: string): Set<string> {
  const copied = new Set<string>();

  for (const rawLine of dockerfile.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!/^COPY\s/i.test(line)) continue;

    const instruction = line.replace(/^COPY\s+/i, "");
    const paths = parseCopyPaths(instruction);
    if (!paths) continue;

    const [source, destination] = paths.map(normalizePath);
    if (source === destination && source.endsWith("/package.json")) {
      copied.add(source);
    }
  }

  return copied;
}

export function findMissingWorkspaceCopies(projectRoot: string): string[] {
  const dockerfilePath = join(projectRoot, "apps/nest/Dockerfile");
  const dockerfile = readFileSync(dockerfilePath, "utf8");
  const copied = listCopiedWorkspaceManifests(dockerfile);

  return listWorkspaceDirectories(projectRoot)
    .map((workspace) => `${workspace}/package.json`)
    .filter((manifest) => !copied.has(manifest));
}

function parseCopyPaths(instruction: string): [string, string] | undefined {
  if (instruction.startsWith("[")) {
    try {
      const paths = JSON.parse(instruction) as unknown;
      if (
        Array.isArray(paths) &&
        paths.length === 2 &&
        paths.every((path) => typeof path === "string")
      ) {
        return [paths[0], paths[1]];
      }
    } catch {
      return undefined;
    }
    return undefined;
  }

  const tokens = instruction
    .split(/\s+/)
    .filter(Boolean)
    .filter((token) => !token.startsWith("--"));
  if (tokens.length !== 2) return undefined;
  return [tokens[0], tokens[1]];
}

function normalizePath(path: string): string {
  return path.replaceAll("\\", "/").replace(/^\.\//, "").replace(/\/$/, "");
}

function main(): void {
  const projectRoot = process.cwd();
  const workspaces = listWorkspaceDirectories(projectRoot);
  const missing = findMissingWorkspaceCopies(projectRoot);

  if (missing.length > 0) {
    throw new Error(
      [
        "apps/nest/Dockerfile is missing Yarn workspace manifests:",
        ...missing.map((manifest) => `- COPY ${manifest} ${manifest}`),
        "Docker builds will not work unless this is fixed!!!!",
        "Every workspace package.json must be copied before `yarn workspaces focus`.",
      ].join("\n"),
    );
  }

  console.log(
    `Nest Dockerfile includes all ${workspaces.length} Yarn workspace manifests.`,
  );
}

if (import.meta.main) {
  try {
    main();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Nest Dockerfile workspace lint failed:\n${message}`);
    process.exitCode = 1;
  }
}
