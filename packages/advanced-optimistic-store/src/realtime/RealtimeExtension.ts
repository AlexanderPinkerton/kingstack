// Realtime Extension for Optimistic Store Pattern
// Provides a simple interface for integrating WebSocket realtime updates with optimistic stores

import { Socket } from "socket.io-client";
import type { ObservableUIData } from "../core/ObservableUIData";
import type { RealtimeEvent, RealtimeConfig } from "./types";

export class RealtimeExtension<T extends { id: string }> {
  private store: ObservableUIData<T>;
  private socket: Socket | null = null;
  private config: RealtimeConfig<T>;
  private isConnected = false;

  constructor(store: ObservableUIData<T>, config: RealtimeConfig<T>) {
    this.store = store;
    this.config = config;
  }

  /**
   * Connect to realtime updates via WebSocket
   */
  connect(socket: Socket): void {
    if (this.socket) {
      this.disconnect();
    }

    this.socket = socket;
    this.isConnected = true;

    // Listen for the configured event type
    this.socket.on(this.config.eventType, this.handleRealtimeEvent.bind(this));

    console.log(
      `🔌 RealtimeExtension: Connected to ${this.config.eventType} events`,
    );
  }

  /**
   * Disconnect from realtime updates
   */
  disconnect(): void {
    if (this.socket) {
      this.socket.off(
        this.config.eventType,
        this.handleRealtimeEvent.bind(this),
      );
      this.socket = null;
    }
    this.isConnected = false;
    console.log(
      `🔌 RealtimeExtension: Disconnected from ${this.config.eventType} events`,
    );
  }

  /**
   * Handle incoming realtime events
   */
  private handleRealtimeEvent(event: RealtimeEvent): void {
    console.log(
      `📡 RealtimeExtension: Received ${this.config.eventType} event:`,
      event,
    );

    // 🛡️ PROTECTION 1: Filter out self-originated events (prevent echo)
    if (this.config.browserId && event.browserId === this.config.browserId) {
      console.log(
        `📡 RealtimeExtension: Skipping self-originated event from browser ${event.browserId}`,
      );
      return;
    }

    // 🛡️ PROTECTION 2: Check if we should process this event
    if (
      this.config.shouldProcessEvent &&
      !this.config.shouldProcessEvent(event)
    ) {
      console.log(
        `📡 RealtimeExtension: Skipping event due to shouldProcessEvent filter`,
      );
      return;
    }

    // Use custom handler if available
    if (this.config.customHandlers?.[event.type]) {
      this.config.customHandlers[event.type](this.store, event);
      return;
    }

    // Default handling based on event type
    this.handleDefaultEvent(event);
  }

  /**
   * Default event handling for INSERT, UPDATE, DELETE operations
   */
  private handleDefaultEvent(event: RealtimeEvent): void {
    // Handle the actual event structure: { type, event, data }
    const eventType = event.event;

    // 🔧 Use configurable data extractor or default to event.data
    const dataExtractor =
      this.config.dataExtractor || ((e: RealtimeEvent) => e.data);
    const data = dataExtractor(event);

    try {
      switch (eventType) {
        case "INSERT": // Drop to the UPDATE case
        case "UPDATE":
          if (!data) {
            console.warn(
              `📡 RealtimeExtension: No data found in ${eventType} event:`,
              event,
            );
            return;
          }

          // UI-only update (server already updated via realtime)
          this.store.upsertFromRealtime(data);
          console.log(
            `📡 RealtimeExtension: ${eventType} processed for item ${data.id}`,
          );
          break;

        case "DELETE":
          if (!data) {
            console.warn(
              `📡 RealtimeExtension: No data found in DELETE event:`,
              event,
            );
            return;
          }

          // UI-only removal (server already updated via realtime)
          this.store.removeFromRealtime(data.id);
          console.log(
            `📡 RealtimeExtension: DELETE processed for item ${data.id}`,
          );
          break;

        default:
          console.warn(
            `📡 RealtimeExtension: Unknown event type: ${eventType}`,
          );
      }
    } catch (error) {
      console.error(
        `📡 RealtimeExtension: Error processing ${eventType} event:`,
        error,
      );
    }
  }

  /**
   * Get connection status
   */
  get connected(): boolean {
    return this.isConnected && this.socket?.connected === true;
  }

  /**
   * Get the underlying socket
   */
  get socketInstance(): Socket | null {
    return this.socket;
  }
}
