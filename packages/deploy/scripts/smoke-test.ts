import { spawnSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const repositoryRoot = resolve(import.meta.dir, "../../..");
const temporaryRoot = mkdtempSync(
  join(tmpdir(), "kingstack-deploy-package-smoke-"),
);
const projectRoot = join(temporaryRoot, "project");
const configArchive = join(temporaryRoot, "kingstack-config.tgz");
const deployArchive = join(temporaryRoot, "kingstack-deploy.tgz");
const expectedVersion = (
  JSON.parse(
    readFileSync(join(repositoryRoot, "packages/deploy/package.json"), "utf8"),
  ) as { version: string }
).version;

try {
  run("yarn", ["workspace", "@kingstack/config", "build"], repositoryRoot);
  run("yarn", ["workspace", "@kingstack/deploy", "build"], repositoryRoot);
  run(
    "yarn",
    ["workspace", "@kingstack/config", "pack", "--out", configArchive],
    repositoryRoot,
  );
  run(
    "yarn",
    ["workspace", "@kingstack/deploy", "pack", "--out", deployArchive],
    repositoryRoot,
  );

  writeFileSync(
    join(temporaryRoot, "package.json"),
    `${JSON.stringify(
      {
        private: true,
        packageManager: "yarn@4.10.2",
        resolutions: {
          "@kingstack/config": `file:${configArchive}`,
        },
        devDependencies: {
          "@kingstack/config": `file:${configArchive}`,
          "@kingstack/deploy": `file:${deployArchive}`,
        },
      },
      null,
      2,
    )}\n`,
  );
  writeFileSync(
    join(temporaryRoot, ".yarnrc.yml"),
    "enableGlobalCache: false\nnodeLinker: node-modules\n",
  );
  mkdirSync(join(projectRoot, "config"), { recursive: true });
  writeFileSync(
    join(projectRoot, "config/schema.ts"),
    `import { defineSchema, EnvironmentMode } from "@kingstack/config";

export const schema = defineSchema({
  environments: {
    production: { mode: EnvironmentMode.Hosted },
  },
  core: {
    NEXT_HOST: { required: true },
    SUPABASE_PROJECT_REF: { required: true },
  },
  computed: (core) => ({ NEXT_URL: \`https://\${core.NEXT_HOST}\` }),
  envfiles: {},
});
`,
  );
  writeFileSync(
    join(projectRoot, "config/production.ts"),
    `import { defineValues } from "@kingstack/config";
export const values = defineValues({
  NEXT_HOST: "app.example.com",
  SUPABASE_PROJECT_REF: "abcdefghijklmnopqrst",
});
`,
  );

  run("yarn", ["install"], temporaryRoot);

  const version = run(
    "yarn",
    ["exec", "king-deploy", "--version"],
    temporaryRoot,
  );
  if (version.trim() !== expectedVersion) {
    throw new Error(`Unexpected packed CLI version: ${version.trim()}`);
  }

  for (const args of [
    ["--help"],
    ["nest", "--help"],
    ["supabase", "provision", "--help"],
    ["supabase", "pull", "--help"],
    ["supabase", "auth", "--help"],
    ["vercel", "pull", "--help"],
  ]) {
    run("yarn", ["exec", "king-deploy", ...args], temporaryRoot);
  }

  const dryRun = run(
    "yarn",
    [
      "exec",
      "king-deploy",
      "--cwd",
      projectRoot,
      "supabase",
      "auth",
      "production",
      "--dry-run",
    ],
    temporaryRoot,
  );
  if (!dryRun.includes("Dry run complete")) {
    throw new Error("The packed CLI did not load the fixture project.");
  }

  console.log("Packed @kingstack/deploy smoke test passed.");
} finally {
  rmSync(temporaryRoot, { force: true, recursive: true });
}

function run(command: string, args: string[], cwd: string): string {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    env: {
      ...process.env,
      YARN_CACHE_FOLDER: join(temporaryRoot, ".yarn-cache"),
      YARN_ENABLE_GLOBAL_CACHE: "false",
      YARN_GLOBAL_FOLDER: join(temporaryRoot, ".yarn-global"),
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(
      `${command} ${args.join(" ")} failed (${result.status ?? "unknown"}).\n${result.stdout || ""}${result.stderr || ""}`,
    );
  }
  return result.stdout || "";
}
