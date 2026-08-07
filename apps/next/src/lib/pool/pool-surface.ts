import type { PoolViewpoint } from "@kingstack/shared";
import type {
  PoolViewController,
  PoolWorldPoint,
} from "@/lib/pool/pool-renderer";

export interface PoolPointerTarget {
  setPointer(x: number, z: number): void;
  clearPointer(): void;
  emitTap(x: number, z: number): void;
  setViewpoint(viewpoint: PoolViewpoint): void;
}

/** Thin DOM bridge for pointer disturbances and the orbiting pool camera. */
export class PoolSurfaceController {
  private element: HTMLElement | null = null;
  private rect: DOMRect | null = null;
  private orbitPointerId: number | null = null;
  private orbitX = 0;
  private orbitY = 0;
  private disposed = false;

  constructor(
    private readonly store: PoolPointerTarget,
    private readonly projector: PoolViewController,
  ) {}

  attach(element: HTMLElement | null): void {
    if (this.disposed || element === this.element) return;
    this.detach();
    if (!element) return;

    this.element = element;
    this.refreshRect();
    this.publishViewpoint();
    element.addEventListener("pointermove", this.handlePointerMove);
    element.addEventListener("pointerdown", this.handlePointerDown);
    element.addEventListener("pointerup", this.handlePointerUp);
    element.addEventListener("pointercancel", this.handlePointerUp);
    element.addEventListener("pointerleave", this.handlePointerLeave);
    element.addEventListener("wheel", this.handleWheel, { passive: false });
    element.addEventListener("contextmenu", this.handleContextMenu);
    element.addEventListener("click", this.handleClick, { passive: true });
    window.addEventListener("resize", this.handleResize, { passive: true });
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
    element.removeEventListener("pointerdown", this.handlePointerDown);
    element.removeEventListener("pointerup", this.handlePointerUp);
    element.removeEventListener("pointercancel", this.handlePointerUp);
    element.removeEventListener("pointerleave", this.handlePointerLeave);
    element.removeEventListener("wheel", this.handleWheel);
    element.removeEventListener("contextmenu", this.handleContextMenu);
    element.removeEventListener("click", this.handleClick);
    window.removeEventListener("resize", this.handleResize);
    window.removeEventListener("scroll", this.refreshRect, { capture: true });
    document.removeEventListener(
      "visibilitychange",
      this.handleVisibilityChange,
    );
    this.element = null;
    this.rect = null;
    this.orbitPointerId = null;
    this.store.clearPointer();
  }

  dispose(): void {
    this.detach();
    this.disposed = true;
  }

  private refreshRect = (): void => {
    this.rect = this.element?.getBoundingClientRect() ?? null;
  };

  private handleResize = (): void => {
    this.refreshRect();
    this.publishViewpoint();
  };

  private publishViewpoint(): void {
    this.store.setViewpoint(this.projector.viewpoint());
  }

  private toWorld(clientX: number, clientY: number): PoolWorldPoint | null {
    const rect = this.rect;
    if (!rect || rect.width === 0 || rect.height === 0) return null;
    return this.projector.project(
      (clientX - rect.left) / rect.width,
      (clientY - rect.top) / rect.height,
    );
  }

  private publishPointer(event: PointerEvent): void {
    if (event.pointerType === "touch") return;
    const point = this.toWorld(event.clientX, event.clientY);
    if (point) this.store.setPointer(point.x, point.z);
  }

  private handlePointerDown = (event: PointerEvent): void => {
    if (event.button !== 2) {
      this.publishPointer(event);
      return;
    }
    event.preventDefault();
    this.orbitPointerId = event.pointerId;
    this.orbitX = event.clientX;
    this.orbitY = event.clientY;
    this.store.clearPointer();
    this.element?.setPointerCapture?.(event.pointerId);
  };

  private handlePointerMove = (event: PointerEvent): void => {
    if (event.pointerId !== this.orbitPointerId) {
      this.publishPointer(event);
      return;
    }
    event.preventDefault();
    this.projector.orbit(
      event.clientX - this.orbitX,
      event.clientY - this.orbitY,
    );
    this.orbitX = event.clientX;
    this.orbitY = event.clientY;
    this.publishViewpoint();
  };

  private handlePointerUp = (event: PointerEvent): void => {
    if (event.pointerId !== this.orbitPointerId) return;
    this.orbitPointerId = null;
    if (this.element?.hasPointerCapture?.(event.pointerId)) {
      this.element.releasePointerCapture?.(event.pointerId);
    }
  };

  private handleWheel = (event: WheelEvent): void => {
    event.preventDefault();
    this.projector.zoom(event.deltaY);
    this.publishViewpoint();
  };

  private handleContextMenu = (event: MouseEvent): void => {
    event.preventDefault();
  };

  private handleClick = (event: MouseEvent): void => {
    if (event.button !== 0) return;
    const point = this.toWorld(event.clientX, event.clientY);
    if (point) this.store.emitTap(point.x, point.z);
  };

  private handlePointerLeave = (): void => {
    if (this.orbitPointerId === null) this.store.clearPointer();
  };

  private handleVisibilityChange = (): void => {
    if (document.visibilityState === "hidden") this.store.clearPointer();
  };
}
