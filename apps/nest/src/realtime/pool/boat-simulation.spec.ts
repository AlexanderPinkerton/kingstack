import { describe, expect, it } from "vitest";
import { BoatSimulation, type BoatWaterSurface } from "./boat-simulation";

function surface(
  options: {
    height?: number;
    verticalVelocity?: number;
    slopeX?: number;
    slopeZ?: number;
  } = {},
): BoatWaterSurface {
  return {
    sample: (_x, _z, out) => {
      out.height = options.height ?? 0;
      out.verticalVelocity = options.verticalVelocity ?? 0;
      out.slopeX = options.slopeX ?? 0;
      out.slopeZ = options.slopeZ ?? 0;
      return out;
    },
  };
}

describe("BoatSimulation", () => {
  it("settles into a finite floating pose on flat water", () => {
    const boat = new BoatSimulation();
    for (let index = 0; index < 1_800; index += 1) boat.step(surface());

    const pose = boat.pose();
    expect(pose.position.y).toBeGreaterThan(-30);
    expect(pose.position.y).toBeLessThan(40);
    expect(Object.values(pose.position).every(Number.isFinite)).toBe(true);
    expect(Object.values(pose.rotation).every(Number.isFinite)).toBe(true);
    expect(boat.isSettled()).toBe(true);
  });

  it("turns a water slope into horizontal movement and rotation", () => {
    const boat = new BoatSimulation();
    const start = boat.pose();
    const sloped = surface({ slopeX: 0.16, slopeZ: -0.08 });

    for (let index = 0; index < 180; index += 1) boat.step(sloped);

    const moved = boat.pose();
    expect(Math.abs(moved.position.x - start.position.x)).toBeGreaterThan(1);
    expect(Math.abs(moved.position.z - start.position.z)).toBeGreaterThan(1);
    expect(Math.hypot(moved.rotation.x, moved.rotation.z)).toBeGreaterThan(
      0.001,
    );
  });
});
