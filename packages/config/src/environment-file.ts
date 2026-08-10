import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";
import { assertEnvironmentName } from "./cli/utils.js";

export type EnvironmentValues = Readonly<Record<string, string>>;

export function renderEnvironmentValues(
  values: EnvironmentValues,
  description: string,
): string {
  return [
    'import { defineValues, type ConfigValuesFor } from "@kingstack/config";',
    'import type { schema } from "./schema.js";',
    "",
    `/** ${description} */`,
    "export const values = defineValues({",
    ...renderValueAssignments(values, "  "),
    "} satisfies ConfigValuesFor<typeof schema>);",
    "",
  ].join("\n");
}

export function updateEnvironmentValues(
  content: string,
  values: EnvironmentValues,
): string {
  const source = ts.createSourceFile(
    "environment.ts",
    content,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const object = findValuesObject(source);
  if (!object) {
    throw new Error(
      "Could not find `export const values = defineValues({ ... })` in the environment file.",
    );
  }

  const replacements: Array<{ start: number; end: number; text: string }> = [];
  const found = new Set<string>();
  const valueKeys = new Set(Object.keys(values));

  for (const property of object.properties) {
    if (!ts.isPropertyAssignment(property)) continue;
    const name = propertyName(property.name);
    if (!name || !valueKeys.has(name)) continue;
    if (found.has(name)) {
      throw new Error(`Environment values contains duplicate ${name} entries.`);
    }
    found.add(name);
    replacements.push({
      start: property.initializer.getStart(source),
      end: property.initializer.getEnd(),
      text: JSON.stringify(values[name]),
    });
  }

  const missing = Object.keys(values).filter((key) => !found.has(key));
  if (missing.length > 0) {
    appendMissingAssignments(source, object, values, missing, replacements);
  }

  let updated = content;
  for (const replacement of replacements.sort((a, b) => b.start - a.start)) {
    updated = `${updated.slice(0, replacement.start)}${replacement.text}${updated.slice(replacement.end)}`;
  }
  return updated;
}

export function writeEnvironmentFile(
  environment: string,
  values: EnvironmentValues,
  description: string,
  options: { cwd?: string } = {},
): string {
  assertEnvironmentName(environment);
  const relativePath = `config/${environment}.ts`;
  const cwd = resolve(options.cwd || process.cwd());
  const path = resolve(cwd, relativePath);
  const ignored = spawnSync("git", ["check-ignore", "--quiet", relativePath], {
    cwd,
    shell: false,
    stdio: "ignore",
  });
  if (ignored.error) {
    throw new Error(
      `Git is required to verify that ${relativePath} will not expose deployment credentials.`,
      { cause: ignored.error },
    );
  }
  if (ignored.status !== 0) {
    throw new Error(
      `${relativePath} may contain deployment credentials but is not ignored by Git. Add it to .gitignore immediately.`,
    );
  }
  const content = existsSync(path)
    ? updateEnvironmentValues(readFileSync(path, "utf8"), values)
    : renderEnvironmentValues(values, description);
  writeFileSync(path, content, { encoding: "utf8", mode: 0o600 });
  chmodSync(path, 0o600);
  return relativePath;
}

function findValuesObject(
  source: ts.SourceFile,
): ts.ObjectLiteralExpression | undefined {
  let found: ts.ObjectLiteralExpression | undefined;

  function visit(node: ts.Node): void {
    if (found) return;
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === "values" &&
      node.initializer &&
      ts.isCallExpression(node.initializer) &&
      ts.isIdentifier(node.initializer.expression) &&
      node.initializer.expression.text === "defineValues"
    ) {
      found = unwrapObjectLiteral(node.initializer.arguments[0]);
      return;
    }
    ts.forEachChild(node, visit);
  }

  visit(source);
  return found;
}

function unwrapObjectLiteral(
  expression: ts.Expression | undefined,
): ts.ObjectLiteralExpression | undefined {
  let current = expression;
  while (current) {
    if (ts.isObjectLiteralExpression(current)) return current;
    if (
      ts.isParenthesizedExpression(current) ||
      ts.isAsExpression(current) ||
      ts.isSatisfiesExpression(current)
    ) {
      current = current.expression;
      continue;
    }
    return undefined;
  }
  return undefined;
}

function appendMissingAssignments(
  source: ts.SourceFile,
  object: ts.ObjectLiteralExpression,
  values: EnvironmentValues,
  missing: string[],
  replacements: Array<{ start: number; end: number; text: string }>,
): void {
  const closeBrace = object.getEnd() - 1;
  const { line } = source.getLineAndCharacterOfPosition(closeBrace);
  const lineStart = source.getPositionOfLineAndCharacter(line, 0);
  const beforeBrace = source.text.slice(lineStart, closeBrace);
  const closingIndent = /^\s*$/.test(beforeBrace) ? beforeBrace : "";
  const propertyIndent = `${closingIndent}  `;
  const insertionPoint = /^\s*$/.test(beforeBrace) ? lineStart : closeBrace;
  const lastProperty = object.properties.at(-1);

  if (
    lastProperty &&
    !source.text.slice(lastProperty.getEnd(), closeBrace).includes(",")
  ) {
    replacements.push({
      start: lastProperty.getEnd(),
      end: lastProperty.getEnd(),
      text: ",",
    });
  }

  const prefix = insertionPoint === closeBrace ? "\n" : "";
  const suffix = insertionPoint === closeBrace ? `\n${closingIndent}` : "";
  replacements.push({
    start: insertionPoint,
    end: insertionPoint,
    text: `${prefix}${renderValueAssignments(values, propertyIndent, missing).join("\n")}\n${suffix}`,
  });
}

function renderValueAssignments(
  values: EnvironmentValues,
  indent: string,
  keys = Object.keys(values),
): string[] {
  return keys.map((key) => `${indent}${key}: ${JSON.stringify(values[key])},`);
}

function propertyName(name: ts.PropertyName): string | undefined {
  return ts.isIdentifier(name) || ts.isStringLiteral(name)
    ? name.text
    : undefined;
}
