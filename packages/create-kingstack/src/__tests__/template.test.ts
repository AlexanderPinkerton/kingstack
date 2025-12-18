import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { tmpdir } from "os";
import { join } from "path";
import { mkdirSync, writeFileSync, rmSync, existsSync } from "fs";
import {
    replaceNamespace,
    replaceWorkspaceVersions,
    removePublishedPackages,
    getAllFiles,
    getAllPackageJsonFiles
} from "../template";

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

        const content = require("fs").readFileSync(filePath, "utf-8");
        expect(content).toBe('import { foo } from "@my-app/shared";');
    });

    it("should NOT replace @kingstack/config (published package)", () => {
        const filePath = join(testDir, "test.ts");
        writeFileSync(filePath, 'import { defineValues } from "@kingstack/config";');

        replaceNamespace(testDir, "my-app");

        const content = require("fs").readFileSync(filePath, "utf-8");
        expect(content).toBe('import { defineValues } from "@kingstack/config";');
    });

    it("should handle multiple replacements in one file", () => {
        const filePath = join(testDir, "test.ts");
        writeFileSync(filePath, `
import { foo } from "@kingstack/shared";
import { bar } from "@kingstack/prisma";
import { baz } from "@kingstack/config";
`);

        replaceNamespace(testDir, "my-app");

        const content = require("fs").readFileSync(filePath, "utf-8");
        expect(content).toContain('@my-app/shared');
        expect(content).toContain('@my-app/prisma');
        expect(content).toContain('@kingstack/config'); // Should NOT be replaced
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
        writeFileSync(pkgPath, JSON.stringify({
            name: "test",
            devDependencies: {
                "@kingstack/config": "workspace:*"
            }
        }, null, 2));

        replaceWorkspaceVersions(testDir);

        const pkg = JSON.parse(require("fs").readFileSync(pkgPath, "utf-8"));
        expect(pkg.devDependencies["@kingstack/config"]).toBe("^0.1.4");
    });

    it("should not modify non-published packages", () => {
        const pkgPath = join(testDir, "package.json");
        writeFileSync(pkgPath, JSON.stringify({
            name: "test",
            dependencies: {
                "@kingstack/shared": "workspace:*"
            }
        }, null, 2));

        replaceWorkspaceVersions(testDir);

        const pkg = JSON.parse(require("fs").readFileSync(pkgPath, "utf-8"));
        expect(pkg.dependencies["@kingstack/shared"]).toBe("workspace:*");
    });
});

describe("removePublishedPackages", () => {
    const testDir = join(tmpdir(), "create-kingstack-test-" + Date.now());

    beforeEach(() => {
        mkdirSync(testDir, { recursive: true });
        mkdirSync(join(testDir, "packages", "config"), { recursive: true });
        mkdirSync(join(testDir, "packages", "create-kingstack"), { recursive: true });
        mkdirSync(join(testDir, "packages", "shared"), { recursive: true });
        writeFileSync(join(testDir, "packages", "config", "package.json"), "{}");
        writeFileSync(join(testDir, "packages", "create-kingstack", "package.json"), "{}");
        writeFileSync(join(testDir, "packages", "shared", "package.json"), "{}");
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
        expect(existsSync(join(testDir, "packages", "create-kingstack"))).toBe(false);
    });

    it("should NOT remove packages/shared", () => {
        removePublishedPackages(testDir);
        expect(existsSync(join(testDir, "packages", "shared"))).toBe(true);
    });

    it("should return count of removed packages", () => {
        const count = removePublishedPackages(testDir);
        expect(count).toBe(2);
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
        expect(files.some(f => f.endsWith("index.ts"))).toBe(true);
    });

    it("should find .json files", () => {
        const files = getAllFiles(testDir);
        expect(files.some(f => f.endsWith("package.json"))).toBe(true);
    });

    it("should skip node_modules", () => {
        const files = getAllFiles(testDir);
        expect(files.some(f => f.includes("node_modules"))).toBe(false);
    });
});
