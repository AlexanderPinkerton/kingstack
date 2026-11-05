import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const packageRoot = resolve(__dirname, "..");
const temporary = mkdtempSync(join(tmpdir(), "king-email-config-pack-"));

function run(command: string, args: string[], cwd: string): string {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    env: { ...process.env, YARN_ENABLE_IMMUTABLE_INSTALLS: "false" },
  });
  if (result.error) throw result.error;
  if (result.status !== 0)
    throw new Error(
      `${command} ${args.join(" ")} failed:\n${result.stdout}${result.stderr}`,
    );
  return result.stdout;
}

try {
  const emailArchive = join(temporary, "email.tgz");
  run("yarn", ["pack", "--out", emailArchive], packageRoot);
  let configArchive = process.env.KINGSTACK_CONFIG_ARCHIVE;
  if (configArchive) {
    configArchive = resolve(configArchive);
  } else {
    configArchive = join(temporary, "config.tgz");
    run(
      "yarn",
      ["pack", "--out", configArchive],
      resolve(packageRoot, "../config"),
    );
  }

  const cwd = join(temporary, "consumer");
  mkdirSync(join(cwd, "config"), { recursive: true });
  mkdirSync(join(cwd, "supabase"));
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
  const installation = run("yarn", ["install", "--mode=skip-build"], cwd);
  if (/YN0060[^\n]*@kingstack\/config/.test(installation))
    throw new Error(
      "Packed config version does not satisfy email's peer range.",
    );
  writeFileSync(
    join(cwd, "email.config.ts"),
    `import { defineEmailConfig } from '@kingstack/email';
export default defineEmailConfig({brand:{name:'Packed app'},from:{email:'support@example.com'}});
`,
  );
  writeFileSync(
    join(cwd, "supabase/config.toml"),
    'project_id = "package-smoke"\n[auth.email]\nenable_confirmations = true\n',
  );
  writeFileSync(
    join(cwd, "config/schema.ts"),
    `import { defineSchema, EnvironmentMode } from '@kingstack/config';
export const schema = defineSchema({
  environments: { production: { mode: EnvironmentMode.Hosted } },
  core: {
    SUPABASE_PROJECT_REF: { required: true },
    NEXT_URL: { required: true },
    RESEND_API_KEY: { required: true }
  },
  computed: () => ({}),
  envfiles: {}
});
`,
  );
  writeFileSync(
    join(cwd, "config/production.ts"),
    `export const values = {
  SUPABASE_PROJECT_REF: 'abcdefghijklmnopqrst',
  NEXT_URL: 'https://example.com',
  RESEND_API_KEY: 're_fixture-secret'
};
`,
  );
  writeFileSync(
    join(cwd, "check.ts"),
    `import assert from 'node:assert/strict';
import { dirname, join } from 'node:path';
const { runCli } = require(join(dirname(require.resolve('@kingstack/email')), 'cli.js'));
const configVersion = require('@kingstack/config/package.json').version;
process.env.SUPABASE_ACCESS_TOKEN = 'sbp_fixture';
let requests = 0;
globalThis.fetch = async (url, options) => {
  assert.equal(url, 'https://api.supabase.com/v1/projects/abcdefghijklmnopqrst/config/auth');
  assert.equal(options.method, 'GET');
  requests++;
  return Response.json({ uri_allow_list: '', rate_limit_email_sent: 2 });
};
await runCli(['auth', 'export']);
const output = [];
const log = console.log;
console.log = (line) => output.push(String(line));
try {
  await runCli(['auth', 'sync', '--env', 'production']);
  await runCli(['auth', 'policy', '--env', 'production', '--require-verification']);
} finally {
  console.log = log;
}
assert.equal(requests, 2);
const plans = output.map(line => JSON.parse(line));
assert.equal(plans[0].project, 'abcdefghijklmnopqrst');
assert.equal(plans[0].apply, false);
assert.equal(plans[0].settings.site_url, 'https://example.com');
assert.equal(plans[0].settings.smtp_host, 'smtp.resend.com');
assert.equal(plans[0].settings.mailer_autoconfirm, undefined);
assert.equal(plans[1].settings.mailer_autoconfirm, false);
assert.ok(!output.join('').includes('re_fixture-secret'));
console.log('Packed config ' + configVersion + ': email environment resolution, SMTP/template plan, and verification policy passed with mocked network access.');
`,
  );
  console.log(run("bun", ["check.ts"], cwd));
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
