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
import { observable } from "mobx";
import type { RealtimeTransport } from "@/lib/realtime-manager";
import { browserLogger } from "@/lib/browser-logger";

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

export type CheckboxPresenceTone = "lime" | "violet";

export interface CheckboxPresenceParticipant {
  id: string;
  name: string;
  tone: CheckboxPresenceTone;
}

export type CheckboxPresenceAction =
  "join" | "focus" | "idle" | "leave" | "reset";

export interface CheckboxPresenceEvent {
  type?: "checkbox_presence";
  action?: CheckboxPresenceAction;
  participant?: CheckboxPresenceParticipant;
  checkboxIndex?: number | null;
}

export interface CheckboxPresence {
  participant: CheckboxPresenceParticipant;
  checkboxIndex: number | null;
}

export type DecodedCheckboxPresence =
  | { operation: "upsert"; presence: CheckboxPresence }
  | { operation: "remove"; participantId: string }
  | { operation: "reset" };

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

export function decodeCheckboxPresence(
  event: CheckboxPresenceEvent,
): DecodedCheckboxPresence | null {
  if (event.type && event.type !== "checkbox_presence") return null;
  if (event.action === "reset") return { operation: "reset" };

  const participant = event.participant;
  const checkboxIndex = event.checkboxIndex;
  if (
    !participant ||
    typeof participant.id !== "string" ||
    typeof participant.name !== "string" ||
    (participant.tone !== "lime" && participant.tone !== "violet")
  ) {
    return null;
  }

  if (event.action === "leave" && checkboxIndex === null) {
    return { operation: "remove", participantId: participant.id };
  }

  if (
    event.action === "focus" &&
    typeof checkboxIndex === "number" &&
    Number.isInteger(checkboxIndex) &&
    checkboxIndex >= 0
  ) {
    return {
      operation: "upsert",
      presence: { participant, checkboxIndex },
    };
  }

  if (
    (event.action === "join" || event.action === "idle") &&
    checkboxIndex === null
  ) {
    return {
      operation: "upsert",
      presence: { participant, checkboxIndex: null },
    };
  }

  return null;
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
  private readonly presenceByParticipant = observable.map<
    string,
    CheckboxPresence
  >();
  private releaseCheckboxRealtime: (() => void) | null = null;
  private releasePresenceRealtime: (() => void) | null = null;

  constructor(
    queryClient: QueryClient,
    private readonly realtimeTransport: RealtimeTransport,
    browserId?: string,
  ) {
    this.demand = new StoreDemand(() => {
      this.optimisticStore.updateOptions();
      this.syncRealtimeSubscription();
    });

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
        enabled: () => this.demand.isActive,
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

  dispose(): void {
    this.releaseCheckboxRealtime?.();
    this.releaseCheckboxRealtime = null;
    this.releasePresenceRealtime?.();
    this.releasePresenceRealtime = null;
    this.presenceByParticipant.clear();
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
    return Array.from(this.presenceByParticipant.values())
      .filter(
        (presence) =>
          presence.checkboxIndex === index &&
          presence.participant.id !== excludingParticipantId,
      )
      .map((presence) => presence.participant);
  }

  getPresentParticipants(): CheckboxPresenceParticipant[] {
    return Array.from(this.presenceByParticipant.values()).map(
      (presence) => presence.participant,
    );
  }

  joinPresence(participant: CheckboxPresenceParticipant): void {
    const event: Required<CheckboxPresenceEvent> = {
      type: "checkbox_presence",
      action: "join",
      participant,
      checkboxIndex: null,
    };
    this.applyPresenceEvent(event);
    this.realtimeTransport.publishLatest("checkbox_presence", event);
  }

  highlightCheckbox(
    participant: CheckboxPresenceParticipant,
    checkboxIndex: number,
  ): void {
    const event: Required<CheckboxPresenceEvent> = {
      type: "checkbox_presence",
      action: "focus",
      participant,
      checkboxIndex,
    };
    this.applyPresenceEvent(event);
    this.realtimeTransport.publishLatest("checkbox_presence", event);
  }

  clearCheckboxHighlight(participant: CheckboxPresenceParticipant): void {
    const event: Required<CheckboxPresenceEvent> = {
      type: "checkbox_presence",
      action: "idle",
      participant,
      checkboxIndex: null,
    };
    this.applyPresenceEvent(event);
    this.realtimeTransport.publishLatest("checkbox_presence", event);
  }

  leavePresence(participant: CheckboxPresenceParticipant): void {
    const event: Required<CheckboxPresenceEvent> = {
      type: "checkbox_presence",
      action: "leave",
      participant,
      checkboxIndex: null,
    };
    this.applyPresenceEvent(event);
    this.realtimeTransport.publishLatest("checkbox_presence", event);
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
      const response = await fetch(
        `${baseUrl}/checkboxes/initialize?count=${count}`,
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
    } else if (!shouldSubscribe && this.releaseCheckboxRealtime) {
      this.releaseCheckboxRealtime();
      this.releaseCheckboxRealtime = null;
    }

    if (shouldSubscribe && !this.releasePresenceRealtime) {
      this.releasePresenceRealtime =
        this.realtimeTransport.subscribe<CheckboxPresenceEvent>(
          "checkbox_presence",
          (event) => this.applyPresenceEvent(event),
        );
    } else if (!shouldSubscribe && this.releasePresenceRealtime) {
      this.releasePresenceRealtime();
      this.releasePresenceRealtime = null;
      this.presenceByParticipant.clear();
    }
  }

  private applyPresenceEvent(event: CheckboxPresenceEvent): void {
    const change = decodeCheckboxPresence(event);
    if (!change) return;

    if (change.operation === "reset") {
      this.presenceByParticipant.clear();
    } else if (change.operation === "remove") {
      this.presenceByParticipant.delete(change.participantId);
    } else {
      this.presenceByParticipant.set(
        change.presence.participant.id,
        change.presence,
      );
    }
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
}
