"use client";

import { useEffect } from "react";
import { useRootStore } from "@/hooks/useRootStore";
import type { PresenceParticipant } from "@/lib/realtime/presence-room";
import type { WavePoolStore } from "@/stores/userApp/wavePoolStore";

/** Thin lifecycle bridge from React to the one global pool store. */
export function useWavePool(
  participant: PresenceParticipant | null,
): WavePoolStore {
  const rootStore = useRootStore();
  const store = rootStore.userStore.wavePoolStore();
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

  return store;
}
