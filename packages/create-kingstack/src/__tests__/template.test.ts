import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { tmpdir } from "os";
import { join } from "path";
import { execFileSync } from "child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "fs";
import {
  replaceNamespace,
  replaceWorkspaceVersions,
  removePublishedPackages,
  getAllFiles,
  copyLocalTemplate,
} from "../template";

describe("copyLocalTemplate", () => {
  const testRoot = join(
    tmpdir(),
    "create-kingstack-local-template-" + Date.now(),
  );
  const sourceDir = join(testRoot, "source");
  const targetDir = join(testRoot, "target");

  beforeEach(() => {
    mkdirSync(sourceDir, { recursive: true });
    execFileSync("git", ["init", "-q"], { cwd: sourceDir });

    writeFileSync(join(sourceDir, ".gitignore"), "ignored.txt\n");
    writeFileSync(join(sourceDir, "tracked.txt"), "original");
    execFileSync("git", ["add", ".gitignore", "tracked.txt"], {
      cwd: sourceDir,
    });

    writeFileSync(join(sourceDir, "tracked.txt"), "uncommitted change");
    writeFileSync(join(sourceDir, "untracked.txt"), "untracked template file");
    writeFileSync(join(sourceDir, "ignored.txt"), "local secret");
  });

  afterEach(() => {
    rmSync(testRoot, { recursive: true, force: true });
  });

  it("copies dirty tracked and non-ignored untracked files without .git", () => {
    expect(copyLocalTemplate(sourceDir, targetDir)).toBe(true);

    expect(readFileSync(join(targetDir, "tracked.txt"), "utf-8")).toBe(
      "uncommitted change",
    );
    expect(readFileSync(join(targetDir, "untracked.txt"), "utf-8")).toBe(
      "untracked template file",
    );
    expect(existsSync(join(targetDir, "ignored.txt"))).toBe(false);
    expect(existsSync(join(targetDir, ".git"))).toBe(false);
  });

  it("refuses to put generated output inside the source repository", () => {
    expect(copyLocalTemplate(sourceDir, join(sourceDir, "generated"))).toBe(
      false,
    );
  });
});

