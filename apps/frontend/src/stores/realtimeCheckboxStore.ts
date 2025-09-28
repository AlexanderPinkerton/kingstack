// Realtime Checkbox Store - Self-contained with realtime capabilities
// Extends the optimistic store pattern with realtime integration

import {
  makeObservable,
  observable,
  computed,
  action,
  runInAction,
} from "mobx";
import {
  createOptimisticStoreManager,
  Entity,
} from "@/lib/optimistic-store-pattern";
import { createRealtimeExtension } from "@/lib/realtime-extension";

// ---------- Types ----------

export interface CheckboxApiData extends Entity {
  index: number;
  checked: boolean;
  created_at: string;
  updated_at: string;
}

export interface CheckboxUiData extends Entity {
  index: number;
  checked: boolean;
  created_at: Date;
  updated_at: Date;
}

// ---------- API Functions ----------

const API_BASE_URL =
  process.env.NEXT_PUBLIC_NEST_BACKEND_URL || "http://localhost:3000";

async function fetchCheckboxes(): Promise<CheckboxApiData[]> {
  const response = await fetch(`${API_BASE_URL}/checkboxes`);
  if (!response.ok) {
    throw new Error(`Failed to fetch checkboxes: ${response.statusText}`);
  }
  return response.json();
}

async function createCheckbox(data: {
  index: number;
  checked: boolean;
}): Promise<CheckboxApiData> {
  const response = await fetch(`${API_BASE_URL}/checkboxes`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    throw new Error(`Failed to create checkbox: ${response.statusText}`);
  }
  return response.json();
}

async function updateCheckbox({
  id,
  data,
}: {
  id: string;
  data: { index?: number; checked?: boolean };
}): Promise<CheckboxApiData> {
  const response = await fetch(`${API_BASE_URL}/checkboxes/${id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    throw new Error(`Failed to update checkbox: ${response.statusText}`);
  }
  return response.json();
}

async function deleteCheckbox(id: string): Promise<{ id: string }> {
  const response = await fetch(`${API_BASE_URL}/checkboxes/${id}`, {
    method: "DELETE",
  });
  if (!response.ok) {
    throw new Error(`Failed to delete checkbox: ${response.statusText}`);
  }
  return { id };
}

// ---------- Data Transformer ----------

const checkboxTransformer = {
  toUi(apiData: CheckboxApiData): CheckboxUiData {
    return {
      id: apiData.id,
      index: apiData.index,
      checked: apiData.checked,
      created_at: new Date(apiData.created_at),
      updated_at: new Date(apiData.updated_at),
    };
  },

  toApi(uiData: CheckboxUiData): CheckboxApiData {
    return {
      id: uiData.id,
      index: uiData.index,
      checked: uiData.checked,
      created_at: uiData.created_at.toISOString(),
      updated_at: uiData.updated_at.toISOString(),
    };
  },

  optimisticDefaults: {
    createOptimisticUiData: (
      formData: { index: number; checked: boolean },
      context?: any,
    ): CheckboxUiData => {
      return {
        id: `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        index: formData.index,
        checked: formData.checked,
        created_at: new Date(),
        updated_at: new Date(),
      };
    },
    pendingFields: [] as (keyof CheckboxUiData)[],
  },
};

// ---------- Realtime Checkbox Store Class ----------

export class RealtimeCheckboxStore {
  // Store manager
  public storeManager = createOptimisticStoreManager<
    CheckboxApiData,
    CheckboxUiData
  >({
    name: "checkboxes",
    queryFn: fetchCheckboxes,
    mutations: {
      create: createCheckbox,
      update: updateCheckbox,
      remove: deleteCheckbox,
    },
    transformer: checkboxTransformer,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });

  // Realtime extension property type definition
  private realtimeExtension: ReturnType<
    typeof createRealtimeExtension<CheckboxUiData>
  > | null = null;

  // Connection status
  public isConnected = false;

  constructor() {
    makeObservable(this, {
      isConnected: observable,
    });
  }

  // ---------- Realtime Methods ----------

