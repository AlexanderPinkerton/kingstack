import { describe, expect, it } from "vitest";
import {
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
