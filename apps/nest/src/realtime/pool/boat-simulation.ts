import {
  POOL_PRESENTATION_HEIGHT_SCALE,
  POOL_WORLD,
  type PoolQuaternion,
  type PoolVector3,
} from "@kingstack/shared";
import type { WaveSample } from "./wave-field";

export interface BoatWaterSurface {
  sample(x: number, z: number, out: WaveSample): WaveSample;
}

export interface BoatPose {
  position: PoolVector3;
  rotation: PoolQuaternion;
}

const FIXED_STEP_SECONDS = 1 / 60;
const MASS = 90;
const GRAVITY = 260;
const BUOYANCY_PER_DEPTH = 190;
const VERTICAL_WATER_DRAG = 42;
const HORIZONTAL_WATER_DRAG = 12;
// A height field has no explicit horizontal water velocity. Amplify its
// surface-normal component into an arcade-scale lateral push so a wave moves
// the boat by a visible distance instead of a technically non-zero pixel.
const WAVE_SLOPE_PUSH = 40;
const AIR_LINEAR_DAMPING = 0.22;
const AIR_ANGULAR_DAMPING = 1.15;
const MAX_LINEAR_SPEED = 700;
const MAX_ANGULAR_SPEED = 2.5;
const BOAT_HALF_WIDTH = 46;
const BOAT_HALF_LENGTH = 88;
const BOAT_BOTTOM = -24;

const INERTIA = {
  x: (MASS * (176 ** 2 + 48 ** 2)) / 12,
  y: (MASS * (92 ** 2 + 176 ** 2)) / 12,
  z: (MASS * (92 ** 2 + 48 ** 2)) / 12,
} as const;

const PROBES = [
  { x: -BOAT_HALF_WIDTH, y: BOAT_BOTTOM, z: -BOAT_HALF_LENGTH },
  { x: BOAT_HALF_WIDTH, y: BOAT_BOTTOM, z: -BOAT_HALF_LENGTH },
  { x: -BOAT_HALF_WIDTH, y: BOAT_BOTTOM, z: 0 },
  { x: BOAT_HALF_WIDTH, y: BOAT_BOTTOM, z: 0 },
  { x: -BOAT_HALF_WIDTH, y: BOAT_BOTTOM, z: BOAT_HALF_LENGTH },
  { x: BOAT_HALF_WIDTH, y: BOAT_BOTTOM, z: BOAT_HALF_LENGTH },
] as const;

/**
 * One deliberately lightweight six-degree-of-freedom rigid body.
 *
 * Distributed buoyancy forces create pitch and roll. This is gameplay physics,
 * not a volumetric hull displacement model, but it stays deterministic and
 * allocation-free in the authoritative 60 Hz path.
 */
export class BoatSimulation {
  private readonly position = { x: 0, y: 0, z: 0 };
  private readonly rotation = { x: 0, y: 0, z: 0, w: 1 };
  private readonly linearVelocity = { x: 0, y: 0, z: 0 };
  private readonly angularVelocity = { x: 0, y: 0, z: 0 };
  private readonly rotatedProbe = { x: 0, y: 0, z: 0 };
  private readonly sample: WaveSample = {
    height: 0,
    verticalVelocity: 0,
    slopeX: 0,
    slopeZ: 0,
  };

  constructor() {
    this.reset();
  }

