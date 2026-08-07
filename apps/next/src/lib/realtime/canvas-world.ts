// The shared coordinate system for the collaborative canvas.
//
// The world has a fixed size in its own units. Every client renders it into a
// stage locked to the world's aspect ratio, so the stage *is* the world at some
// uniform scale. That single constraint is what makes a point mean the same
// thing on a 27" display and on a phone: there is no per-client layout for the
// coordinates to disagree about.
//
// It is also why the checkbox example cannot work this way. Its surface is a
// responsive card whose contents change with the breakpoint, so a fraction of
// that card names a different thing on every device.

export const CANVAS_WORLD = {
  width: 1600,
  height: 1000,
} as const;

export const CANVAS_WORLD_ASPECT = CANVAS_WORLD.width / CANVAS_WORLD.height;

/** Minor gridlines every 100 units, major every 400. */
export const CANVAS_GRID_STEP = 100;
export const CANVAS_GRID_MAJOR_EVERY = 4;

/** Whole world units are precise enough to read and to compare across devices. */
export function formatWorldPoint(x: number, y: number): string {
  return `${Math.round(x)}, ${Math.round(y)}`;
}
