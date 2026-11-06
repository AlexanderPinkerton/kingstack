import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const root = resolve(__dirname, "..");
const temporary = mkdtempSync(join(tmpdir(), "king-email-config-pack-"));
function run(command: string, args: string[], cwd: string) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    env: { ...process.env, YARN_ENABLE_IMMUTABLE_INSTALLS: "false" },
  });
  if (result.error || result.status !== 0)
    throw new Error(`${command} failed:\n${result.stdout}${result.stderr}`);
  return result.stdout;
}
try {
  const emailArchive = join(temporary, "email.tgz");
  run("yarn", ["pack", "--out", emailArchive], root);
  const configArchive =
    process.env.KINGSTACK_CONFIG_ARCHIVE || join(temporary, "config.tgz");
  if (!process.env.KINGSTACK_CONFIG_ARCHIVE)
    run("yarn", ["pack", "--out", configArchive], resolve(root, "../config"));
  const cwd = join(temporary, "consumer");
  for (const directory of ["config", "supabase", "bin"])
    mkdirSync(join(cwd, directory), { recursive: true });
  writeFileSync(
    join(cwd, "package.json"),
    JSON.stringify({
      private: true,
      packageManager: "yarn@4.10.2",
      dependencies: {
        "@kingstack/email": `file:${emailArchive}`,
        "@kingstack/config": `file:${configArchive}`,
        react: "19.0.0",
        "react-dom": "19.0.0",
      },
    }),
  );
  writeFileSync(join(cwd, ".yarnrc.yml"), "nodeLinker: node-modules\n");
  run("yarn", ["install", "--mode=skip-build"], cwd);
  writeFileSync(
    join(cwd, "email.config.ts"),
    `import { defineEmailConfig } from '@kingstack/email';
export default defineEmailConfig({brand:{name:'Packed app'},from:{email:'support@example.com'}});`,
  );
  writeFileSync(
    join(cwd, "supabase/config.toml"),
    'project_id = "local-project"\n[auth.email]\nenable_confirmations = true\n',
  );
  writeFileSync(
    join(cwd, "config/schema.ts"),
    `import { defineSchema, EnvironmentMode } from '@kingstack/config';
export const schema = defineSchema({
  environments: { production: { mode: EnvironmentMode.Hosted } },
  core: { PROJECT: { required: true } }, computed: () => ({}), envfiles: {},
  configs: { supabase: { path: 'supabase/config.toml', format: 'toml', mappings: { project_id: 'PROJECT' } } },
  services: { supabase: { provider: 'supabase', description: 'Supabase CLI', projectRef: 'PROJECT', configFile: 'supabase' } }
});`,
  );
  writeFileSync(
    join(cwd, "config/production.ts"),
    "export const values = { PROJECT: 'abcdefghijklmnopqrst' };\n",
  );
  writeFileSync(
    join(cwd, "bin/supabase"),
    `#!/usr/bin/env bun
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
const directory = process.argv[process.argv.indexOf('--workdir') + 1];
const toml = readFileSync(join(directory, 'supabase/config.toml'), 'utf8');
assert.ok(toml.includes('project_id = "abcdefghijklmnopqrst"'));
assert.ok(!toml.includes('[auth.email.smtp]'));
if (process.env.EXPECT_TEMPLATES === 'true') {
  assert.ok(toml.includes('[auth.email.template.confirmation]'));
  assert.ok(existsSync(join(directory, 'supabase/templates/confirmation.html')));
} else assert.ok(!toml.includes('[auth.email.template.'));
`,
    { mode: 0o755 },
  );
  writeFileSync(
    join(cwd, "check.ts"),
    `import assert from 'node:assert/strict';
import { dirname, join } from 'node:path';
import { readFileSync } from 'node:fs';
const { runCli } = require(join(dirname(require.resolve('@kingstack/email')), 'cli.js'));
const { syncCommand } = require(join(dirname(require.resolve('@kingstack/config')), 'cli/sync.js'));
process.env.PATH = join(process.cwd(), 'bin') + ':' + process.env.PATH;
globalThis.fetch = async () => { throw new Error('Unexpected network request'); };
assert.equal(await syncCommand({ cwd: process.cwd(), env: 'production' }), true);
await runCli(['auth', 'export']);
await runCli(['auth', 'export', '--check']);
process.env.EXPECT_TEMPLATES = 'true';
assert.equal(await syncCommand({ cwd: process.cwd(), env: 'production' }), true);
assert.ok(readFileSync('supabase/config.toml', 'utf8').includes('project_id = "local-project"'));
await assert.rejects(runCli(['auth', 'sync', '--env', 'production']), /king-config sync/);
console.log('Packed config/email: fresh project and exported templates deploy through one fake Supabase CLI; no SMTP credentials or hosted writes.');
`,
  );
  console.log(run("bun", ["check.ts"], cwd));
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
