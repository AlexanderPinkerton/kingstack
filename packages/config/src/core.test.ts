import { describe, it, expect } from "vitest";
import { defineSchema, resolveConfig, validateSchemaMappings } from "./core";

describe("resolveConfig", () => {
  it("should resolve core values and defaults", () => {
    const schema = defineSchema({
      core: {
        REQUIRED: { required: true },
        WITH_DEFAULT: { default: "default-val" },
      },
      computed: () => ({}),
      envfiles: {},
    });

    const values = { REQUIRED: "provided" };
    const { config, errors } = resolveConfig(schema, values);

    expect(errors).toHaveLength(0);
    expect(config.core.REQUIRED).toBe("provided");
    expect(config.core.WITH_DEFAULT).toBe("default-val");
  });

  it("should report missing required values", () => {
    const schema = defineSchema({
      core: {
        REQUIRED: { required: true },
      },
      computed: () => ({}),
      envfiles: {},
    });

    const values = {};
    const { errors } = resolveConfig(schema, values);

    expect(errors).toHaveLength(1);
    expect(errors[0].key).toBe("REQUIRED");
  });

  it("should resolve computed values", () => {
    const schema = defineSchema({
      core: {
        BASE: { default: "base" },
      },
      computed: (core) => ({
        DERIVED: `${core.BASE}-derived`,
      }),
      envfiles: {},
    });

    const { config } = resolveConfig(schema, {});
    expect(config.computed.DERIVED).toBe("base-derived");
    expect(config.all.DERIVED).toBe("base-derived");
  });

  it("rejects stale values instead of silently ignoring them", () => {
    const schema = defineSchema({
      core: { CURRENT: { required: true } },
      computed: () => ({}),
      envfiles: {},
    });

    const { errors } = resolveConfig(schema, {
      CURRENT: "present",
      REMOVED: "stale",
    });

    expect(errors).toContainEqual(expect.objectContaining({ key: "REMOVED" }));
  });

  it("uses environment context for requirements and computed values", () => {
    const schema = defineSchema({
      environments: {
        local: { mode: "local", sync: false },
        staging: { mode: "hosted", sync: true },
      },
      core: {
        DEPLOY_TOKEN: {
          requiredWhen: ({ mode }) => mode === "hosted",
        },
      },
      computed: (_core, context) => ({ ENVIRONMENT: context.environment }),
      envfiles: {},
    });

    expect(resolveConfig(schema, {}, { environment: "local" }).errors).toEqual(
      [],
    );
    expect(
      resolveConfig(schema, {}, { environment: "staging" }).errors[0]?.key,
    ).toBe("DEPLOY_TOKEN");
    expect(
      resolveConfig(
        schema,
        { DEPLOY_TOKEN: "configured" },
        { environment: "staging" },
      ).config.computed.ENVIRONMENT,
    ).toBe("staging");
  });

  it("rejects computed collisions", () => {
    const schema = defineSchema({
      core: { VALUE: { default: "input" } },
      computed: () => ({ VALUE: "computed" }),
      envfiles: {},
    });

    const { errors } = resolveConfig(schema, {});
    expect(errors[0]?.key).toBe("computed.VALUE");
  });

  it("validates env, config-file, and service mappings", () => {
    const schema = defineSchema({
      core: { KNOWN: { default: "value" } },
      computed: () => ({}),
      envfiles: {
        app: { path: "app/.env", keys: ["MISSING_ENV"] },
      },
      configs: {
        app: {
          path: "app/config.toml",
          format: "toml",
          mappings: { port: "MISSING_CONFIG" },
        },
      },
      services: {
        github: {
          description: "test",
          keys: ["MISSING_SERVICE"],
        },
      },
    });

    const errors = validateSchemaMappings(schema, new Set(["KNOWN"]));
    expect(errors.map((error) => error.key)).toEqual(
      expect.arrayContaining([
        "app.MISSING_ENV",
        "app.port",
        "github.MISSING_SERVICE",
      ]),
    );
  });

  it("rejects sensitive inputs mapped to public environment names", () => {
    const schema = defineSchema({
      core: { SECRET: { default: "value", sensitive: true } },
      computed: () => ({}),
      envfiles: {
        app: {
          path: "app/.env",
          keys: [],
          aliases: { SECRET: "NEXT_PUBLIC_SECRET" },
        },
      },
    });

    const errors = validateSchemaMappings(schema, new Set(["SECRET"]));
    expect(errors[0]?.message).toContain("cannot be emitted as public");
  });
});
