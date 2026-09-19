import { describe, expect, it } from "bun:test";
import { rejects } from "node:assert/strict";
import {
  assertNewPackageContract,
  hasExpectedTrust,
  parseBootstrapArgs,
  parseNpmWebAuthChallenge,
  parseTrustConfiguration,
  pendingChangesetRelease,
  repositorySlug,
  validatePackedManifest,
  validateWorkspaceManifest,
  verificationScripts,
  waitForNpmWebAuth,
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

  it("runs either packed-consumer check after building", () => {
    for (const script of ["test:package", "test:pack"]) {
      expect(
        verificationScripts({
          ...validManifest,
          scripts: { ...validManifest.scripts, [script]: "node smoke.mjs" },
        }),
      ).toEqual(["lint", "typecheck", "test", "build", script]);
    }
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

describe("npm browser authentication for captured trust commands", () => {
  const challenge = {
    authUrl: "https://www.npmjs.com/auth/cli/test-challenge",
    doneUrl: "https://registry.npmjs.org/-/v1/done?authId=test-challenge",
  };

  it("recognizes npm's structured browser challenge without swallowing other failures", () => {
    expect(
      parseNpmWebAuthChallenge(
        JSON.stringify({
          error: { code: "EOTP", ...challenge },
        }),
      ),
    ).toEqual(challenge);
    expect(parseNpmWebAuthChallenge("not JSON")).toBeUndefined();
    expect(
      parseNpmWebAuthChallenge(
        JSON.stringify({
          error: { code: "E403", ...challenge },
        }),
      ),
    ).toBeUndefined();
    expect(
      parseNpmWebAuthChallenge(
        JSON.stringify({
          error: { code: "EOTP" },
        }),
      ),
    ).toBeUndefined();
  });

  it("rejects authentication URLs outside npm", () => {
    for (const field of ["authUrl", "doneUrl"]) {
      expect(() =>
        parseNpmWebAuthChallenge(
          JSON.stringify({
            error: {
              code: "EOTP",
              ...challenge,
              [field]: "https://example.com/auth",
            },
          }),
        ),
      ).toThrow("unexpected browser authentication URL");
    }
  });

  it("waits for browser approval and returns the OTP without following redirects", async () => {
    let calls = 0;
    const otp = await waitForNpmWebAuth(challenge, (url, init) => {
      expect(url).toBe(challenge.doneUrl);
      expect(init.redirect).toBe("error");
      expect(init.headers).toEqual({ "cache-control": "no-store" });
      expect(init.signal).toBeInstanceOf(AbortSignal);
      calls++;
      if (calls === 1) {
        return Promise.resolve(
          new Response(null, {
            status: 202,
            headers: { "retry-after": "0.001" },
          }),
        );
      }
      return Promise.resolve(Response.json({ token: "test-only-otp" }));
    });
    expect(calls).toBe(2);
    expect(otp).toBe("test-only-otp");
  });

  it("stops when the auth link expires or npm returns an invalid response", async () => {
    await rejects(
      waitForNpmWebAuth(challenge, () =>
        Promise.resolve(new Response(null, { status: 404 })),
      ),
      /fresh link/,
    );
    await rejects(
      waitForNpmWebAuth(challenge, () => Promise.resolve(Response.json({}))),
      /no one-time password/,
    );
  });

  it("stops polling when authentication is cancelled", async () => {
    const controller = new AbortController();
    let calls = 0;
    await rejects(
      waitForNpmWebAuth(
        challenge,
        () => {
          calls++;
          controller.abort(new Error("authentication cancelled"));
          return Promise.resolve(new Response(null, { status: 202 }));
        },
        controller.signal,
      ),
    );
    expect(calls).toBe(1);
  });
});
