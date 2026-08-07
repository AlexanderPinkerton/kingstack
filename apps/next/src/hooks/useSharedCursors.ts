"use client";

import { useCallback, useEffect, useMemo } from "react";
import { useRootStore } from "@/hooks/useRootStore";
import {
  CursorSurfaceController,
  type CursorSurfaceOptions,
} from "@/lib/realtime/cursor-surface";
import type { PresenceParticipant } from "@/lib/realtime/presence-room";
import type { SharedCursorStore } from "@/stores/userApp/sharedCursorStore";

export interface SharedCursorsBinding {
  store: SharedCursorStore;
  /** Attach to the element whose bounds define the shared coordinate space. */
  surfaceRef: (element: HTMLElement | null) => void;
}

/**
 * Wires a surface element to the cursor room for `scope`. The hook only maps
 * mount to activation and hands the element to a plain controller; pointer
 * handling, throttling, and publishing all happen outside React.
 */
export function useSharedCursors(
  scope: string,
  participant: PresenceParticipant | null,
): SharedCursorsBinding {
  const rootStore = useRootStore();
  return useCursorRoom(rootStore.userStore.cursorStore(scope), participant);
}

/**
 * Same wiring against the fixed canvas world, where positions are absolute
 * world units and therefore mean the same thing on every device.
 */
export function useCanvasCursors(
  scope: string,
  participant: PresenceParticipant | null,
): SharedCursorsBinding {
  const rootStore = useRootStore();
  return useCursorRoom(
    rootStore.userStore.canvasCursorStore(scope),
    participant,
    // Taps are how a touch client shows up on the canvas at all.
    { emitTaps: true },
  );
}

function useCursorRoom(
  store: SharedCursorStore,
  participant: PresenceParticipant | null,
  options: CursorSurfaceOptions = {},
): SharedCursorsBinding {
  const emitTaps = options.emitTaps ?? false;
  const surface = useMemo(
    () => new CursorSurfaceController(store, { emitTaps }),
    [store, emitTaps],
  );

  const participantId = participant?.id ?? null;
  const participantName = participant?.name ?? null;
  const participantTone = participant?.tone ?? null;

  useEffect(() => store.activate(), [store]);

  useEffect(() => {
    if (!participantId || !participantName || !participantTone) return;
    store.setParticipant({
      id: participantId,
      name: participantName,
      tone: participantTone,
    });
  }, [store, participantId, participantName, participantTone]);

  useEffect(() => () => surface.dispose(), [surface]);

  const surfaceRef = useCallback(
    (element: HTMLElement | null) => surface.attach(element),
    [surface],
  );

  return { store, surfaceRef };
}