  connectRealtime(socket: any): void {
    // If already connected to the same socket, don't reconnect
    if (
      this.realtimeExtension &&
      this.realtimeExtension.socketInstance === socket
    ) {
      console.log("🔌 RealtimeCheckboxStore: Already connected to this socket");
      return;
    }

    if (this.realtimeExtension) {
      this.realtimeExtension.disconnect();
    }

    // Use the simplified realtime extension with the store's transformer
    this.realtimeExtension = createRealtimeExtension<CheckboxUiData>(
      this.storeManager.store,
      "checkbox_update",
      checkboxTransformer,
      {
        shouldProcessEvent: (event) => event.type === "checkbox_update",
      }
    );
    this.realtimeExtension.connect(socket);

    runInAction(() => {
      this.isConnected = this.realtimeExtension?.connected || false;
    });

    console.log("🔌 RealtimeCheckboxStore: Connected to realtime");
  }

  disconnectRealtime(): void {
    if (this.realtimeExtension) {
      this.realtimeExtension.disconnect();
      this.realtimeExtension = null;
    }

    runInAction(() => {
      this.isConnected = false;
    });

    console.log("🔌 RealtimeCheckboxStore: Disconnected from realtime");
  }

  // ---------- Store Access Methods ----------

  get checkboxes(): CheckboxUiData[] {
    return this.storeManager.store.list;
  }

  get count(): number {
    return this.storeManager.store.count;
  }

  get isLoading(): boolean {
    return this.storeManager.status.isLoading;
  }

  get isError(): boolean {
    return this.storeManager.status.isError;
  }

  get error(): Error | null {
    return this.storeManager.status.error;
  }

  get isSyncing(): boolean {
    return this.storeManager.status.isSyncing;
  }

  get updatePending(): boolean {
    return this.storeManager.status.updatePending;
  }

  get createPending(): boolean {
    return this.storeManager.status.createPending;
  }

  get deletePending(): boolean {
    return this.storeManager.status.deletePending;
  }

  // ---------- Action Methods ----------

  getCheckboxByIndex(index: number): CheckboxUiData | undefined {
    return this.storeManager.store.list.find(
      (checkbox) => checkbox.index === index,
    );
  }

  isCheckboxChecked(index: number): boolean {
    const checkbox = this.getCheckboxByIndex(index);
    return checkbox?.checked || false;
  }

  toggleCheckbox(index: number): void {
    const existingCheckbox = this.getCheckboxByIndex(index);

    if (existingCheckbox) {
      // Update existing checkbox
      this.storeManager.actions.update({
        id: existingCheckbox.id,
        data: { checked: !existingCheckbox.checked },
      });
    } else {
      // Create new checkbox
      this.storeManager.actions.create({
        index,
        checked: true,
      });
    }
  }

  setCheckboxChecked(index: number, checked: boolean): void {
    const existingCheckbox = this.getCheckboxByIndex(index);

    if (existingCheckbox) {
      // Update existing checkbox
      this.storeManager.actions.update({
        id: existingCheckbox.id,
        data: { checked },
      });
    } else {
      // Create new checkbox
      this.storeManager.actions.create({
        index,
        checked,
      });
    }
  }

  refetch(): void {
    this.storeManager.actions.refetch();
  }

  // ---------- Initialization ----------

  async initializeCheckboxes(count: number = 200): Promise<void> {
    try {
      const baseUrl =
        process.env.NEXT_PUBLIC_NEST_BACKEND_URL || "http://localhost:3000";
      const response = await fetch(`${baseUrl}/checkboxes/initialize`, {
        method: "POST",
      });

      if (response.ok) {
        this.refetch(); // Refetch data after initialization
      } else {
        throw new Error(
          `Failed to initialize checkboxes: ${response.statusText}`,
        );
      }
    } catch (error) {
      console.error("Failed to initialize checkboxes:", error);
      throw error;
    }
  }
}

// ---------- Singleton Instance ----------

export const realtimeCheckboxStore = new RealtimeCheckboxStore();