describe("replaceNamespace", () => {
  const testDir = join(tmpdir(), "create-kingstack-test-" + Date.now());

  beforeEach(() => {
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it("should replace @kingstack/shared with @my-app/shared", () => {
    const filePath = join(testDir, "test.ts");
    writeFileSync(filePath, 'import { foo } from "@kingstack/shared";');

    replaceNamespace(testDir, "my-app");

    const content = readFileSync(filePath, "utf-8");
    expect(content).toBe('import { foo } from "@my-app/shared";');
  });

  it("should NOT replace @kingstack/config (published package)", () => {
    const filePath = join(testDir, "test.ts");
    writeFileSync(
      filePath,
      'import { defineValues } from "@kingstack/config";',
    );

    replaceNamespace(testDir, "my-app");

    const content = readFileSync(filePath, "utf-8");
    expect(content).toBe('import { defineValues } from "@kingstack/config";');
  });

  it("should NOT replace @kingstack/advanced-optimistic-store", () => {
    const filePath = join(testDir, "test.ts");
    writeFileSync(
      filePath,
      'import { createOptimisticStore } from "@kingstack/advanced-optimistic-store";',
    );

    replaceNamespace(testDir, "my-app");

    const content = readFileSync(filePath, "utf-8");
    expect(content).toContain("@kingstack/advanced-optimistic-store");
    expect(content).not.toContain("@my-app/advanced-optimistic-store");
  });

  it("should handle multiple replacements in one file", () => {
    const filePath = join(testDir, "test.ts");
    writeFileSync(
      filePath,
      `
import { foo } from "@kingstack/shared";
import { bar } from "@kingstack/prisma";
import { baz } from "@kingstack/config";
`,
    );

    replaceNamespace(testDir, "my-app");

    const content = readFileSync(filePath, "utf-8");
    expect(content).toContain("@my-app/shared");
    expect(content).toContain("@my-app/prisma");
    expect(content).toContain("@kingstack/config"); // Should NOT be replaced
  });
});

describe("replaceWorkspaceVersions", () => {
  const testDir = join(tmpdir(), "create-kingstack-test-" + Date.now());

  beforeEach(() => {
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it("should replace workspace:* with npm version for @kingstack/config", () => {
    const pkgPath = join(testDir, "package.json");
    writeFileSync(
      pkgPath,
      JSON.stringify(
        {
          name: "test",
          devDependencies: {
            "@kingstack/config": "workspace:*",
          },
        },
        null,
        2,
      ),
    );

    replaceWorkspaceVersions(testDir);

    const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
    expect(pkg.devDependencies["@kingstack/config"]).toBe("^0.1.4");
  });

  it("should replace the AOS workspace version with its npm version", () => {
    const pkgPath = join(testDir, "package.json");
    writeFileSync(
      pkgPath,
      JSON.stringify(
        {
          name: "test",
          dependencies: {
            "@kingstack/advanced-optimistic-store": "workspace:*",
          },
        },
        null,
        2,
      ),
    );

    replaceWorkspaceVersions(testDir);

    const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
    expect(pkg.dependencies["@kingstack/advanced-optimistic-store"]).toBe(
      "^0.1.0",
    );
  });

  it("should not modify non-published packages", () => {
    const pkgPath = join(testDir, "package.json");
    writeFileSync(
      pkgPath,
      JSON.stringify(
        {
          name: "test",
          dependencies: {
            "@kingstack/shared": "workspace:*",
          },
        },
        null,
        2,
      ),
    );

    replaceWorkspaceVersions(testDir);

    const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
    expect(pkg.dependencies["@kingstack/shared"]).toBe("workspace:*");
  });
});

describe("removePublishedPackages", () => {
  const testDir = join(tmpdir(), "create-kingstack-test-" + Date.now());

  beforeEach(() => {
    mkdirSync(testDir, { recursive: true });
    mkdirSync(join(testDir, "packages", "config"), { recursive: true });
    mkdirSync(join(testDir, "packages", "advanced-optimistic-store"), {
      recursive: true,
    });
    mkdirSync(join(testDir, "packages", "create-kingstack"), {
      recursive: true,
    });
    mkdirSync(join(testDir, "packages", "shared"), { recursive: true });
    writeFileSync(join(testDir, "packages", "config", "package.json"), "{}");
    writeFileSync(
      join(testDir, "packages", "advanced-optimistic-store", "package.json"),
      "{}",
    );
    writeFileSync(
      join(testDir, "packages", "create-kingstack", "package.json"),
      "{}",
    );
    writeFileSync(join(testDir, "packages", "shared", "package.json"), "{}");
    writeFileSync(
      join(testDir, "Dockerfile"),
      [
        "COPY packages/config/package.json packages/config/package.json",
        "COPY packages/advanced-optimistic-store/package.json packages/advanced-optimistic-store/package.json",
        "COPY packages/shared/package.json packages/shared/package.json",
      ].join("\n"),
    );
    mkdirSync(join(testDir, "scripts"), { recursive: true });
    writeFileSync(
      join(testDir, "scripts", "test-create-kingstack.ts"),
      "contributor only",
    );
    writeFileSync(
      join(testDir, "scripts", "enable-backend.ts"),
      "generated project command",
    );
    writeFileSync(
      join(testDir, "package.json"),
      JSON.stringify({
        scripts: {
          test: "vitest",
          "test:create-kingstack": "bun scripts/test-create-kingstack.ts",
          "backend:enable": "bun scripts/enable-backend.ts",
        },
      }),
    );
    writeFileSync(
      join(testDir, "readme.md"),
      [
        "# App",
        "",
        "<!-- create-kingstack:contributor-only:start -->",
        "bun scripts/test-create-kingstack example",
        "<!-- create-kingstack:contributor-only:end -->",
        "",
        "Generated-project documentation.",
      ].join("\n"),
    );
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it("should remove packages/config", () => {
    removePublishedPackages(testDir);
    expect(existsSync(join(testDir, "packages", "config"))).toBe(false);
  });

  it("should remove packages/create-kingstack", () => {
    removePublishedPackages(testDir);
    expect(existsSync(join(testDir, "packages", "create-kingstack"))).toBe(
      false,
    );
  });

  it("should remove packages/advanced-optimistic-store", () => {
    removePublishedPackages(testDir);
    expect(
      existsSync(join(testDir, "packages", "advanced-optimistic-store")),
    ).toBe(false);
  });

  it("should NOT remove packages/shared", () => {
    removePublishedPackages(testDir);
    expect(existsSync(join(testDir, "packages", "shared"))).toBe(true);
  });

  it("should return count of removed packages", () => {
    const count = removePublishedPackages(testDir);
    expect(count).toBe(3);
  });

  it("should remove the local smoke-test helper", () => {
    removePublishedPackages(testDir);
    expect(
      existsSync(join(testDir, "scripts", "test-create-kingstack.ts")),
    ).toBe(false);
    const pkg = JSON.parse(
      readFileSync(join(testDir, "package.json"), "utf-8"),
    );
    expect(pkg.scripts.test).toBe("vitest");
    expect(pkg.scripts["test:create-kingstack"]).toBeUndefined();
    expect(pkg.scripts["backend:enable"]).toBe("bun scripts/enable-backend.ts");
    expect(existsSync(join(testDir, "scripts", "enable-backend.ts"))).toBe(
      true,
    );
    const readme = readFileSync(join(testDir, "readme.md"), "utf-8");
    expect(readme).not.toContain("scripts/test-create-kingstack");
    expect(readme).toContain("Generated-project documentation.");
  });

  it("should remove published workspace COPY lines from Dockerfiles", () => {
    removePublishedPackages(testDir);

    const content = readFileSync(join(testDir, "Dockerfile"), "utf-8");
    expect(content).not.toContain("packages/config/package.json");
    expect(content).not.toContain(
      "packages/advanced-optimistic-store/package.json",
    );
    expect(content).toContain("packages/shared/package.json");
  });
});

describe("getAllFiles", () => {
  const testDir = join(tmpdir(), "create-kingstack-test-" + Date.now());

  beforeEach(() => {
    mkdirSync(testDir, { recursive: true });
    mkdirSync(join(testDir, "src"), { recursive: true });
    mkdirSync(join(testDir, "node_modules"), { recursive: true });
    writeFileSync(join(testDir, "src", "index.ts"), "");
    writeFileSync(join(testDir, "package.json"), "{}");
    writeFileSync(join(testDir, "node_modules", "something.js"), "");
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it("should find .ts files", () => {
    const files = getAllFiles(testDir);
    expect(files.some((f) => f.endsWith("index.ts"))).toBe(true);
  });

  it("should find .json files", () => {
    const files = getAllFiles(testDir);
    expect(files.some((f) => f.endsWith("package.json"))).toBe(true);
  });

  it("should skip node_modules", () => {
    const files = getAllFiles(testDir);
    expect(files.some((f) => f.includes("node_modules"))).toBe(false);
  });
});

describe("published AOS template conversion", () => {
  const testDir = join(
    tmpdir(),
    "create-kingstack-aos-conversion-" + Date.now(),
  );

  beforeEach(() => {
    mkdirSync(join(testDir, "apps", "next", "src"), { recursive: true });
    mkdirSync(join(testDir, "packages", "advanced-optimistic-store"), {
      recursive: true,
    });

    writeFileSync(
      join(testDir, "apps", "next", "package.json"),
      JSON.stringify(
        {
          name: "@kingstack/next",
          dependencies: {
            "@kingstack/advanced-optimistic-store": "workspace:*",
          },
        },
        null,
        2,
      ),
    );
    writeFileSync(
      join(testDir, "apps", "next", "src", "store.ts"),
      'import { createOptimisticStore } from "@kingstack/advanced-optimistic-store";',
    );
    writeFileSync(
      join(testDir, "packages", "advanced-optimistic-store", "package.json"),
      "{}",
    );
    writeFileSync(
      join(testDir, "Dockerfile"),
      "COPY packages/advanced-optimistic-store/package.json packages/advanced-optimistic-store/package.json\n",
    );
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it("produces an npm dependency with no local workspace coupling", () => {
    removePublishedPackages(testDir);
    replaceNamespace(testDir, "my-app");
    replaceWorkspaceVersions(testDir);

    const pkg = JSON.parse(
      readFileSync(join(testDir, "apps", "next", "package.json"), "utf-8"),
    );
    const source = readFileSync(
      join(testDir, "apps", "next", "src", "store.ts"),
      "utf-8",
    );
    const dockerfile = readFileSync(join(testDir, "Dockerfile"), "utf-8");

    expect(pkg.name).toBe("@my-app/next");
    expect(pkg.dependencies["@kingstack/advanced-optimistic-store"]).toBe(
      "^0.1.0",
    );
    expect(source).toContain("@kingstack/advanced-optimistic-store");
    expect(
      existsSync(join(testDir, "packages", "advanced-optimistic-store")),
    ).toBe(false);
    expect(dockerfile).not.toContain("advanced-optimistic-store");
  });
});
