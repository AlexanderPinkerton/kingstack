import { describe, expect, it } from "bun:test";
import { resolveConfig } from "@kingstack/config";
import { schema } from "../config/schema.js";

const hostedValues = {
  NEXT_HOST: "www.example.com",
  SUPABASE_PROJECT_REF: "abcdefghijklmnopqrst",
  SUPABASE_REGION: "aws-0-us-east-2",
  SUPABASE_PUBLISHABLE_KEY: "sb_publishable_public-test",
  SUPABASE_SECRET_KEY: "sb_secret_private-test",
  SUPABASE_DB_PASSWORD: "password with symbols = %",
};

describe("KingStack database connection schema", () => {
  it("uses transaction and session pooler modes for hosted connections", () => {
    const { config, errors } = resolveConfig(schema, hostedValues, {
      environment: "production",
    });
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
    const { config, errors } = resolveConfig(schema, hostedValues, {
      environment: "local",
    });
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

describe("KingStack frontend origin schema", () => {
  it.each(["local", "development", "production"])(
    "shares one origin in %s",
    (environment) => {
      const { config, errors } = resolveConfig(schema, hostedValues, {
        environment,
      });
      expect(errors).toEqual([]);
      const origin =
        environment === "local"
          ? "http://www.example.com:3069"
          : "https://www.example.com";
      for (const key of [
        "NEXT_URL",
        "NEXT_PUBLIC_API_URL",
        "NEXT_PUBLIC_SITE_URL",
      ]) {
        expect(config.all[key]).toBe(origin);
      }
      expect(config.all.KINGSTACK_ENVIRONMENT).toBe(environment);
      for (const key of [
        "NEXT_PUBLIC_SITE_URL",
        "KINGSTACK_ENVIRONMENT",
      ] as const) {
        expect(schema.envfiles.next.keys).toContain(key);
        expect(schema.services.vercel.keys).toContain(key);
      }
      expect(schema.configs.supabase.mappings["auth.site_url"]).toBe(
        "NEXT_URL",
      );
    },
  );

  it.each([
    "https://example.com",
    "example.com/path",
    "example.com:443",
    "user@example.com",
    "example.com?x=1",
    "example.com#fragment",
    "localhost",
    "127.0.0.1",
  ])("rejects an invalid hosted hostname: %s", (NEXT_HOST) => {
    const { errors } = resolveConfig(
      schema,
      { ...hostedValues, NEXT_HOST },
      { environment: "production" },
    );
    expect(errors.some(({ key }) => key === "NEXT_HOST")).toBe(true);
  });

  it("retains local ports and normalizes hosted hostname casing", () => {
    const local = resolveConfig(
      schema,
      { ...hostedValues, NEXT_HOST: "localhost", NEXT_PORT: "4567" },
      { environment: "local" },
    );
    expect(local.errors).toEqual([]);
    expect(local.config.all.NEXT_PUBLIC_SITE_URL).toBe("http://localhost:4567");
    const hosted = resolveConfig(
      schema,
      { ...hostedValues, NEXT_HOST: "WWW.Example.com" },
      { environment: "production" },
    );
    expect(hosted.errors).toEqual([]);
    expect(hosted.config.all.NEXT_PUBLIC_SITE_URL).toBe(
      "https://www.example.com",
    );
  });
});
