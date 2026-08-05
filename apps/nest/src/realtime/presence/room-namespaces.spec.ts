import { describe, expect, it } from "vitest";
import { getRoomNamespaceConfig } from "./room-namespaces";

describe("checkboxes namespace", () => {
  const config = getRoomNamespaceConfig("checkboxes")!;

  it("accepts an in-range grid index", () => {
    expect(config.validateState({ checkboxIndex: 42 })).toEqual({
      checkboxIndex: 42,
    });
  });

  it("rejects out-of-range, fractional, and non-numeric indexes", () => {
    expect(config.validateState({ checkboxIndex: -1 })).toBeNull();
    expect(config.validateState({ checkboxIndex: 200 })).toBeNull();
    expect(config.validateState({ checkboxIndex: 1.5 })).toBeNull();
    expect(config.validateState({ checkboxIndex: "3" })).toBeNull();
    expect(config.validateState(null)).toBeNull();
  });
});

describe("cursors namespace", () => {
  const config = getRoomNamespaceConfig("cursors")!;

  it("keeps fractional coordinates inside the surface", () => {
    expect(config.validateState({ x: 0.25, y: 0.75 })).toEqual({
      x: 0.25,
      y: 0.75,
    });
  });

  it("clamps a pointer that drifts just outside the surface", () => {
    expect(config.validateState({ x: -0.2, y: 1.4 })).toEqual({ x: 0, y: 1 });
  });

  it("rejects coordinates that are far out of band or not numbers", () => {
    expect(config.validateState({ x: 40, y: 0.5 })).toBeNull();
    expect(config.validateState({ x: Number.NaN, y: 0.5 })).toBeNull();
    expect(config.validateState({ x: 0.5 })).toBeNull();
  });
});

describe("unknown namespaces", () => {
  it("has no configuration", () => {
    expect(getRoomNamespaceConfig("kanban")).toBeNull();
  });
});
