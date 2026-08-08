import { QueryClient } from "@tanstack/react-query";
import { action, computed, makeObservable, observable } from "mobx";
import type { RealtimeStatus } from "@/lib/realtime-manager";
import { RealtimeManager } from "@/lib/realtime-manager";
import {
  RealtimeCheckboxStore,
  type CheckboxPresenceParticipant,
} from "./checkboxStore";

type DemoSide = "primary" | "collaborator";

function normalizeDisplayName(name: string): string {
  return name.trim().slice(0, 40) || "You";
}

function createDemoId(role: DemoSide): string {
  const randomId =
    globalThis.crypto?.randomUUID?.() ??
    `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${role}-${randomId}`;
}

/**
 * Owns the second, isolated runtime used by the side-by-side realtime demo.
 * React only mounts this controller and renders its two domain stores.
 */
export class RealtimeCheckboxDemoController {
  primaryName: string;
  readonly collaboratorName = "Maya";
  readonly collaboratorStore: RealtimeCheckboxStore;

  private readonly primaryParticipantId = createDemoId("primary");
  private readonly collaboratorParticipantId = createDemoId("collaborator");
  private readonly collaboratorQueryClient = new QueryClient();
  private readonly collaboratorRealtime: RealtimeManager;
  private readonly collaboratorBrowserId = createDemoId("collaborator");
  private primaryPresenceIndex: number | null = null;
  private collaboratorPresenceIndex: number | null = null;
  private releasePrimary: (() => void) | null = null;
  private releaseCollaborator: (() => void) | null = null;
  private accessToken: string | null = null;
  private mounts = 0;
  private disposalGeneration = 0;
  private disposed = false;

  constructor(
    readonly primaryStore: RealtimeCheckboxStore,
    primaryName: string,
  ) {
    this.primaryName = normalizeDisplayName(primaryName);
    this.collaboratorRealtime = new RealtimeManager({
      browserId: this.collaboratorBrowserId,
    });
    this.collaboratorStore = new RealtimeCheckboxStore(
      this.collaboratorQueryClient,
      this.collaboratorRealtime,
      this.collaboratorBrowserId,
    );

    makeObservable(this, {
      primaryName: observable,
      primaryParticipant: computed,
      collaboratorParticipant: computed,
      collaboratorConnected: computed,
      collaboratorStatus: computed,
      setPrimaryName: action,
    });
  }

  get primaryParticipant(): CheckboxPresenceParticipant {
    return {
      id: this.primaryParticipantId,
      name: this.primaryName,
      tone: "lime",
    };
  }

  get collaboratorParticipant(): CheckboxPresenceParticipant {
    return {
      id: this.collaboratorParticipantId,
      name: this.collaboratorName,
      tone: "violet",
    };
  }

  get collaboratorConnected(): boolean {
    return this.collaboratorRealtime.connected;
  }

  get collaboratorStatus(): RealtimeStatus {
    return this.collaboratorRealtime.status;
  }

  mount(): () => void {
    if (this.disposed) {
      throw new Error("Cannot mount a disposed realtime demo controller");
    }

    this.mounts += 1;
    this.disposalGeneration += 1;

    if (!this.releasePrimary) {
      this.releasePrimary = this.primaryStore.activate();
      this.primaryStore.joinPresence(this.primaryParticipant);
    }
    if (!this.releaseCollaborator) {
      this.releaseCollaborator = this.collaboratorStore.activate();
      this.collaboratorStore.joinPresence(this.collaboratorParticipant);
    }
    if (this.accessToken) {
      this.collaboratorRealtime.setup(this.accessToken);
    }

    let released = false;
    return () => {
      if (released || this.disposed) return;
      released = true;
      this.mounts = Math.max(0, this.mounts - 1);
      if (this.mounts !== 0) return;

      const generation = ++this.disposalGeneration;
      queueMicrotask(() => {
        if (
          !this.disposed &&
          this.mounts === 0 &&
          this.disposalGeneration === generation
        ) {
          this.dispose();
        }
      });
    };
  }

  setAccessToken(accessToken: string | null): void {
    if (this.disposed || this.accessToken === accessToken) return;

    this.accessToken = accessToken;
    this.primaryStore.setAccessToken(accessToken);
    this.collaboratorStore.setAccessToken(accessToken);
    if (accessToken) {
      this.collaboratorRealtime.setup(accessToken);

      if (this.primaryPresenceIndex !== null) {
        this.primaryStore.highlightCheckbox(
          this.primaryParticipant,
          this.primaryPresenceIndex,
        );
      } else {
        this.primaryStore.joinPresence(this.primaryParticipant);
      }
      if (this.collaboratorPresenceIndex !== null) {
        this.collaboratorStore.highlightCheckbox(
          this.collaboratorParticipant,
          this.collaboratorPresenceIndex,
        );
      } else {
        this.collaboratorStore.joinPresence(this.collaboratorParticipant);
      }
    } else {
      this.collaboratorRealtime.teardown();
    }
  }

  setPrimaryName(name: string): void {
    const normalizedName = normalizeDisplayName(name);
    if (this.disposed || this.primaryName === normalizedName) return;
    this.primaryName = normalizedName;

    if (this.primaryPresenceIndex !== null) {
      this.primaryStore.highlightCheckbox(
        this.primaryParticipant,
        this.primaryPresenceIndex,
      );
    } else {
      this.primaryStore.joinPresence(this.primaryParticipant);
    }
  }

  highlight(side: DemoSide, checkboxIndex: number): void {
    if (side === "primary") {
      if (this.primaryPresenceIndex === checkboxIndex) return;
      this.primaryPresenceIndex = checkboxIndex;
      this.primaryStore.highlightCheckbox(
        this.primaryParticipant,
        checkboxIndex,
      );
      return;
    }

    if (this.collaboratorPresenceIndex === checkboxIndex) return;
    this.collaboratorPresenceIndex = checkboxIndex;
    this.collaboratorStore.highlightCheckbox(
      this.collaboratorParticipant,
      checkboxIndex,
    );
  }

  clearHighlight(side: DemoSide): void {
    if (side === "primary") {
      if (this.primaryPresenceIndex === null) return;
      this.primaryPresenceIndex = null;
      this.primaryStore.clearCheckboxHighlight(this.primaryParticipant);
      return;
    }

    if (this.collaboratorPresenceIndex === null) return;
    this.collaboratorPresenceIndex = null;
    this.collaboratorStore.clearCheckboxHighlight(this.collaboratorParticipant);
  }

  private dispose(): void {
    if (this.disposed) return;
    this.disposed = true;

    this.primaryStore.leavePresence();
    this.collaboratorStore.leavePresence();

    this.releasePrimary?.();
    this.releasePrimary = null;
    this.releaseCollaborator?.();
    this.releaseCollaborator = null;
    this.collaboratorStore.dispose();
    this.collaboratorRealtime.dispose();
    this.collaboratorQueryClient.clear();
  }
}
