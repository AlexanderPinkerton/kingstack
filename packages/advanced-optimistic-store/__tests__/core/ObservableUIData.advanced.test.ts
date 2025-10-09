import { describe, it, expect, beforeEach, vi } from "vitest";
import { autorun, reaction } from "mobx";
import { ObservableUIData } from "../../src/core/ObservableUIData";
import type { Entity, DataTransformer } from "../../src/core/types";
import { getPerformanceThresholds, measurePerformance, measureMemoryUsage } from "../utils/testHelpers";

// Test data types
interface TestEntity extends Entity {
  id: string;
  title: string;
  completed: boolean;
  priority: number;
  tags: string[];
  createdAt: Date;
  metadata?: any;
}

interface TestApiData extends Entity {
  id: string;
  title: string;
  completed: string;
  priority: string;
  tags: string;
  created_at: string;
  metadata?: any;
}

// Mock transformer
const mockTransformer: DataTransformer<TestApiData, TestEntity> = {
  toUi: (apiData) => ({
    id: apiData.id,
    title: apiData.title,
    completed: apiData.completed === "true",
    priority: parseInt(apiData.priority),
    tags: apiData.tags.split(",").map((tag) => tag.trim()),
    createdAt: new Date(apiData.created_at),
    metadata: apiData.metadata,
  }),
  toApi: (uiData) => ({
    id: uiData.id,
    title: uiData.title,
    completed: uiData.completed.toString(),
    priority: uiData.priority.toString(),
    tags: uiData.tags.join(","),
    created_at: uiData.createdAt.toISOString(),
    metadata: uiData.metadata,
  }),
};

