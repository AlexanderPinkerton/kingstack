import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runPortCli } from "../port-cli";
import { parseProjectPortConfig, standardPortBase } from "../port-config";
import { listProjectPortAllocations, portsFromBase } from "../ports";

describe("existing-project port commands", () => {
  let generatedRoots: string[];
  let logs: string[];
  let registryPath: string;
  let testRoot: string;
  let warnings: string[];

  beforeEach(() => {
    testRoot = mkdtempSync(join(tmpdir(), "create-kingstack-port-cli-test-"));
    registryPath = join(testRoot, "port-allocations.json");
    generatedRoots = [];
    logs = [];
    warnings = [];
  });

  afterEach(() => {
    rmSync(testRoot, { force: true, recursive: true });
  });

  function projectConfig(basePort: number, legacy = false): string {
    const ports = portsFromBase(basePort);
    return `export const values = {
  NEXT_PORT: "${legacy ? 3074 : ports.next}",
  NEST_PORT: "${legacy ? 3075 : ports.nest}",
  SUPABASE_DB_SHADOW_PORT: "${legacy ? 54350 : ports.supabaseDbShadowPort}",
  SUPABASE_API_PORT: "${legacy ? 54351 : ports.supabaseApiPort}",
  SUPABASE_DB_DIRECT_PORT: "${legacy ? 54352 : ports.supabaseDbDirectPort}",
  SUPABASE_DB_POOLER_PORT: "${legacy ? 54352 : ports.supabaseDbPoolerPort}",
  SUPABASE_STUDIO_PORT: "${legacy ? 54354 : ports.supabaseStudioPort}",
  SUPABASE_EMAIL_PORT: "${legacy ? 54356 : ports.supabaseEmailPort}",
  SUPABASE_ANALYTICS_PORT: "${legacy ? 54355 : ports.supabaseAnalyticsPort}",
  SUPABASE_EDGE_RUNTIME_INSPECTOR_PORT: "${legacy ? 54357 : ports.supabaseEdgeRuntimeInspectorPort}",
  API_SECRET: "preserved",
};
`;
  }

  function createProject(
    name: string,
    basePort: number,
    legacy = false,
  ): string {
    const root = join(testRoot, name);
    mkdirSync(join(root, "config"), { recursive: true });
    writeFileSync(join(root, "package.json"), JSON.stringify({ name }));
    writeFileSync(
      join(root, "config", "local.ts"),
      projectConfig(basePort, legacy).replace(
        legacy ? /.*SUPABASE_EDGE_RUNTIME_INSPECTOR_PORT.*\n/ : /$^/,
        "",
      ),
    );
    writeFileSync(
      join(root, "config", "schema.ts"),
      `export const schema = {
  SUPABASE_EDGE_RUNTIME_INSPECTOR_PORT: { default: "54327" },
};
`,
    );
    return root;
  }

  function run(
    projectRoot: string,
    args: string[],
    unavailablePorts: number[] = [],
  ): Promise<number> {
    const unavailable = new Set(unavailablePorts);
    return runPortCli(args, {
      cwd: projectRoot,
      generateLocalEnvironment: (root) => {
        generatedRoots.push(root);
        return true;
      },
      log: (message) => logs.push(message),
      probe: (port) => Promise.resolve(!unavailable.has(port)),
      registryPath,
      warn: (message) => warnings.push(message),
    });
  }

  it("reports legacy configuration and assigns a fresh standard block", async () => {
    const projectRoot = createProject("legacy-project", 10000, true);

    expect(await run(projectRoot, ["status"])).toBe(1);
    expect(logs.join("\n")).toContain("legacy or customized");

    logs = [];
    expect(await run(projectRoot, ["assign"])).toBe(0);

    const source = readFileSync(
      join(projectRoot, "config", "local.ts"),
      "utf-8",
    );
    const ports = parseProjectPortConfig(source);
    expect(standardPortBase(ports)).toBe(10000);
    expect(source).toContain('API_SECRET: "preserved"');
    expect(source).toContain('SUPABASE_EDGE_RUNTIME_INSPECTOR_PORT: "10008"');
    expect(generatedRoots).toEqual([projectRoot]);
    expect(listProjectPortAllocations({ registryPath })).toMatchObject([
      { projectName: "legacy-project", basePort: 10000 },
    ]);
    logs = [];
    expect(await run(projectRoot, ["status"])).toBe(0);
    expect(logs.join("\n")).toContain(
      "Status: configuration and registry agree",
    );
  });

  it("reports an existing browser-blocked port assignment", async () => {
    const projectRoot = createProject("blocked-project", 10080);

    expect(await run(projectRoot, ["status"])).toBe(1);
    expect(logs.join("\n")).toContain(
      "Browser compatibility: blocked ports 10080 (amanda)",
    );
    expect(logs.join("\n")).toContain(
      "run ports assign to replace browser-blocked ports",
    );
  });

  it("requires legacy projects to assign rather than register", async () => {
    const projectRoot = createProject("legacy-register", 10000, true);

    await expect(run(projectRoot, ["register"])).rejects.toThrow(
      "Run ports assign instead",
    );
    expect(listProjectPortAllocations({ registryPath })).toEqual([]);
  });

  it("registers a standard config and refuses a conflicting project", async () => {
    const first = createProject("first-project", 17420);
    const second = createProject("second-project", 17420);

    expect(await run(first, ["register"])).toBe(0);
    await expect(run(second, ["register"])).rejects.toThrow(
      "Busy or reserved ports",
    );
    expect(await run(first, ["register"])).toBe(0);
    expect(logs.join("\n")).toContain("Already registered");
  });

  it("moves an already standard project to a different automatic block", async () => {
    const projectRoot = createProject("moving-project", 10000);
    expect(await run(projectRoot, ["register"])).toBe(0);

    expect(await run(projectRoot, ["assign"])).toBe(0);

    const ports = parseProjectPortConfig(
      readFileSync(join(projectRoot, "config", "local.ts"), "utf-8"),
    );
    expect(standardPortBase(ports)).toBe(10010);
    expect(listProjectPortAllocations({ registryPath })[0].basePort).toBe(
      10010,
    );
  });

  it("supports an explicit assignment and warns about currently listening old ports", async () => {
    const projectRoot = createProject("custom-project", 10000, true);

    expect(
      await run(projectRoot, ["assign", "--port-base", "18000"], [3074]),
    ).toBe(0);

    expect(warnings.join("\n")).toContain("3074");
    const ports = parseProjectPortConfig(
      readFileSync(join(projectRoot, "config", "local.ts"), "utf-8"),
    );
    expect(standardPortBase(ports)).toBe(18000);
  });

  it("lists and releases an allocation without changing config", async () => {
    const projectRoot = createProject("released-project", 17420);
    const original = readFileSync(
      join(projectRoot, "config", "local.ts"),
      "utf-8",
    );
    expect(await run(projectRoot, ["register"])).toBe(0);

    logs = [];
    expect(await run(projectRoot, ["list"])).toBe(0);
    expect(logs.join("\n")).toContain("17420-17429  released-project");

    logs = [];
    expect(await run(projectRoot, ["release"])).toBe(0);
    expect(listProjectPortAllocations({ registryPath })).toEqual([]);
    expect(readFileSync(join(projectRoot, "config", "local.ts"), "utf-8")).toBe(
      original,
    );
    expect(logs.join("\n")).toContain("Configuration was not changed");
  });

  it("keeps the new source and registry assignment when environment generation fails", async () => {
    const projectRoot = createProject("generation-failure", 10000, true);

    await expect(
      runPortCli(["assign"], {
        cwd: projectRoot,
        generateLocalEnvironment: () => false,
        log: () => undefined,
        probe: () => Promise.resolve(true),
        registryPath,
        warn: () => undefined,
      }),
    ).rejects.toThrow("assignment is saved");

    expect(
      standardPortBase(
        parseProjectPortConfig(
          readFileSync(join(projectRoot, "config", "local.ts"), "utf-8"),
        ),
      ),
    ).toBe(10000);
    expect(listProjectPortAllocations({ registryPath })).toHaveLength(1);
  });
});
