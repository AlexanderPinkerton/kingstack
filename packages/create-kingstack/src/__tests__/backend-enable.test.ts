import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "fs";
import { spawnSync } from "child_process";
import { tmpdir } from "os";
import { dirname, join, resolve } from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const repoRoot = resolve(process.cwd(), "..", "..");
const enableBackendScript = join(repoRoot, "scripts", "enable-backend.ts");

describe("guided backend enablement", () => {
  let testRoot: string;
  let fakeBin: string;
  let commandLog: string;

  beforeEach(() => {
    testRoot = mkdtempSync(join(tmpdir(), "kingstack-enable-backend-"));
    fakeBin = join(testRoot, "bin");
    commandLog = join(testRoot, "commands.log");

    for (const relativePath of [
      "config/local.ts",
      "supabase/config.toml",
      "packages/prisma/schema.prisma",
    ]) {
      const path = join(testRoot, relativePath);
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, "");
    }

    mkdirSync(join(testRoot, "apps", "next"), { recursive: true });
    mkdirSync(join(testRoot, "apps", "nest"), { recursive: true });
    writeFileSync(join(testRoot, "package.json"), "{}");
    writeFileSync(
      join(testRoot, "apps", "next", ".env"),
      [
        "PORT=17420",
        "NEXT_PUBLIC_NEST_BACKEND_URL=http://localhost:17421",
        "NEXT_PUBLIC_SUPABASE_URL=http://localhost:17423",
      ].join("\n"),
    );
    writeFileSync(join(testRoot, "apps", "nest", ".env"), "PORT=17421\n");

    mkdirSync(fakeBin, { recursive: true });
    writeExecutable(
      "docker",
      `#!/bin/sh
echo "docker $*" >> "$COMMAND_LOG"
exit "\${DOCKER_STATUS:-0}"
`,
    );
    writeExecutable(
      "yarn",
      `#!/bin/sh
echo "yarn $*" >> "$COMMAND_LOG"
if [ "$1" = "supabase:status" ]; then
  if [ "$SUPABASE_RUNNING" = "1" ]; then
    echo "API URL: http://127.0.0.1:17423"
    exit 0
  fi
  echo "Supabase is not running"
  exit 1
fi
exit 0
`,
    );
    writeExecutable(
      "bun",
      `#!/bin/sh
echo "bun $*" >> "$COMMAND_LOG"
exit 0
`,
    );
  });

  afterEach(() => {
    rmSync(testRoot, { recursive: true, force: true });
  });

  function writeExecutable(name: string, content: string): void {
    const path = join(fakeBin, name);
    writeFileSync(path, content);
    chmodSync(path, 0o755);
  }

  function runEnableBackend(
    extraEnv: NodeJS.ProcessEnv = {},
  ): ReturnType<typeof spawnSync> {
    return spawnSync(process.execPath, [enableBackendScript], {
      cwd: testRoot,
      encoding: "utf-8",
      env: {
        ...process.env,
        ...extraEnv,
        COMMAND_LOG: commandLog,
        PATH: `${fakeBin}:${process.env.PATH ?? ""}`,
      },
    });
  }

  function commands(): string[] {
    return readFileSync(commandLog, "utf-8").trim().split("\n");
  }

  it("starts a stopped backend and guides the user to the full stack", () => {
    const result = runEnableBackend();

    expect(result.status).toBe(0);
    expect(commands()).toEqual([
      "docker info",
      "yarn env:local",
      "yarn supabase:status",
      "yarn supabase:start",
      "bun scripts/setup-shadow-db.ts",
      "yarn prisma:migrate",
    ]);
    expect(result.stdout).toContain("KingStack backend is enabled");
    expect(result.stdout).toContain("http://localhost:17420/app");
    expect(result.stdout).toContain("Run yarn dev");
  });

  it("reuses an already-running project Supabase instance", () => {
    const result = runEnableBackend({ SUPABASE_RUNNING: "1" });

    expect(result.status).toBe(0);
    expect(commands()).not.toContain("yarn supabase:start");
    expect(result.stdout).toContain("already running");
  });

  it("stops early with actionable guidance when Docker is unavailable", () => {
    const result = runEnableBackend({ DOCKER_STATUS: "1" });

    expect(result.status).toBe(1);
    expect(commands()).toEqual(["docker info"]);
    expect(result.stderr).toContain("Start Docker Desktop");
    expect(result.stderr).toContain("yarn backend:enable");
  });
});
