// MobX-based observable UI data store with snapshot/rollback support
// This class holds the UI-transformed data and provides reactive access

import {
  makeObservable,
  observable,
  computed,
  action,
  runInAction,
  spy,
} from "mobx";
import type { Entity, DataTransformer } from "./types";

export class ObservableUIData<T extends Entity> {
  /*
   * All observables must be public or you must use this syntax to make them observable
   * ----OR----
   * This can be overcome by explicitly passing the relevant private fields as generic argument, like this:
   * makeObservable<MyStore, "privateField" | "privateField2">(this, { privateField: observable, privateField2: observable })
   */
  public entities = new Map<string, T>();
  private snapshots: Map<string, T>[] = [];
  private transformer?: DataTransformer<any, T>;

  constructor(transformer?: DataTransformer<any, T>) {
    this.transformer = transformer;
    makeObservable(this, {
      entities: observable,
      list: computed,
      count: computed,
      upsert: action,
      update: action,
      remove: action,
      clear: action,
      pushSnapshot: action,
      rollback: action,
      reconcile: action,
    });
  }

  // Computed properties
  get list(): T[] {
    return Array.from(this.entities.values());
  }

  get count(): number {
    return this.entities.size;
  }

  // Basic operations (used internally and by manager actions)
  get(id: string): T | undefined {
    return this.entities.get(id);
  }

  upsert(entity: T): void {
    this.entities.set(entity.id, entity);
  }

  update(id: string, updates: Partial<T>): void {
    const existing = this.entities.get(id);
    if (existing) {
      this.entities.set(id, { ...existing, ...updates });
    }
  }

  remove(id: string): void {
    this.entities.delete(id);
  }

  clear(): void {
    this.entities.clear();
  }

  // MobX-aware methods for realtime updates (UI-only, server already updated)
  // These methods handle runInAction internally so the realtime extension doesn't need MobX
  upsertFromRealtime<TApiData extends Entity>(apiData: TApiData): void {
    runInAction(() => {
      const uiData = this.transformer
        ? this.transformer.toUi(apiData)
        : (apiData as unknown as T);
      this.upsert(uiData);
    });
  }

  removeFromRealtime(id: string): void {
    runInAction(() => {
      this.remove(id);
    });
  }

  // Optimistic update support
  pushSnapshot(): void {
    const snapshot = new Map(this.entities);
    this.snapshots.push(snapshot);
  }

  rollback(): void {
    const snapshot = this.snapshots.pop();
    if (snapshot) {
      this.entities = snapshot;
    }
  }

  // Server reconciliation - optimized diffing approach
  reconcile<TApiData extends Entity = T>(
    serverData: TApiData[],
    transformer?: DataTransformer<TApiData, T>,
  ): void {
    // Create a map of server data for efficient lookup
    const serverDataMap = new Map<string, T>();

    for (const apiItem of serverData) {
      const uiItem = transformer
        ? transformer.toUi(apiItem)
        : (apiItem as unknown as T);
      serverDataMap.set(uiItem.id, uiItem);
    }

    // Only update if data has actually changed
    const currentIds = new Set(this.entities.keys());
    const serverIds = new Set(serverDataMap.keys());

    // Check if we need to do a full reconciliation
    const needsFullReconcile =
      currentIds.size !== serverIds.size ||
      [...currentIds].some((id) => !serverIds.has(id)) ||
      [...serverIds].some((id) => !currentIds.has(id)) ||
      [...serverIds].some((id) => {
        const current = this.entities.get(id);
        const server = serverDataMap.get(id);
        return !current || !server || !this.shallowEqual(current, server);
      });

    if (!needsFullReconcile) {
      console.log("reconciled: no changes detected, skipping update");
      return;
    }

    // Clear snapshots only when doing full reconciliation
    this.snapshots = [];

    // Update entities efficiently
    runInAction(() => {
      // Remove entities that are no longer in server data
      for (const [id] of this.entities) {
        if (!serverDataMap.has(id)) {
          this.entities.delete(id);
        }
      }

      // Add or update entities from server data
      for (const [id, uiItem] of serverDataMap) {
        this.entities.set(id, uiItem);
      }
    });

    console.log(
      "reconciled: updated with",
      this.list.length,
      "items from server",
    );
  }

  // Optimized shallow equality comparison with early exit and type checking
  private shallowEqual(a: T, b: T): boolean {
    // Quick reference equality check first
    if (a === b) return true;

    // Handle null/undefined cases
    if (a == null || b == null) return a === b;

    const keysA = Object.keys(a);
    const keysB = Object.keys(b);

    // Quick length check
    if (keysA.length !== keysB.length) return false;

    // Early exit for empty objects
    if (keysA.length === 0) return true;

    // Optimized comparison with type checking
    for (let i = 0; i < keysA.length; i++) {
      const key = keysA[i];
      const valA = (a as any)[key];
      const valB = (b as any)[key];

      // Quick reference equality
      if (valA === valB) continue;

      // Handle Date objects
      if (valA instanceof Date && valB instanceof Date) {
        if (valA.getTime() !== valB.getTime()) return false;
        continue;
      }

      // Handle arrays
      if (Array.isArray(valA) && Array.isArray(valB)) {
        if (valA.length !== valB.length) return false;
        for (let j = 0; j < valA.length; j++) {
          if (valA[j] !== valB[j]) return false;
        }
        continue;
      }

      // Handle objects (shallow)
      if (
        typeof valA === "object" &&
        typeof valB === "object" &&
        valA !== null &&
        valB !== null
      ) {
        const valAKeys = Object.keys(valA);
        const valBKeys = Object.keys(valB);
        if (valAKeys.length !== valBKeys.length) return false;
        for (const valKey of valAKeys) {
          if ((valA as any)[valKey] !== (valB as any)[valKey]) return false;
        }
        continue;
      }

      // Default strict equality
      if (valA !== valB) return false;
    }

    return true;
  }

  // Utility methods
  filter(predicate: (entity: T) => boolean): T[] {
    return this.list.filter(predicate);
  }

  find(predicate: (entity: T) => boolean): T | undefined {
    return this.list.find(predicate);
  }
}
