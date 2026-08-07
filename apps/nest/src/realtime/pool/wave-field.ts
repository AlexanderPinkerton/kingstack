import { POOL_GRID, POOL_HEIGHT_MAX, POOL_WORLD } from "@kingstack/shared";

export interface WaveFieldOptions {
  worldWidth?: number;
  worldDepth?: number;
  waveSpeed?: number;
  stepSeconds?: number;
  dampingPerStep?: number;
  maxHeight?: number;
}

export interface WaveSample {
  height: number;
  verticalVelocity: number;
  slopeX: number;
  slopeZ: number;
}

const DEFAULT_STEP_SECONDS = 1 / 60;
const DEFAULT_WAVE_SPEED = 500;
// Applied at 60 Hz. This deliberately dissipates reflected waves within a few
// seconds so the shared pool returns to a calm baseline between interactions.
const DEFAULT_DAMPING_PER_STEP = 0.985;

export class WaveField {
  private current: Float32Array;
  private previous: Float32Array;
  private readonly lambdaXSquared: number;
  private readonly lambdaZSquared: number;
  private readonly dampingPerStep: number;
  private readonly maxHeight: number;
  private readonly cellWidth: number;
  private readonly cellDepth: number;
  private readonly worldWidth: number;
  private readonly worldDepth: number;
  private readonly stepSeconds: number;

  constructor(
    readonly cols = POOL_GRID.cols,
    readonly rows = POOL_GRID.rows,
    options: WaveFieldOptions = {},
  ) {
    if (
      !Number.isInteger(cols) ||
      cols < 2 ||
      !Number.isInteger(rows) ||
      rows < 2
    ) {
      throw new RangeError("WaveField requires at least a 2x2 integer grid");
    }

    const worldWidth = options.worldWidth ?? POOL_WORLD.width;
    const worldDepth = options.worldDepth ?? POOL_WORLD.depth;
    const waveSpeed = options.waveSpeed ?? DEFAULT_WAVE_SPEED;
    const stepSeconds = options.stepSeconds ?? DEFAULT_STEP_SECONDS;
    this.stepSeconds = stepSeconds;
    this.worldWidth = worldWidth;
    this.worldDepth = worldDepth;
    this.dampingPerStep = options.dampingPerStep ?? DEFAULT_DAMPING_PER_STEP;
    this.maxHeight = options.maxHeight ?? POOL_HEIGHT_MAX;

    if (
      !Number.isFinite(worldWidth) ||
      worldWidth <= 0 ||
      !Number.isFinite(worldDepth) ||
      worldDepth <= 0 ||
      !Number.isFinite(waveSpeed) ||
      waveSpeed <= 0 ||
      !Number.isFinite(stepSeconds) ||
      stepSeconds <= 0 ||
      !Number.isFinite(this.dampingPerStep) ||
      this.dampingPerStep <= 0 ||
      this.dampingPerStep > 1 ||
      !Number.isFinite(this.maxHeight) ||
      this.maxHeight <= 0
    ) {
      throw new RangeError("WaveField options must be finite positive values");
    }

    this.cellWidth = worldWidth / cols;
    this.cellDepth = worldDepth / rows;
    const xRatio = (waveSpeed * stepSeconds) / this.cellWidth;
    const zRatio = (waveSpeed * stepSeconds) / this.cellDepth;
    this.lambdaXSquared = xRatio * xRatio;
    this.lambdaZSquared = zRatio * zRatio;

    if (this.lambdaXSquared + this.lambdaZSquared > 1) {
      throw new RangeError(
        "WaveField options violate the 2D Courant stability condition",
      );
    }

    this.current = new Float32Array(cols * rows);
    this.previous = new Float32Array(cols * rows);
  }

  step(): void {
    const current = this.current;
    const previous = this.previous;
    let invalid = false;

    for (let row = 0; row < this.rows; row += 1) {
      const upRow = row === 0 ? row : row - 1;
      const downRow = row === this.rows - 1 ? row : row + 1;

      for (let col = 0; col < this.cols; col += 1) {
        const leftCol = col === 0 ? col : col - 1;
        const rightCol = col === this.cols - 1 ? col : col + 1;
        const index = row * this.cols + col;
        const center = current[index];
        const laplacianX =
          current[row * this.cols + leftCol] +
          current[row * this.cols + rightCol] -
          2 * center;
        const laplacianZ =
          current[upRow * this.cols + col] +
          current[downRow * this.cols + col] -
          2 * center;

        let next =
          (2 * center -
            previous[index] +
            this.lambdaXSquared * laplacianX +
            this.lambdaZSquared * laplacianZ) *
          this.dampingPerStep;

        if (!Number.isFinite(next)) {
          next = 0;
          invalid = true;
        } else {
          next = Math.max(-this.maxHeight, Math.min(this.maxHeight, next));
        }
        previous[index] = next;
      }
    }

    this.previous = current;
    this.current = previous;

    if (invalid) {
      this.reset();
      throw new Error("WaveField produced a non-finite value and was reset");
    }
  }

