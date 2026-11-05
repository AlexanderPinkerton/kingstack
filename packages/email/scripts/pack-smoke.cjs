const { spawnSync } = require("node:child_process");
const { mkdtempSync, writeFileSync, mkdirSync, rmSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join, resolve } = require("node:path");

const packageRoot = resolve(__dirname, "..");
const temporary = mkdtempSync(join(tmpdir(), "king-email-pack-"));
function run(command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    env: { ...process.env, YARN_ENABLE_IMMUTABLE_INSTALLS: "false" },
  });
  if (result.error) throw result.error;
  if (result.status !== 0)
    throw new Error(
      `${command} ${args.join(" ")} failed:\n${result.stdout || ""}${result.stderr || ""}`,
    );
  return result.stdout;
}
try {
  const archive = join(temporary, "email.tgz");
  run("yarn", ["pack", "--out", archive], packageRoot);
  for (const version of ["18.3.1", "19.0.0"]) {
    const cwd = join(temporary, `react-${version}`);
    mkdirSync(join(cwd, "supabase"), { recursive: true });
    writeFileSync(
      join(cwd, "package.json"),
      JSON.stringify({
        private: true,
        packageManager: "yarn@4.10.2",
        dependencies: {
          "@kingstack/email": `file:${archive}`,
          react: version,
          "react-dom": version,
        },
        devDependencies: {
          typescript: "5.9.3",
          "@types/node": "^24.10.1",
          "@types/react": `^${version.split(".")[0]}.0.0`,
          "@types/react-dom": `^${version.split(".")[0]}.0.0`,
        },
      }),
    );
    writeFileSync(join(cwd, ".yarnrc.yml"), "nodeLinker: node-modules\n");
    run("yarn", ["install", "--mode=skip-build"], cwd);
    writeFileSync(
      join(cwd, "email.config.ts"),
      `import { defineEmailConfig } from '@kingstack/email';\nexport default defineEmailConfig({brand:{name:'Packed app'},from:{email:'support@example.com'}});\n`,
    );
    writeFileSync(
      join(cwd, "supabase/config.toml"),
      'project_id = "package-smoke"\n[auth.email]\nenable_confirmations = true\n',
    );
    writeFileSync(
      join(cwd, "check.cjs"),
      `
const assert = require('node:assert/strict');
const React = require('react');
const {defineEmailConfig} = require('@kingstack/email');
const {renderAuthEmails} = require('@kingstack/email/auth');
const {EmailLayout} = require('@kingstack/email/react');
const {createMailer} = require('@kingstack/email/server');
(async()=>{
  const config=defineEmailConfig({brand:{name:'Packed app'},from:{email:'support@example.com'}});
  assert.equal(Object.keys(await renderAuthEmails(config)).length,6);
  const mailer=createMailer({config,environment:'test',delivery:{type:'capture'}});
  const result=await mailer.send({to:'recipient@example.com',subject:'Packed test',react:React.createElement(EmailLayout,{brand:config.brand,preview:'test'},React.createElement('p',null,'Hello'))});
  assert.equal(result.status,'captured');
})().catch(e=>{console.error(e);process.exitCode=1;});
`,
    );
    run("node", ["check.cjs"], cwd);
    writeFileSync(
      join(cwd, "check.mjs"),
      `import { defineEmailConfig } from '@kingstack/email';\nimport { renderAuthEmails } from '@kingstack/email/auth';\nimport { createMailer } from '@kingstack/email/server';\nif (typeof createMailer !== 'function') throw Error('ESM export missing');\nawait renderAuthEmails(defineEmailConfig({brand:{name:'ESM app'},from:{email:'support@example.com'}}));\n`,
    );
    run("node", ["check.mjs"], cwd);
    writeFileSync(
      join(cwd, "check.tsx"),
      `import * as React from 'react';\nimport {defineEmailConfig} from '@kingstack/email';\nimport {EmailLayout} from '@kingstack/email/react';\nimport {createMailer} from '@kingstack/email/server';\nconst config=defineEmailConfig({brand:{name:'Types'},from:{email:'support@example.com'}});\nconst mailer=createMailer({config,environment:'test',delivery:{type:'capture'}});\nvoid mailer.send({to:'recipient@example.com',subject:'Typed',react:<EmailLayout brand={config.brand} preview='Test'><p>Hello</p></EmailLayout>});\n`,
    );
    for (const moduleResolution of ["node", "NodeNext"]) {
      let module = "commonjs";
      if (moduleResolution === "NodeNext") module = "NodeNext";
      writeFileSync(
        join(cwd, "tsconfig.json"),
        JSON.stringify({
          compilerOptions: {
            target: "ES2022",
            module,
            moduleResolution,
            jsx: "react",
            strict: true,
            skipLibCheck: false,
            esModuleInterop: true,
            noEmit: true,
          },
          include: ["check.tsx"],
        }),
      );
      run("yarn", ["tsc"], cwd);
    }
    run("yarn", ["exec", "king-email", "--help"], cwd);
    run("yarn", ["exec", "king-email", "auth", "export"], cwd);
    run("yarn", ["exec", "king-email", "auth", "export", "--check"], cwd);
    run("yarn", ["exec", "king-email", "preview"], cwd);
    console.log(
      `Packed package passed: React ${version}, CommonJS + ESM, TypeScript node + NodeNext, local CLI, no optional peers.`,
    );
  }
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
