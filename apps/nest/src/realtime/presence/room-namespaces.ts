// Per-namespace policy for presence rooms.
//
// The gateway stays generic by delegating two decisions here: who may join a
// room, and whether a presence `state` payload is well formed. Adding a
// collaborative example means adding one entry to this table, not another
// handler on the gateway.

import { POOL_ROOM_ID, normalizePoolPoint } from "@kingstack/shared";

export interface RoomNamespaceConfig {
  /** Reject joins from sockets that only completed `register_public`. */
  requiresAuth: boolean;
  /** Optional exact room/scope admission policy within this namespace. */
  allowsRoomId?(roomId: string): boolean;
  /**
   * Validate and normalize a non-null presence state. Return `null` to reject.
   * Idle presence (`state: null`) bypasses this and is always allowed.
   */
  validateState(state: unknown): unknown | null;
  /**
   * Validate a one-shot signal. Omit to reject every signal in this namespace,
   * which is the default: a room opts in to transient events explicitly.
   */
  validateSignal?(kind: string, data: unknown): unknown | null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : null;
}

function isFiniteNumberInRange(
  value: unknown,
  min: number,
  max: number,
): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= min &&
    value <= max
  );
}

export const CHECKBOX_GRID_SIZE = 200;

/** `{ checkboxIndex }` — which cell of the shared grid a participant is on. */
function validateCheckboxState(state: unknown): unknown | null {
  const record = asRecord(state);
  if (!record) return null;

  const checkboxIndex = record.checkboxIndex;
  if (
    typeof checkboxIndex !== "number" ||
    !Number.isInteger(checkboxIndex) ||
    checkboxIndex < 0 ||
    checkboxIndex >= CHECKBOX_GRID_SIZE
  ) {
    return null;
  }

  return { checkboxIndex };
}

/**
 * `{ x, y }` — pointer position as a fraction of the shared surface, so it
 * survives different viewport sizes. Values are clamped rather than rejected:
 * a pointer leaving the surface should not tear down presence.
 */
function validateCursorState(state: unknown): unknown | null {
  const record = asRecord(state);
  if (!record) return null;

  if (
    !isFiniteNumberInRange(record.x, -1, 2) ||
    !isFiniteNumberInRange(record.y, -1, 2)
  ) {
    return null;
  }

  return {
    x: Math.min(1, Math.max(0, record.x)),
    y: Math.min(1, Math.max(0, record.y)),
  };
}

/**
 * Largest world a canvas room may declare. Positions are absolute world units,
 * not viewport fractions, so every client resolves them to the same point on
 * the scene regardless of how big its own window is.
 */
export const CANVAS_WORLD_LIMIT = 10_000;

/** `{ x, y }` in world units. Out-of-world points are rejected, not clamped. */
function validateCanvasState(state: unknown): unknown | null {
  const record = asRecord(state);
  if (!record) return null;

  if (
    !isFiniteNumberInRange(record.x, 0, CANVAS_WORLD_LIMIT) ||
    !isFiniteNumberInRange(record.y, 0, CANVAS_WORLD_LIMIT)
  ) {
    return null;
  }

  return { x: record.x, y: record.y };
}

const ROOM_NAMESPACES: Record<string, RoomNamespaceConfig> = {
  checkboxes: {
    requiresAuth: true,
    validateState: validateCheckboxState,
  },
  cursors: {
    requiresAuth: true,
    validateState: validateCursorState,
  },
  canvas: {
    requiresAuth: true,
    validateState: validateCanvasState,
    // A tap at a world point. Touch clients have no pointer to publish, so
    // this is the only way they are visible on the canvas at all.
    validateSignal: (kind, data) =>
      kind === "ripple" ? validateCanvasState(data) : null,
  },
  pool: {
    requiresAuth: true,
    allowsRoomId: (roomId) => roomId === POOL_ROOM_ID,
    validateState: normalizePoolPoint,
    validateSignal: (kind, data) =>
      kind === "ripple" ? normalizePoolPoint(data) : null,
  },
  // Entity fan-out only; the post feed carries no presence of its own.
  posts: {
    requiresAuth: true,
    validateState: () => null,
  },
};

export function getRoomNamespaceConfig(
  namespace: string,
): RoomNamespaceConfig | null {
  return ROOM_NAMESPACES[namespace] ?? null;
}

export function knownRoomNamespaces(): string[] {
  return Object.keys(ROOM_NAMESPACES);
}
