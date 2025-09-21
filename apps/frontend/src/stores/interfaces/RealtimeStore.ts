import { Socket } from "socket.io-client";

/**
 * Interface for domain stores that need realtime functionality
 * All domain stores that want to handle realtime events should implement this interface
 */
export interface RealtimeStore {
  /**
   * Setup realtime event handlers for this domain store
   * Called by RootStore when the WebSocket connection is established
   * @param socket - The WebSocket socket instance from RootStore
   */
  setupRealtimeHandlers(socket: Socket): void;
}

/**
 * Base class for domain stores that provides common realtime functionality
 * Domain stores can extend this class to get standard realtime behavior
 */
export abstract class BaseRealtimeStore implements RealtimeStore {
  abstract setupRealtimeHandlers(socket: Socket): void;
}
