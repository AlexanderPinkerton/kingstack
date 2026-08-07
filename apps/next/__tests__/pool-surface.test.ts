import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PoolViewController } from "@/lib/pool/pool-renderer";
import {
  PoolSurfaceController,
  type PoolPointerTarget,
} from "@/lib/pool/pool-surface";

const VIEWPOINT = { x: 800, y: 960, z: 1_820 };

class TestSurface extends EventTarget {
  private capturedPointer: number | null = null;

  getBoundingClientRect(): DOMRect {
    return { left: 20, top: 10, width: 200, height: 100 } as DOMRect;
  }

  setPointerCapture(pointerId: number): void {
    this.capturedPointer = pointerId;
  }

  hasPointerCapture(pointerId: number): boolean {
    return this.capturedPointer === pointerId;
  }

  releasePointerCapture(pointerId: number): void {
    if (this.capturedPointer === pointerId) this.capturedPointer = null;
  }
}

class TestPointerEvent extends Event {
  constructor(
    type: string,
    readonly clientX: number,
    readonly clientY: number,
    readonly button = 0,
    readonly pointerId = 1,
    readonly pointerType = "mouse",
  ) {
    super(type, { cancelable: true });
  }
}

class TestWheelEvent extends Event {
  constructor(readonly deltaY: number) {
    super("wheel", { cancelable: true });
  }
}

beforeEach(() => {
  const testDocument = new EventTarget() as EventTarget & {
    visibilityState: DocumentVisibilityState;
  };
  testDocument.visibilityState = "visible";
  vi.stubGlobal("window", new EventTarget());
  vi.stubGlobal("document", testDocument);
});

afterEach(() => vi.unstubAllGlobals());

function controller(
  project: PoolViewController["project"] = (x, y) => ({ x, z: y }),
): {
  projector: PoolViewController;
  project: ReturnType<typeof vi.fn<PoolViewController["project"]>>;
  orbit: ReturnType<typeof vi.fn<PoolViewController["orbit"]>>;
  zoom: ReturnType<typeof vi.fn<PoolViewController["zoom"]>>;
} {
  const projectMock = vi.fn(project);
  const orbit = vi.fn<PoolViewController["orbit"]>();
  const zoom = vi.fn<PoolViewController["zoom"]>();
  return {
    projector: {
      project: projectMock,
      orbit,
      zoom,
      viewpoint: vi.fn(() => VIEWPOINT),
    },
    project: projectMock,
    orbit,
    zoom,
  };
}

function harness(camera = controller()) {
  const setPointer = vi.fn<(x: number, z: number) => void>();
  const clearPointer = vi.fn<() => void>();
  const emitTap = vi.fn<(x: number, z: number) => void>();
  const setViewpoint = vi.fn<PoolPointerTarget["setViewpoint"]>();
  const store: PoolPointerTarget = {
    setPointer,
    clearPointer,
    emitTap,
    setViewpoint,
  };
  return {
    store,
    ...camera,
    setPointer,
    clearPointer,
    emitTap,
    setViewpoint,
  };
}

function surface(): HTMLElement {
  return new TestSurface() as unknown as HTMLElement;
}

function pointer(
  element: HTMLElement,
  type: "pointermove" | "pointerdown" | "pointerup",
  clientX: number,
  clientY: number,
  options: { button?: number; pointerId?: number; pointerType?: string } = {},
): void {
  const event = new TestPointerEvent(
    type,
    clientX,
    clientY,
    options.button,
    options.pointerId,
    options.pointerType,
  );
  element.dispatchEvent(event);
}

function click(element: HTMLElement, clientX: number, clientY: number): void {
  element.dispatchEvent(new TestPointerEvent("click", clientX, clientY));
}

describe("PoolSurfaceController", () => {
  it("projects cached surface fractions into pool-world coordinates", () => {
    const { store, projector, project, setPointer, setViewpoint } = harness(
      controller(() => ({ x: 800, z: 500 })),
    );
    const surfaceController = new PoolSurfaceController(store, projector);
    const element = surface();

    surfaceController.attach(element);
    pointer(element, "pointermove", 120, 60);

    expect(project).toHaveBeenCalledWith(0.5, 0.5);
    expect(setPointer).toHaveBeenCalledWith(800, 500);
    expect(setViewpoint).toHaveBeenCalledWith(VIEWPOINT);
  });

  it("ignores touch movement but accepts a touch-generated click", () => {
    const { store, projector, setPointer, emitTap } = harness();
    const surfaceController = new PoolSurfaceController(store, projector);
    const element = surface();

    surfaceController.attach(element);
    pointer(element, "pointermove", 120, 60, { pointerType: "touch" });
    click(element, 120, 60);

    expect(setPointer).not.toHaveBeenCalled();
    expect(emitTap).toHaveBeenCalledWith(0.5, 0.5);
  });

  it("orbits with the secondary button and publishes the new viewpoint", () => {
    const { store, projector, orbit, clearPointer, setViewpoint } = harness();
    const surfaceController = new PoolSurfaceController(store, projector);
    const element = surface();

    surfaceController.attach(element);
    pointer(element, "pointerdown", 100, 50, { button: 2, pointerId: 4 });
    pointer(element, "pointermove", 130, 65, { button: 2, pointerId: 4 });
    pointer(element, "pointerup", 130, 65, { button: 2, pointerId: 4 });

    expect(clearPointer).toHaveBeenCalled();
    expect(orbit).toHaveBeenCalledWith(30, 15);
    expect(setViewpoint).toHaveBeenLastCalledWith(VIEWPOINT);
  });

  it("zooms with the wheel and publishes the new viewpoint", () => {
    const { store, projector, zoom, setViewpoint } = harness();
    const surfaceController = new PoolSurfaceController(store, projector);
    const element = surface();
    const wheel = new TestWheelEvent(-120);

    surfaceController.attach(element);
    element.dispatchEvent(wheel);

    expect(zoom).toHaveBeenCalledWith(-120);
    expect(setViewpoint).toHaveBeenLastCalledWith(VIEWPOINT);
    expect(wheel.defaultPrevented).toBe(true);
  });

  it("clears on detach and stops publishing", () => {
    const { store, projector, setPointer, clearPointer } = harness();
    const surfaceController = new PoolSurfaceController(store, projector);
    const element = surface();

    surfaceController.attach(element);
    surfaceController.detach();
    pointer(element, "pointermove", 120, 60);

    expect(clearPointer).toHaveBeenCalledOnce();
    expect(setPointer).not.toHaveBeenCalled();
  });

  it("ignores projected points outside the visible pool", () => {
    const { store, projector, setPointer, emitTap } = harness(
      controller(() => null),
    );
    const surfaceController = new PoolSurfaceController(store, projector);
    const element = surface();

    surfaceController.attach(element);
    pointer(element, "pointermove", 20, 10);
    click(element, 20, 10);

    expect(setPointer).not.toHaveBeenCalled();
    expect(emitTap).not.toHaveBeenCalled();
  });
});
