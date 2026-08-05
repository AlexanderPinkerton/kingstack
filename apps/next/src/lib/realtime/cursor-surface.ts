// Binds a DOM element to a SharedCursorStore.
//
// Lives outside React because this is the hot path: pointermove fires far more
// often than anything should re-render. The controller reads the surface
// geometry once and caches it, so a moving pointer never forces layout, and
// hands normalized coordinates to the store, which throttles the actual
// publish.

import type { SharedCursorStore } from "@/stores/userApp/sharedCursorStore";

export interface CursorSurfaceOptions {
  /**
   * Publish a tap wherever the surface is clicked. Uses `click` rather than
   * `pointerdown` so the browser resolves tap-versus-scroll for us: a touch
   * drag that scrolls the page never produces one.
   */
  emitTaps?: boolean;
}

export class CursorSurfaceController {
  private readonly emitTaps: boolean;
  private element: HTMLElement | null = null;
  private rect: DOMRect | null = null;
  private disposed = false;

  constructor(
    private readonly store: SharedCursorStore,
    options: CursorSurfaceOptions = {},
  ) {
    this.emitTaps = options.emitTaps ?? false;
  }

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
    if (this.emitTaps) {
      element.addEventListener("click", this.handleClick, { passive: true });
    }
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

  private toFraction(
    clientX: number,
    clientY: number,
  ): { x: number; y: number } | null {
    const rect = this.rect;
    if (!rect || rect.width === 0 || rect.height === 0) return null;

    return {
      x: (clientX - rect.left) / rect.width,
      y: (clientY - rect.top) / rect.height,
    };
  }

  private handlePointerMove = (event: PointerEvent): void => {
    // Touch drags scroll the page; publishing them would fight the gesture.
    if (event.pointerType === "touch") return;

    const fraction = this.toFraction(event.clientX, event.clientY);
    if (!fraction) return;

    this.store.setPointer(fraction.x, fraction.y);
  };

  /**
   * Unlike pointermove this accepts touch: a tap is the only presence a touch
   * client can express, since there is no hover to sample.
   */
  private handleClick = (event: MouseEvent): void => {
    const fraction = this.toFraction(event.clientX, event.clientY);
    if (!fraction) return;
    this.store.emitTap(fraction.x, fraction.y);
  };

  private handlePointerLeave = (): void => {
    this.store.clearPointer();
  };

  private handleVisibilityChange = (): void => {
    if (document.visibilityState === "hidden") this.store.clearPointer();
  };
}