  step(surface: BoatWaterSurface, dt = FIXED_STEP_SECONDS): void {
    if (!Number.isFinite(dt) || dt <= 0 || dt > 0.05) return;

    let forceX = 0;
    let forceY = -MASS * GRAVITY;
    let forceZ = 0;
    let torqueX = 0;
    let torqueY = 0;
    let torqueZ = 0;

    for (const probe of PROBES) {
      const rotated = rotateVector(
        this.rotation,
        probe.x,
        probe.y,
        probe.z,
        this.rotatedProbe,
      );
      const pointX = this.position.x + rotated.x;
      const pointY = this.position.y + rotated.y;
      const pointZ = this.position.z + rotated.z;
      surface.sample(pointX, pointZ, this.sample);

      const waterHeight = this.sample.height * POOL_PRESENTATION_HEIGHT_SCALE;
      const depth = Math.min(90, waterHeight - pointY);
      if (depth <= 0) continue;

      let normalX = -this.sample.slopeX * POOL_PRESENTATION_HEIGHT_SCALE;
      let normalY = 1;
      let normalZ = -this.sample.slopeZ * POOL_PRESENTATION_HEIGHT_SCALE;
      const normalLength = Math.hypot(normalX, normalY, normalZ) || 1;
      normalX /= normalLength;
      normalY /= normalLength;
      normalZ /= normalLength;

      const pointVelocityX =
        this.linearVelocity.x +
        this.angularVelocity.y * rotated.z -
        this.angularVelocity.z * rotated.y;
      const pointVelocityY =
        this.linearVelocity.y +
        this.angularVelocity.z * rotated.x -
        this.angularVelocity.x * rotated.z;
      const pointVelocityZ =
        this.linearVelocity.z +
        this.angularVelocity.x * rotated.y -
        this.angularVelocity.y * rotated.x;
      const submersion = Math.min(1, depth / 45);
      const buoyancy = BUOYANCY_PER_DEPTH * depth;
      const localForceX =
        normalX * buoyancy * WAVE_SLOPE_PUSH -
        pointVelocityX * HORIZONTAL_WATER_DRAG * submersion;
      const localForceY =
        normalY * buoyancy -
        (pointVelocityY -
          this.sample.verticalVelocity * POOL_PRESENTATION_HEIGHT_SCALE) *
          VERTICAL_WATER_DRAG *
          submersion;
      const localForceZ =
        normalZ * buoyancy * WAVE_SLOPE_PUSH -
        pointVelocityZ * HORIZONTAL_WATER_DRAG * submersion;

      forceX += localForceX;
      forceY += localForceY;
      forceZ += localForceZ;
      torqueX += rotated.y * localForceZ - rotated.z * localForceY;
      torqueY += rotated.z * localForceX - rotated.x * localForceZ;
      torqueZ += rotated.x * localForceY - rotated.y * localForceX;
    }

    this.linearVelocity.x += (forceX / MASS) * dt;
    this.linearVelocity.y += (forceY / MASS) * dt;
    this.linearVelocity.z += (forceZ / MASS) * dt;
    this.angularVelocity.x += (torqueX / INERTIA.x) * dt;
    this.angularVelocity.y += (torqueY / INERTIA.y) * dt;
    this.angularVelocity.z += (torqueZ / INERTIA.z) * dt;

    const linearDamping = Math.exp(-AIR_LINEAR_DAMPING * dt);
    const angularDamping = Math.exp(-AIR_ANGULAR_DAMPING * dt);
    scaleVector(this.linearVelocity, linearDamping);
    scaleVector(this.angularVelocity, angularDamping);
    clampVectorLength(this.linearVelocity, MAX_LINEAR_SPEED);
    clampVectorLength(this.angularVelocity, MAX_ANGULAR_SPEED);

    this.position.x += this.linearVelocity.x * dt;
    this.position.y += this.linearVelocity.y * dt;
    this.position.z += this.linearVelocity.z * dt;
    integrateRotation(this.rotation, this.angularVelocity, dt);
    this.resolvePoolWalls();

    if (!this.isFinite()) this.reset();
  }

  pose(): BoatPose {
    return {
      position: { ...this.position },
      rotation: { ...this.rotation },
    };
  }

  isSettled(): boolean {
    return (
      Math.hypot(
        this.linearVelocity.x,
        this.linearVelocity.y,
        this.linearVelocity.z,
      ) < 0.8 &&
      Math.hypot(
        this.angularVelocity.x,
        this.angularVelocity.y,
        this.angularVelocity.z,
      ) < 0.012
    );
  }

