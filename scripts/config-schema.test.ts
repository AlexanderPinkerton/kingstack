import { describe, expect, it } from "bun:test";
import { resolveConfig } from "@kingstack/config";
import { schema } from "../config/schema.js";

const hostedValues = {
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
