// Binds a DOM element to a SharedCursorStore.
//
// Lives outside React because this is the hot path: pointermove fires far more
// often than anything should re-render. The controller reads the surface
// geometry once and caches it, so a moving pointer never forces layout, and
// hands normalized coordinates to the store, which throttles the actual
// publish.

import type { SharedCursorStore } from "@/stores/userApp/sharedCursorStore";

export class CursorSurfaceController {
  private element: HTMLElement | null = null;
  private rect: DOMRect | null = null;
  private disposed = false;

  constructor(private readonly store: SharedCursorStore) {}

  /** Idempotent; safe to call with the same element on every React render. */
  attach(element: HTMLElement | null): void {
    if (this.disposed || element === this.element) return;

    this.detach();
    if (!element) return;

    this.element = element;
    this.refreshRect();

    element.addEventListener("pointermove", this.handlePointerMove, {
      passive: true,
    });
    element.addEventListener("pointerleave", this.handlePointerLeave);
    element.addEventListener("pointerdown", this.handlePointerMove, {
      passive: true,
    });
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
    element.removeEventListener("pointerleave", this.handlePointerLeave);
    element.removeEventListener("pointerdown", this.handlePointerMove);
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

  private handlePointerMove = (event: PointerEvent): void => {
    // Touch drags scroll the page; publishing them would fight the gesture.
    if (event.pointerType === "touch") return;

    const rect = this.rect;
    if (!rect || rect.width === 0 || rect.height === 0) return;

    this.store.setPointer(
      (event.clientX - rect.left) / rect.width,
      (event.clientY - rect.top) / rect.height,
    );
  };

  private handlePointerLeave = (): void => {
    this.store.clearPointer();
  };

  private handleVisibilityChange = (): void => {
    if (document.visibilityState === "hidden") this.store.clearPointer();
  };
}
