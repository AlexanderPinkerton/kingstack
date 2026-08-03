import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { afterEach, describe, expect, it } from "vitest";
import {
  findKingStackProjectRoot,
  parseProjectPortConfig,
  readProjectPortConfig,
  renderProjectPortConfig,
  standardPortBase,
  writeProjectPortConfig,
} from "../port-config";
import { portsFromBase } from "../ports";

const temporaryRoots: string[] = [];

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) {
    rmSync(root, { force: true, recursive: true });
  }
});

function configSource(basePort: number): string {
  const ports = portsFromBase(basePort);
  return `import { defineValues } from "@kingstack/config";

export const values = defineValues({
  NEXT_PORT: "${ports.next}",
  NEST_PORT: '${ports.nest}',
  SUPABASE_DB_SHADOW_PORT: "${ports.supabaseDbShadowPort}",
  SUPABASE_API_PORT: "${ports.supabaseApiPort}",
  SUPABASE_DB_DIRECT_PORT: "${ports.supabaseDbDirectPort}",
  SUPABASE_DB_POOLER_PORT: "${ports.supabaseDbPoolerPort}",
  SUPABASE_STUDIO_PORT: "${ports.supabaseStudioPort}",
  SUPABASE_EMAIL_PORT: "${ports.supabaseEmailPort}",
  SUPABASE_ANALYTICS_PORT: "${ports.supabaseAnalyticsPort}",
  SUPABASE_EDGE_RUNTIME_INSPECTOR_PORT: "${ports.supabaseEdgeRuntimeInspectorPort}",
  API_SECRET: "keep-me",
});
`;
}

function createProject(basePort = 17420): string {
  const root = mkdtempSync(join(tmpdir(), "kingstack-port-config-test-"));
  temporaryRoots.push(root);
  mkdirSync(join(root, "config"));
  mkdirSync(join(root, "apps", "next"), { recursive: true });
  writeFileSync(
    join(root, "package.json"),
    JSON.stringify({ name: "existing-project" }),
  );
  writeFileSync(join(root, "config", "local.ts"), configSource(basePort));
  return root;
}

describe("project port configuration", () => {
  it("reads a standard block and finds the project from a child directory", () => {
    const root = createProject();
    const config = readProjectPortConfig(root);

    expect(findKingStackProjectRoot(join(root, "apps", "next"))).toBe(root);
    expect(config.projectName).toBe("existing-project");
    expect(config.ports).toEqual(portsFromBase(17420));
    expect(standardPortBase(config.ports)).toBe(17420);
  });

  it("recognizes legacy split ports as non-standard", () => {
    const ports = parseProjectPortConfig(
      configSource(17420).replace('NEXT_PORT: "17420"', 'NEXT_PORT: "3074"'),
    );

    expect(standardPortBase(ports)).toBeUndefined();
  });

  it("updates only port values and preserves formatting and secrets", () => {
    const original = configSource(17420);
    const updated = renderProjectPortConfig(original, portsFromBase(18000));

    expect(updated).toContain('NEXT_PORT: "18000"');
    expect(updated).toContain("NEST_PORT: '18001'");
    expect(updated).toContain('API_SECRET: "keep-me"');
    expect(updated.replace(/\d+/g, "#")).toBe(original.replace(/\d+/g, "#"));
  });

  it("writes an existing config atomically without replacing other values", () => {
    const root = createProject();
    const config = readProjectPortConfig(root);

    writeProjectPortConfig(config, portsFromBase(19000));

    const updated = readFileSync(config.configPath, "utf-8");
    expect(parseProjectPortConfig(updated)).toEqual(portsFromBase(19000));
    expect(updated).toContain('API_SECRET: "keep-me"');
  });

  it("uses schema defaults for missing legacy keys and inserts them on assignment", () => {
    const root = createProject();
    const configPath = join(root, "config", "local.ts");
    writeFileSync(
      configPath,
      readFileSync(configPath, "utf-8").replace(
        /.*SUPABASE_EDGE_RUNTIME_INSPECTOR_PORT.*\n/,
        "",
      ),
    );
    writeFileSync(
      join(root, "config", "schema.ts"),
      `export const schema = {
  SUPABASE_EDGE_RUNTIME_INSPECTOR_PORT: {
    required: false,
    default: "54327",
  },
};
`,
    );

    const config = readProjectPortConfig(root);
    expect(config.ports.supabaseEdgeRuntimeInspectorPort).toBe(54327);
    expect(config.missingConfigKeys).toEqual([
      "SUPABASE_EDGE_RUNTIME_INSPECTOR_PORT",
    ]);

    writeProjectPortConfig(config, portsFromBase(20000));

    const updated = readFileSync(configPath, "utf-8");
    expect(updated).toContain('SUPABASE_EDGE_RUNTIME_INSPECTOR_PORT: "20008"');
    expect(updated).toContain('API_SECRET: "keep-me"');
  });

  it("refuses missing, duplicated, or non-string port properties", () => {
    const source = configSource(17420);
    expect(() =>
      parseProjectPortConfig(source.replace(/.*NEXT_PORT.*\n/, "")),
    ).toThrow("NEXT_PORT");
    expect(() =>
      parseProjectPortConfig(
        source.replace(
          'NEXT_PORT: "17420",',
          'NEXT_PORT: "17420",\n  NEXT_PORT: "17421",',
        ),
      ),
    ).toThrow("found 2");
    expect(() =>
      parseProjectPortConfig(
        source.replace('NEXT_PORT: "17420"', "NEXT_PORT: 17420"),
      ),
    ).toThrow("NEXT_PORT");
  });
});
