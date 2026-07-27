"use client";

import { useEffect } from "react";
import type { ActivatableStore } from "@/lib/store-lifecycle";

/**
 * Thin React adapter for a raw TypeScript store's demand lifecycle.
 */
export function useStoreActivation(store: ActivatableStore): void {
  useEffect(() => store.activate(), [store]);
}
