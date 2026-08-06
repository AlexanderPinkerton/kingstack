import { describe, expect, it } from "vitest";
import { POOL_CELL_COUNT } from "@kingstack/shared";
import { WaveField } from "./wave-field";

describe("WaveField", () => {
  it("propagates an impulse and remains finite", () => {
    const field = new WaveField();
    const quantised = new Int8Array(POOL_CELL_COUNT);

    field.impulse(800, 500, -24, 90);
    field.quantise(quantised);
    const initiallyChanged = quantised.filter((value) => value !== 0).length;

    for (let index = 0; index < 30; index += 1) field.step();
    field.quantise(quantised);

    expect(initiallyChanged).toBeGreaterThan(0);
    expect(quantised.every((value) => Number.isFinite(value))).toBe(true);
    expect(quantised.filter((value) => value !== 0).length).toBeGreaterThan(
      initiallyChanged,
    );
  });

  it("decays below the visible threshold over a long run", () => {
    const field = new WaveField();
    const quantised = new Int8Array(POOL_CELL_COUNT);
    field.impulse(40, 40, -40, 100);

    for (let index = 0; index < 10_000; index += 1) field.step();
    field.quantise(quantised);

    expect(field.energy()).toBeLessThan(0.01);
    expect(quantised.every((value) => value === 0)).toBe(true);
  });

  it("rejects a timestep and speed that violate Courant stability", () => {
    expect(
      () => new WaveField(64, 40, { waveSpeed: 10_000, stepSeconds: 1 / 30 }),
    ).toThrow(/Courant/);
  });

  it("bounds repeated hostile impulses", () => {
    const field = new WaveField();
    const quantised = new Int8Array(POOL_CELL_COUNT);

    for (let index = 0; index < 1_000; index += 1) {
      field.impulse(
        index % 2 === 0 ? 0 : 1600,
        index % 2 === 0 ? 0 : 1000,
        -10_000,
        500,
      );
      field.step();
    }
    field.quantise(quantised);

    expect(quantised.every((value) => value >= -127 && value <= 127)).toBe(
      true,
    );
    expect(Number.isFinite(field.energy())).toBe(true);
  });
});
