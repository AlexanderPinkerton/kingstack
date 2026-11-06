import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { parseArgs } from "node:util";
import { defineEmailConfig } from "./index";
import { exportAuthEmails, projectPath } from "./files";
import type { EmailConfig } from "./types";

const help = `KingStack email

  king-email preview [--interactive]
  king-email auth export [--check]

Options: --cwd <project>, --config <email.config.ts>, --help, --version
Export renders HTML files and config.toml template references. Hosted settings
and templates are deployed together by king-config sync using the Supabase CLI.
Preview writes safe HTML examples; --interactive uses the project's optional React Email CLI.
`;

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
  if (["auth sync", "auth policy", "auth templates"].includes(action))
    throw new Error(
      "Hosted email commands moved to king-config sync --env <environment>. Configure the Supabase service, render with king-email auth export, and sync settings and templates together. No changes made.",
    );
  if (!["preview", "auth export"].includes(action))
    throw new Error(`Unknown command.\n${help}`);
  if (values.apply || values.env || values["require-verification"])
    throw new Error(
      "Hosted options belong to king-config sync; email export and preview are local operations.",
    );
  if (values.check && action !== "auth export")
    throw new Error("--check is only valid for auth export.");
  if (values.interactive && action !== "preview")
    throw new Error("--interactive is only valid for preview.");
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
}
if (require.main === module) {
  void runCli().catch((error: unknown) => {
    console.error(
      error instanceof Error ? error.message : "Email command failed.",
    );
    process.exitCode = 1;
  });
}
