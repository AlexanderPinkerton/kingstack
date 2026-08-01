import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { generateLocalConfig } from "../config-generators";
import {
  allocateProjectPorts,
  portsFromBase,
  projectBlockPorts,
  uniquePorts,
} from "../ports";

describe("smart port allocation", () => {
  let testRoot: string;
  let registryPath: string;

  beforeEach(() => {
    testRoot = mkdtempSync(join(tmpdir(), "create-kingstack-ports-"));
    registryPath = join(testRoot, "port-allocations.json");
  });

  afterEach(() => {
    rmSync(testRoot, { recursive: true, force: true });
  });

  it("maps one project block across every local service", () => {
    expect(portsFromBase(17420)).toEqual({
      next: 17420,
      nest: 17421,
      supabaseDbShadowPort: 17422,
      supabaseApiPort: 17423,
      supabaseDbDirectPort: 17424,
      supabaseDbPoolerPort: 17424,
      supabaseStudioPort: 17425,
      supabaseEmailPort: 17426,
      supabaseAnalyticsPort: 17427,
      supabaseEdgeRuntimeInspectorPort: 17428,
    });
    expect(uniquePorts(portsFromBase(17420))).toHaveLength(9);
    expect(projectBlockPorts(17420)).toEqual([
      17420, 17421, 17422, 17423, 17424, 17425, 17426, 17427, 17428, 17429,
    ]);
  });

  it("skips a block containing a port used by a running process", async () => {
    const allocation = await allocateProjectPorts({
      projectName: "new-project",
      targetDir: join(testRoot, "new-project"),
      registryPath,
      probe: (port) => Promise.resolve(port !== 10003),
    });

    expect(allocation.basePort).toBe(10010);
    expect(existsSync(registryPath)).toBe(true);
  });

  it("reserves blocks belonging to stopped projects that still exist", async () => {
    const existingProject = join(testRoot, "existing-project");
    mkdirSync(existingProject);

    await allocateProjectPorts({
      projectName: "existing-project",
      targetDir: existingProject,
      setup: "full",
      preferredBase: 10000,
      registryPath,
      probe: () => Promise.resolve(true),
    });

    const allocation = await allocateProjectPorts({
      projectName: "new-project",
      targetDir: join(testRoot, "new-project"),
      registryPath,
      probe: () => Promise.resolve(true),
    });

    expect(allocation.basePort).toBe(10010);
    const registry = JSON.parse(readFileSync(registryPath, "utf-8"));
    expect(registry.allocations).toHaveLength(2);
    expect(registry.allocations[0].setup).toBe("full");
  });

  it("rejects an explicitly requested block when any port is unavailable", async () => {
    await expect(
      allocateProjectPorts({
        projectName: "new-project",
        targetDir: join(testRoot, "new-project"),
        preferredBase: 17420,
        registryPath,
        probe: (port) => Promise.resolve(port !== 17424),
      }),
    ).rejects.toThrow("Busy or reserved ports: 17424");
  });

  it("protects the reserved tenth port from overlapping explicit blocks", async () => {
    await allocateProjectPorts({
      projectName: "existing-project",
      targetDir: join(testRoot, "existing-project"),
      preferredBase: 10000,
      registryPath,
      probe: () => Promise.resolve(true),
    });

    await expect(
      allocateProjectPorts({
        projectName: "overlapping-project",
        targetDir: join(testRoot, "overlapping-project"),
        preferredBase: 10009,
        registryPath,
        probe: () => Promise.resolve(true),
      }),
    ).rejects.toThrow("Busy or reserved ports: 10009");
  });

  it("serializes concurrent allocations through the registry lock", async () => {
    const allocations = await Promise.all(
      ["project-one", "project-two"].map((projectName) =>
        allocateProjectPorts({
          projectName,
          targetDir: join(testRoot, projectName),
          registryPath,
          probe: async () => {
            await new Promise((resolveDelay) => setTimeout(resolveDelay, 1));
            return true;
          },
        }),
      ),
    );

    expect(allocations.map(({ basePort }) => basePort).sort()).toEqual([
      10000, 10010,
    ]);
  });

  it("writes the complete allocation into generated local config", () => {
    const targetDir = join(testRoot, "generated-project");
    mkdirSync(join(targetDir, "config"), { recursive: true });

    generateLocalConfig(targetDir, "generated-project", portsFromBase(17420));

    const config = readFileSync(join(targetDir, "config", "local.ts"), "utf-8");
    expect(config).toContain('NEXT_PORT: "17420"');
    expect(config).toContain('SUPABASE_API_PORT: "17423"');
    expect(config).toContain('SUPABASE_EDGE_RUNTIME_INSPECTOR_PORT: "17428"');
    expect(config).toContain('KINGSTACK_ENVIRONMENT: "local"');
    expect(config).not.toContain("ENVIRONMENT_TYPE");
  });
});
