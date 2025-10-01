import { describe, it, expect, beforeEach, vi } from "vitest";
import { ObservableUIData } from "./ObservableUIData";
import type { Entity, DataTransformer } from "./types";

// Test data types
interface TestEntity extends Entity {
  id: string;
  title: string;
  completed: boolean;
  priority: number;
  tags: string[];
  createdAt: Date;
}

interface TestApiData extends Entity {
  id: string;
  title: string;
  completed: string;
  priority: string;
  tags: string;
  created_at: string;
}

// Mock transformer for testing
const mockTransformer: DataTransformer<TestApiData, TestEntity> = {
  toUi: (apiData) => ({
    id: apiData.id,
    title: apiData.title,
    completed: apiData.completed === "true",
    priority: parseInt(apiData.priority),
    tags: apiData.tags.split(",").map((tag) => tag.trim()),
    createdAt: new Date(apiData.created_at),
  }),
  toApi: (uiData) => ({
    id: uiData.id,
    title: uiData.title,
    completed: uiData.completed.toString(),
    priority: uiData.priority.toString(),
    tags: uiData.tags.join(","),
    created_at: uiData.createdAt.toISOString(),
  }),
};

describe("ObservableUIData", () => {
  let store: ObservableUIData<TestEntity>;

  beforeEach(() => {
    store = new ObservableUIData<TestEntity>();
  });

  describe("constructor and initialization", () => {
    it("should create an empty store", () => {
      expect(store.entities).toBeDefined();
      expect(store.entities.size).toBe(0);
      expect(store.count).toBe(0);
      expect(store.list).toEqual([]);
    });

    it("should accept a transformer in constructor", () => {
      const storeWithTransformer = new ObservableUIData<TestEntity>(
        mockTransformer,
      );
      expect(storeWithTransformer).toBeDefined();
    });
  });

  describe("computed properties", () => {
    it("should return empty list when no entities", () => {
      expect(store.list).toEqual([]);
    });

    it("should return all entities as array", () => {
      const entity1: TestEntity = {
        id: "1",
        title: "Task 1",
        completed: false,
        priority: 1,
        tags: ["work"],
        createdAt: new Date("2023-01-01"),
      };
      const entity2: TestEntity = {
        id: "2",
        title: "Task 2",
        completed: true,
        priority: 2,
        tags: ["personal"],
        createdAt: new Date("2023-01-02"),
      };

      store.upsert(entity1);
      store.upsert(entity2);

      expect(store.list).toHaveLength(2);
      expect(store.list).toEqual(expect.arrayContaining([entity1, entity2]));
    });

    it("should return correct count", () => {
      expect(store.count).toBe(0);

      store.upsert({
        id: "1",
        title: "Task 1",
        completed: false,
        priority: 1,
        tags: ["work"],
        createdAt: new Date("2023-01-01"),
      });

      expect(store.count).toBe(1);

      store.upsert({
        id: "2",
        title: "Task 2",
        completed: true,
        priority: 2,
        tags: ["personal"],
        createdAt: new Date("2023-01-02"),
      });

      expect(store.count).toBe(2);
    });
  });

  describe("basic operations", () => {
    const testEntity: TestEntity = {
      id: "1",
      title: "Test Task",
      completed: false,
      priority: 1,
      tags: ["test"],
      createdAt: new Date("2023-01-01"),
    };

    it("should get entity by id", () => {
      expect(store.get("1")).toBeUndefined();

      store.upsert(testEntity);
      const retrieved = store.get("1");

      expect(retrieved).toEqual(testEntity);
    });

    it("should upsert entity", () => {
      store.upsert(testEntity);

      expect(store.get("1")).toEqual(testEntity);
      expect(store.count).toBe(1);
    });

    it("should update existing entity", () => {
      store.upsert(testEntity);
      store.update("1", { completed: true, priority: 5 });

      const updated = store.get("1");
      expect(updated?.completed).toBe(true);
      expect(updated?.priority).toBe(5);
      expect(updated?.title).toBe("Test Task"); // Should preserve other fields
    });

    it("should not update non-existent entity", () => {
      store.update("nonexistent", { completed: true });
      expect(store.count).toBe(0);
    });

    it("should remove entity", () => {
      store.upsert(testEntity);
      expect(store.count).toBe(1);

      store.remove("1");
      expect(store.count).toBe(0);
      expect(store.get("1")).toBeUndefined();
    });

    it("should clear all entities", () => {
      store.upsert(testEntity);
      store.upsert({
        id: "2",
        title: "Task 2",
        completed: true,
        priority: 2,
        tags: ["work"],
        createdAt: new Date("2023-01-02"),
      });

      expect(store.count).toBe(2);

      store.clear();
      expect(store.count).toBe(0);
      expect(store.list).toEqual([]);
    });
  });

  describe("realtime operations", () => {
    const apiData: TestApiData = {
      id: "1",
      title: "Realtime Task",
      completed: "true",
      priority: "3",
      tags: "realtime,test",
      created_at: "2023-01-01T00:00:00.000Z",
    };

    it("should upsert via realtime with transformer", () => {
      const storeWithTransformer = new ObservableUIData<TestEntity>(
        mockTransformer,
      );

      storeWithTransformer.upsertViaRealtime(apiData);

      const result = storeWithTransformer.get("1");
      expect(result).toBeDefined();
      expect(result?.title).toBe("Realtime Task");
      expect(result?.completed).toBe(true);
      expect(result?.priority).toBe(3);
      expect(result?.tags).toEqual(["realtime", "test"]);
      expect(result?.createdAt).toBeInstanceOf(Date);
    });

    it("should upsert via realtime without transformer", () => {
      store.upsertViaRealtime(apiData as any);

      const result = store.get("1");
      expect(result).toEqual(apiData);
    });

    it("should remove via realtime", () => {
      const testEntity: TestEntity = {
        id: "1",
        title: "Test Task",
        completed: false,
        priority: 1,
        tags: ["test"],
        createdAt: new Date("2023-01-01"),
      };

      store.upsert(testEntity);
      expect(store.count).toBe(1);

      store.removeViaRealtime("1");
      expect(store.count).toBe(0);
    });
  });

  describe("snapshot and rollback", () => {
    const entity1: TestEntity = {
      id: "1",
      title: "Task 1",
      completed: false,
      priority: 1,
      tags: ["work"],
      createdAt: new Date("2023-01-01"),
    };

    const entity2: TestEntity = {
      id: "2",
      title: "Task 2",
      completed: true,
      priority: 2,
      tags: ["personal"],
      createdAt: new Date("2023-01-02"),
    };

    it("should push snapshot", () => {
      store.upsert(entity1);
      store.pushSnapshot();

      // Modify the store
      store.upsert(entity2);
      store.update("1", { completed: true });

      expect(store.count).toBe(2);
      expect(store.get("1")?.completed).toBe(true);
    });

    it("should rollback to previous snapshot", () => {
      store.upsert(entity1);
      store.pushSnapshot();

      // Modify the store
      store.upsert(entity2);
      store.update("1", { completed: true });

      store.rollback();

      expect(store.count).toBe(1);
      expect(store.get("1")).toEqual(entity1);
      expect(store.get("2")).toBeUndefined();
    });

    it("should handle multiple snapshots", () => {
      store.upsert(entity1);
      store.pushSnapshot();

      store.upsert(entity2);
      store.pushSnapshot();

      store.update("1", { completed: true });
      store.update("2", { priority: 5 });

      // Rollback to second snapshot
      store.rollback();
      expect(store.get("1")?.completed).toBe(false);
      expect(store.get("2")?.priority).toBe(2);

      // Rollback to first snapshot
      store.rollback();
      expect(store.count).toBe(1);
      expect(store.get("2")).toBeUndefined();
    });

    it("should handle rollback when no snapshots", () => {
      store.upsert(entity1);
      store.rollback(); // Should not throw

      expect(store.count).toBe(1);
      expect(store.get("1")).toEqual(entity1);
    });
  });

  describe("reconciliation", () => {
    const serverData1: TestApiData = {
      id: "1",
      title: "Server Task 1",
      completed: "true",
      priority: "1",
      tags: "server,test",
      created_at: "2023-01-01T00:00:00.000Z",
    };

    const serverData2: TestApiData = {
      id: "2",
      title: "Server Task 2",
      completed: "false",
      priority: "2",
      tags: "server,important",
      created_at: "2023-01-02T00:00:00.000Z",
    };

    beforeEach(() => {
      store = new ObservableUIData<TestEntity>(mockTransformer);
    });

    it("should reconcile with server data", () => {
      store.reconcile([serverData1, serverData2]);

      expect(store.count).toBe(2);
      expect(store.get("1")?.title).toBe("Server Task 1");
      expect(store.get("2")?.title).toBe("Server Task 2");
    });

    it("should update existing entities", () => {
      // Add initial data
      store.upsert({
        id: "1",
        title: "Old Title",
        completed: false,
        priority: 5,
        tags: ["old"],
        createdAt: new Date("2022-01-01"),
      });

      // Reconcile with server data using transformer
      store.reconcile([serverData1], mockTransformer);

      expect(store.count).toBe(1);
      expect(store.get("1")?.title).toBe("Server Task 1");
      expect(store.get("1")?.completed).toBe(true);
    });

    it("should remove entities not in server data", () => {
      // Add initial data
      store.upsert({
        id: "1",
        title: "Task 1",
        completed: false,
        priority: 1,
        tags: ["work"],
        createdAt: new Date("2023-01-01"),
      });

      store.upsert({
        id: "2",
        title: "Task 2",
        completed: true,
        priority: 2,
        tags: ["personal"],
        createdAt: new Date("2023-01-02"),
      });

      // Reconcile with only one item
      store.reconcile([serverData1]);

      expect(store.count).toBe(1);
      expect(store.get("1")).toBeDefined();
      expect(store.get("2")).toBeUndefined();
    });

    it("should skip reconciliation when no changes", () => {
      // Add initial data that matches server data exactly
      const initialData: TestEntity = {
        id: "1",
        title: "Server Task 1",
        completed: true,
        priority: 1,
        tags: ["server", "test"],
        createdAt: new Date("2023-01-01T00:00:00.000Z"),
      };

      store.upsert(initialData);

      // Mock console.log to verify it's called
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      // Reconcile with same data (but as API data) using transformer
      const sameServerData: TestApiData = {
        id: "1",
        title: "Server Task 1",
        completed: "true",
        priority: "1",
        tags: "server,test",
        created_at: "2023-01-01T00:00:00.000Z",
      };

      store.reconcile([sameServerData], mockTransformer);

      expect(consoleSpy).toHaveBeenCalledWith(
        "reconciled: no changes detected, skipping update",
      );

      consoleSpy.mockRestore();
    });

    it("should clear snapshots during reconciliation", () => {
      const entity1: TestEntity = {
        id: "1",
        title: "Task 1",
        completed: false,
        priority: 1,
        tags: ["work"],
        createdAt: new Date("2023-01-01"),
      };

      store.upsert(entity1);
      store.pushSnapshot();
      store.pushSnapshot();

      expect(store["snapshots"]).toHaveLength(2);

      store.reconcile([serverData1]);

      expect(store["snapshots"]).toHaveLength(0);
    });
  });

  describe("utility methods", () => {
    const entity1: TestEntity = {
      id: "1",
      title: "Work Task",
      completed: false,
      priority: 1,
      tags: ["work", "urgent"],
      createdAt: new Date("2023-01-01"),
    };

    const entity2: TestEntity = {
      id: "2",
      title: "Personal Task",
      completed: true,
      priority: 2,
      tags: ["personal"],
      createdAt: new Date("2023-01-02"),
    };

    const entity3: TestEntity = {
      id: "3",
      title: "Another Work Task",
      completed: false,
      priority: 3,
      tags: ["work"],
      createdAt: new Date("2023-01-03"),
    };

    beforeEach(() => {
      store.upsert(entity1);
      store.upsert(entity2);
      store.upsert(entity3);
    });

    it("should filter entities", () => {
      const workTasks = store.filter((entity) => entity.tags.includes("work"));
      expect(workTasks).toHaveLength(2);
      expect(workTasks).toEqual(expect.arrayContaining([entity1, entity3]));

      const completedTasks = store.filter((entity) => entity.completed);
      expect(completedTasks).toHaveLength(1);
      expect(completedTasks).toEqual(expect.arrayContaining([entity2]));
    });

    it("should find single entity", () => {
      const workTask = store.find((entity) => entity.tags.includes("urgent"));
      expect(workTask).toEqual(entity1);

      const highPriorityTask = store.find((entity) => entity.priority > 2);
      expect(highPriorityTask).toEqual(entity3);

      const nonExistent = store.find(
        (entity) => entity.title === "Non-existent",
      );
      expect(nonExistent).toBeUndefined();
    });
  });

  describe("shallow equality comparison", () => {
    it("should handle reference equality", () => {
      const entity: TestEntity = {
        id: "1",
        title: "Test",
        completed: false,
        priority: 1,
        tags: ["test"],
        createdAt: new Date("2023-01-01"),
      };

      expect(store["shallowEqual"](entity, entity)).toBe(true);
    });

    it("should handle null/undefined", () => {
      expect(store["shallowEqual"](null as any, null as any)).toBe(true);
      expect(store["shallowEqual"](undefined as any, undefined as any)).toBe(
        true,
      );
      expect(store["shallowEqual"](null as any, undefined as any)).toBe(false);
    });

    it("should handle Date objects", () => {
      const date1 = new Date("2023-01-01");
      const date2 = new Date("2023-01-01");
      const date3 = new Date("2023-01-02");

      const entity1: TestEntity = {
        id: "1",
        title: "Test",
        completed: false,
        priority: 1,
        tags: ["test"],
        createdAt: date1,
      };

      const entity2: TestEntity = {
        id: "1",
        title: "Test",
        completed: false,
        priority: 1,
        tags: ["test"],
        createdAt: date2,
      };

      const entity3: TestEntity = {
        id: "1",
        title: "Test",
        completed: false,
        priority: 1,
        tags: ["test"],
        createdAt: date3,
      };

      expect(store["shallowEqual"](entity1, entity2)).toBe(true);
      expect(store["shallowEqual"](entity1, entity3)).toBe(false);
    });

    it("should handle arrays", () => {
      const entity1: TestEntity = {
        id: "1",
        title: "Test",
        completed: false,
        priority: 1,
        tags: ["a", "b"],
        createdAt: new Date("2023-01-01"),
      };

      const entity2: TestEntity = {
        id: "1",
        title: "Test",
        completed: false,
        priority: 1,
        tags: ["a", "b"],
        createdAt: new Date("2023-01-01"),
      };

      const entity3: TestEntity = {
        id: "1",
        title: "Test",
        completed: false,
        priority: 1,
        tags: ["a", "c"],
        createdAt: new Date("2023-01-01"),
      };

      expect(store["shallowEqual"](entity1, entity2)).toBe(true);
      expect(store["shallowEqual"](entity1, entity3)).toBe(false);
    });

    it("should handle objects", () => {
      const entity1 = {
        id: "1",
        title: "Test",
        metadata: { key: "value" },
      };

      const entity2 = {
        id: "1",
        title: "Test",
        metadata: { key: "value" },
      };

      const entity3 = {
        id: "1",
        title: "Test",
        metadata: { key: "different" },
      };

      // Shallow equality should work for objects with same values
      expect(store["shallowEqual"](entity1 as any, entity2 as any)).toBe(true);
      expect(store["shallowEqual"](entity1 as any, entity3 as any)).toBe(false);
    });
  });

  describe("edge cases", () => {
    it("should handle empty reconciliation", () => {
      store.upsert({
        id: "1",
        title: "Task",
        completed: false,
        priority: 1,
        tags: ["work"],
        createdAt: new Date("2023-01-01"),
      });

      store.reconcile([]);

      expect(store.count).toBe(0);
    });

    it("should handle upsert with same id", () => {
      const entity1: TestEntity = {
        id: "1",
        title: "Original",
        completed: false,
        priority: 1,
        tags: ["work"],
        createdAt: new Date("2023-01-01"),
      };

      const entity2: TestEntity = {
        id: "1",
        title: "Updated",
        completed: true,
        priority: 2,
        tags: ["personal"],
        createdAt: new Date("2023-01-02"),
      };

      store.upsert(entity1);
      expect(store.get("1")?.title).toBe("Original");

      store.upsert(entity2);
      expect(store.get("1")?.title).toBe("Updated");
      expect(store.count).toBe(1);
    });
  });
});
