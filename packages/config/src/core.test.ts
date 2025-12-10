import { describe, it, expect } from "vitest";
import { resolveConfig, defineSchema } from "./core";

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
});