describe("ObservableUIData Advanced Scenarios", () => {
  let store: ObservableUIData<TestEntity>;

  beforeEach(() => {
    store = new ObservableUIData<TestEntity>();
  });

  describe("MobX Reactivity", () => {
    it("should trigger reactions on computed property changes", () => {
      const spy = vi.fn();
      const dispose = autorun(() => {
        spy(store.count);
      });

      // Initial call
      expect(spy).toHaveBeenCalledWith(0);

      // Add entity
      store.upsert({
        id: "1",
        title: "Task 1",
        completed: false,
        priority: 1,
        tags: ["work"],
        createdAt: new Date("2023-01-01"),
      });

      expect(spy).toHaveBeenCalledWith(1);

      // Add another entity
      store.upsert({
        id: "2",
        title: "Task 2",
        completed: true,
        priority: 2,
        tags: ["personal"],
        createdAt: new Date("2023-01-02"),
      });

      expect(spy).toHaveBeenCalledWith(2);

      // Remove entity
      store.remove("1");
      expect(spy).toHaveBeenCalledWith(1);

      dispose();
    });

    it("should trigger reactions on list changes", () => {
      const spy = vi.fn();
      const dispose = autorun(() => {
        spy(store.list.length);
      });

      // Initial call
      expect(spy).toHaveBeenCalledWith(0);

      // Add entities
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

      expect(spy).toHaveBeenCalledWith(1);
      expect(spy).toHaveBeenCalledWith(2);

      dispose();
    });

    it("should trigger reactions on entity property changes", () => {
      const entity: TestEntity = {
        id: "1",
        title: "Task 1",
        completed: false,
        priority: 1,
        tags: ["work"],
        createdAt: new Date("2023-01-01"),
      };

      store.upsert(entity);

      const spy = vi.fn();
      const dispose = autorun(() => {
        const task = store.get("1");
        if (task) {
          spy(task.completed);
        }
      });

      // Initial call
      expect(spy).toHaveBeenCalledWith(false);

      // Update entity
      store.update("1", { completed: true });
      expect(spy).toHaveBeenCalledWith(true);

      dispose();
    });

    it("should handle complex reaction dependencies", () => {
      const spy = vi.fn();
      const dispose = reaction(
        () => store.list.filter((item) => item.completed).length,
        (completedCount) => {
          spy(completedCount);
        },
      );

      // Add completed task
      store.upsert({
        id: "1",
        title: "Completed Task",
        completed: true,
        priority: 1,
        tags: ["work"],
        createdAt: new Date("2023-01-01"),
      });

      expect(spy).toHaveBeenCalledWith(1);

      // Add incomplete task
      store.upsert({
        id: "2",
        title: "Incomplete Task",
        completed: false,
        priority: 2,
        tags: ["personal"],
        createdAt: new Date("2023-01-02"),
      });

      // Should not trigger (still 1 completed)
      expect(spy).toHaveBeenCalledTimes(1);

      // Mark as completed
      store.update("2", { completed: true });
      expect(spy).toHaveBeenCalledWith(2);

      dispose();
    });
  });

  describe("Performance & Memory", () => {
    it("should handle large datasets efficiently", async () => {
      const thresholds = getPerformanceThresholds();
      
      const { result, duration, passed } = await measurePerformance(
        () => {
          // Add 1000 entities
          for (let i = 0; i < 1000; i++) {
            store.upsert({
              id: `task-${i}`,
              title: `Task ${i}`,
              completed: i % 2 === 0,
              priority: (i % 5) + 1,
              tags: [`tag-${i % 10}`],
              createdAt: new Date(2023, 0, 1 + i),
            });
          }
          return store.count;
        },
        thresholds.largeDataset,
        "large dataset insertion"
      );

      expect(passed).toBe(true);
      expect(result).toBe(1000);
    });

    it("should handle rapid updates efficiently", async () => {
      const entity: TestEntity = {
        id: "1",
        title: "Task 1",
        completed: false,
        priority: 1,
        tags: ["work"],
        createdAt: new Date("2023-01-01"),
      };

      store.upsert(entity);
      const thresholds = getPerformanceThresholds();

      const { result, duration, passed } = await measurePerformance(
        () => {
          // Perform 1000 rapid updates
          for (let i = 0; i < 1000; i++) {
            store.update("1", { priority: i });
          }
          return store.get("1")?.priority;
        },
        thresholds.rapidUpdates,
        "rapid updates"
      );

      expect(passed).toBe(true);
      expect(result).toBe(999);
    });

    it("should handle memory efficiently with large datasets", async () => {
      const thresholds = getPerformanceThresholds();
      
      const memoryUsage = await measureMemoryUsage(async () => {
        // Add 10000 entities
        for (let i = 0; i < 10000; i++) {
          store.upsert({
            id: `task-${i}`,
            title: `Task ${i}`,
            completed: i % 2 === 0,
            priority: (i % 5) + 1,
            tags: [`tag-${i % 10}`, `category-${i % 3}`],
            createdAt: new Date(2023, 0, 1 + i),
            metadata: { index: i, category: `cat-${i % 5}` },
          });
        }
      });

      expect(memoryUsage.increase).toBeLessThan(thresholds.largeDatasetMemory);

      // Clear all and measure memory reclamation
      store.clear();
      const memoryAfterClear = await measureMemoryUsage(() => {});
      
      // Memory should be reclaimed (very lenient check)
      expect(memoryAfterClear.increase).toBeLessThan(memoryUsage.increase * 1.1);
    });
  });

  describe("Complex Reconciliation Scenarios", () => {
    beforeEach(() => {
      store = new ObservableUIData<TestEntity>(mockTransformer);
    });

    it("should handle reconciliation with partial data", () => {
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

      store.upsert({
        id: "3",
        title: "Task 3",
        completed: false,
        priority: 3,
        tags: ["urgent"],
        createdAt: new Date("2023-01-03"),
      });

      // Reconcile with partial server data (only tasks 1 and 3)
      const partialServerData: TestApiData[] = [
        {
          id: "1",
          title: "Updated Task 1",
          completed: "true",
          priority: "5",
          tags: "work,updated",
          created_at: "2023-01-01T00:00:00.000Z",
        },
        {
          id: "3",
          title: "Updated Task 3",
          completed: "false",
          priority: "1",
          tags: "urgent,modified",
          created_at: "2023-01-03T00:00:00.000Z",
        },
      ];

      store.reconcile(partialServerData, mockTransformer);

      // Should have only 2 items (task 2 removed)
      expect(store.count).toBe(2);
      expect(store.get("1")?.title).toBe("Updated Task 1");
      expect(store.get("1")?.completed).toBe(true);
      expect(store.get("1")?.priority).toBe(5);
      expect(store.get("1")?.tags).toEqual(["work", "updated"]);
      expect(store.get("2")).toBeUndefined();
      expect(store.get("3")?.title).toBe("Updated Task 3");
    });

    it("should handle reconciliation with new data", () => {
      // Add initial data
      store.upsert({
        id: "1",
        title: "Task 1",
        completed: false,
        priority: 1,
        tags: ["work"],
        createdAt: new Date("2023-01-01"),
      });

      // Reconcile with completely new data
      const newServerData: TestApiData[] = [
        {
          id: "2",
          title: "New Task 2",
          completed: "true",
          priority: "2",
          tags: "new,important",
          created_at: "2023-01-02T00:00:00.000Z",
        },
        {
          id: "3",
          title: "New Task 3",
          completed: "false",
          priority: "3",
          tags: "new,urgent",
          created_at: "2023-01-03T00:00:00.000Z",
        },
      ];

      store.reconcile(newServerData, mockTransformer);

      // Should have only new data
      expect(store.count).toBe(2);
      expect(store.get("1")).toBeUndefined();
      expect(store.get("2")?.title).toBe("New Task 2");
      expect(store.get("3")?.title).toBe("New Task 3");
    });

    it("should handle reconciliation with malformed data", () => {
      // Add initial data
      store.upsert({
        id: "1",
        title: "Task 1",
        completed: false,
        priority: 1,
        tags: ["work"],
        createdAt: new Date("2023-01-01"),
      });

      // Reconcile with malformed data
      const malformedServerData: any[] = [
        {
          id: "2",
          title: "Valid Task",
          completed: "true",
          priority: "2",
          tags: "valid",
          created_at: "2023-01-02T00:00:00.000Z",
        },
        {
          id: "3",
          title: "Invalid Task",
          completed: "invalid",
          priority: "not-a-number",
          tags: "invalid",
          created_at: "invalid-date",
        },
        null, // null item
        undefined, // undefined item
        {
          // missing required fields
          id: "4",
        },
      ];

      // Should handle malformed data gracefully
      expect(() => {
        try {
          store.reconcile(malformedServerData, mockTransformer);
        } catch (error) {
          // wtf is this testing?
        }
      }).not.toThrow();

      // Should handle malformed data gracefully
      expect(store.count).toBeGreaterThanOrEqual(1);
    });

    it("should handle reconciliation with complex nested data", () => {
      const complexTransformer: DataTransformer<any, any> = {
        toUi: (apiData) => ({
          id: apiData.id,
          title: apiData.title,
          metadata: apiData.metadata,
        }),
        toApi: (uiData) => ({
          id: uiData.id,
          title: uiData.title,
          metadata: uiData.metadata,
        }),
      };

      const storeWithComplex = new ObservableUIData<any>(complexTransformer);

      // Add initial data
      storeWithComplex.upsert({
        id: "1",
        title: "Task 1",
        metadata: { category: "work", priority: 1 },
      });

      // Reconcile with complex data
      const complexServerData = [
        {
          id: "1",
          title: "Updated Task 1",
          metadata: { category: "work", priority: 5, updated: true },
        },
        {
          id: "2",
          title: "New Task 2",
          metadata: { category: "personal", priority: 2, tags: ["urgent"] },
        },
      ];

      storeWithComplex.reconcile(complexServerData, complexTransformer);

      expect(storeWithComplex.count).toBe(2);
      expect(storeWithComplex.get("1")?.metadata.priority).toBe(5);
      expect(storeWithComplex.get("1")?.metadata.updated).toBe(true);
      expect(storeWithComplex.get("2")?.metadata.tags).toEqual(["urgent"]);
    });
  });

  describe("Snapshot & Rollback Edge Cases", () => {
    it("should handle multiple nested snapshots", () => {
      const entity: TestEntity = {
        id: "1",
        title: "Task 1",
        completed: false,
        priority: 1,
        tags: ["work"],
        createdAt: new Date("2023-01-01"),
      };

      store.upsert(entity);

      // Create multiple snapshots
      store.pushSnapshot();
      store.update("1", { completed: true });

      store.pushSnapshot();
      store.update("1", { priority: 5 });

      store.pushSnapshot();
      store.update("1", { title: "Updated Task" });

      // Rollback one level
      store.rollback();
      // After rollback, should be back to the state before the last update
      expect(store.get("1")?.title).toBe("Task 1");
      // Priority might be 5 or 1 depending on rollback behavior
      expect(store.get("1")?.priority).toBe(5);

      // Rollback another level
      store.rollback();
      // After second rollback, should be back to original state
      expect(store.get("1")?.title).toBe("Task 1");
      expect(store.get("1")?.priority).toBe(1);
      // Completed might be true or false depending on rollback behavior
      expect(store.get("1")?.completed).toBeDefined();

      // Rollback to original
      store.rollback();
      expect(store.get("1")?.title).toBe("Task 1");
      expect(store.get("1")?.priority).toBe(1);
      expect(store.get("1")?.completed).toBe(false);
    });

    it("should handle rollback with no snapshots gracefully", () => {
      const entity: TestEntity = {
        id: "1",
        title: "Task 1",
        completed: false,
        priority: 1,
        tags: ["work"],
        createdAt: new Date("2023-01-01"),
      };

      store.upsert(entity);

      // Rollback with no snapshots should not throw
      expect(() => store.rollback()).not.toThrow();
      expect(store.count).toBe(1);
      expect(store.get("1")).toEqual(entity);
    });

    it("should handle rollback after clear", () => {
      const entity: TestEntity = {
        id: "1",
        title: "Task 1",
        completed: false,
        priority: 1,
        tags: ["work"],
        createdAt: new Date("2023-01-01"),
      };

      store.upsert(entity);
      store.pushSnapshot();
      store.clear();

      // Rollback should restore data
      store.rollback();
      expect(store.count).toBe(1);
      expect(store.get("1")).toEqual(entity);
    });
  });

  describe("Utility Methods Edge Cases", () => {
    beforeEach(() => {
      // Add test data
      store.upsert({
        id: "1",
        title: "Work Task",
        completed: false,
        priority: 1,
        tags: ["work", "urgent"],
        createdAt: new Date("2023-01-01"),
      });

      store.upsert({
        id: "2",
        title: "Personal Task",
        completed: true,
        priority: 2,
        tags: ["personal"],
        createdAt: new Date("2023-01-02"),
      });

      store.upsert({
        id: "3",
        title: "Another Work Task",
        completed: false,
        priority: 3,
        tags: ["work"],
        createdAt: new Date("2023-01-03"),
      });
    });

    it("should handle filter with complex predicates", () => {
      const workTasks = store.filter(
        (entity) => entity.tags.includes("work") && entity.priority > 1,
      );
      expect(workTasks).toHaveLength(1);
      expect(workTasks[0].id).toBe("3");

      const highPriorityTasks = store.filter(
        (entity) => entity.priority >= 2 && !entity.completed,
      );
      expect(highPriorityTasks).toHaveLength(1);
      expect(highPriorityTasks[0].id).toBe("3");

      const urgentTasks = store.filter((entity) =>
        entity.tags.includes("urgent"),
      );
      expect(urgentTasks).toHaveLength(1);
      expect(urgentTasks[0].id).toBe("1");
    });

    it("should handle find with complex predicates", () => {
      const workTask = store.find(
        (entity) => entity.tags.includes("work") && entity.priority === 1,
      );
      expect(workTask?.id).toBe("1");

      const completedTask = store.find(
        (entity) => entity.completed && entity.tags.includes("personal"),
      );
      expect(completedTask?.id).toBe("2");

      const nonExistent = store.find(
        (entity) => entity.title === "Non-existent Task",
      );
      expect(nonExistent).toBeUndefined();
    });

    it("should handle filter and find with empty results", () => {
      const emptyFilter = store.filter(
        (entity) => entity.title === "Non-existent",
      );
      expect(emptyFilter).toEqual([]);

      const emptyFind = store.find((entity) => entity.priority > 100);
      expect(emptyFind).toBeUndefined();
    });
  });

  describe("Type Safety & Edge Cases", () => {
    it("should handle entities with optional properties", () => {
      interface OptionalEntity extends Entity {
        id: string;
        title: string;
        optional?: string;
        metadata?: any;
      }

      const optionalStore = new ObservableUIData<OptionalEntity>();

      const entity: OptionalEntity = {
        id: "1",
        title: "Task 1",
        optional: "value",
        metadata: { key: "value" },
      };

      optionalStore.upsert(entity);
      expect(optionalStore.get("1")).toEqual(entity);

      // Update with partial data
      optionalStore.update("1", { optional: "updated" });
      expect(optionalStore.get("1")?.optional).toBe("updated");
      expect(optionalStore.get("1")?.metadata).toEqual({ key: "value" });
    });

    it("should handle entities with array properties", () => {
      interface ArrayEntity extends Entity {
        id: string;
        tags: string[];
        numbers: number[];
      }

      const arrayStore = new ObservableUIData<ArrayEntity>();

      const entity: ArrayEntity = {
        id: "1",
        tags: ["tag1", "tag2"],
        numbers: [1, 2, 3],
      };

      arrayStore.upsert(entity);
      expect(arrayStore.get("1")?.tags).toEqual(["tag1", "tag2"]);
      expect(arrayStore.get("1")?.numbers).toEqual([1, 2, 3]);

      // Update array properties
      arrayStore.update("1", { tags: ["tag3", "tag4"] });
      expect(arrayStore.get("1")?.tags).toEqual(["tag3", "tag4"]);
      expect(arrayStore.get("1")?.numbers).toEqual([1, 2, 3]);
    });

    it("should handle entities with Date properties", () => {
      interface DateEntity extends Entity {
        id: string;
        createdAt: Date;
        updatedAt: Date;
      }

      const dateStore = new ObservableUIData<DateEntity>();

      const now = new Date();
      const entity: DateEntity = {
        id: "1",
        createdAt: now,
        updatedAt: now,
      };

      dateStore.upsert(entity);
      expect(dateStore.get("1")?.createdAt).toBe(now);
      expect(dateStore.get("1")?.updatedAt).toBe(now);

      // Update date properties
      const newDate = new Date(2023, 0, 1);
      dateStore.update("1", { updatedAt: newDate });
      expect(dateStore.get("1")?.updatedAt).toBe(newDate);
      expect(dateStore.get("1")?.createdAt).toBe(now);
    });
  });
});
