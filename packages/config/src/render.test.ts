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
  it("updates mapped values with numeric port conversion", () => {
    const content = renderTomlFile(
      '[api]\nport = 1000\nname = "app"\n',
      { API_PORT: "4321" },
      {
        path: "config.toml",
        format: "toml",
        mappings: { "api.port": "API_PORT" },
      },
    );

    expect(content).toContain("port = 4_321");
    expect(content).toContain('name = "app"');
  });
});