  impulse(x: number, z: number, strength: number, radius: number): void {
    if (
      !Number.isFinite(x) ||
      !Number.isFinite(z) ||
      !Number.isFinite(strength) ||
      !Number.isFinite(radius) ||
      radius <= 0
    ) {
      return;
    }

    const minCol = Math.max(0, Math.floor((x - radius) / this.cellWidth));
    const maxCol = Math.min(
      this.cols - 1,
      Math.floor((x + radius) / this.cellWidth),
    );
    const minRow = Math.max(0, Math.floor((z - radius) / this.cellDepth));
    const maxRow = Math.min(
      this.rows - 1,
      Math.floor((z + radius) / this.cellDepth),
    );

    for (let row = minRow; row <= maxRow; row += 1) {
      const cellZ = (row + 0.5) * this.cellDepth;
      for (let col = minCol; col <= maxCol; col += 1) {
        const cellX = (col + 0.5) * this.cellWidth;
        const distance = Math.hypot(cellX - x, cellZ - z);
        if (distance > radius) continue;

        const weight = 0.5 * (Math.cos((Math.PI * distance) / radius) + 1);
        const index = row * this.cols + col;
        const next = Math.max(
          -this.maxHeight,
          Math.min(this.maxHeight, this.current[index] + strength * weight),
        );
        // Change displacement without manufacturing an extra velocity spike.
        const delta = next - this.current[index];
        this.current[index] = next;
        this.previous[index] = Math.max(
          -this.maxHeight,
          Math.min(this.maxHeight, this.previous[index] + delta),
        );
      }
    }
  }

  quantise(out: Int8Array): void {
    if (out.length !== this.current.length) {
      throw new RangeError(`Expected ${this.current.length} quantised cells`);
    }

    for (let index = 0; index < this.current.length; index += 1) {
      const value = Math.round((this.current[index] / this.maxHeight) * 127);
      out[index] = Math.max(-127, Math.min(127, value));
    }
  }

  /** Samples the continuous surface without allocating in the 60 Hz path. */
  sample(x: number, z: number, out: WaveSample): WaveSample {
    const clampedX = Math.min(this.worldWidth, Math.max(0, x));
    const clampedZ = Math.min(this.worldDepth, Math.max(0, z));
    const height = this.sampleArray(this.current, clampedX, clampedZ);
    const previousHeight = this.sampleArray(this.previous, clampedX, clampedZ);
    const left = this.sampleArray(
      this.current,
      Math.max(0, clampedX - this.cellWidth),
      clampedZ,
    );
    const right = this.sampleArray(
      this.current,
      Math.min(this.worldWidth, clampedX + this.cellWidth),
      clampedZ,
    );
    const near = this.sampleArray(
      this.current,
      clampedX,
      Math.max(0, clampedZ - this.cellDepth),
    );
    const far = this.sampleArray(
      this.current,
      clampedX,
      Math.min(this.worldDepth, clampedZ + this.cellDepth),
    );

    out.height = height;
    out.verticalVelocity = (height - previousHeight) / this.stepSeconds;
    out.slopeX = (right - left) / (2 * this.cellWidth);
    out.slopeZ = (far - near) / (2 * this.cellDepth);
    return out;
  }

  energy(): number {
    let energy = 0;
    for (let index = 0; index < this.current.length; index += 1) {
      const displacement = this.current[index];
      const velocity = this.current[index] - this.previous[index];
      energy += displacement * displacement + velocity * velocity;
    }
    return energy / this.current.length;
  }

  reset(): void {
    this.current.fill(0);
    this.previous.fill(0);
  }

  private sampleArray(field: Float32Array, x: number, z: number): number {
    const gridX = (x / this.worldWidth) * (this.cols - 1);
    const gridZ = (z / this.worldDepth) * (this.rows - 1);
    const left = Math.floor(gridX);
    const near = Math.floor(gridZ);
    const right = Math.min(this.cols - 1, left + 1);
    const far = Math.min(this.rows - 1, near + 1);
    const fractionX = gridX - left;
    const fractionZ = gridZ - near;
    const nearLeft = field[near * this.cols + left] ?? 0;
    const nearRight = field[near * this.cols + right] ?? 0;
    const farLeft = field[far * this.cols + left] ?? 0;
    const farRight = field[far * this.cols + right] ?? 0;
    const nearValue = nearLeft + (nearRight - nearLeft) * fractionX;
    const farValue = farLeft + (farRight - farLeft) * fractionX;
    return nearValue + (farValue - nearValue) * fractionZ;
  }
}
