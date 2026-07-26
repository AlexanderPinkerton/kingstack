import { describe, expect, it, vi } from "vitest";
import { ObservableUIData } from "../../src/core/ObservableUIData";
import { RealtimeExtension } from "../../src/realtime/RealtimeExtension";
import type { RealtimeEvent, RealtimeSocket } from "../../src/realtime/types";

interface ApiItem {
  id: string;
  active: string;
}

interface UiItem {
  id: string;
  active: boolean;
}

function createSocket() {
  const listeners = new Map<string, (event: RealtimeEvent) => void>();
  const socket: RealtimeSocket = {
    connected: true,
    on: vi.fn((eventType, listener) => {
      listeners.set(eventType, listener);
    }),
    off: vi.fn((eventType, listener) => {
      if (listeners.get(eventType) === listener) {
        listeners.delete(eventType);
      }
    }),
  };

  return {
    socket,
    emit(eventType: string, event: RealtimeEvent) {
      listeners.get(eventType)?.(event);
    },
  };
}

describe("RealtimeExtension", () => {
  it("uses the same listener for connect and disconnect", () => {
    const store = new ObservableUIData<UiItem>();
    const { socket } = createSocket();
    const extension = new RealtimeExtension<ApiItem, UiItem>(store, {
      eventType: "item_update",
    });

    extension.connect(socket);
    extension.disconnect();

    const registeredListener = vi.mocked(socket.on).mock.calls[0]?.[1];
    const removedListener = vi.mocked(socket.off).mock.calls[0]?.[1];
    expect(removedListener).toBe(registeredListener);
    expect(extension.connected).toBe(false);
  });

  it("transforms remote API data and ignores self-originated events", () => {
    const store = new ObservableUIData<UiItem>({
      toUi: (apiData: ApiItem) => ({
        id: apiData.id,
        active: apiData.active === "true",
      }),
      toApi: (uiData) => ({
        id: uiData.id,
        active: uiData.active.toString(),
      }),
    });
    const { socket, emit } = createSocket();
    const onApplied = vi.fn();
    const extension = new RealtimeExtension<ApiItem, UiItem>(store, {
      eventType: "item_update",
      browserId: "this-browser",
      onApplied,
    });
    extension.connect(socket);

    emit("item_update", {
      type: "item_update",
      event: "INSERT",
      data: { id: "1", active: "true" },
    });
    expect(store.get("1")).toEqual({ id: "1", active: true });
    expect(onApplied).toHaveBeenCalledTimes(1);

    emit("item_update", {
      type: "item_update",
      event: "UPDATE",
      browserId: "this-browser",
      data: { id: "1", active: "false" },
    });
    expect(store.get("1")?.active).toBe(true);
    expect(onApplied).toHaveBeenCalledTimes(1);

    extension.disconnect();
    emit("item_update", {
      type: "item_update",
      event: "DELETE",
      data: { id: "1", active: "true" },
    });
    expect(store.get("1")).toBeDefined();
  });

  it("supports custom handlers keyed by database operation", () => {
    const store = new ObservableUIData<UiItem>();
    const { socket, emit } = createSocket();
    const updateHandler = vi.fn();
    const extension = new RealtimeExtension<ApiItem, UiItem>(store, {
      eventType: "item_update",
      customHandlers: {
        UPDATE: updateHandler,
      },
    });
    extension.connect(socket);

    const event: RealtimeEvent<ApiItem> = {
      type: "item_update",
      event: "UPDATE",
      data: { id: "1", active: "true" },
    };
    emit("item_update", event);

    expect(updateHandler).toHaveBeenCalledWith(store, event);
  });
});
