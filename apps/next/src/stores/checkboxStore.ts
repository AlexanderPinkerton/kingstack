// Realtime Checkbox Store - Self-contained with integrated realtime capabilities
// Uses the optimistic store pattern with built-in realtime integration

import {
  createOptimisticStore,
  Entity,
} from "@kingstack/advanced-optimistic-store";
import { getMockData, isPlaygroundMode } from "@kingstack/shapes";
// No longer need to import realtime extension - it's integrated into the store

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
  process.env.NEXT_PUBLIC_NEST_URL || "http://localhost:3000";

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
  // Optimistic store with integrated realtime
  public optimisticStore: ReturnType<
    typeof createOptimisticStore<CheckboxApiData, CheckboxUiData>
  >;

  constructor(browserId?: string) {
    // Store is created with realtime config but not connected yet
    // rootStore will connect it when socket is ready
    this.optimisticStore = createOptimisticStore<
      CheckboxApiData,
      CheckboxUiData
    >({
      name: "checkboxes",
      queryFn: this.getQueryFn(),
      mutations: {
        create: this.getCreateMutation(),
        update: this.getUpdateMutation(),
        remove: this.getDeleteMutation(),
      },
      transformer: this.getTransformer(),
      staleTime: 2 * 60 * 1000, // 2 minutes
      realtime: this.getRealtimeConfig(browserId),
    });
  }

  // ---------- Store Access Methods ----------

  get checkboxes(): CheckboxUiData[] {
    return this.optimisticStore.ui.list;
  }

  get count(): number {
    return this.optimisticStore.ui.count;
  }

  get isLoading(): boolean {
    return this.optimisticStore.api.status.isLoading;
  }

  get isError(): boolean {
    return this.optimisticStore.api.status.isError;
  }

  get error(): Error | null {
    return this.optimisticStore.api.status.error;
  }

  get isSyncing(): boolean {
    return this.optimisticStore.api.status.isSyncing;
  }

  get updatePending(): boolean {
    return this.optimisticStore.api.status.updatePending;
  }

  get createPending(): boolean {
    return this.optimisticStore.api.status.createPending;
  }

  get deletePending(): boolean {
    return this.optimisticStore.api.status.deletePending;
  }

  get isConnected(): boolean {
    return this.optimisticStore.realtime?.isConnected || false;
  }

  // ---------- Realtime Methods (for rootStore control) ----------

  connectRealtime(socket: any): void {
    if (this.optimisticStore.realtime) {
      this.optimisticStore.realtime.connect(socket);
      console.log("🔌 RealtimeCheckboxStore: Connected to realtime");
    } else {
      console.warn("🔌 RealtimeCheckboxStore: Realtime not configured");
    }
  }

  disconnectRealtime(): void {
    if (this.optimisticStore.realtime) {
      this.optimisticStore.realtime.disconnect();
      console.log("🔌 RealtimeCheckboxStore: Disconnected from realtime");
    }
  }

  // ---------- Action Methods ----------

  getCheckboxByIndex(index: number): CheckboxUiData | undefined {
    return this.optimisticStore.ui.list.find(
      (checkbox: CheckboxUiData) => checkbox.index === index,
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
      this.optimisticStore.api.update(existingCheckbox.id, {
        checked: !existingCheckbox.checked,
      });
    } else {
      // Create new checkbox
      this.optimisticStore.api.create({
        index,
        checked: true,
      });
    }
  }

  setCheckboxChecked(index: number, checked: boolean): void {
    const existingCheckbox = this.getCheckboxByIndex(index);

    if (existingCheckbox) {
      // Update existing checkbox
      this.optimisticStore.api.update(existingCheckbox.id, { checked });
    } else {
      // Create new checkbox
      this.optimisticStore.api.create({
        index,
        checked,
      });
    }
  }

  refetch(): void {
    this.optimisticStore.api.refetch();
  }

  // ---------- Initialization ----------

  async initializeCheckboxes(count: number = 200): Promise<void> {
    try {
      const baseUrl =
        process.env.NEXT_PUBLIC_NEST_URL || "http://localhost:3000";
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

  // ============================================================================
  // PLAYGROUND CONFIGURATION
  // ============================================================================
  // All playground logic is centralized here for easy maintenance

  private getQueryFn() {
    return isPlaygroundMode() ? this.playgroundQueryFn : this.apiQueryFn;
  }

  private getCreateMutation() {
    return isPlaygroundMode()
      ? this.playgroundCreateMutation
      : this.apiCreateMutation;
  }

  private getUpdateMutation() {
    return isPlaygroundMode()
      ? this.playgroundUpdateMutation
      : this.apiUpdateMutation;
  }

  private getDeleteMutation() {
    return isPlaygroundMode()
      ? this.playgroundDeleteMutation
      : this.apiDeleteMutation;
  }

  private getTransformer() {
    return checkboxTransformer;
  }

  private getRealtimeConfig(browserId?: string) {
    // Only enable realtime in non-playground mode
    if (isPlaygroundMode()) {
      return undefined;
    }

    return {
      eventType: "checkbox_update",
      // 🔧 Custom data extractor for checkbox events
      // The api sends events in format: { type, event, checkbox: {...} }
      dataExtractor: (event: any) => event.checkbox || event.data,
      shouldProcessEvent: (event: any) => event.type === "checkbox_update",
      // 🛡️ Filter out self-originated events to prevent echo
      browserId: browserId,
    };
  }

  // API Implementations
  private apiQueryFn = async (): Promise<CheckboxApiData[]> => {
    return fetchCheckboxes();
  };

  private apiCreateMutation = async (data: {
    index: number;
    checked: boolean;
  }): Promise<CheckboxApiData> => {
    return createCheckbox(data);
  };

  private apiUpdateMutation = async ({
    id,
    data,
  }: {
    id: string;
    data: { index?: number; checked?: boolean };
  }): Promise<CheckboxApiData> => {
    return updateCheckbox({ id, data });
  };

  private apiDeleteMutation = async (id: string): Promise<{ id: string }> => {
    return deleteCheckbox(id);
  };

  // Playground Implementations
  private playgroundQueryFn = async (): Promise<CheckboxApiData[]> => {
    await new Promise((resolve) => setTimeout(resolve, 300)); // Simulate delay
    return getMockData("checkboxes") as CheckboxApiData[];
  };

  private playgroundCreateMutation = async (data: {
    index: number;
    checked: boolean;
  }): Promise<CheckboxApiData> => {
    await new Promise((resolve) => setTimeout(resolve, 300));
    return {
      id: `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      index: data.index,
      checked: data.checked,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  };

  private playgroundUpdateMutation = async ({
    id,
    data,
  }: {
    id: string;
    data: { index?: number; checked?: boolean };
  }): Promise<CheckboxApiData> => {
    await new Promise((resolve) => setTimeout(resolve, 300));

    // Get existing checkbox from mock data to preserve unchanged fields
    const existingCheckboxes = getMockData("checkboxes") as CheckboxApiData[];
    const existingCheckbox = existingCheckboxes.find((c) => c.id === id);

    // If we have an existing checkbox, merge it with the updates
    if (existingCheckbox) {
      return {
        ...existingCheckbox,
        ...data, // This will override only the fields that were updated
        updated_at: new Date().toISOString(), // Always update the timestamp
      };
    }

    // Fallback if no existing checkbox found
    return {
      id,
      index: data.index || 0,
      checked: data.checked || false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  };

  private playgroundDeleteMutation = async (
    id: string,
  ): Promise<{ id: string }> => {
    await new Promise((resolve) => setTimeout(resolve, 300));
    return { id };
  };
}
