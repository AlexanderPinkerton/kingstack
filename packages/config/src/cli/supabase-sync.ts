import { spawnSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { parse } from "@iarna/toml";
import type { ConfigSchema, SupabaseServiceConfig } from "../core";
import { configOutputApplies, renderTomlFile } from "../render";

export function prepareSupabaseSync(
  service: SupabaseServiceConfig,
  schema: ConfigSchema,
  config: Record<string, string>,
  environment: string,
  cwd: string,
) {
  const project = config[service.projectRef];
  if (!/^[a-z0-9]{20}$/.test(project ?? ""))
    throw new Error(
      `Supabase sync requires a hosted project reference in ${service.projectRef}`,
    );
  const definition = schema.configs?.[service.configFile];
  if (
    !definition ||
    definition.format !== "toml" ||
    definition.path !== "supabase/config.toml" ||
    !configOutputApplies(definition, environment)
  )
    throw new Error(
      "Supabase sync requires an applicable supabase/config.toml output mapping",
    );
  const content = renderTomlFile(
    readFileSync(resolve(cwd, definition.path), "utf8"),
    config,
    definition,
  );
  const document = parse(content) as {
    project_id?: string;
    auth?: {
      email?: {
        template?: Record<string, { content_path?: string }>;
        notification?: Record<
          string,
          { content_path?: string; enabled?: boolean }
        >;
      };
    };
  };
  if (document.project_id !== project)
    throw new Error(
      "Generated Supabase project_id does not match the selected environment",
    );
  const templates = document.auth?.email?.template ?? {};
  const notifications = document.auth?.email?.notification ?? {};
  const assets: string[] = [];
  for (const template of [
    ...Object.values(templates),
    ...Object.values(notifications)
      .filter((item) => item.enabled)
      .map((item) => ({
        ...item,
        // Supabase CLI 2.x resolves notification paths from supabase/.
        content_path: item.content_path
          ? join("supabase", item.content_path)
          : undefined,
      })),
  ]) {
    if (!template.content_path) continue;
    const path = template.content_path;
    if (isAbsolute(path) || relative(cwd, resolve(cwd, path)).startsWith(".."))
      throw new Error("Email template paths must stay inside the project");
    if (!existsSync(resolve(cwd, path)))
      throw new Error(
        `Missing email template: ${path}. Render templates before syncing.`,
      );
    assets.push(path);
  }
  return {
    project,
    content,
    assets,
    templateCount: Object.keys(templates).length,
  };
}

export function syncToSupabase(options: {
  plan: ReturnType<typeof prepareSupabaseSync>;
  config: Record<string, string>;
  cwd: string;
  dryRun: boolean;
}): boolean {
  const { plan, config, cwd, dryRun } = options;
  console.log(`\nSupabase project: ${plan.project}`);
  console.log(
    `   Supabase CLI config push: supported settings and ${plan.templateCount} configured email templates.`,
  );
  if (dryRun) {
    console.log(
      "   Offline plan only; CLI validation and remote comparison happen on apply. No files or hosted settings changed.",
    );
    return true;
  }
  // Isolate the selected environment from the running app's generated files.
  // Secrets go through the CLI environment, never command arguments.
  const directory = mkdtempSync(join(tmpdir(), "king-config-supabase-"));
  try {
    cpSync(join(cwd, "supabase"), join(directory, "supabase"), {
      recursive: true,
      filter: (source) =>
        !/(^|[/\\])(\.temp|\.branches|\.env(?:\.[^/\\]*)?)($|[/\\])/.test(
          relative(join(cwd, "supabase"), source),
        ),
    });
    for (const asset of plan.assets) {
      const destination = resolve(directory, asset);
      mkdirSync(dirname(destination), { recursive: true });
      cpSync(resolve(cwd, asset), destination);
    }
    writeFileSync(join(directory, "supabase/config.toml"), plan.content, {
      mode: 0o600,
    });
    const result = spawnSync(
      "supabase",
      [
        "config",
        "push",
        "--workdir",
        directory,
        "--project-ref",
        plan.project,
        "--yes",
      ],
      {
        cwd,
        env: { ...process.env, ...config },
        stdio: "inherit",
        shell: false,
      },
    );
    if (result.error || result.status !== 0)
      throw new Error(
        "Supabase CLI config push failed. Review the CLI output; authenticate with yarn supabase login if needed.",
      );
    console.log("   Supabase configuration and configured templates synced.");
    return true;
  } catch (error) {
    console.error(
      `   ${error instanceof Error ? error.message : "Supabase config push failed"}`,
    );
    return false;
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}
