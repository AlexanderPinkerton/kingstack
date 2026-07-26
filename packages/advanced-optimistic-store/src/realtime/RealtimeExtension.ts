// Realtime Extension for Optimistic Store Pattern
// Provides a transport-agnostic interface for event-emitter style realtime clients.

import type { ObservableUIData } from "../core/ObservableUIData.js";
import type { RealtimeEvent, RealtimeConfig, RealtimeSocket } from "./types.js";

export class RealtimeExtension<
  TApiData extends { id: string },
  TUiData extends { id: string } = TApiData,
> {
  private store: ObservableUIData<TUiData>;
  private socket: RealtimeSocket | null = null;
  private config: RealtimeConfig<TApiData, TUiData>;
  private isConnected = false;
  private readonly eventListener = (event: RealtimeEvent): void => {
    this.handleRealtimeEvent(event as RealtimeEvent<TApiData>);
  };

  constructor(
    store: ObservableUIData<TUiData>,
    config: RealtimeConfig<TApiData, TUiData>,
  ) {
    this.store = store;
    this.config = config;
  }

  /**
   * Connect to realtime updates via WebSocket
   */
  connect(socket: RealtimeSocket): void {
    if (this.socket) {
      this.disconnect();
    }

    this.socket = socket;
    this.isConnected = true;

    // Listen for the configured event type
    this.socket.on(this.config.eventType, this.eventListener);
  }

  /**
   * Disconnect from realtime updates
   */
  disconnect(): void {
    if (this.socket) {
      this.socket.off(this.config.eventType, this.eventListener);
      this.socket = null;
    }
    this.isConnected = false;
  }

  /**
   * Handle incoming realtime events
   */
  private handleRealtimeEvent(event: RealtimeEvent<TApiData>): void {
    try {
      // Filter out self-originated events to prevent server echoes.
      if (this.config.browserId && event.browserId === this.config.browserId) {
        return;
      }

      if (
        this.config.shouldProcessEvent &&
        !this.config.shouldProcessEvent(event)
      ) {
        return;
      }

      const customHandler =
        this.config.customHandlers?.[event.event] ??
        this.config.customHandlers?.[event.type];

      if (customHandler) {
        customHandler(this.store, event);
        return;
      }

      this.handleDefaultEvent(event);
    } catch (error) {
      this.config.onError?.(error, event);
    }
  }

  /**
   * Default event handling for INSERT, UPDATE, DELETE operations
   */
  private handleDefaultEvent(event: RealtimeEvent<TApiData>): void {
    const eventType = event.event;

    const dataExtractor =
      this.config.dataExtractor ??
      ((candidate: RealtimeEvent<TApiData>) => candidate.data);
    const data = dataExtractor(event);

    if (!data) {
      return;
    }

    switch (eventType) {
      case "INSERT":
      case "UPDATE":
        this.store.upsertViaRealtime<TApiData>(data);
        this.config.onApplied?.(eventType, data, event);
        break;
      case "DELETE":
        this.store.removeViaRealtime(data.id);
        this.config.onApplied?.(eventType, data, event);
        break;
    }
  }

  /**
   * Get connection status
   */
  get connected(): boolean {
    return (
      this.isConnected &&
      this.socket !== null &&
      this.socket.connected !== false
    );
  }

  /**
   * Get the underlying socket
   */
  get socketInstance(): RealtimeSocket | null {
    return this.socket;
  }
}
