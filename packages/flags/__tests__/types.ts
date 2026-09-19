import { expectTypeOf } from "vitest";
import { variantFlag } from "../src/index.js";
import { createFlagEvaluator } from "../src/server.js";
import { FeatureFlagStore } from "../src/mobx.js";
import { createFixtureSnapshot } from "../src/testing.js";
import { flags } from "./fixtures.js";

const store = new FeatureFlagStore({ catalog: flags });
expectTypeOf(store.get(flags.dashboard)).toEqualTypeOf<boolean>();
expectTypeOf(store.get(flags.layout)).toEqualTypeOf<"control" | "compact">();
expectTypeOf(
  createFlagEvaluator({ client: null }).evaluate(flags.layout),
).toEqualTypeOf<Promise<"control" | "compact">>();
variantFlag({
  key: "layout",
  description: "x",
  variants: ["control", "compact"],
  // @ts-expect-error A default must be a declared variant, not an inferred extra variant.
  defaultValue: "typo",
});
// @ts-expect-error Fixtures must preserve catalog variant literals.
createFixtureSnapshot(flags, "draft", { layout: "typo" });
// @ts-expect-error Fixture names are catalog properties, not arbitrary provider keys.
createFixtureSnapshot(flags, "draft", { unknown: true });