  reset(): void {
    this.position.x = POOL_WORLD.width / 2;
    this.position.y = 8;
    this.position.z = POOL_WORLD.depth / 2;
    this.rotation.x = 0;
    this.rotation.y = 0;
    this.rotation.z = 0;
    this.rotation.w = 1;
    this.linearVelocity.x = 0;
    this.linearVelocity.y = 0;
    this.linearVelocity.z = 0;
    this.angularVelocity.x = 0;
    this.angularVelocity.y = 0;
    this.angularVelocity.z = 0;
  }

  private resolvePoolWalls(): void {
    const marginX = BOAT_HALF_LENGTH;
    const marginZ = BOAT_HALF_LENGTH;
    if (
      this.position.x < marginX ||
      this.position.x > POOL_WORLD.width - marginX
    ) {
      this.position.x = Math.min(
        POOL_WORLD.width - marginX,
        Math.max(marginX, this.position.x),
      );
      this.linearVelocity.x *= -0.25;
      this.angularVelocity.z *= 0.6;
    }
    if (
      this.position.z < marginZ ||
      this.position.z > POOL_WORLD.depth - marginZ
    ) {
      this.position.z = Math.min(
        POOL_WORLD.depth - marginZ,
        Math.max(marginZ, this.position.z),
      );
      this.linearVelocity.z *= -0.25;
      this.angularVelocity.x *= 0.6;
    }
    if (this.position.y < -140 || this.position.y > 300) this.reset();
  }

  private isFinite(): boolean {
    return (
      Number.isFinite(this.position.x) &&
      Number.isFinite(this.position.y) &&
      Number.isFinite(this.position.z) &&
      Number.isFinite(this.rotation.x) &&
      Number.isFinite(this.rotation.y) &&
      Number.isFinite(this.rotation.z) &&
      Number.isFinite(this.rotation.w) &&
      Number.isFinite(this.linearVelocity.x) &&
      Number.isFinite(this.linearVelocity.y) &&
      Number.isFinite(this.linearVelocity.z) &&
      Number.isFinite(this.angularVelocity.x) &&
      Number.isFinite(this.angularVelocity.y) &&
      Number.isFinite(this.angularVelocity.z)
    );
  }
}

function rotateVector(
  rotation: PoolQuaternion,
  x: number,
  y: number,
  z: number,
  out: PoolVector3,
): PoolVector3 {
  const tx = 2 * (rotation.y * z - rotation.z * y);
  const ty = 2 * (rotation.z * x - rotation.x * z);
  const tz = 2 * (rotation.x * y - rotation.y * x);
  out.x = x + rotation.w * tx + rotation.y * tz - rotation.z * ty;
  out.y = y + rotation.w * ty + rotation.z * tx - rotation.x * tz;
  out.z = z + rotation.w * tz + rotation.x * ty - rotation.y * tx;
  return out;
}

function scaleVector(vector: PoolVector3, scalar: number): void {
  vector.x *= scalar;
  vector.y *= scalar;
  vector.z *= scalar;
}

function clampVectorLength(vector: PoolVector3, maximum: number): void {
  const length = Math.hypot(vector.x, vector.y, vector.z);
  if (length <= maximum || length === 0) return;
  scaleVector(vector, maximum / length);
}

function integrateRotation(
  rotation: PoolQuaternion,
  angularVelocity: PoolVector3,
  dt: number,
): void {
  const { x, y, z, w } = rotation;
  const halfDt = dt * 0.5;
  rotation.x +=
    (angularVelocity.x * w + angularVelocity.y * z - angularVelocity.z * y) *
    halfDt;
  rotation.y +=
    (-angularVelocity.x * z + angularVelocity.y * w + angularVelocity.z * x) *
    halfDt;
  rotation.z +=
    (angularVelocity.x * y - angularVelocity.y * x + angularVelocity.z * w) *
    halfDt;
  rotation.w +=
    (-angularVelocity.x * x - angularVelocity.y * y - angularVelocity.z * z) *
    halfDt;
  const norm = Math.hypot(rotation.x, rotation.y, rotation.z, rotation.w) || 1;
  rotation.x /= norm;
  rotation.y /= norm;
  rotation.z /= norm;
  rotation.w /= norm;
}
