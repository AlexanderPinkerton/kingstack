import { describe, expect, it } from "vitest";
import {
  parseEnvFile,
  renderEnvFile,
  renderTomlFile,
  serializeEnvValue,
} from "./render";

describe("environment-file rendering", () => {
  it("round-trips special characters without exposing or corrupting them", () => {
    const content = renderEnvFile(
      "staging",
      {
        PLAIN: "value",
        SPECIAL: 'spaces # quotes " and $variables',
        SOURCE_PORT: "3000",
      },
      {
        path: "app/.env",
        keys: ["PLAIN", "SPECIAL"],
        aliases: { SOURCE_PORT: "PORT" },
      },
    );
    const parsed = parseEnvFile(content);

    expect(parsed.errors).toEqual([]);
    expect(Object.fromEntries(parsed.entries)).toEqual({
      PLAIN: "value",
      PORT: "3000",
      SPECIAL: 'spaces # quotes " and $variables',
    });
  });

  it("rejects multiline values", () => {
    expect(() => serializeEnvValue("SECRET", "first\nsecond")).toThrow(
      "cannot contain a newline",
    );
  });
});

describe("TOML rendering", () => {
  it("updates mapped values without reformatting the document", () => {
    const original = [
      'project_id = "old-project" # keep this comment',
      "",
      "[api]",
      "port = 1000 # API port",
      'name = "app # one"',
      "",
      "[db]",
      "port=2000",
      "shadow_port = 1999",
      "",
      "  [db.pooler]",
      "  port = 2000",
      "",
    ].join("\n");
    const content = renderTomlFile(
      original,
      {
        API_PORT: "4321",
        DB_PORT: "4322",
        PROJECT_ID: "new-project",
      },
      {
        path: "config.toml",
        format: "toml",
        mappings: {
          project_id: "PROJECT_ID",
          "api.port": "API_PORT",
          "db.port": "DB_PORT",
        },
      },
    );

    expect(content).toBe(
      original
        .replace('"old-project"', '"new-project"')
        .replace("port = 1000", "port = 4321")
        .replace("port=2000", "port=4322"),
    );
    expect(content).not.toContain("4_321");
    expect(content).toContain("  port = 2000");
  });

  it("fails rather than synthesizing a missing assignment", () => {
    expect(() =>
      renderTomlFile(
        '[api]\nname = "app"\n',
        { API_PORT: "4321" },
        {
          path: "config.toml",
          format: "toml",
          mappings: { "api.port": "API_PORT" },
        },
      ),
    ).toThrow('Cannot update missing TOML mapping "api.port"');
  });

  it("preserves inline comments when string values contain hashes", () => {
    const content = renderTomlFile(
      '[auth]\nsite_url = "http://old.test/#path" # keep\n',
      { SITE_URL: "http://new.test/#path" },
      {
        path: "config.toml",
        format: "toml",
        mappings: { "auth.site_url": "SITE_URL" },
      },
    );

    expect(content).toBe('[auth]\nsite_url = "http://new.test/#path" # keep\n');
  });

  it("rejects multiline mapped strings instead of risking structural edits", () => {
    expect(() =>
      renderTomlFile(
        '[auth]\nsite_url = "http://old.test"\n',
        { SITE_URL: "first\n[api]\nport = 1" },
        {
          path: "config.toml",
          format: "toml",
          mappings: { "auth.site_url": "SITE_URL" },
        },
      ),
    ).toThrow("must be a single-line string");
  });
});
