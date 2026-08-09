// Checkbox domain store. Transport events are decoded here and all server
// changes enter the same AOS reconciliation path as query and mutation results.

import {
  createOptimisticStore,
  type Entity,
  type OptimisticStore,
  type RemoteChange,
} from "@kingstack/advanced-optimistic-store";
import type { QueryClient } from "@tanstack/react-query";
import { StoreDemand } from "@/lib/store-lifecycle";
import type { RealtimeTransport } from "@/lib/realtime-manager";
import {
  PresenceRoom,
  type PresenceParticipant,
} from "@/lib/realtime/presence-room";
import { browserLogger } from "@/lib/browser-logger";
import { fetchWithAuth } from "@/lib/auth/authenticated-fetch";

const logger = browserLogger.child({ component: "CheckboxStore" });

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

export interface CheckboxRealtimeEvent {
  type?: string;
  event?: "INSERT" | "UPDATE" | "DELETE";
  checkbox?: CheckboxApiData;
  data?: CheckboxApiData;
  browserId?: string;
}

/** Presence in this room is "which cell of the shared grid are you on". */
export interface CheckboxPresenceState {
  checkboxIndex: number;
}

export type CheckboxPresenceParticipant = PresenceParticipant;

/** Entity events and presence for the grid share one room. */
export const CHECKBOX_ROOM_ID = "checkboxes:global";

export function decodeCheckboxRemoteChange(
  event: CheckboxRealtimeEvent,
): RemoteChange<CheckboxApiData> | null {
  if (event.type && event.type !== "checkbox_update") return null;

  const entity = event.checkbox ?? event.data;
  if (!entity || !event.event) return null;

  if (event.event === "DELETE") {
    return {
      operation: "delete",
      id: entity.id,
      originId: event.browserId,
      revision: entity.updated_at,
    };
  }

  return {
    operation: event.event === "INSERT" ? "insert" : "update",
    entity,
    membership: "include",
    originId: event.browserId,
    revision: entity.updated_at,
  };
}

// ---------- API Functions ----------

const API_BASE_URL =
  process.env.NEXT_PUBLIC_NEST_BACKEND_URL || "http://localhost:3000";

async function fetchCheckboxes(
  accessToken: string,
): Promise<CheckboxApiData[]> {
  const response = await fetchWithAuth(
    accessToken,
    `${API_BASE_URL}/checkboxes`,
  );
  if (!response.ok) {
    throw new Error(`Failed to fetch checkboxes: ${response.statusText}`);
  }
  return response.json();
}

async function createCheckbox(
  data: {
    index: number;
    checked: boolean;
  },
  accessToken: string,
): Promise<CheckboxApiData> {
  const response = await fetchWithAuth(
    accessToken,
    `${API_BASE_URL}/checkboxes`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    },
  );
  if (!response.ok) {
    throw new Error(`Failed to create checkbox: ${response.statusText}`);
  }
  return response.json();
}

async function updateCheckbox(
  {
    id,
    data,
  }: {
    id: string;
    data: { checked: boolean };
  },
  accessToken: string,
): Promise<CheckboxApiData> {
  const response = await fetchWithAuth(
    accessToken,
    `${API_BASE_URL}/checkboxes/${id}`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    },
  );
  if (!response.ok) {
    throw new Error(`Failed to update checkbox: ${response.statusText}`);
  }
  return response.json();
}

