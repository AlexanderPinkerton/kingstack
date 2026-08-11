import { describe, expect, it } from "bun:test";
import {
  assertNewPackageContract,
  hasExpectedTrust,
  parseBootstrapArgs,
  parseTrustConfiguration,
  pendingChangesetRelease,
  repositorySlug,
  validatePackedManifest,
  validateWorkspaceManifest,
  verificationScripts,
  type PackageManifest,
} from "./bootstrap-public-package.js";

const validManifest: PackageManifest = {
  name: "@kingstack/example",
  version: "0.0.0",
  repository: {
    type: "git",
    url: "https://github.com/AlexanderPinkerton/kingstack.git",
    directory: "packages/example",
  },
  publishConfig: { access: "public" },
  scripts: {
    build: "tsc",
    lint: "eslint src",
    test: "vitest run",
    typecheck: "tsc --noEmit",
  },
};

describe("public package bootstrap arguments", () => {
  it("parses a package, dry runs, and confirmation bypasses", () => {
    expect(
      parseBootstrapArgs(["@kingstack/example", "--dry-run", "--yes"]),
    ).toEqual({
      dryRun: true,
      help: false,
      packageName: "@kingstack/example",
      yes: true,
    });
  });

  it("rejects unknown options and extra package names", () => {
    expect(() => parseBootstrapArgs(["--force"])).toThrow("Unknown option");
    expect(() =>
      parseBootstrapArgs(["@kingstack/one", "@kingstack/two"]),
    ).toThrow("Unexpected argument");
  });
});

describe("public package manifest validation", () => {
  it("accepts the standard public KingStack package contract", () => {
    expect(
      validateWorkspaceManifest(
        validManifest,
        "@kingstack/example",
        "/repo/packages/example",
      ),
    ).toMatchObject({
      directory: "/repo/packages/example",
      manifest: { name: "@kingstack/example", version: "0.0.0" },
    });
    expect(repositorySlug(validManifest.repository)).toBe(
      "AlexanderPinkerton/kingstack",
    );
    expect(verificationScripts(validManifest)).toEqual([
      "lint",
      "typecheck",
      "test",
      "build",
    ]);
  });

  it("rejects private, incorrectly scoped, and misconfigured packages", () => {
    expect(() =>
      validateWorkspaceManifest(
        { ...validManifest, private: true },
        "@kingstack/example",
        "/repo/packages/example",
      ),
    ).toThrow("is private");
    expect(() =>
      validateWorkspaceManifest(
        { ...validManifest, name: "@other/example" },
        "@other/example",
        "/repo/packages/example",
      ),
    ).toThrow("Only literal @kingstack/*");
    expect(() =>
      validateWorkspaceManifest(
        { ...validManifest, publishConfig: undefined },
        "@kingstack/example",
        "/repo/packages/example",
      ),
    ).toThrow("publishConfig.access");
  });
});

describe("new Changesets package contract", () => {
  it("requires a 0.0.0 package with an initial minor Changeset", () => {
    const release = pendingChangesetRelease(
      [
        `---
"@kingstack/example": minor
"@kingstack/config": patch
---`,
      ],
      "@kingstack/example",
    );

    expect(release).toBe("minor");
    expect(() =>
      assertNewPackageContract("@kingstack/example", "0.0.0", release),
    ).not.toThrow();
    expect(() =>
      assertNewPackageContract("@kingstack/example", "0.1.0", release),
    ).toThrow("must start at 0.0.0");
    expect(() =>
      assertNewPackageContract("@kingstack/example", "0.0.0", undefined),
    ).toThrow("pending minor Changeset");
  });
});

describe("packed package validation", () => {
  it("accepts registry dependency ranges", () => {
    expect(() =>
      validatePackedManifest(
        {
          name: "@kingstack/example",
          version: "0.0.0",
          dependencies: { "@kingstack/config": "0.3.0" },
        },
        "@kingstack/example",
        "0.0.0",
      ),
    ).not.toThrow();
  });

  it("rejects local-only dependency protocols in the artifact", () => {
    expect(() =>
      validatePackedManifest(
        {
          name: "@kingstack/example",
          version: "0.0.0",
          dependencies: { "@kingstack/config": "workspace:*" },
        },
        "@kingstack/example",
        "0.0.0",
      ),
    ).toThrow("local-only workspace:");
  });
});

describe("npm trusted-publisher validation", () => {
  it("parses and accepts the exact KingStack GitHub publisher", () => {
    const trust = parseTrustConfiguration(`npm authentication complete
{
  "id": "publisher-id",
  "type": "github",
  "file": "release-changeset.yml",
  "repository": "AlexanderPinkerton/kingstack",
  "permissions": ["createPackage"]
}`);

    expect(trust).toBeDefined();
    expect(hasExpectedTrust(trust!)).toBe(true);
  });

  it("distinguishes missing and mismatched publishers", () => {
    expect(parseTrustConfiguration("\n")).toBeUndefined();
    expect(
      hasExpectedTrust({
        type: "github",
        file: "release.yml",
        repository: "AlexanderPinkerton/kingstack",
        permissions: ["createPackage"],
      }),
    ).toBe(false);
  });
});
