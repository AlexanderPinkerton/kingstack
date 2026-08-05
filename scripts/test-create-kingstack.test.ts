import { describe, expect, test } from "bun:test";
import { smokeProjectDirectoryName } from "./test-create-kingstack.js";

describe("create-kingstack smoke-test paths", () => {
  test("puts the timestamp on the project directory name", () => {
    expect(
      smokeProjectDirectoryName(
        "queens-go",
        new Date("2026-08-04T21:54:27.327Z"),
      ),
    ).toBe("queens-go-2026-08-04-21-54-27-327");
  });
});
