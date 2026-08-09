import { BadRequestException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import {
  validateCount,
  validateCreateCheckbox,
  validateUpdateCheckbox,
} from "./checkboxes.controller";

describe("guest checkbox input boundaries", () => {
  it("accepts only cells inside the fixed 200-cell demo grid", () => {
    expect(validateCreateCheckbox({ index: 0, checked: true })).toEqual({
      index: 0,
      checked: true,
    });
    expect(validateCreateCheckbox({ index: 199, checked: false })).toEqual({
      index: 199,
      checked: false,
    });

    expect(() => validateCreateCheckbox({ index: -1, checked: true })).toThrow(
      BadRequestException,
    );
    expect(() => validateCreateCheckbox({ index: 200, checked: true })).toThrow(
      BadRequestException,
    );
    expect(() => validateCreateCheckbox({ index: 1, checked: "yes" })).toThrow(
      BadRequestException,
    );
  });

  it("allows toggles but not index reassignment", () => {
    expect(validateUpdateCheckbox({ checked: false })).toEqual({
      checked: false,
    });
    expect(validateUpdateCheckbox({ index: 3, checked: true })).toEqual({
      checked: true,
    });
    expect(() => validateUpdateCheckbox({ index: 3 })).toThrow(
      BadRequestException,
    );
  });

  it("bounds non-destructive bootstrap counts", () => {
    expect(validateCount()).toBe(200);
    expect(validateCount("1")).toBe(1);
    expect(validateCount("200")).toBe(200);
    expect(() => validateCount("0")).toThrow(BadRequestException);
    expect(() => validateCount("201")).toThrow(BadRequestException);
    expect(() => validateCount("1.5")).toThrow(BadRequestException);
  });
});
