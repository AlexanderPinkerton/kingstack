import type { PoolProjector, PoolWorldPoint } from "@/lib/pool/pool-renderer";

export interface PoolPointerTarget {
  setPointer(x: number, z: number): void;
  clearPointer(): void;
  emitTap(x: number, z: number): void;
}

/** DOM event bridge for the allocation-free pool controller path. */
export class PoolSurfaceController {
  private element: HTMLElement | null = null;
  private rect: DOMRect | null = null;
  private disposed = false;

  constructor(
    private readonly store: PoolPointerTarget,
    private readonly projector: PoolProjector,
  ) {}

  attach(element: HTMLElement | null): void {
    if (this.disposed || element === this.element) return;
    this.detach();
    if (!element) return;

    this.element = element;
    this.refreshRect();
    element.addEventListener("pointermove", this.handlePointerMove, {
      passive: true,
    });
    element.addEventListener("pointerdown", this.handlePointerMove, {
      passive: true,
    });
    element.addEventListener("pointerleave", this.handlePointerLeave);
    element.addEventListener("click", this.handleClick, { passive: true });
    window.addEventListener("resize", this.refreshRect, { passive: true });
    window.addEventListener("scroll", this.refreshRect, {
      passive: true,
      capture: true,
    });
    document.addEventListener("visibilitychange", this.handleVisibilityChange);
  }

  detach(): void {
    const element = this.element;
    if (!element) return;

    element.removeEventListener("pointermove", this.handlePointerMove);
    element.removeEventListener("pointerdown", this.handlePointerMove);
    element.removeEventListener("pointerleave", this.handlePointerLeave);
    element.removeEventListener("click", this.handleClick);
    window.removeEventListener("resize", this.refreshRect);
    window.removeEventListener("scroll", this.refreshRect, { capture: true });
    document.removeEventListener(
      "visibilitychange",
      this.handleVisibilityChange,
    );
    this.element = null;
    this.rect = null;
    this.store.clearPointer();
  }

  dispose(): void {
    this.detach();
    this.disposed = true;
  }

  private refreshRect = (): void => {
    this.rect = this.element?.getBoundingClientRect() ?? null;
  };

  private toWorld(clientX: number, clientY: number): PoolWorldPoint | null {
    const rect = this.rect;
    if (!rect || rect.width === 0 || rect.height === 0) return null;
    return this.projector.project(
      (clientX - rect.left) / rect.width,
      (clientY - rect.top) / rect.height,
    );
  }

  private handlePointerMove = (event: PointerEvent): void => {
    if (event.pointerType === "touch") return;
    const point = this.toWorld(event.clientX, event.clientY);
    if (point) this.store.setPointer(point.x, point.z);
  };

  private handleClick = (event: MouseEvent): void => {
    const point = this.toWorld(event.clientX, event.clientY);
    if (point) this.store.emitTap(point.x, point.z);
  };

  private handlePointerLeave = (): void => this.store.clearPointer();

  private handleVisibilityChange = (): void => {
    if (document.visibilityState === "hidden") this.store.clearPointer();
  };
}
