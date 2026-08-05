import { describe, expect, it } from "vitest";
import {
  normalizeParticipant,
  normalizeRoomId,
  normalizeSignalKind,
  roomNamespaceOf,
} from "./presence-protocol";

describe("normalizeSignalKind", () => {
  it("accepts short kebab-case kinds", () => {
    expect(normalizeSignalKind("ripple")).toBe("ripple");
    expect(normalizeSignalKind("  typing-start  ")).toBe("typing-start");
  });

  it("rejects empty, oversized, and non-slug kinds", () => {
    expect(normalizeSignalKind("")).toBeNull();
    expect(normalizeSignalKind("   ")).toBeNull();
    expect(normalizeSignalKind("Ripple")).toBeNull();
    expect(normalizeSignalKind("ripple!")).toBeNull();
    expect(normalizeSignalKind("a".repeat(40))).toBeNull();
    expect(normalizeSignalKind(7)).toBeNull();
  });
});

describe("normalizeRoomId", () => {
  it("accepts namespace:scope ids", () => {
    expect(normalizeRoomId("checkboxes:global")).toBe("checkboxes:global");
    expect(normalizeRoomId("  cursors:realtime-demo  ")).toBe(
      "cursors:realtime-demo",
    );
  });

  it("rejects ids that are missing a namespace, malformed, or oversized", () => {
    expect(normalizeRoomId("checkboxes")).toBeNull();
    expect(normalizeRoomId("Checkboxes:Global")).toBeNull();
    expect(normalizeRoomId("checkboxes:global:extra")).toBeNull();
    expect(normalizeRoomId("checkboxes:")).toBeNull();
    expect(normalizeRoomId(`cursors:${"a".repeat(80)}`)).toBeNull();
    expect(normalizeRoomId(42)).toBeNull();
    expect(normalizeRoomId(undefined)).toBeNull();
  });
});

describe("roomNamespaceOf", () => {
  it("reads the namespace segment", () => {
    expect(roomNamespaceOf("cursors:realtime-demo")).toBe("cursors");
  });
});

describe("normalizeParticipant", () => {
  it("trims the display name and preserves identity", () => {
    expect(
      normalizeParticipant({ id: "participant-a", name: "  Maya  ", tone: "violet" }),
    ).toEqual({ id: "participant-a", name: "Maya", tone: "violet" });
  });

  it("rejects empty names, unknown tones, and oversized identifiers", () => {
    expect(normalizeParticipant(null)).toBeNull();
    expect(normalizeParticipant({ id: "a", name: "   ", tone: "lime" })).toBeNull();
    expect(normalizeParticipant({ id: "a", name: "Maya", tone: "gold" })).toBeNull();
    expect(
      normalizeParticipant({ id: "a".repeat(200), name: "Maya", tone: "lime" }),
    ).toBeNull();
    expect(
      normalizeParticipant({ id: "a", name: "n".repeat(60), tone: "lime" }),
    ).toBeNull();
  });
});
