"use client";

import { useCallback, useEffect, useMemo } from "react";
import { useRootStore } from "@/hooks/useRootStore";
import { CursorSurfaceController } from "@/lib/realtime/cursor-surface";
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
  const store = rootStore.userStore.cursorStore(scope);
  const surface = useMemo(() => new CursorSurfaceController(store), [store]);

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
