#!/usr/bin/env bun
import { glob } from "glob";
import { resolve } from "path";
import { readFileSync } from "fs";

/**
 * Scans for public packages and returns a Turbo filter string.
 * Usage: turbo run build $(bun scripts/get-public-filters.ts)
 */
async function main() {
    const cwd = process.cwd();
    // Assuming monorepo structure in packages/* and apps/*
    // Adjust glob patterns if needed (e.g. including apps if any are public)
    const packageJsonFiles = await glob(["packages/*/package.json"], { cwd });

    const publicPackages: string[] = [];

    for (const file of packageJsonFiles) {
        try {
            const content = readFileSync(resolve(cwd, file), "utf-8");
            const pkg = JSON.parse(content);

            // If private is NOT true, it's public.
            // Note: npm defaults private to false if omitted.
            if (pkg.private !== true) {
                publicPackages.push(pkg.name);
            }
        } catch (e) {
            console.error(`Error reading ${file}:`, e);
        }
    }

    if (publicPackages.length === 0) {
        console.error("No public packages found!");
        process.exit(1);
    }

    // Construct filter string: --filter=pkgA... --filter=pkgB...
    // The "..." suffix tells Turbo to include dependencies.
    const filterString = publicPackages.map(name => `--filter=${name}...`).join(" ");

    // Print to stdout
    console.log(filterString);
}

main();
