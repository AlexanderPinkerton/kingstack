// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest";
import { CursorSurfaceController } from "@/lib/realtime/cursor-surface";
import type { SharedCursorStore } from "@/stores/userApp/sharedCursorStore";

function fakeStore() {
  const setPointer = vi.fn<(x: number, y: number) => void>();
  const clearPointer = vi.fn<() => void>();
  const emitTap = vi.fn<(x: number, y: number) => void>();
  const store = {
    setPointer,
    clearPointer,
    emitTap,
  } as unknown as SharedCursorStore;
  return { store, setPointer, clearPointer, emitTap };
}

function click(element: HTMLElement, clientX: number, clientY: number): void {
  const event = new Event("click") as Event & {
    clientX: number;
    clientY: number;
  };
  event.clientX = clientX;
  event.clientY = clientY;
  element.dispatchEvent(event);
}

function surfaceElement(rect: Partial<DOMRect>): HTMLElement {
  const element = document.createElement("div");
  const bounds = { left: 0, top: 0, width: 200, height: 100, ...rect };
  element.getBoundingClientRect = () => bounds as DOMRect;
  document.body.appendChild(element);
  return element;
}

function pointerMove(
  element: HTMLElement,
  clientX: number,
  clientY: number,
  pointerType = "mouse",
): void {
  const event = new Event("pointermove") as Event & {
    clientX: number;
    clientY: number;
    pointerType: string;
  };
  event.clientX = clientX;
  event.clientY = clientY;
  event.pointerType = pointerType;
  element.dispatchEvent(event);
}

describe("CursorSurfaceController", () => {
  it("normalizes pointer position against the surface bounds", () => {
    const { store, setPointer } = fakeStore();
    const controller = new CursorSurfaceController(store);
    const element = surfaceElement({ left: 20, top: 10, width: 200, height: 100 });

    controller.attach(element);
    pointerMove(element, 120, 60);

    expect(setPointer).toHaveBeenCalledWith(0.5, 0.5);
  });

  it("ignores touch pointers so page scrolling is not hijacked", () => {
    const { store, setPointer } = fakeStore();
    const controller = new CursorSurfaceController(store);
    const element = surfaceElement({});

    controller.attach(element);
    pointerMove(element, 100, 50, "touch");

    expect(setPointer).not.toHaveBeenCalled();
  });

  it("stops publishing after detach and clears the pointer once", () => {
    const { store, setPointer, clearPointer } = fakeStore();
    const controller = new CursorSurfaceController(store);
    const element = surfaceElement({});

    controller.attach(element);
    controller.detach();
    pointerMove(element, 100, 50);

    expect(setPointer).not.toHaveBeenCalled();
    expect(clearPointer).toHaveBeenCalledOnce();
  });

  it("re-attaching to the same element does not double-subscribe", () => {
    const { store, setPointer } = fakeStore();
    const controller = new CursorSurfaceController(store);
    const element = surfaceElement({});

    controller.attach(element);
    controller.attach(element);
    pointerMove(element, 100, 50);

    expect(setPointer).toHaveBeenCalledOnce();
  });

  it("moves its listeners when the surface element is swapped", () => {
    const { store, setPointer } = fakeStore();
    const controller = new CursorSurfaceController(store);
    const first = surfaceElement({});
    const second = surfaceElement({ width: 400, height: 200 });

    controller.attach(first);
    controller.attach(second);

    pointerMove(first, 100, 50);
    expect(setPointer).not.toHaveBeenCalled();

    pointerMove(second, 200, 100);
    expect(setPointer).toHaveBeenCalledWith(0.5, 0.5);
  });

  it("retires the pointer when the tab is hidden", () => {
    const { store, clearPointer } = fakeStore();
    const controller = new CursorSurfaceController(store);
    const element = surfaceElement({});

    controller.attach(element);
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "hidden",
    });
    document.dispatchEvent(new Event("visibilitychange"));

    expect(clearPointer).toHaveBeenCalledOnce();
  });

  it("emits taps only when the surface opts in", () => {
    const silent = fakeStore();
    const silentController = new CursorSurfaceController(silent.store);
    const silentElement = surfaceElement({});
    silentController.attach(silentElement);
    click(silentElement, 100, 50);
    expect(silent.emitTap).not.toHaveBeenCalled();

    const tapping = fakeStore();
    const tappingController = new CursorSurfaceController(tapping.store, {
      emitTaps: true,
    });
    const tappingElement = surfaceElement({ width: 200, height: 100 });
    tappingController.attach(tappingElement);
    click(tappingElement, 100, 50);
    expect(tapping.emitTap).toHaveBeenCalledWith(0.5, 0.5);
  });

  it("emits taps from touch, which publishes no pointer of its own", () => {
    const { store, emitTap, setPointer } = fakeStore();
    const controller = new CursorSurfaceController(store, { emitTaps: true });
    const element = surfaceElement({ width: 200, height: 100 });

    controller.attach(element);
    pointerMove(element, 100, 50, "touch");
    click(element, 100, 50);

    expect(setPointer).not.toHaveBeenCalled();
    expect(emitTap).toHaveBeenCalledWith(0.5, 0.5);
  });

  it("stops emitting taps after detach", () => {
    const { store, emitTap } = fakeStore();
    const controller = new CursorSurfaceController(store, { emitTaps: true });
    const element = surfaceElement({});

    controller.attach(element);
    controller.detach();
    click(element, 100, 50);

    expect(emitTap).not.toHaveBeenCalled();
  });

  it("ignores a surface that has collapsed to zero size", () => {
    const { store, setPointer } = fakeStore();
    const controller = new CursorSurfaceController(store);
    const element = surfaceElement({ width: 0, height: 0 });

    controller.attach(element);
    pointerMove(element, 10, 10);

    expect(setPointer).not.toHaveBeenCalled();
  });
});
