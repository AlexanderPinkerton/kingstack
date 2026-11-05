import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { parseArgs } from "node:util";
import { defineEmailConfig } from "./index";
import { exportAuthEmails, projectPath } from "./files";
import { setAuthVerificationPolicy, syncAuthEmails } from "./supabase";
import type { EmailConfig, HostedEmailEnvironment } from "./types";

const help = `KingStack email

  king-email preview [--interactive]
  king-email auth export [--check]
  king-email auth sync --env <hosted-environment> [--apply]
  king-email auth policy --env <hosted-environment> --require-verification [--apply]

Options: --cwd <project>, --config <email.config.ts>, --help, --version
Sync and policy are read-only unless --apply is supplied. Policy changes are separate from SMTP/templates.
Preview writes safe HTML examples; --interactive uses the project's optional React Email CLI.
`;

async function hostedEnvironment(
  config: EmailConfig,
  environment: string,
  cwd: string,
): Promise<HostedEmailEnvironment> {
  if (
    !/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(environment) ||
    ["local", "test"].includes(environment)
  ) {
    throw new Error(
      "Select a hosted --env, such as development or production.",
    );
  }
  if (config.tooling?.resolveEnvironment)
    return config.tooling.resolveEnvironment(environment, cwd);
  const requireFromProject = createRequire(resolve(cwd, "package.json"));
  let path: string;
  try {
    path = requireFromProject.resolve("@kingstack/config");
  } catch {
    throw new Error(
      "Install @kingstack/config in this project or provide tooling.resolveEnvironment.",
    );
  }
  const { loadResolvedEnvironment } = requireFromProject(
    path,
  ) as typeof import("@kingstack/config");
  const resolved = await loadResolvedEnvironment(environment, cwd);
  if (resolved.errors.length)
    throw new Error(
      "Resolve configuration errors with king-config check before syncing email.",
    );
  const values = resolved.config.all;
  return {
    projectRef: values.SUPABASE_PROJECT_REF,
    siteUrl: values.NEXT_URL,
    resendApiKey: values.RESEND_API_KEY,
  };
}

export async function runCli(
  args: string[] = process.argv.slice(2),
): Promise<void> {
  const { values, positionals } = parseArgs({
    args,
    allowPositionals: true,
    options: {
      cwd: { type: "string" },
      config: { type: "string" },
      env: { type: "string" },
      apply: { type: "boolean" },
      check: { type: "boolean" },
      interactive: { type: "boolean" },
      "require-verification": { type: "boolean" },
      help: { type: "boolean", short: "h" },
      version: { type: "boolean" },
    },
  });
  if (values.version) {
    console.log(
      (
        JSON.parse(
          readFileSync(resolve(__dirname, "../package.json"), "utf8"),
        ) as { version: string }
      ).version,
    );
    return;
  }
  if (values.help || !positionals.length) {
    console.log(help);
    return;
  }
  const action = positionals.join(" ");
  if (!["preview", "auth export", "auth sync", "auth policy"].includes(action))
    throw new Error(`Unknown command.\n${help}`);
  if (values.apply && !["auth sync", "auth policy"].includes(action))
    throw new Error("--apply is only valid for sync or policy.");
  if (values.check && action !== "auth export")
    throw new Error("--check is only valid for auth export.");
  if (values.interactive && action !== "preview")
    throw new Error("--interactive is only valid for preview.");
  if (values["require-verification"] && action !== "auth policy")
    throw new Error("Verification policy must be changed using auth policy.");
  if (action === "auth policy" && !values["require-verification"])
    throw new Error("Provide --require-verification explicitly.");
  if (["auth sync", "auth policy"].includes(action) && !values.env)
    throw new Error("Provide the hosted --env explicitly.");
  const cwd = resolve(values.cwd || process.cwd());
  const configFile = projectPath(cwd, values.config || "email.config.ts");
  let config: EmailConfig;
  try {
    // The CLI runs under Bun so projects can supply their own TypeScript/TSX config.
    const loadFromProject = createRequire(resolve(cwd, "package.json"));
    const loaded = loadFromProject(configFile) as { default: EmailConfig };
    config = defineEmailConfig(loaded.default);
  } catch {
    throw new Error(
      "Could not load email configuration. Check email.config.ts, its imports, and sender/brand settings.",
    );
  }
  if (action === "preview" && values.interactive) {
    const requireFromProject = createRequire(resolve(cwd, "package.json"));
    let manifestPath: string;
    try {
      manifestPath = requireFromProject.resolve("react-email/package.json");
    } catch {
      throw new Error(
        "Interactive preview requires react-email installed as a development dependency in this project. Static king-email preview works without it.",
      );
    }
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
      bin: string | Record<string, string>;
    };
    let entry = manifest.bin;
    if (typeof entry !== "string") entry = entry.email;
    if (!entry)
      throw new Error("Installed React Email CLI has no email executable.");
    const result = spawnSync(
      "node",
      [
        resolve(dirname(manifestPath), entry),
        "dev",
        "--dir",
        config.tooling?.reactEmailDirectory || "emails",
      ],
      { cwd, stdio: "inherit" },
    );
    if (result.error || result.status !== 0)
      throw new Error("React Email preview exited unsuccessfully.");
    return;
  }
  if (action === "preview" || action === "auth export") {
    const files = await exportAuthEmails(config, {
      cwd,
      check: values.check,
      preview: action === "preview",
    });
    console.log(
      `${values.check ? "Checked" : "Rendered"} email files:\n${files.join("\n")}`,
    );
    return;
  }
  const environment = values.env!;
  const hosted = await hostedEnvironment(config, environment, cwd);
  const common = {
    environment,
    projectRef: hosted.projectRef,
    cwd,
    apply: values.apply,
  };
  if (action === "auth policy") {
    await setAuthVerificationPolicy({ ...common, requireVerification: true });
  } else {
    await exportAuthEmails(config, { cwd, check: true });
    await syncAuthEmails({ ...common, hosted, config });
  }
}
if (require.main === module) {
  void runCli().catch((error: unknown) => {
    console.error(
      error instanceof Error ? error.message : "Email command failed.",
    );
    process.exitCode = 1;
  });
}
