import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { parse } from "@iarna/toml";
import { renderAuthEmails } from "./auth";
import type { EmailConfig } from "./types";

const start = "# BEGIN GENERATED AUTH EMAIL TEMPLATES";
const end = "# END GENERATED AUTH EMAIL TEMPLATES";

export function projectPath(cwd: string, filename: string): string {
  const path = resolve(cwd, filename);
  const inside = relative(resolve(cwd), path);
  if (
    inside === ".." ||
    inside.startsWith("../") ||
    inside.startsWith("..\\")
  ) {
    throw new Error(
      "Email tooling files must remain inside the project directory.",
    );
  }
  return path;
}

export async function exportAuthEmails(
  config: EmailConfig,
  options: { cwd?: string; check?: boolean; preview?: boolean } = {},
): Promise<string[]> {
  const cwd = resolve(options.cwd || process.cwd());
  let directory = config.tooling?.templatesDirectory || "supabase/templates";
  if (options.preview)
    directory = config.tooling?.previewDirectory || ".local/auth-emails";
  const outputDirectory = projectPath(cwd, directory);
  const templates = await renderAuthEmails(config, {
    preview: options.preview,
  });
  const writes: Array<[string, string]> = [];
  for (const [kind, template] of Object.entries(templates)) {
    writes.push([resolve(outputDirectory, `${kind}.html`), template.html]);
  }
  if (!options.preview) {
    const file = projectPath(
      cwd,
      config.tooling?.supabaseConfigPath || "supabase/config.toml",
    );
    let current: string;
    try {
      current = readFileSync(file, "utf8");
    } catch {
      throw new Error(
        "Supabase config is missing. Run supabase init or configure tooling.supabaseConfigPath.",
      );
    }
    parse(current);
    const begin = current.indexOf(start);
    const finish = current.indexOf(end);
    if (
      (begin === -1) !== (finish === -1) ||
      finish < begin ||
      current.indexOf(start, begin + start.length) !== -1 ||
      current.indexOf(end, finish + end.length) !== -1
    ) {
      throw new Error(
        "Invalid generated auth template block in Supabase config.",
      );
    }
    if (begin === -1 && /^\s*\[auth\.email\.template\./m.test(current)) {
      throw new Error(
        "Existing unmanaged auth templates need review before export.",
      );
    }
    const lines = [start];
    for (const [kind, template] of Object.entries(templates)) {
      const contentPath = `./${relative(cwd, resolve(outputDirectory, `${kind}.html`)).replaceAll("\\", "/")}`;
      lines.push(
        `[auth.email.template.${kind}]\nsubject = ${JSON.stringify(template.subject)}\ncontent_path = ${JSON.stringify(contentPath)}\n`,
      );
    }
    lines.push(end);
    const block = lines.join("\n");
    let next = `${current.trimEnd()}\n\n${block}\n`;
    if (begin !== -1)
      next =
        current.slice(0, begin) + block + current.slice(finish + end.length);
    parse(next);
    writes.push([file, next]);
  }
  // Validate every output before writing, so a malformed TOML block leaves files alone.
  for (const [file, content] of writes) {
    if (options.check) {
      let actual: string | undefined;
      try {
        actual = readFileSync(file, "utf8");
      } catch {
        /* Report missing and stale together. */
      }
      if (actual !== content)
        throw new Error(
          `${relative(cwd, file)} is missing or stale. Run king-email auth export.`,
        );
    } else {
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, content);
    }
  }
  return writes.map(([file]) => relative(cwd, file));
}
