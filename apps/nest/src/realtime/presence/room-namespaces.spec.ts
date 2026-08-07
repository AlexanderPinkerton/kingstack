import { describe, expect, it } from "vitest";
import { POOL_ROOM_ID } from "@kingstack/shared";
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

describe("canvas namespace", () => {
  const config = getRoomNamespaceConfig("canvas")!;

  it("accepts absolute world coordinates", () => {
    expect(config.validateState({ x: 812, y: 460 })).toEqual({
      x: 812,
      y: 460,
    });
  });

  it("keeps sub-unit precision so cursors do not snap to whole pixels", () => {
    expect(config.validateState({ x: 812.25, y: 460.75 })).toEqual({
      x: 812.25,
      y: 460.75,
    });
  });

  it("rejects points outside the world rather than clamping them", () => {
    // A fraction here means the client forgot to project into world units,
    // which is a bug worth surfacing rather than silently snapping to a corner.
    expect(config.validateState({ x: -1, y: 460 })).toBeNull();
    expect(config.validateState({ x: 20_000, y: 460 })).toBeNull();
    expect(
      config.validateState({ x: 812, y: Number.POSITIVE_INFINITY }),
    ).toBeNull();
    expect(config.validateState({ y: 460 })).toBeNull();
  });
});

describe("room signals", () => {
  it("accepts a canvas ripple at a world point", () => {
    const config = getRoomNamespaceConfig("canvas")!;

    expect(config.validateSignal?.("ripple", { x: 400, y: 800 })).toEqual({
      x: 400,
      y: 800,
    });
  });

  it("rejects unknown signal kinds and malformed ripple points", () => {
    const config = getRoomNamespaceConfig("canvas")!;

    expect(config.validateSignal?.("explode", { x: 400, y: 800 })).toBeNull();
    expect(config.validateSignal?.("ripple", { x: -5, y: 800 })).toBeNull();
    expect(config.validateSignal?.("ripple", null)).toBeNull();
  });

  it("is opt-in: namespaces without a validator accept no signals", () => {
    expect(
      getRoomNamespaceConfig("cursors")?.validateSignal === undefined,
    ).toBe(true);
    expect(
      getRoomNamespaceConfig("checkboxes")?.validateSignal === undefined,
    ).toBe(true);
  });
});

describe("global pool namespace", () => {
  const config = getRoomNamespaceConfig("pool")!;

  it("admits only the one global pool room", () => {
    expect(config.allowsRoomId?.(POOL_ROOM_ID)).toBe(true);
    expect(config.allowsRoomId?.("pool:private")).toBe(false);
  });

  it("validates the pool pointer and 3D viewpoint envelope", () => {
    const state = {
      pointer: { x: 1600, y: 1000 },
      viewpoint: { x: 800, y: 960, z: 1_820 },
    };
    expect(config.validateState(state)).toEqual(state);
    expect(
      config.validateState({ ...state, pointer: { x: 1601, y: 1000 } }),
    ).toBeNull();
    expect(config.validateState({ ...state, pointer: null })).toEqual({
      pointer: null,
      viewpoint: state.viewpoint,
    });
    expect(
      config.validateState({
        ...state,
        viewpoint: { x: 800, y: Number.NaN, z: 1_820 },
      }),
    ).toBeNull();
    expect(config.validateSignal?.("ripple", { x: 20, y: 30 })).toEqual({
      x: 20,
      y: 30,
    });
    expect(config.validateSignal?.("reset-boat", true)).toBe(true);
    expect(config.validateSignal?.("reset-boat", false)).toBeNull();
    expect(config.validateSignal?.("explode", { x: 20, y: 30 })).toBeNull();
  });
});

describe("unknown namespaces", () => {
  it("has no configuration", () => {
    expect(getRoomNamespaceConfig("kanban")).toBeNull();
  });
});
