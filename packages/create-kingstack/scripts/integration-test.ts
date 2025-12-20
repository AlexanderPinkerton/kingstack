#!/usr/bin/env bun
// ============================================================================
// Integration tests for create-kingstack CLI
// Runs the CLI in Docker containers with various tool configurations
// ============================================================================

import { $ } from "bun";
import pc from "picocolors";

// Script is at packages/create-kingstack/scripts/integration-test.ts
// We need the repo root for proper Docker mounting
const PACKAGE_DIR = import.meta.dir + "/..";
const REPO_ROOT = PACKAGE_DIR + "/../..";
const CLI_PATH = "packages/create-kingstack/dist/index.js";

interface TestCase {
    name: string;
    expectedToFail: boolean;
    dockerSetup: string;
    cliArgs?: string;
}

const testCases: TestCase[] = [
    {
        name: "No tools installed",
        expectedToFail: true,
        dockerSetup: "",
    },
    {
        name: "Only git installed",
        expectedToFail: true,
        dockerSetup: "apk add --no-cache git > /dev/null 2>&1",
    },
    {
        name: "git + yarn installed (missing bun)",
        expectedToFail: true,
        dockerSetup: `
            apk add --no-cache git > /dev/null 2>&1 && 
            npm install -g yarn > /dev/null 2>&1
        `.trim(),
    },
    {
        name: "All core tools (--help check)",
        expectedToFail: false,
        dockerSetup: `
            apk add --no-cache git bash curl unzip > /dev/null 2>&1 &&
            npm install -g yarn > /dev/null 2>&1 &&
            curl -fsSL https://bun.sh/install | bash > /dev/null 2>&1 &&
            export PATH=$HOME/.bun/bin:$PATH
        `.trim(),
        cliArgs: "--help",
    },
];

async function runTest(test: TestCase): Promise<boolean> {
    console.log(pc.blue("━".repeat(50)));
    console.log(pc.yellow(`Test: ${test.name}`));
    console.log();

    const cliArgs = test.cliArgs || "test-app --dir /tmp";
    const dockerCommand = `
        ${test.dockerSetup}
        node packages/create-kingstack/dist/index.js ${cliArgs} 2>&1
    `.trim();

    try {
        const result = await $`docker run --rm -v ${REPO_ROOT}:/app -w /app node:20-alpine sh -c ${dockerCommand}`.quiet();

        console.log(result.stdout.toString());

        if (test.expectedToFail) {
            console.log(pc.red("✗ FAILED") + " (expected failure but got success)");
            return false;
        } else {
            console.log(pc.green("✓ PASSED") + " (expected success)");
            return true;
        }
    } catch (error: any) {
        const output = error.stdout?.toString() || error.stderr?.toString() || "";
        console.log(output);

        if (test.expectedToFail) {
            console.log(pc.green("✓ PASSED") + ` (expected failure, got exit code ${error.exitCode})`);
            return true;
        } else {
            console.log(pc.red("✗ FAILED") + ` (expected success, got exit code ${error.exitCode})`);
            return false;
        }
    }
}

async function main() {
    console.log();
    console.log(pc.blue("============================================"));
    console.log(pc.blue("  create-kingstack Integration Tests"));
    console.log(pc.blue("============================================"));
    console.log();

    // Build first
    console.log(pc.yellow("Building create-kingstack..."));
    await $`cd ${PACKAGE_DIR} && bun run build`.quiet();
    console.log(pc.green("✓ Build complete"));
    console.log();

    // Run tests
    let passed = 0;
    let failed = 0;

    for (const test of testCases) {
        const success = await runTest(test);
        if (success) {
            passed++;
        } else {
            failed++;
        }
        console.log();
    }

    // Summary
    console.log(pc.blue("============================================"));
    console.log(pc.blue("  Results"));
    console.log(pc.blue("============================================"));
    console.log();
    console.log(`  ${pc.green("Passed:")} ${passed}`);
    console.log(`  ${pc.red("Failed:")} ${failed}`);
    console.log();

    if (failed === 0) {
        console.log(pc.green("All tests passed! 🎉"));
        process.exit(0);
    } else {
        console.log(pc.red("Some tests failed."));
        process.exit(1);
    }
}

main();
