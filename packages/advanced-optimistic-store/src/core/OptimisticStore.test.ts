import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { QueryClient } from "@tanstack/query-core";
import { autorun } from "mobx";
import { createOptimisticStore } from "./OptimisticStore";
import type { Entity, OptimisticStoreConfig } from "./types";

// Test data types
interface TestApiData extends Entity {
  id: string;
  title: string;
  completed: string;
  priority: string;
  created_at: string;
}

interface TestUiData extends Entity {
  id: string;
  title: string;
  completed: boolean;
  priority: number;
  created_at: Date;
}

// Mock API functions
const mockQueryFn = vi.fn();
const mockCreateMutation = vi.fn();
const mockUpdateMutation = vi.fn();
const mockRemoveMutation = vi.fn();

// Mock transformer
const mockTransformer = {
  toUi: (apiData: TestApiData): TestUiData => ({
    id: apiData.id,
    title: apiData.title,
    completed: apiData.completed === "true",
    priority: parseInt(apiData.priority),
    created_at: new Date(apiData.created_at),
  }),
  toApi: (uiData: TestUiData): TestApiData => ({
    id: uiData.id,
    title: uiData.title,
    completed: uiData.completed.toString(),
    priority: uiData.priority.toString(),
    created_at: uiData.created_at.toISOString(),
  }),
};

// Mock realtime extension
const mockRealtimeExtension = {
  connected: false,
  connect: vi.fn(),
  disconnect: vi.fn(),
  handleEvent: vi.fn(),
};

// Mock the realtime module
vi.mock("../realtime", () => ({
  createRealtimeExtension: vi.fn(() => mockRealtimeExtension),
}));

// Mock the query client module
vi.mock("../query/queryClient", () => ({
  getGlobalQueryClient: vi.fn(() => new QueryClient()),
}));

