import { describe, expect, it } from "vitest";
import { normalizeCheckboxPresencePayload } from "./realtime.gateway";

describe("normalizeCheckboxPresencePayload", () => {
  it("normalizes a valid highlight and trims the display name", () => {
    expect(
      normalizeCheckboxPresencePayload({
        action: "focus",
        participant: {
          id: "participant-a",
          name: "  Maya  ",
          tone: "violet",
        },
        checkboxIndex: 42,
      }),
    ).toEqual({
      action: "focus",
      participant: {
        id: "participant-a",
        name: "Maya",
        tone: "violet",
      },
      checkboxIndex: 42,
    });
  });

  it("accepts explicit leave events", () => {
    expect(
      normalizeCheckboxPresencePayload({
        action: "leave",
        participant: {
          id: "participant-a",
          name: "Maya",
          tone: "violet",
        },
        checkboxIndex: null,
      }),
    ).toMatchObject({ action: "leave", checkboxIndex: null });
  });

  it("rejects invalid names, tones, and checkbox indexes", () => {
    expect(normalizeCheckboxPresencePayload(undefined)).toBeNull();
    expect(
      normalizeCheckboxPresencePayload({
        action: "focus",
        participant: { id: "a", name: "", tone: "lime" },
        checkboxIndex: 0,
      }),
    ).toBeNull();
    expect(
      normalizeCheckboxPresencePayload({
        action: "focus",
        participant: { id: "a", name: "Ada", tone: "lime" },
        checkboxIndex: 200,
      }),
    ).toBeNull();
    expect(
      normalizeCheckboxPresencePayload({
        action: "focus",
        participant: {
          id: "a",
          name: "Ada",
          tone: "blue" as "lime",
        },
        checkboxIndex: 0,
      }),
    ).toBeNull();
  });
});
