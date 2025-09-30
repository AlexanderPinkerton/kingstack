import { describe, it, expect, beforeEach, vi } from "vitest";
import { QueryClient } from "@tanstack/query-core";
import { createOptimisticStore, ObservableUIData } from "./index";
import type { Entity, OptimisticStoreConfig } from "./types";

// Test data types
interface TodoApiData extends Entity {
  id: string;
  title: string;
  completed: string;
  priority: string;
  created_at: string;
  user_id: string;
}

interface TodoUiData extends Entity {
  id: string;
  title: string;
  completed: boolean;
  priority: number;
  created_at: Date;
  user_id: string;
}

describe("Core Module Integration", () => {
  let queryClient: QueryClient;
  let mockQueryFn: any;
  let mockMutations: any;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    mockQueryFn = vi.fn();
    mockMutations = {
      create: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
    };

    // Setup default mock responses
    mockQueryFn.mockResolvedValue([
      {
        id: "1",
        title: "Learn TypeScript",
        completed: "false",
        priority: "1",
        created_at: "2023-01-01T00:00:00.000Z",
        user_id: "user-123",
      },
      {
        id: "2",
        title: "Build App",
        completed: "true",
        priority: "2",
        created_at: "2023-01-02T00:00:00.000Z",
        user_id: "user-123",
      },
    ]);

    mockMutations.create.mockResolvedValue({
      id: "3",
      title: "New Task",
      completed: "false",
      priority: "3",
      created_at: "2023-01-03T00:00:00.000Z",
      user_id: "user-123",
    });

    mockMutations.update.mockResolvedValue({
      id: "1",
      title: "Updated Task",
      completed: "true",
      priority: "5",
      created_at: "2023-01-01T00:00:00.000Z",
      user_id: "user-123",
    });

    mockMutations.remove.mockResolvedValue({ id: "1" });
  });

  describe("ObservableUIData exports", () => {
    it("should export ObservableUIData class", () => {
      expect(ObservableUIData).toBeDefined();
      expect(typeof ObservableUIData).toBe("function");
    });

    it("should create ObservableUIData instance", () => {
      const store = new ObservableUIData<TodoUiData>();
      expect(store).toBeInstanceOf(ObservableUIData);
      expect(store.entities).toBeDefined();
      expect(store.count).toBe(0);
    });
  });

  describe("createOptimisticStore exports", () => {
    it("should export createOptimisticStore function", () => {
      expect(createOptimisticStore).toBeDefined();
      expect(typeof createOptimisticStore).toBe("function");
    });

    it("should create optimistic store with default transformer", () => {
      const config: OptimisticStoreConfig<TodoApiData, TodoUiData> = {
        name: "todos",
        queryFn: mockQueryFn,
        mutations: mockMutations,
      };

      const store = createOptimisticStore(config, queryClient);

      expect(store).toBeDefined();
      expect(store.ui).toBeDefined();
      expect(store.api).toBeDefined();
      expect(store.ui).toBeInstanceOf(Object);
    });
  });

  describe("end-to-end workflow", () => {
    it("should handle complete CRUD workflow", async () => {
      const config: OptimisticStoreConfig<TodoApiData, TodoUiData> = {
        name: "todos",
        queryFn: mockQueryFn,
        mutations: mockMutations,
      };

      const store = createOptimisticStore(config, queryClient);

      // 1. Initial load
      await store.api.triggerQuery();
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(store.ui.count).toBe(2);
      expect(store.ui.list).toHaveLength(2);

      const initialTask = store.ui.get("1");
      expect(initialTask?.title).toBe("Learn TypeScript");
      expect(initialTask?.completed).toBe(false);
      expect(initialTask?.priority).toBe(1);
      expect(initialTask?.created_at).toBeInstanceOf(Date);

      // 2. Create new task
      const newTaskData = {
        title: "New Task",
        completed: false,
        priority: 3,
        user_id: "user-123",
      };

      await store.api.create(newTaskData);

      expect(mockMutations.create).toHaveBeenCalledWith(
        newTaskData,
        expect.any(Object),
      );
      expect(store.ui.count).toBe(3);

      // 3. Update existing task
      const updateData = {
        title: "Updated Task",
        completed: true,
        priority: 5,
      };

      await store.api.update("1", updateData);

      expect(mockMutations.update).toHaveBeenCalledWith(
        {
          id: "1",
          data: updateData,
        },
        expect.any(Object),
      );

      const updatedTask = store.ui.get("1");
      expect(updatedTask?.title).toBe("Updated Task");
      expect(updatedTask?.completed).toBe(true);
      expect(updatedTask?.priority).toBe(5);

      // 4. Remove task
      await store.api.remove("1");

      expect(mockMutations.remove).toHaveBeenCalledWith(
        "1",
        expect.any(Object),
      );
      expect(store.ui.count).toBe(2);
      expect(store.ui.get("1")).toBeUndefined();
    });

    it("should handle optimistic updates with rollback", async () => {
      const config: OptimisticStoreConfig<TodoApiData, TodoUiData> = {
        name: "todos",
        queryFn: mockQueryFn,
        mutations: {
          ...mockMutations,
          create: vi.fn().mockRejectedValue(new Error("Server error")),
        },
        optimisticDefaults: {
          createOptimisticUiData: (userInput: any) => ({
            id: `temp-${Date.now()}`,
            title: userInput.title,
            completed: userInput.completed || false,
            priority: userInput.priority || 1,
            created_at: new Date(),
            user_id: userInput.user_id,
          }),
        },
      };

      const store = createOptimisticStore(config, queryClient);

      // Load initial data
      await store.api.triggerQuery();
      await new Promise((resolve) => setTimeout(resolve, 100));

      const initialCount = store.ui.count;

      // Attempt to create with optimistic update
      const newTaskData = {
        title: "Optimistic Task",
        completed: false,
        priority: 3,
        user_id: "user-123",
      };

      try {
        await store.api.create(newTaskData);
      } catch (error) {
        // Expected to fail
      }

      // Should rollback to initial state
      expect(store.ui.count).toBe(initialCount);
    });

    it("should handle realtime updates", async () => {
      const config: OptimisticStoreConfig<TodoApiData, TodoUiData> = {
        name: "todos",
        queryFn: mockQueryFn,
        mutations: mockMutations,
        realtime: {
          eventType: "todo_update",
          browserId: "test-browser",
        },
      };

      const store = createOptimisticStore(config, queryClient);

      // Load initial data
      await store.api.triggerQuery();
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(store.ui.count).toBe(2);

      // Simulate realtime update
      const realtimeData: TodoApiData = {
        id: "3",
        title: "Realtime Task",
        completed: "false",
        priority: "3",
        created_at: "2023-01-03T00:00:00.000Z",
        user_id: "user-123",
      };

      // Manually trigger realtime update (simulating WebSocket event)
      store.ui.upsertFromRealtime(realtimeData);

      expect(store.ui.count).toBe(3);
      const realtimeTask = store.ui.get("3");
      expect(realtimeTask?.title).toBe("Realtime Task");
      expect(realtimeTask?.completed).toBe(false);
      expect(realtimeTask?.priority).toBe(3);
    });

    it("should handle server reconciliation", async () => {
      const config: OptimisticStoreConfig<TodoApiData, TodoUiData> = {
        name: "todos",
        queryFn: mockQueryFn,
        mutations: mockMutations,
      };

      const store = createOptimisticStore(config, queryClient);

      // Load initial data
      await store.api.triggerQuery();
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(store.ui.count).toBe(2);

      // Simulate server data change
      const updatedServerData: TodoApiData[] = [
        {
          id: "1",
          title: "Updated Learn TypeScript",
          completed: "true",
          priority: "5",
          created_at: "2023-01-01T00:00:00.000Z",
          user_id: "user-123",
        },
        {
          id: "3",
          title: "New Server Task",
          completed: "false",
          priority: "1",
          created_at: "2023-01-03T00:00:00.000Z",
          user_id: "user-123",
        },
      ];

      // Reconcile with new server data using transformer
      const transformer = {
        toUi: (apiData: TodoApiData): TodoUiData => ({
          id: apiData.id,
          title: apiData.title,
          completed: apiData.completed === "true",
          priority: parseInt(apiData.priority),
          created_at: new Date(apiData.created_at),
          user_id: apiData.user_id,
        }),
        toApi: (uiData: TodoUiData): TodoApiData => ({
          id: uiData.id,
          title: uiData.title,
          completed: uiData.completed.toString(),
          priority: uiData.priority.toString(),
          created_at: uiData.created_at.toISOString(),
          user_id: uiData.user_id,
        }),
      };

      store.ui.reconcile(updatedServerData, transformer);

      expect(store.ui.count).toBe(2);
      const updatedTask = store.ui.get("1");
      expect(updatedTask?.title).toBe("Updated Learn TypeScript");
      expect(updatedTask?.completed).toBe(true);
      expect(updatedTask?.priority).toBe(5);

      const newTask = store.ui.get("3");
      expect(newTask?.title).toBe("New Server Task");
      expect(newTask?.completed).toBe(false);
    });
  });

  describe("error scenarios", () => {
    it("should handle query failures gracefully", async () => {
      const error = new Error("Network error");
      mockQueryFn.mockRejectedValue(error);

      const config: OptimisticStoreConfig<TodoApiData, TodoUiData> = {
        name: "todos",
        queryFn: mockQueryFn,
        mutations: mockMutations,
      };

      const store = createOptimisticStore(config, queryClient);

      await store.api.triggerQuery();
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(store.api.status.isError).toBe(true);
      expect(store.api.status.error).toBe(error);
      expect(store.ui.count).toBe(0);
    });

    it("should handle mutation failures gracefully", async () => {
      const error = new Error("Server error");
      mockMutations.create.mockRejectedValue(error);

      const config: OptimisticStoreConfig<TodoApiData, TodoUiData> = {
        name: "todos",
        queryFn: mockQueryFn,
        mutations: mockMutations,
      };

      const store = createOptimisticStore(config, queryClient);

      await expect(store.api.create({})).rejects.toThrow("Server error");
    });
  });

  describe("performance and memory", () => {
    it("should handle large datasets efficiently", async () => {
      // Generate large dataset
      const largeDataset: TodoApiData[] = Array.from(
        { length: 1000 },
        (_, i) => ({
          id: `task-${i}`,
          title: `Task ${i}`,
          completed: i % 2 === 0 ? "true" : "false",
          priority: ((i % 5) + 1).toString(),
          created_at: new Date(2023, 0, 1 + i).toISOString(),
          user_id: "user-123",
        }),
      );

      mockQueryFn.mockResolvedValue(largeDataset);

      const config: OptimisticStoreConfig<TodoApiData, TodoUiData> = {
        name: "todos",
        queryFn: mockQueryFn,
        mutations: mockMutations,
      };

      const store = createOptimisticStore(config, queryClient);

      await store.api.triggerQuery();
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(store.ui.count).toBe(1000);
      expect(store.ui.list).toHaveLength(1000);

      // Test filtering performance
      const completedTasks = store.ui.filter((task) => task.completed);
      expect(completedTasks).toHaveLength(500);

      // Test finding performance
      const specificTask = store.ui.find((task) => task.id === "task-500");
      expect(specificTask?.title).toBe("Task 500");
    });

    it("should handle rapid updates efficiently", async () => {
      const config: OptimisticStoreConfig<TodoApiData, TodoUiData> = {
        name: "todos",
        queryFn: mockQueryFn,
        mutations: mockMutations,
      };

      const store = createOptimisticStore(config, queryClient);

      // Load initial data
      await store.api.triggerQuery();
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Perform rapid updates
      for (let i = 0; i < 100; i++) {
        store.ui.update("1", { priority: i });
      }

      const finalTask = store.ui.get("1");
      expect(finalTask?.priority).toBe(99);
    });
  });
});
