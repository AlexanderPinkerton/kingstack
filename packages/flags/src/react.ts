"use client";

import { createContext, useContext, useEffect } from "react";
import type { FeatureFlagStore } from "./mobx.js";

/** Mount using this context's Provider; the host owns store creation and identity updates. */
export const FeatureFlagContext = createContext<FeatureFlagStore | null>(null);

export function useFeatureFlags(): FeatureFlagStore {
  const store = useContext(FeatureFlagContext);
  if (!store) throw new Error("FeatureFlagContext.Provider is missing");
  return store;
}

/** Call once at the runtime boundary, or at a feature boundary for demand-driven loading. */
export function useFeatureFlagLifecycle(
  store: FeatureFlagStore,
): FeatureFlagStore {
  useEffect(() => store.acquire(), [store]);
  return store;
}
