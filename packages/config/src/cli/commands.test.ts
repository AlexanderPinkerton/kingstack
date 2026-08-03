import {
  appendFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { checkCommand } from "./check";
import { diffCommand } from "./diff";
import { initEnvironmentCommand } from "./environment";
import { generateCommand } from "./generate";
import { initSchemaCommand } from "./init";
import { syncCommand } from "./sync";

describe("configuration CLI commands", () => {
  const temporaryDirectories: string[] = [];

  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    for (const directory of temporaryDirectories.splice(0)) {
      rmSync(directory, { force: true, recursive: true });
    }
  });

  it("reports stale source keys without printing their values", async () => {
    const cwd = createFixture({ STALE_KEY: "do-not-print-this-value" });

    await expect(checkCommand({ cwd, environment: "local" })).resolves.toBe(
      false,
    );
    const output = vi.mocked(console.error).mock.calls.flat().join("\n");
    expect(output).toContain("STALE_KEY");
    expect(output).not.toContain("do-not-print-this-value");
  });

  it("generates files and reports subsequent key-level drift", async () => {
    const cwd = createFixture({ PORT: "3000" });

    await expect(generateCommand("local", { cwd })).resolves.toBe(true);
    await expect(diffCommand("local", { cwd })).resolves.toBe(true);

    const envPath = join(cwd, "app/.env");
    expect(readFileSync(envPath, "utf8")).toContain("ENVIRONMENT=local");
    appendFileSync(envPath, "STALE=value\n");

    await expect(diffCommand("local", { cwd })).resolves.toBe(false);
    expect(vi.mocked(console.log).mock.calls.flat().join("\n")).toContain(
      "app/.env:STALE (extra)",
    );
  });

  it("keeps sync dry runs free of filesystem and provider side effects", async () => {
    const cwd = createFixture({ PORT: "3000" });

    await expect(
      syncCommand({ cwd, dryRun: true, env: "local", target: "vercel" }),
    ).resolves.toBe(true);
    expect(existsSync(join(cwd, ".vercel"))).toBe(false);
  });

  it("scaffolds required values for a declared staging environment", async () => {
    const cwd = createFixture({ PORT: "3000" });

    await expect(initEnvironmentCommand("staging", { cwd })).resolves.toBe(
      true,
    );
    const content = readFileSync(join(cwd, "config/staging.ts"), "utf8");
    expect(content).toContain('PORT: ""');
    expect(content).not.toContain("3000");
    expect(readFileSync(join(cwd, ".gitignore"), "utf8")).toContain(
      "config/staging.ts",
    );
  });

  it("initializes a standalone schema without overwriting existing files", () => {
    const cwd = createEmptyFixture();

    expect(initSchemaCommand({ cwd })).toBe(true);
    expect(readFileSync(join(cwd, "config/schema.ts"), "utf8")).toContain(
      "EnvironmentMode.Local",
    );
    expect(readFileSync(join(cwd, "config/example.ts"), "utf8")).toContain(
      "satisfies ConfigValues",
    );
    expect(initSchemaCommand({ cwd })).toBe(false);
  });

  function createFixture(values: Record<string, string>): string {
    const cwd = createEmptyFixture();
    mkdirSync(join(cwd, "config"), { recursive: true });
    writeFileSync(
      join(cwd, "config/schema.ts"),
      `export const schema = {
  environments: {
    local: { mode: "local", sync: false },
    staging: { mode: "hosted", sync: true },
  },
  core: {
    PORT: { required: true },
    VERCEL_PROJECT_ID: { default: "project" },
    VERCEL_ORG_ID: { default: "org" },
  },
  computed: (_core, context) => ({ ENVIRONMENT: context.environment }),
  envfiles: { app: { path: "app/.env", keys: ["PORT", "ENVIRONMENT"] } },
  services: {
    github: { description: "test", keys: ["PORT"] },
    vercel: { description: "test", keys: ["PORT"] },
  },
};
`,
    );
    writeFileSync(
      join(cwd, "config/local.ts"),
      `export const values = ${JSON.stringify(values)};\n`,
    );
    return cwd;
  }

  function createEmptyFixture(): string {
    const cwd = mkdtempSync(join(tmpdir(), "king-config-test-"));
    temporaryDirectories.push(cwd);
    return cwd;
  }
});
