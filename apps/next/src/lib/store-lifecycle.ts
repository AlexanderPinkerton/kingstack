export interface ActivatableStore {
  /**
   * Acquire demand for this store. The returned release function is idempotent.
   */
  activate(): () => void;
}

export interface DisposableStore {
  dispose(): void;
}

/**
 * Separates the lifetime of a store object from demand for its server data.
 * Multiple consumers can safely share one store without disabling it when only
 * one consumer unmounts.
 */
export class StoreDemand {
  private consumers = 0;
  private disposed = false;

  constructor(private readonly onDemandChange: () => void) {}

  get isActive(): boolean {
    return !this.disposed && this.consumers > 0;
  }

  activate(): () => void {
    if (this.disposed) {
      throw new Error("Cannot activate a disposed store");
    }

    this.consumers += 1;
    if (this.consumers === 1) {
      this.onDemandChange();
    }

    let released = false;
    return () => {
      if (released || this.disposed) return;
      released = true;

      this.consumers = Math.max(0, this.consumers - 1);
      if (this.consumers === 0) {
        this.onDemandChange();
      }
    };
  }

  dispose(): void {
    this.disposed = true;
    this.consumers = 0;
  }
}
