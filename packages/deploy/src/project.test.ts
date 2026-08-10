import {
  mkdtempSync,
  mkdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it, spyOn } from "bun:test";
import { runDeployCli } from "./cli.js";
import { loadProjectConfig } from "./nest/digitalocean/project-config.js";
import { resolveKingStackProject } from "./project.js";

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { force: true, recursive: true });
  }
});

describe("KingStack project boundary", () => {
  it("resolves --cwd without changing the caller's working directory", async () => {
    const before = process.cwd();
    const output: string[] = [];
    const log = spyOn(console, "log").mockImplementation((value = "") => {
      output.push(String(value));
    });

    try {
      await runDeployCli(["--cwd", "fixture", "nest", "--help"], {
        version: "0.1.0-test",
        currentWorkingDirectory: () => "/tmp/kingstack-runner",
      });
    } finally {
      log.mockRestore();
    }

    expect(process.cwd()).toBe(before);
    expect(output.join("\n")).toContain(
      "Deploy the KingStack NestJS Docker image",
    );
    expect(
      resolveKingStackProject("fixture", "/tmp/kingstack-runner").root,
    ).toBe("/tmp/kingstack-runner/fixture");
  });

  it("loads a compatible project from its explicit root", async () => {
    const root = createProjectFixture();

    const project = await loadProjectConfig("production", { root });

    expect(project.appSlug).toBe("fixture-app");
    expect(project.prismaWorkspace).toBe("@fixture/prisma");
    expect(project.port).toBe(3420);
    expect(project.backendUrl).toBe("https://api.example.com");
    expect(project.nestEnv).toContain("LOG_FORMAT=json");
  });

  it("reports every missing required project artifact before mutation", async () => {
    const root = mkdtempSync(join(tmpdir(), "kingstack-deploy-empty-"));
    temporaryDirectories.push(root);

    let message = "";
    try {
      await loadProjectConfig("production", { root });
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }
    expect(message).toContain(
      "Missing: package.json, apps/nest/Dockerfile, config/schema.ts, config/production.ts, packages/prisma/package.json",
    );
  });
});

function createProjectFixture(): string {
  const root = mkdtempSync(join(tmpdir(), "kingstack-deploy-project-"));
  temporaryDirectories.push(root);
  mkdirSync(join(root, "apps/nest"), { recursive: true });
  mkdirSync(join(root, "config"), { recursive: true });
  mkdirSync(join(root, "packages/prisma"), { recursive: true });
  symlinkSync(
    resolve(import.meta.dir, "../../../node_modules"),
    join(root, "node_modules"),
    "dir",
  );

  writeFileSync(
    join(root, "package.json"),
    JSON.stringify({ name: "@fixture/fixture-app" }),
  );
  writeFileSync(join(root, "apps/nest/Dockerfile"), "FROM scratch\n");
  writeFileSync(
    join(root, "packages/prisma/package.json"),
    JSON.stringify({ name: "@fixture/prisma" }),
  );
  writeFileSync(
    join(root, "config/schema.ts"),
    `import { defineSchema, EnvironmentMode } from "@kingstack/config";

export const schema = defineSchema({
  environments: {
    production: { mode: EnvironmentMode.Hosted },
  },
  core: {
    NEST_PORT: { default: "3420" },
    LOG_FORMAT: { default: "json" },
    DATABASE_URL: { default: "postgresql://fixture" },
  },
  computed: () => ({
    NEXT_PUBLIC_NEST_BACKEND_URL: "https://api.example.com",
  }),
  envfiles: {
    nest: { path: "apps/nest/.env", keys: ["NEST_PORT", "LOG_FORMAT"] },
    prisma: { path: "packages/prisma/.env", keys: ["DATABASE_URL"] },
  },
});
`,
  );
  writeFileSync(
    join(root, "config/production.ts"),
    `import { defineValues } from "@kingstack/config";
export const values = defineValues({});
`,
  );
  return root;
}
