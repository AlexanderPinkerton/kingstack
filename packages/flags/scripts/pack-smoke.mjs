import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = fileURLToPath(new URL("../", import.meta.url));
const repositoryRoot = resolve(packageRoot, "../..");
const require = createRequire(join(packageRoot, "package.json"));
const temporaryRoot = mkdtempSync(join(tmpdir(), "kingstack-flags-pack-"));

function runNode(args, cwd = temporaryRoot) {
  execFileSync(process.execPath, args, {
    cwd,
    stdio: "pipe",
    env: { ...process.env, NODE_PATH: "" },
  });
}

function dependencyRoot(name) {
  let directory = dirname(require.resolve(name));
  while (directory !== dirname(directory)) {
    const manifest = join(directory, "package.json");
    if (
      existsSync(manifest) &&
      JSON.parse(readFileSync(manifest, "utf8")).name === name
    )
      return directory;
    directory = dirname(directory);
  }
  throw new Error(`Cannot locate installed dependency ${name}`);
}

function checkBrowserGraph(file, allowed, visited = new Set()) {
  if (visited.has(file)) return;
  visited.add(file);
  const source = readFileSync(file, "utf8");
  const imports = source.matchAll(
    /(?:from\s+|import\s*\(\s*|require\s*\(\s*)["']([^"']+)["']/g,
  );
  for (const [, specifier] of imports) {
    if (specifier.startsWith(".")) {
      let target = resolve(dirname(file), specifier);
      if (file.endsWith(".d.ts")) target = target.replace(/\.js$/, ".d.ts");
      checkBrowserGraph(target, allowed, visited);
    } else
      assert(
        allowed.has(specifier),
        `Browser entry imports unexpected dependency: ${specifier}`,
      );
  }
}

try {
  const archive = join(temporaryRoot, "flags.tgz");
  runNode(
    [
      join(repositoryRoot, ".yarn/releases/yarn-4.10.2.cjs"),
      "pack",
      "--out",
      archive,
    ],
    packageRoot,
  );
  execFileSync("tar", ["-xzf", archive, "-C", temporaryRoot]);
  const installed = join(temporaryRoot, "node_modules/@kingstack/flags");
  mkdirSync(dirname(installed), { recursive: true });
  renameSync(join(temporaryRoot, "package"), installed);
  writeFileSync(
    join(temporaryRoot, "package.json"),
    JSON.stringify({ private: true, type: "module" }),
  );

  for (const [entry, allowed] of [
    ["index", []],
    ["http", []],
    ["testing", []],
    ["mobx", ["mobx"]],
    ["react", ["react", "mobx"]],
  ]) {
    for (const extension of [".js", ".d.ts"]) {
      checkBrowserGraph(
        join(installed, `dist/esm/${entry}${extension}`),
        new Set(allowed),
      );
    }
  }

  // A completely isolated consumer: even OpenFeature, MobX, React and Nest are absent.
  const assertions = `
    const flag = booleanFlag({ key: "test", description: "Test", defaultValue: true, clientVisible: true });
    const catalog = defineFlags({ flag });
    const evaluator = createFlagEvaluator({ client: null });
    assert.equal(await evaluator.evaluate(flag), true);
    const handler = createSnapshotHandler({ evaluator, catalog, resolveContext: () => Promise.resolve({ scope: "draft", context: {} }) });
    const response = await handler(new Request("https://example.test/api/feature-flags"));
    assert.equal(response.status, 200);
    const snapshot = await response.json();
    assert.equal(snapshot.flags.test.value, true);
    assert.equal(snapshot.flags.test.status, DecisionStatuses.Default);
    assert.equal(snapshot.mode, SnapshotModes.Disabled);
  `;
  writeFileSync(
    join(temporaryRoot, "consumer.mjs"),
    `
    import assert from "node:assert/strict";
    import { booleanFlag, defineFlags, DecisionStatuses, SnapshotModes } from "@kingstack/flags";
    import { createFlagEvaluator, createSnapshotHandler } from "@kingstack/flags/server";
    import "@kingstack/flags/http";
    import "@kingstack/flags/testing";
    ${assertions}
  `,
  );
  writeFileSync(
    join(temporaryRoot, "consumer.cjs"),
    `
    const assert = require("node:assert/strict");
    const { booleanFlag, defineFlags, DecisionStatuses, SnapshotModes } = require("@kingstack/flags");
    const { createFlagEvaluator, createSnapshotHandler } = require("@kingstack/flags/server");
    require("@kingstack/flags/http");
    require("@kingstack/flags/testing");
    (async () => { ${assertions} })().catch(error => { console.error(error); process.exitCode = 1; });
  `,
  );
  runNode(["consumer.mjs"]);
  runNode(["consumer.cjs"]);

  // Add only the documented peers for the declaration and browser runtime checks.
  for (const name of [
    "@openfeature/core",
    "@openfeature/server-sdk",
    "mobx",
    "react",
  ]) {
    const target = join(temporaryRoot, "node_modules", name);
    mkdirSync(dirname(target), { recursive: true });
    symlinkSync(dependencyRoot(name), target, "dir");
  }
  for (const name of ["react", "node"]) {
    const target = join(temporaryRoot, "node_modules/@types", name);
    mkdirSync(dirname(target), { recursive: true });
    symlinkSync(
      dirname(require.resolve(`@types/${name}/package.json`)),
      target,
      "dir",
    );
  }

  const consumer = `
    import { booleanFlag, defineFlags, variantFlag } from "@kingstack/flags";
    import { createFlagEvaluator, createSnapshotHandler } from "@kingstack/flags/server";
    import { createHttpSnapshotLoader } from "@kingstack/flags/http";
    import { FeatureFlagStore } from "@kingstack/flags/mobx";
    import { FeatureFlagContext, useFeatureFlags } from "@kingstack/flags/react";
    import { createFixtureLoader } from "@kingstack/flags/testing";
    const flags = defineFlags({ layout: variantFlag({ key: "layout", description: "Layout", variants: ["control", "compact"], defaultValue: "control", clientVisible: true }) });
    const store = new FeatureFlagStore({ catalog: flags, enabled: true, scope: "draft", loadSnapshot: createFixtureLoader(flags, { layout: "compact" }) });
    const variant: "control" | "compact" = store.get(flags.layout);
    const evaluator = createFlagEvaluator({ client: null });
    const result: Promise<"control" | "compact"> = evaluator.evaluate(flags.layout);
    // @ts-expect-error published declarations must retain variant literals
    const invalid: "other" = store.get(flags.layout);
  `;
  writeFileSync(join(temporaryRoot, "types.mts"), consumer);
  writeFileSync(join(temporaryRoot, "types.cts"), consumer);
  const compiler = require.resolve("typescript/bin/tsc");
  const common = [
    "--strict",
    "--noEmit",
    "--target",
    "ES2022",
    "--lib",
    "ES2022,DOM",
    "--types",
    "node",
    "--esModuleInterop",
  ];
  runNode([
    compiler,
    ...common,
    "--module",
    "NodeNext",
    "--moduleResolution",
    "NodeNext",
    "types.mts",
    "types.cts",
  ]);
  // CycleArena-style legacy Nest compilation, in addition to modern exports resolution.
  runNode([
    compiler,
    ...common,
    "--module",
    "CommonJS",
    "--moduleResolution",
    "Node",
    "types.cts",
  ]);
  runNode([
    "--input-type=module",
    "-e",
    `
    import assert from "node:assert/strict";
    import { FeatureFlagStore } from "@kingstack/flags/mobx";
    import { FeatureFlagContext } from "@kingstack/flags/react";
    assert(new FeatureFlagStore({ catalog: {} }).ready);
    assert(FeatureFlagContext.Provider);
  `,
  ]);
  console.log(
    `Packed ESM/CommonJS imports, browser boundaries, and consumer types passed on ${process.version}. No Nest or PostHog installed in the consumer.`,
  );
} catch (error) {
  if (error?.stdout) process.stderr.write(error.stdout);
  if (error?.stderr) process.stderr.write(error.stderr);
  throw error;
} finally {
  rmSync(temporaryRoot, { recursive: true, force: true });
}