async function deleteCheckbox(
  id: string,
  accessToken: string,
): Promise<{ id: string }> {
  const response = await fetchWithAuth(
    accessToken,
    `${API_BASE_URL}/checkboxes/${id}`,
    {
      method: "DELETE",
    },
  );
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
    createOptimisticUiData: (formData: {
      index: number;
      checked: boolean;
    }): CheckboxUiData => {
      return {
        id: `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        index: formData.index,
        checked: formData.checked,
        created_at: new Date(),
        updated_at: new Date(),
      };
    },
  },
};

// ---------- Realtime Checkbox Store Class ----------

export class RealtimeCheckboxStore {
  private readonly optimisticStore: OptimisticStore<
    CheckboxApiData,
    CheckboxUiData
  >;
  private readonly demand: StoreDemand;
  private readonly presence: PresenceRoom<CheckboxPresenceState>;
  private releaseCheckboxRealtime: (() => void) | null = null;
  private releaseRoom: (() => void) | null = null;
  private releasePresence: (() => void) | null = null;
  private accessToken: string | null = null;

  constructor(
    queryClient: QueryClient,
    private readonly realtimeTransport: RealtimeTransport,
    browserId?: string,
  ) {
    this.demand = new StoreDemand(() => {
      this.optimisticStore.updateOptions();
      this.syncRealtimeSubscription();
    });
    this.presence = new PresenceRoom<CheckboxPresenceState>(
      realtimeTransport,
      CHECKBOX_ROOM_ID,
    );

    this.optimisticStore = createOptimisticStore<
      CheckboxApiData,
      CheckboxUiData
    >(
      {
        name: "checkboxes",
        queryFn: this.apiQueryFn,
        mutations: {
          create: this.apiCreateMutation,
          update: this.apiUpdateMutation,
          remove: this.apiDeleteMutation,
        },
        transformer: this.getTransformer(),
        staleTime: 2 * 60 * 1000,
        enabled: () => this.demand.isActive && this.accessToken !== null,
        remote: {
          localOriginId: browserId,
        },
      },
      queryClient,
    );
  }

  activate(): () => void {
    return this.demand.activate();
  }

  setAccessToken(accessToken: string | null): void {
    if (this.accessToken === accessToken) return;
    this.accessToken = accessToken;
    this.optimisticStore.updateOptions();
  }

  dispose(): void {
    this.releaseCheckboxRealtime?.();
    this.releaseCheckboxRealtime = null;
    this.releaseRoom?.();
    this.releaseRoom = null;
    this.releasePresence?.();
    this.releasePresence = null;
    this.presence.dispose();
    this.demand.dispose();
    this.optimisticStore.destroy();
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

  getPresenceAt(
    index: number,
    excludingParticipantId: string,
  ): CheckboxPresenceParticipant[] {
    return Array.from(this.presence.entries.values())
      .filter(
        (entry) =>
          entry.state?.checkboxIndex === index &&
          entry.participant.id !== excludingParticipantId,
      )
      .map((entry) => entry.participant);
  }

  getPresentParticipants(): CheckboxPresenceParticipant[] {
    return this.presence.participants;
  }

  joinPresence(participant: CheckboxPresenceParticipant): void {
    this.presence.setSelf(participant, null);
  }

  highlightCheckbox(
    participant: CheckboxPresenceParticipant,
    checkboxIndex: number,
  ): void {
    this.presence.setSelf(participant, { checkboxIndex });
  }

  clearCheckboxHighlight(participant: CheckboxPresenceParticipant): void {
    this.presence.setSelf(participant, null);
  }

  leavePresence(): void {
    this.presence.clearSelf();
  }

  toggleCheckbox(index: number): void {
    const existingCheckbox = this.getCheckboxByIndex(index);

    if (existingCheckbox) {
      // Update existing checkbox
      void this.optimisticStore.api.update(existingCheckbox.id, {
        checked: !existingCheckbox.checked,
      });
    } else {
      // Create new checkbox
      void this.optimisticStore.api.create({
        index,
        checked: true,
      });
    }
  }

  setCheckboxChecked(index: number, checked: boolean): void {
    const existingCheckbox = this.getCheckboxByIndex(index);

    if (existingCheckbox) {
      // Update existing checkbox
      void this.optimisticStore.api.update(existingCheckbox.id, { checked });
    } else {
      // Create new checkbox
      void this.optimisticStore.api.create({
        index,
        checked,
      });
    }
  }

  refetch(): void {
    void this.optimisticStore.api.refetch();
  }

  // ---------- Initialization ----------

  async initializeCheckboxes(count: number = 200): Promise<void> {
    try {
      const baseUrl =
        process.env.NEXT_PUBLIC_NEST_BACKEND_URL || "http://localhost:3000";
      const response = await fetchWithAuth(
        this.requireAccessToken(),
        `${baseUrl}/checkboxes/bootstrap?count=${count}`,
        {
          method: "POST",
        },
      );

      if (response.ok) {
        this.refetch(); // Refetch data after initialization
      } else {
        throw new Error(
          `Failed to initialize checkboxes: ${response.statusText}`,
        );
      }
    } catch (error) {
      logger.error("checkboxes.initialize_failed", { error });
      throw error;
    }
  }

  private getTransformer() {
    return checkboxTransformer;
  }

  private syncRealtimeSubscription(): void {
    const shouldSubscribe = this.demand.isActive;

    if (shouldSubscribe && !this.releaseCheckboxRealtime) {
      // Entity events are room-scoped, so the store must hold the room itself
      // rather than relying on presence to have joined it.
      this.releaseRoom = this.realtimeTransport.joinRoom(CHECKBOX_ROOM_ID);
      this.releasePresence = this.presence.activate();
      this.releaseCheckboxRealtime =
        this.realtimeTransport.subscribe<CheckboxRealtimeEvent>(
          "checkbox_update",
          (event) => {
            const change = decodeCheckboxRemoteChange(event);
            if (change) {
              this.optimisticStore.applyRemote(change);
            }
          },
        );
      return;
    }

    if (!shouldSubscribe && this.releaseCheckboxRealtime) {
      this.releaseCheckboxRealtime();
      this.releaseCheckboxRealtime = null;
      this.releasePresence?.();
      this.releasePresence = null;
      this.releaseRoom?.();
      this.releaseRoom = null;
    }
  }

  // API Implementations
  private apiQueryFn = async (): Promise<CheckboxApiData[]> => {
    return fetchCheckboxes(this.requireAccessToken());
  };

  private apiCreateMutation = async (data: {
    index: number;
    checked: boolean;
  }): Promise<CheckboxApiData> => {
    return createCheckbox(data, this.requireAccessToken());
  };

  private apiUpdateMutation = async ({
    id,
    data,
  }: {
    id: string;
    data: { checked: boolean };
  }): Promise<CheckboxApiData> => {
    return updateCheckbox({ id, data }, this.requireAccessToken());
  };

  private apiDeleteMutation = async (id: string): Promise<{ id: string }> => {
    return deleteCheckbox(id, this.requireAccessToken());
  };

  private requireAccessToken(): string {
    if (!this.accessToken) {
      throw new Error("A permanent account is required for checkbox data");
    }
    return this.accessToken;
  }
}
