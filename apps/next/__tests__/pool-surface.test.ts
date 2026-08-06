// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest";
import type { PoolProjector } from "@/lib/pool/pool-renderer";
import {
  PoolSurfaceController,
  type PoolPointerTarget,
} from "@/lib/pool/pool-surface";

function harness(
  projector: PoolProjector = { project: (x, y) => ({ x, z: y }) },
) {
  const setPointer = vi.fn<(x: number, z: number) => void>();
  const clearPointer = vi.fn<() => void>();
  const emitTap = vi.fn<(x: number, z: number) => void>();
  const store: PoolPointerTarget = { setPointer, clearPointer, emitTap };
  return { store, projector, setPointer, clearPointer, emitTap };
}

function surface(): HTMLElement {
  const element = document.createElement("div");
  element.getBoundingClientRect = () =>
    ({ left: 20, top: 10, width: 200, height: 100 }) as DOMRect;
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

function click(element: HTMLElement, clientX: number, clientY: number): void {
  const event = new Event("click") as Event & {
    clientX: number;
    clientY: number;
  };
  event.clientX = clientX;
  event.clientY = clientY;
  element.dispatchEvent(event);
}

describe("PoolSurfaceController", () => {
  it("projects cached surface fractions into pool-world coordinates", () => {
    const projector = {
      project: vi.fn(() => ({ x: 800, z: 500 })),
    } satisfies PoolProjector;
    const { store, setPointer } = harness(projector);
    const controller = new PoolSurfaceController(store, projector);
    const element = surface();

    controller.attach(element);
    pointerMove(element, 120, 60);

    expect(projector.project).toHaveBeenCalledWith(0.5, 0.5);
    expect(setPointer).toHaveBeenCalledWith(800, 500);
  });

  it("ignores touch movement but accepts a touch-generated click", () => {
    const { store, projector, setPointer, emitTap } = harness();
    const controller = new PoolSurfaceController(store, projector);
    const element = surface();

    controller.attach(element);
    pointerMove(element, 120, 60, "touch");
    click(element, 120, 60);

    expect(setPointer).not.toHaveBeenCalled();
    expect(emitTap).toHaveBeenCalledWith(0.5, 0.5);
  });

  it("clears on detach and stops publishing", () => {
    const { store, projector, setPointer, clearPointer } = harness();
    const controller = new PoolSurfaceController(store, projector);
    const element = surface();

    controller.attach(element);
    controller.detach();
    pointerMove(element, 120, 60);

    expect(clearPointer).toHaveBeenCalledOnce();
    expect(setPointer).not.toHaveBeenCalled();
  });

  it("ignores projected points outside the visible pool", () => {
    const projector = { project: () => null } satisfies PoolProjector;
    const { store, setPointer, emitTap } = harness(projector);
    const controller = new PoolSurfaceController(store, projector);
    const element = surface();

    controller.attach(element);
    pointerMove(element, 20, 10);
    click(element, 20, 10);

    expect(setPointer).not.toHaveBeenCalled();
    expect(emitTap).not.toHaveBeenCalled();
  });
});