describe("createOptimisticStore", () => {
  let queryClient: QueryClient;
  let config: OptimisticStoreConfig<TestApiData, TestUiData>;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
        mutations: {
          retry: false,
        },
      },
    });

    // Reset all mocks
    vi.clearAllMocks();

    // Setup default config
    config = {
      name: "test-store",
      queryFn: mockQueryFn,
      mutations: {
        create: mockCreateMutation,
        update: mockUpdateMutation,
        remove: mockRemoveMutation,
      },
      transformer: mockTransformer,
    };

    // Setup default mock implementations
    mockQueryFn.mockResolvedValue([
      {
        id: "1",
        title: "Test Task 1",
        completed: "true",
        priority: "1",
        created_at: "2023-01-01T00:00:00.000Z",
      },
      {
        id: "2",
        title: "Test Task 2",
        completed: "false",
        priority: "2",
        created_at: "2023-01-02T00:00:00.000Z",
      },
    ]);

    mockCreateMutation.mockResolvedValue({
      id: "3",
      title: "New Task",
      completed: "false",
      priority: "3",
      created_at: "2023-01-03T00:00:00.000Z",
    });

    mockUpdateMutation.mockResolvedValue({
      id: "1",
      title: "Updated Task",
      completed: "true",
      priority: "5",
      created_at: "2023-01-01T00:00:00.000Z",
    });

    mockRemoveMutation.mockResolvedValue({ id: "1" });
  });

  afterEach(() => {
    queryClient.clear();
  });

  describe("basic functionality", () => {
    it("should create a store with ui and api namespaces", () => {
      const store = createOptimisticStore(config, queryClient);

      expect(store).toBeDefined();
      expect(store.ui).toBeDefined();
      expect(store.api).toBeDefined();
      expect(store.ui).toBeInstanceOf(Object); // ObservableUIData
      expect(store.api).toHaveProperty("create");
      expect(store.api).toHaveProperty("update");
      expect(store.api).toHaveProperty("remove");
      expect(store.api).toHaveProperty("refetch");
      expect(store.api).toHaveProperty("invalidate");
      expect(store.api).toHaveProperty("triggerQuery");
      expect(store.api).toHaveProperty("status");
    });

    it("should initialize with empty UI data", () => {
      const store = createOptimisticStore(config, queryClient);

      expect(store.ui.count).toBe(0);
      expect(store.ui.list).toEqual([]);
    });

    it("should have correct initial status", () => {
      const store = createOptimisticStore(config, queryClient);

      expect(store.api.status.isLoading).toBe(false);
      expect(store.api.status.isError).toBe(false);
      expect(store.api.status.error).toBeNull();
      expect(store.api.status.isSyncing).toBe(false);
      expect(store.api.status.createPending).toBe(false);
      expect(store.api.status.updatePending).toBe(false);
      expect(store.api.status.deletePending).toBe(false);
      expect(store.api.status.hasPendingMutations).toBe(false);
    });
  });

  describe("query functionality", () => {
    it("should trigger query and populate UI data", async () => {
      const store = createOptimisticStore(config, queryClient);

      // Trigger the query
      await store.api.triggerQuery();

      // Wait for query to complete
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(store.ui.count).toBe(2);
      expect(store.ui.list).toHaveLength(2);

      const firstTask = store.ui.get("1");
      expect(firstTask).toBeDefined();
      expect(firstTask?.title).toBe("Test Task 1");
      expect(firstTask?.completed).toBe(true);
      expect(firstTask?.priority).toBe(1);
      expect(firstTask?.created_at).toBeInstanceOf(Date);
    });

    it("should handle query errors", async () => {
      const error = new Error("Query failed");
      mockQueryFn.mockRejectedValueOnce(error);

      const store = createOptimisticStore(config, queryClient);

      await store.api.triggerQuery();
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(store.api.status.isError).toBe(true);
      expect(store.api.status.error).toBe(error);
    });

    it("should refetch data", async () => {
      const store = createOptimisticStore(config, queryClient);

      await store.api.triggerQuery();
      await new Promise((resolve) => setTimeout(resolve, 100));

      const initialCallCount = mockQueryFn.mock.calls.length;

      await store.api.refetch();
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(mockQueryFn).toHaveBeenCalledTimes(initialCallCount + 1);
    });

    it("should invalidate queries", async () => {
      const store = createOptimisticStore(config, queryClient);

      await store.api.triggerQuery();
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Invalidate should trigger a refetch
      const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
      await store.api.invalidate();

      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ["test-store"],
      });
    });
  });

  describe("mutation functionality", () => {
    it("should create new entity", async () => {
      const store = createOptimisticStore(config, queryClient);

      const newData = {
        title: "New Task",
        completed: false,
        priority: 3,
      };

      const result = await store.api.create(newData);

      expect(mockCreateMutation).toHaveBeenCalledWith(
        newData,
        expect.any(Object),
      );
      expect(result).toEqual({
        id: "3",
        title: "New Task",
        completed: "false",
        priority: "3",
        created_at: "2023-01-03T00:00:00.000Z",
      });
    });

    it("should update existing entity", async () => {
      const store = createOptimisticStore(config, queryClient);

      const updateData = {
        title: "Updated Task",
        completed: true,
        priority: 5,
      };

      const result = await store.api.update("1", updateData);

      expect(mockUpdateMutation).toHaveBeenCalledWith(
        {
          id: "1",
          data: updateData,
        },
        expect.any(Object),
      );
      expect(result).toEqual({
        id: "1",
        title: "Updated Task",
        completed: "true",
        priority: "5",
        created_at: "2023-01-01T00:00:00.000Z",
      });
    });

    it("should remove entity", async () => {
      const store = createOptimisticStore(config, queryClient);

      const result = await store.api.remove("1");

      expect(mockRemoveMutation).toHaveBeenCalledWith("1", expect.any(Object));
      expect(result).toEqual({ id: "1" });
    });

    it("should handle mutation errors", async () => {
      const error = new Error("Mutation failed");
      mockCreateMutation.mockRejectedValueOnce(error);

      const store = createOptimisticStore(config, queryClient);

      await expect(store.api.create({})).rejects.toThrow("Mutation failed");
    });
  });

  describe("optimistic updates", () => {
    it("should handle optimistic create with transformer", async () => {
      const configWithOptimistic = {
        ...config,
        enabled: () => false, // Disable query to prevent interference
        optimisticDefaults: {
          createOptimisticUiData: (userInput: any) => ({
            id: `temp-${Date.now()}`,
            title: userInput.title,
            completed: userInput.completed || false,
            priority: userInput.priority || 1,
            created_at: new Date(),
          }),
        },
      };

      const store = createOptimisticStore(configWithOptimistic, queryClient);

      // Make the server response take longer
      const originalCreateMutation = mockCreateMutation.getMockImplementation();
      mockCreateMutation.mockImplementation(() => 
        new Promise(resolve => 
          setTimeout(() => resolve({
            id: "3",
            title: "New Task",
            completed: "false",
            priority: "3",
            created_at: "2023-01-03T00:00:00.000Z",
          }), 200)
        )
      );

      // Set up MobX spy to track changes
      const spy = vi.fn();
      const dispose = autorun(() => {
        spy(store.ui.count);
      });

      const newData = {
        title: "Optimistic Task",
        completed: false,
        priority: 2,
      };

      // Start the mutation
      const mutationPromise = store.api.create(newData);

      // Wait a bit for the onMutate callback to run
      await new Promise(resolve => setTimeout(resolve, 10));

      // Check that optimistic data is added after onMutate has run
      expect(store.ui.count).toBe(1);
      const optimisticTask = store.ui.list[0];
      expect(optimisticTask.title).toBe("Optimistic Task");
      expect(optimisticTask.id).toMatch(/^temp-/);

      // Wait for mutation to complete
      await mutationPromise;

      // Check that optimistic data is replaced with server data
      expect(store.ui.count).toBe(1);
      const finalTask = store.ui.list[0];
      expect(finalTask.title).toBe("New Task"); // From mock response
      expect(finalTask.id).toBe("3"); // From mock response

      // Verify the spy captured the optimistic update
      expect(spy).toHaveBeenCalledWith(1);

      // Cleanup
      dispose();
      mockCreateMutation.mockImplementation(originalCreateMutation!);
    });

    it("should handle optimistic update", async () => {
      const configWithOptimistic = {
        ...config,
        optimisticDefaults: {
          createOptimisticUiData: (userInput: any) => ({
            id: userInput.id,
            title: userInput.title,
            completed: userInput.completed || false,
            priority: userInput.priority || 1,
            created_at: userInput.created_at || new Date(),
          }),
        },
      };

      // First populate the store
      const store = createOptimisticStore(configWithOptimistic, queryClient);
      await store.api.triggerQuery();
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(store.ui.count).toBe(2);

      // Make the server response take longer
      const originalUpdateMutation = mockUpdateMutation.getMockImplementation();
      mockUpdateMutation.mockImplementation(() => 
        new Promise(resolve => 
          setTimeout(() => resolve({
            id: "1",
            title: "Server Confirmed Updated Task",
            completed: "true",
            priority: "5",
            created_at: "2023-01-01T00:00:00.000Z",
          }), 200)
        )
      );

      // Set up MobX spy to track changes
      const spy = vi.fn();
      const dispose = autorun(() => {
        const task = store.ui.get("1");
        if (task) {
          spy(task.title);
        }
      });

      // Update with optimistic data
      const updateData = { title: "Optimistically Updated" };
      const mutationPromise = store.api.update("1", updateData);

      // Wait a bit for the onMutate callback to run
      await new Promise(resolve => setTimeout(resolve, 10));

      // Check optimistic update after onMutate has run
      const optimisticTask = store.ui.get("1");
      expect(optimisticTask?.title).toBe("Optimistically Updated");

      // Wait for mutation to complete
      await mutationPromise;

      // Check final state
      const finalTask = store.ui.get("1");
      expect(finalTask?.title).toBe("Server Confirmed Updated Task"); // From mock response

      // Verify the spy captured the optimistic update
      expect(spy).toHaveBeenCalledWith("Optimistically Updated");
      expect(spy).toHaveBeenCalledWith("Server Confirmed Updated Task");

      // Cleanup
      dispose();
      mockUpdateMutation.mockImplementation(originalUpdateMutation!);
    });
  });

  describe("realtime functionality", () => {
    it("should create realtime extension when config provided", () => {
      const configWithRealtime = {
        ...config,
        realtime: {
          eventType: "test_update",
          browserId: "test-browser",
        },
      };

      const store = createOptimisticStore(configWithRealtime, queryClient);

      expect(store.realtime).toBeDefined();
      expect(store.realtime?.isConnected).toBe(false);
      expect(store.realtime?.connect).toBeDefined();
      expect(store.realtime?.disconnect).toBeDefined();
    });

    it("should not create realtime extension when config not provided", () => {
      const store = createOptimisticStore(config, queryClient);

      expect(store.realtime).toBeUndefined();
    });

    it("should handle realtime connection", () => {
      const configWithRealtime = {
        ...config,
        realtime: {
          eventType: "test_update",
        },
      };

      const store = createOptimisticStore(configWithRealtime, queryClient);
      const mockSocket = { on: vi.fn(), emit: vi.fn() };

      store.realtime?.connect(mockSocket);

      expect(mockRealtimeExtension.connect).toHaveBeenCalledWith(mockSocket);
    });

    it("should handle realtime disconnection", () => {
      const configWithRealtime = {
        ...config,
        realtime: {
          eventType: "test_update",
        },
      };

      const store = createOptimisticStore(configWithRealtime, queryClient);

      store.realtime?.disconnect();

      expect(mockRealtimeExtension.disconnect).toHaveBeenCalled();
    });
  });

  describe("lifecycle methods", () => {
    it("should update options", () => {
      const store = createOptimisticStore(config, queryClient);

      // This should not throw
      expect(() => store.updateOptions()).not.toThrow();
    });

    it("should check if enabled", () => {
      const store = createOptimisticStore(config, queryClient);

      expect(store.isEnabled()).toBe(true);
    });

    it("should enable and disable", () => {
      const store = createOptimisticStore(config, queryClient);

      store.disable();
      expect(store.isEnabled()).toBe(false);

      store.enable();
      expect(store.isEnabled()).toBe(true);
    });

    it("should destroy store", () => {
      const store = createOptimisticStore(config, queryClient);

      // This should not throw
      expect(() => store.destroy()).not.toThrow();
    });
  });

  describe("configuration options", () => {
    it("should work without transformer", () => {
      const configWithoutTransformer = {
        ...config,
        transformer: false,
      };

      const store = createOptimisticStore(
        configWithoutTransformer,
        queryClient,
      );

      expect(store).toBeDefined();
      expect(store.ui).toBeDefined();
      expect(store.api).toBeDefined();
    });

    it("should work with custom enabled function", () => {
      let enabled = false;
      const configWithEnabled = {
        ...config,
        enabled: () => enabled,
      };

      const store = createOptimisticStore(configWithEnabled, queryClient);

      expect(store.isEnabled()).toBe(false);

      enabled = true;
      expect(store.isEnabled()).toBe(true);
    });

    it("should work with custom stale time", () => {
      const configWithStaleTime = {
        ...config,
        staleTime: 10000, // 10 seconds
      };

      const store = createOptimisticStore(configWithStaleTime, queryClient);

      expect(store).toBeDefined();
    });
  });

  describe("error handling", () => {
    it("should handle query function errors gracefully", async () => {
      const error = new Error("Network error");
      mockQueryFn.mockRejectedValue(error);

      const store = createOptimisticStore(config, queryClient);

      await store.api.triggerQuery();
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(store.api.status.isError).toBe(true);
      expect(store.api.status.error).toBe(error);
    });

    it("should handle mutation errors gracefully", async () => {
      const error = new Error("Server error");
      mockCreateMutation.mockRejectedValue(error);

      const store = createOptimisticStore(config, queryClient);

      await expect(store.api.create({})).rejects.toThrow("Server error");
    });
  });

  describe("edge cases", () => {
    it("should handle empty query results", async () => {
      mockQueryFn.mockResolvedValue([]);

      const store = createOptimisticStore(config, queryClient);

      await store.api.triggerQuery();
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(store.ui.count).toBe(0);
      expect(store.ui.list).toEqual([]);
    });

    it("should handle null query results", async () => {
      mockQueryFn.mockResolvedValue(null);

      const store = createOptimisticStore(config, queryClient);

      await store.api.triggerQuery();
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(store.ui.count).toBe(0);
    });

    it("should handle undefined query results", async () => {
      mockQueryFn.mockResolvedValue(undefined);

      const store = createOptimisticStore(config, queryClient);

      await store.api.triggerQuery();
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(store.ui.count).toBe(0);
    });
  });
});
