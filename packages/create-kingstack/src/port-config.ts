import {
  existsSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "fs";
import { basename, dirname, join, resolve } from "path";
import type { PortAssignments } from "./constants";
import { portsFromBase } from "./ports";

export const PORT_CONFIG_ENTRIES = [
  ["NEXT_PORT", "next"],
  ["NEST_PORT", "nest"],
  ["SUPABASE_DB_SHADOW_PORT", "supabaseDbShadowPort"],
  ["SUPABASE_API_PORT", "supabaseApiPort"],
  ["SUPABASE_DB_DIRECT_PORT", "supabaseDbDirectPort"],
  ["SUPABASE_DB_POOLER_PORT", "supabaseDbPoolerPort"],
  ["SUPABASE_STUDIO_PORT", "supabaseStudioPort"],
  ["SUPABASE_EMAIL_PORT", "supabaseEmailPort"],
  ["SUPABASE_ANALYTICS_PORT", "supabaseAnalyticsPort"],
  ["SUPABASE_EDGE_RUNTIME_INSPECTOR_PORT", "supabaseEdgeRuntimeInspectorPort"],
] as const satisfies ReadonlyArray<readonly [string, keyof PortAssignments]>;

export interface ProjectPortConfig {
  configPath: string;
  content: string;
  missingConfigKeys: string[];
  ports: PortAssignments;
  projectName: string;
  projectRoot: string;
}

function propertyPattern(key: string): RegExp {
  return new RegExp(
    `(^[\\t ]*(?:${key}|["']${key}["'])[\\t ]*:[\\t ]*)(["'])(\\d+)\\2`,
    "gm",
  );
}

function propertyDeclarationPattern(key: string): RegExp {
  return new RegExp(`^[\\t ]*(?:${key}|["']${key}["'])[\\t ]*:`, "gm");
}

function missingPortConfigKeys(content: string): string[] {
  return PORT_CONFIG_ENTRIES.filter(
    ([configKey]) =>
      [...content.matchAll(propertyDeclarationPattern(configKey))].length === 0,
  ).map(([configKey]) => configKey);
}

function parseSchemaPortDefaults(content: string): Partial<PortAssignments> {
  const defaults: Partial<PortAssignments> = {};

  for (const [configKey, assignmentKey] of PORT_CONFIG_ENTRIES) {
    const propertyBlock = new RegExp(
      `(?:${configKey}|["']${configKey}["'])[\\t ]*:[\\t ]*\\{([^}]*)\\}`,
      "m",
    ).exec(content)?.[1];
    const defaultValue = propertyBlock
      ? /default\s*:\s*["'](\d+)["']/.exec(propertyBlock)?.[1]
      : undefined;
    if (defaultValue) defaults[assignmentKey] = Number(defaultValue);
  }

  return defaults;
}

export function parseProjectPortConfig(
  content: string,
  defaults: Partial<PortAssignments> = {},
): PortAssignments {
  const values: Partial<PortAssignments> = {};

  for (const [configKey, assignmentKey] of PORT_CONFIG_ENTRIES) {
    const declarations = [
      ...content.matchAll(propertyDeclarationPattern(configKey)),
    ];
    const matches = [...content.matchAll(propertyPattern(configKey))];
    if (declarations.length === 0 && defaults[assignmentKey] !== undefined) {
      values[assignmentKey] = defaults[assignmentKey];
      continue;
    }
    if (declarations.length !== 1 || matches.length !== 1) {
      throw new Error(
        `Expected exactly one string value for ${configKey} in config/local.ts; found ${declarations.length} properties and ${matches.length} string values.`,
      );
    }

    const port = Number(matches[0][3]);
    if (!Number.isInteger(port) || port < 1 || port > 65_535) {
      throw new Error(`Invalid ${configKey} value in config/local.ts.`);
    }
    values[assignmentKey] = port;
  }

  return values as PortAssignments;
}

export function renderProjectPortConfig(
  content: string,
  ports: PortAssignments,
  insertConfigKeys: string[] = [],
): string {
  let updated = content;

  for (const [configKey, assignmentKey] of PORT_CONFIG_ENTRIES) {
    const declarations = [
      ...updated.matchAll(propertyDeclarationPattern(configKey)),
    ];
    let replacements = 0;
    updated = updated.replace(
      propertyPattern(configKey),
      (_match, prefix: string, quote: string) => {
        replacements += 1;
        return `${prefix}${quote}${ports[assignmentKey]}${quote}`;
      },
    );
    if (
      declarations.length === 0 &&
      replacements === 0 &&
      insertConfigKeys.includes(configKey)
    ) {
      continue;
    }
    if (declarations.length !== 1 || replacements !== 1) {
      throw new Error(
        `Refusing to update config/local.ts: expected exactly one string value for ${configKey}; found ${declarations.length} properties and ${replacements} string values.`,
      );
    }
  }

  if (insertConfigKeys.length > 0) {
    const matches = PORT_CONFIG_ENTRIES.flatMap(([configKey]) =>
      [...updated.matchAll(propertyPattern(configKey))].map((match) => ({
        index: match.index,
        indent: /^([\t ]*)/.exec(match[1])?.[1] ?? "",
        quote: match[2],
      })),
    ).sort((left, right) => right.index - left.index);
    const anchor = matches[0];
    if (!anchor) {
      throw new Error(
        "Refusing to update config/local.ts because no existing port property can anchor missing values.",
      );
    }

    const lineEnding = updated.includes("\r\n") ? "\r\n" : "\n";
    const lineEnd = updated.indexOf("\n", anchor.index);
    const insertionIndex = lineEnd === -1 ? updated.length : lineEnd + 1;
    const insertion = PORT_CONFIG_ENTRIES.filter(([configKey]) =>
      insertConfigKeys.includes(configKey),
    )
      .map(
        ([configKey, assignmentKey]) =>
          `${anchor.indent}${configKey}: ${anchor.quote}${ports[assignmentKey]}${anchor.quote},${lineEnding}`,
      )
      .join("");
    updated =
      updated.slice(0, insertionIndex) +
      (lineEnd === -1 ? lineEnding : "") +
      insertion +
      updated.slice(insertionIndex);
  }

  return updated;
}

export function standardPortBase(ports: PortAssignments): number | undefined {
  const expected = portsFromBase(ports.next);
  return PORT_CONFIG_ENTRIES.every(
    ([, assignmentKey]) => ports[assignmentKey] === expected[assignmentKey],
  )
    ? ports.next
    : undefined;
}

export function findKingStackProjectRoot(startDirectory: string): string {
  let current = resolve(startDirectory);

  while (true) {
    if (
      existsSync(join(current, "package.json")) &&
      existsSync(join(current, "config", "local.ts"))
    ) {
      return current;
    }

    const parent = dirname(current);
    if (parent === current) {
      throw new Error(
        "Could not find a KingStack project with package.json and config/local.ts. Run this command inside the project.",
      );
    }
    current = parent;
  }
}

export function readProjectPortConfig(projectRoot: string): ProjectPortConfig {
  const resolvedRoot = resolve(projectRoot);
  const configPath = join(resolvedRoot, "config", "local.ts");
  const packagePath = join(resolvedRoot, "package.json");
  const content = readFileSync(configPath, "utf-8");
  const missingConfigKeys = missingPortConfigKeys(content);
  const defaults =
    missingConfigKeys.length === 0
      ? {}
      : parseSchemaPortDefaults(
          readFileSync(join(resolvedRoot, "config", "schema.ts"), "utf-8"),
        );
  const packageJson = JSON.parse(readFileSync(packagePath, "utf-8")) as {
    name?: unknown;
  };
  const projectName =
    typeof packageJson.name === "string" && packageJson.name
      ? packageJson.name
      : basename(resolvedRoot);

  return {
    configPath,
    content,
    missingConfigKeys,
    ports: parseProjectPortConfig(content, defaults),
    projectName,
    projectRoot: resolvedRoot,
  };
}

export function writeProjectPortConfig(
  config: ProjectPortConfig,
  ports: PortAssignments,
): void {
  const updated = renderProjectPortConfig(
    config.content,
    ports,
    config.missingConfigKeys,
  );
  const temporaryPath = `${config.configPath}.${process.pid}.tmp`;
  const mode = statSync(config.configPath).mode;

  try {
    writeFileSync(temporaryPath, updated, { encoding: "utf-8", mode });
    renameSync(temporaryPath, config.configPath);
  } finally {
    rmSync(temporaryPath, { force: true });
  }
}
