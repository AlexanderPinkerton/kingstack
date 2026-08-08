import { describe, expect, it } from "bun:test";
import { resolveConfig } from "@kingstack/config";
import { schema } from "../../../config/schema.js";
import {
  parseModernApiKeys,
  parseProjects,
  renderEnvironmentValues,
  updateEnvironmentValues,
  type SupabaseConfigValues,
} from "./get-secrets.js";
import {
  normalizePoolerRegion,
  parseGetSecretsCliArgs,
} from "./get-secrets-options.js";

const importedValues: SupabaseConfigValues = {
  SUPABASE_PROJECT_REF: "abcdefghijklmnopqrst",
  SUPABASE_REGION: "aws-0-us-east-2",
  SUPABASE_PUBLISHABLE_KEY: "sb_publishable_public-test",
  SUPABASE_SECRET_KEY: "sb_secret_private-test",
  SUPABASE_DB_PASSWORD: "password with symbols = %",
};

describe("Supabase credential import CLI", () => {
  it("parses file and explicit print destinations", () => {
    expect(
      parseGetSecretsCliArgs([
        "development",
        "--project-ref",
        "abcdefghijklmnopqrst",
        "--pooler-region",
        "aws-1-us-east-2.pooler.supabase.com",
        "--api-key-name",
        "kingstack",
        "--yes",
      ]),
    ).toEqual({
      environment: "development",
      projectRef: "abcdefghijklmnopqrst",
      poolerRegion: "aws-1-us-east-2",
      apiKeyName: "kingstack",
      print: false,
      yes: true,
      help: false,
    });
    expect(parseGetSecretsCliArgs(["--print"])).toEqual({
      print: true,
      yes: false,
      help: false,
    });
    expect(() => parseGetSecretsCliArgs(["development", "--print"])).toThrow(
      "separate destinations",
    );
  });

  it("validates and normalizes pooler regions", () => {
    expect(normalizePoolerRegion("aws-0-us-east-1")).toBe("aws-0-us-east-1");
    expect(
      normalizePoolerRegion("aws-1-eu-central-2.pooler.supabase.com"),
    ).toBe("aws-1-eu-central-2");
    expect(() => normalizePoolerRegion("us-east-1")).toThrow(
      "Invalid pooler region",
    );
  });

  it("parses the project shape returned by the pinned CLI", () => {
    expect(
      parseProjects(
        JSON.stringify([
          {
            ref: "abcdefghijklmnopqrst",
            name: "KingStack",
            region: "us-east-2",
            status: "ACTIVE_HEALTHY",
            linked: true,
            database: { host: "db.example.supabase.co" },
          },
        ]),
      ),
    ).toEqual([
      {
        ref: "abcdefghijklmnopqrst",
        name: "KingStack",
        region: "us-east-2",
        status: "ACTIVE_HEALTHY",
        linked: true,
      },
    ]);
  });

  it("selects a named modern API key pair without accepting legacy keys", () => {
    const output = JSON.stringify([
      {
        api_key: "legacy-anon",
        name: "anon",
        type: "legacy",
      },
      {
        api_key: "sb_publishable_default-public",
        name: "default",
        type: "publishable",
      },
      {
        api_key: "sb_secret_default-private",
        name: "default",
        type: "secret",
      },
      {
        api_key: "sb_secret_worker-private",
        name: "worker",
        type: "secret",
      },
      {
        api_key: "sb_publishable_worker-public",
        name: "worker",
        type: "publishable",
      },
    ]);

    expect(parseModernApiKeys(output)).toEqual({
      publishableKey: "sb_publishable_default-public",
      secretKey: "sb_secret_default-private",
    });
    expect(parseModernApiKeys(output, "worker")).toEqual({
      publishableKey: "sb_publishable_worker-public",
      secretKey: "sb_secret_worker-private",
    });
    expect(() => parseModernApiKeys(output, "missing")).toThrow(
      "No complete modern API key pair",
    );
    expect(() =>
      parseModernApiKeys(
        JSON.stringify([
          { api_key: "legacy-anon", name: "anon", type: "legacy" },
          {
            api_key: "legacy-service-role",
            name: "service_role",
            type: "legacy",
          },
        ]),
      ),
    ).toThrow("only legacy");
  });

  it("renders a new ignored environment values file", () => {
    const rendered = renderEnvironmentValues(importedValues);

    expect(rendered).toContain('SUPABASE_PROJECT_REF: "abcdefghijklmnopqrst"');
    expect(rendered).toContain('SUPABASE_SECRET_KEY: "sb_secret_private-test"');
    expect(rendered).toContain("satisfies ConfigValuesFor<typeof schema>");
  });

  it("updates only imported values and preserves unrelated configuration", () => {
    const current = `import { defineValues } from "@kingstack/config";
import type { ConfigValues } from "./schema.js";

// Keep this deployment-specific comment.
export const values = defineValues({
  NEXT_HOST: "dev.example.com",
  SUPABASE_PROJECT_REF: "old-project",
  SUPABASE_SECRET_KEY: "old-secret",
} satisfies ConfigValues);
`;
    const updated = updateEnvironmentValues(current, importedValues);

    expect(updated).toContain("// Keep this deployment-specific comment.");
    expect(updated).toContain('NEXT_HOST: "dev.example.com"');
    expect(updated).toContain('SUPABASE_PROJECT_REF: "abcdefghijklmnopqrst"');
    expect(updated).toContain(
      'SUPABASE_PUBLISHABLE_KEY: "sb_publishable_public-test"',
    );
    expect(updated).toContain(
      'SUPABASE_DB_PASSWORD: "password with symbols = %"',
    );
    expect(updated).not.toContain("old-project");
    expect(updated).not.toContain("old-secret");
  });

  it("uses transaction and session pooler modes for hosted connections", () => {
    const { config, errors } = resolveConfig(
      schema,
      { ...importedValues },
      {
        environment: "production",
      },
    );
    const pooled = new URL(config.all.SUPABASE_DB_POOL_URL);
    const migrations = new URL(config.all.SUPABASE_DB_DIRECT_URL);
    const shadow = new URL(config.all.SUPABASE_DB_SHADOW_URL);

    expect(errors).toEqual([]);
    expect(pooled.username).toBe("postgres.abcdefghijklmnopqrst");
    expect(pooled.hostname).toBe("aws-0-us-east-2.pooler.supabase.com");
    expect(pooled.port).toBe("6543");
    expect(pooled.searchParams.get("pgbouncer")).toBe("true");
    expect(migrations.username).toBe("postgres.abcdefghijklmnopqrst");
    expect(migrations.hostname).toBe("aws-0-us-east-2.pooler.supabase.com");
    expect(migrations.port).toBe("5432");
    expect(shadow.username).toBe("postgres.abcdefghijklmnopqrst");
    expect(shadow.hostname).toBe("aws-0-us-east-2.pooler.supabase.com");
    expect(shadow.port).toBe("5432");
  });

  it("preserves the existing local database connection shape", () => {
    const { config, errors } = resolveConfig(
      schema,
      { ...importedValues },
      { environment: "local" },
    );
    const pooled = new URL(config.all.SUPABASE_DB_POOL_URL);
    const migrations = new URL(config.all.SUPABASE_DB_DIRECT_URL);

    expect(errors).toEqual([]);
    expect(pooled.username).toBe("postgres");
    expect(pooled.hostname).toBe("localhost");
    expect(pooled.port).toBe("54322");
    expect(migrations.username).toBe("postgres");
    expect(migrations.hostname).toBe("localhost");
    expect(migrations.port).toBe("54322");
  });
});
