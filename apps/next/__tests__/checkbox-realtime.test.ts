import { describe, expect, it } from "vitest";
import {
  decodeCheckboxPresence,
  decodeCheckboxRemoteChange,
  type CheckboxApiData,
} from "@/stores/userApp/checkboxStore";

const checkbox: CheckboxApiData = {
  id: "checkbox-1",
  index: 1,
  checked: true,
  created_at: "2026-07-27T10:00:00.000Z",
  updated_at: "2026-07-27T10:01:00.000Z",
};

describe("decodeCheckboxRemoteChange", () => {
  it("normalizes an upsert and declares collection membership", () => {
    expect(
      decodeCheckboxRemoteChange({
        type: "checkbox_update",
        event: "UPDATE",
        checkbox,
        browserId: "browser-a",
      }),
    ).toEqual({
      operation: "update",
      entity: checkbox,
      membership: "include",
      originId: "browser-a",
      revision: checkbox.updated_at,
    });
  });

  it("normalizes deletes", () => {
    expect(
      decodeCheckboxRemoteChange({
        event: "DELETE",
        data: checkbox,
      }),
    ).toEqual({
      operation: "delete",
      id: checkbox.id,
      originId: undefined,
      revision: checkbox.updated_at,
    });
  });

  it("rejects unrelated or incomplete transport events", () => {
    expect(
      decodeCheckboxRemoteChange({
        type: "another_channel",
        event: "UPDATE",
        checkbox,
      }),
    ).toBeNull();
    expect(decodeCheckboxRemoteChange({ event: "INSERT" })).toBeNull();
    expect(decodeCheckboxRemoteChange({ checkbox })).toBeNull();
  });
});

describe("decodeCheckboxPresence", () => {
  const participant = {
    id: "participant-a",
    name: "Maya",
    tone: "violet" as const,
  };

  it("decodes join, focus, idle, and leave events", () => {
    expect(
      decodeCheckboxPresence({
        type: "checkbox_presence",
        action: "join",
        participant,
        checkboxIndex: null,
      }),
    ).toEqual({
      operation: "upsert",
      presence: { participant, checkboxIndex: null },
    });

    expect(
      decodeCheckboxPresence({
        type: "checkbox_presence",
        action: "focus",
        participant,
        checkboxIndex: 42,
      }),
    ).toEqual({
      operation: "upsert",
      presence: { participant, checkboxIndex: 42 },
    });

    expect(
      decodeCheckboxPresence({
        type: "checkbox_presence",
        action: "idle",
        participant,
        checkboxIndex: null,
      }),
    ).toEqual({
      operation: "upsert",
      presence: { participant, checkboxIndex: null },
    });

    expect(
      decodeCheckboxPresence({
        type: "checkbox_presence",
        action: "leave",
        participant,
        checkboxIndex: null,
      }),
    ).toEqual({ operation: "remove", participantId: participant.id });
  });

  it("decodes authoritative roster resets", () => {
    expect(
      decodeCheckboxPresence({
        type: "checkbox_presence",
        action: "reset",
      }),
    ).toEqual({ operation: "reset" });
  });

  it("rejects malformed and unrelated presence events", () => {
    expect(
      decodeCheckboxPresence({
        type: "checkbox_presence",
        action: "focus",
        participant,
        checkboxIndex: -1,
      }),
    ).toBeNull();
    expect(
      decodeCheckboxPresence({
        participant: { ...participant, tone: "violet" },
      }),
    ).toBeNull();
  });
});
