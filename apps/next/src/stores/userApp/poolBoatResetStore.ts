import {
  action,
  computed,
  makeObservable,
  observable,
  runInAction,
} from "mobx";

const PENDING_TIMEOUT_MS = 1_500;
const COUNTDOWN_POLL_MS = 250;

/** Low-frequency UI projection of the server-authoritative global cooldown. */
export class PoolBoatResetStore {
  secondsRemaining = 0;
  pending = false;

  private frameKey: string | null = null;
  private availableAtMs = 0;
  private countdownHandle: ReturnType<typeof setInterval> | null = null;
  private pendingHandle: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    makeObservable(this, {
      secondsRemaining: observable,
      pending: observable,
      canReset: computed,
      label: computed,
      observeFrame: action,
      beginRequest: action,
      cancelPending: action,
      reset: action,
    });
  }

  get canReset(): boolean {
    return !this.pending && this.secondsRemaining === 0;
  }

  get label(): string {
    if (this.pending) return "Resetting…";
    if (this.secondsRemaining > 0) {
      return `Reset in ${this.secondsRemaining}s`;
    }
    return "Reset boat";
  }

  observeFrame(
    epoch: string,
    resetSeq: number,
    cooldownMs: number,
    nowMs = performance.now(),
  ): void {
    const frameKey = `${epoch}:${resetSeq}`;
    if (frameKey === this.frameKey) return;
    this.frameKey = frameKey;
    this.availableAtMs = nowMs + Math.max(0, cooldownMs);
    this.clearPendingTimer();
    this.pending = false;
    this.updateCountdown(nowMs);
    this.restartCountdown();
  }

  beginRequest(): boolean {
    if (!this.canReset) return false;
    this.clearPendingTimer();
    this.pending = true;
    this.pendingHandle = setTimeout(() => {
      this.pendingHandle = null;
      runInAction(() => {
        this.pending = false;
      });
    }, PENDING_TIMEOUT_MS);
    return true;
  }

  cancelPending(): void {
    this.clearPendingTimer();
    this.pending = false;
  }

  reset(): void {
    this.stopCountdown();
    this.clearPendingTimer();
    this.frameKey = null;
    this.availableAtMs = 0;
    this.secondsRemaining = 0;
    this.pending = false;
  }

  dispose(): void {
    this.reset();
  }

  private restartCountdown(): void {
    this.stopCountdown();
    if (this.secondsRemaining === 0) return;
    this.countdownHandle = setInterval(() => {
      const nowMs = performance.now();
      const next = secondsUntil(this.availableAtMs, nowMs);
      if (next === this.secondsRemaining) return;
      runInAction(() => {
        this.secondsRemaining = next;
      });
      if (next === 0) this.stopCountdown();
    }, COUNTDOWN_POLL_MS);
  }

  private updateCountdown(nowMs: number): void {
    this.secondsRemaining = secondsUntil(this.availableAtMs, nowMs);
  }

  private stopCountdown(): void {
    if (this.countdownHandle === null) return;
    clearInterval(this.countdownHandle);
    this.countdownHandle = null;
  }

  private clearPendingTimer(): void {
    if (this.pendingHandle === null) return;
    clearTimeout(this.pendingHandle);
    this.pendingHandle = null;
  }
}

function secondsUntil(availableAtMs: number, nowMs: number): number {
  return Math.max(0, Math.ceil((availableAtMs - nowMs) / 1_000));
}
