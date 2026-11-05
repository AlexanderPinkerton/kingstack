import { describe, expect, it } from "vitest";
import { renderJsonFile, renderTomlFile } from "./render";

const definition = {
  path: ".vercel/project.json",
  format: "json" as const,
  mappings: { projectId: "PROJECT", orgId: "ORG", "settings.region": "REGION" },
};
const values = { PROJECT: "prj_staging", ORG: "team", REGION: "iad1" };

describe("JSON config outputs", () => {
  it("creates nested string mappings and preserves unrelated metadata", () => {
    const result = renderJsonFile(
      '{"projectId":"old","settings":{"framework":"nextjs"},"extra":[1,true]}',
      values,
      definition,
    );
    expect(JSON.parse(result)).toEqual({
      projectId: values.PROJECT,
      orgId: values.ORG,
      settings: { framework: "nextjs", region: "iad1" },
      extra: [1, true],
    });
    expect(renderJsonFile(result, values, definition)).toBe(result);
    expect(JSON.parse(renderJsonFile("{}", values, definition)).projectId).toBe(
      values.PROJECT,
    );
  });
  it.each(["[]", "null", '"string"', '{"secret":"do-not-log"'])(
    "rejects invalid object input without exposing contents: %s",
    (input) => {
      expect(() => renderJsonFile(input, values, definition)).toThrow(/JSON/);
      try {
        renderJsonFile(input, values, definition);
      } catch (error) {
        expect(String(error)).not.toContain("do-not-log");
      }
    },
  );
  it.each([
    "__proto__.polluted",
    "constructor.prototype.polluted",
    "x.prototype.y",
    "x..y",
  ])("rejects unsafe mapping %s", (path) => {
    expect(() =>
      renderJsonFile("{}", values, {
        ...definition,
        mappings: { [path]: "PROJECT" },
      }),
    ).toThrow("Invalid JSON mapping");
    expect(Object.hasOwn(Object.prototype, "polluted")).toBe(false);
  });
  it("rejects object traversal and scalar type changes without discarding data", () => {
    expect(() => renderJsonFile('{"settings":[]}', values, definition)).toThrow(
      "non-object",
    );
    expect(() =>
      renderJsonFile('{"projectId":42}', values, definition),
    ).toThrow("must target a string");
    expect(() => renderJsonFile("{}", {}, definition)).toThrow(
      "Missing source key",
    );
  });
});

describe("indexed TOML mappings", () => {
  it("updates redirect arrays while preserving comments, spacing and unmapped elements", () => {
    const input =
      '[auth]\nurls = [\n  "old", # preserve me\n  \'second\',\n  "untouched"\n]\n';
    const result = renderTomlFile(
      input,
      {
        FIRST: 'https://host/path?x="quoted"',
        SECOND: "https://staging/callback",
      },
      {
        path: "supabase/config.toml",
        format: "toml",
        mappings: { "auth.urls.0": "FIRST", "auth.urls.1": "SECOND" },
      },
    );
    expect(result).toBe(
      input
        .replace('"old"', "'https://host/path?x=\"quoted\"'")
        .replace("'second'", '"https://staging/callback"'),
    );
  });
  it("rejects missing indices before rewriting anything", () => {
    expect(() =>
      renderTomlFile(
        '[auth]\nurls = ["one"]\n',
        { URL: "two" },
        {
          path: "config.toml",
          format: "toml",
          mappings: { "auth.urls.2": "URL" },
        },
      ),
    ).toThrow("missing TOML mapping");
  });
});
