import { POOL_GRID, POOL_HEIGHT_MAX, POOL_WORLD } from "@kingstack/shared";

export interface WaveFieldOptions {
  worldWidth?: number;
  worldDepth?: number;
  waveSpeed?: number;
  stepSeconds?: number;
  dampingPerStep?: number;
  maxHeight?: number;
}

const DEFAULT_STEP_SECONDS = 1 / 60;
const DEFAULT_WAVE_SPEED = 500;
const DEFAULT_DAMPING_PER_STEP = 0.996;

export class WaveField {
  private current: Float32Array;
  private previous: Float32Array;
  private readonly lambdaXSquared: number;
  private readonly lambdaZSquared: number;
  private readonly dampingPerStep: number;
  private readonly maxHeight: number;
  private readonly cellWidth: number;
  private readonly cellDepth: number;

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
}
