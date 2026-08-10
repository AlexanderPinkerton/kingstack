#!/usr/bin/env bun

import packageJson from "../package.json" with { type: "json" };
import { runDeployCli } from "./cli.js";

const { version } = packageJson;

void runDeployCli(process.argv.slice(2), { version }).catch(
  (error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error();
    console.error(`KingStack deployment ${version} stopped: ${message}`);
    process.exitCode = 1;
  },
);
