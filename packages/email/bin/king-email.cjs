#!/usr/bin/env node
const { spawnSync } = require("node:child_process");
const { resolve } = require("node:path");
const result = spawnSync(
  "bun",
  [resolve(__dirname, "../dist/cli.js"), ...process.argv.slice(2)],
  { stdio: "inherit" },
);
if (result.error) {
  console.error(
    "KingStack email tooling requires Bun 1.2.8 or newer on PATH. The mailer itself runs on Node.js.",
  );
  process.exitCode = 1;
} else {
  process.exitCode = result.status ?? 1;
}
