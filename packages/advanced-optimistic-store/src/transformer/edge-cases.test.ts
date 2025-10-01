import { describe, it, expect, vi } from "vitest";
import { createDefaultTransformer, createTransformer } from "./index";
import type { Entity, DataTransformer } from "../core/types";

// Test data types
interface TestApiData extends Entity {
  id: string;
  title: string;
  completed: string;
  priority: string;
  created_at: string;
  tags: string;
  metadata?: any;
}

interface TestUiData extends Entity {
  id: string;
  title: string;
  completed: boolean;
  priority: number;
  created_at: Date;
  tags: string[];
  metadata?: any;
}

describe("Transformer Edge Cases", () => {
  describe("Error Handling", () => {
    it("should handle transformer errors gracefully", () => {
      const errorTransformer: DataTransformer<TestApiData, TestUiData> = {
        toUi: vi.fn().mockImplementation(() => {
          throw new Error("Transformer error");
        }),
        toApi: vi.fn().mockImplementation(() => {
          throw new Error("Transformer error");
        }),
      };

      const transformer = createTransformer<TestApiData, TestUiData>(
        errorTransformer,
      );
      expect(transformer).toBe(errorTransformer);

      // Should not throw during creation
      expect(() => transformer).not.toThrow();
    });

    it("should handle partial transformer errors", () => {
      const partialErrorTransformer: DataTransformer<TestApiData, TestUiData> =
        {
          toUi: vi.fn().mockImplementation((data) => {
            if (data.id === "error") {
              throw new Error("UI transformation error");
            }
            return {
              id: data.id,
              title: data.title,
              completed: data.completed === "true",
              priority: parseInt(data.priority),
              created_at: new Date(data.created_at),
              tags: data.tags.split(","),
              metadata: data.metadata,
            };
          }),
          toApi: vi.fn().mockImplementation((data) => {
            if (data.title === "error") {
              throw new Error("API transformation error");
            }
            return {
              id: data.id,
              title: data.title,
              completed: data.completed.toString(),
              priority: data.priority.toString(),
              created_at: data.created_at.toISOString(),
              tags: data.tags.join(","),
              metadata: data.metadata,
            };
          }),
        };

      const transformer = createTransformer<TestApiData, TestUiData>(
        partialErrorTransformer,
      );

      // Valid data should work
      const validApiData: TestApiData = {
        id: "1",
        title: "Valid Task",
        completed: "true",
        priority: "1",
        created_at: "2023-01-01T00:00:00.000Z",
        tags: "work,urgent",
      };

      expect(() => transformer!.toUi(validApiData)).not.toThrow();

      // Invalid data should throw
      const invalidApiData: TestApiData = {
        id: "error",
        title: "Error Task",
        completed: "true",
        priority: "1",
        created_at: "2023-01-01T00:00:00.000Z",
        tags: "work,urgent",
      };

      expect(() => transformer!.toUi(invalidApiData)).toThrow(
        "UI transformation error",
      );
    });
  });

  describe("Malformed Data Handling", () => {
    it("should handle malformed API data", () => {
      const transformer = createDefaultTransformer<TestApiData, TestUiData>();

      const malformedData = {
        id: "1",
        title: "Task",
        completed: "invalid", // Not "true" or "false"
        priority: "not-a-number",
        created_at: "invalid-date",
        tags: "work,urgent",
      } as any;

      // Should not throw
      expect(() => transformer.toUi(malformedData)).not.toThrow();

      const result = transformer.toUi(malformedData);
      expect(result.completed).toBe("invalid"); // Should preserve as-is
      expect(result.priority).toBe("not-a-number"); // Should preserve as-is
      expect(result.created_at).toBe("invalid-date"); // Should preserve as-is
    });

    it("should handle missing required fields", () => {
      const transformer = createDefaultTransformer<TestApiData, TestUiData>();

      const incompleteData = {
        id: "1",
        // Missing other required fields
      } as any;

      // Should not throw
      expect(() => transformer.toUi(incompleteData)).not.toThrow();

      const result = transformer.toUi(incompleteData);
      expect(result.id).toBe("1");
      expect(result.title).toBeUndefined();
    });

    it("should handle null and undefined values", () => {
      const transformer = createDefaultTransformer<TestApiData, TestUiData>();

      const dataWithNulls = {
        id: "1",
        title: null,
        completed: undefined,
        priority: "1",
        created_at: "2023-01-01T00:00:00.000Z",
        tags: "work,urgent",
      } as any;

      // Should not throw
      expect(() => transformer.toUi(dataWithNulls)).not.toThrow();

      const result = transformer.toUi(dataWithNulls);
      expect(result.title).toBe(null);
      expect(result.completed).toBe(undefined);
    });
  });

  describe("Performance & Memory", () => {
    it("should handle large datasets efficiently", () => {
      const transformer = createDefaultTransformer<TestApiData, TestUiData>();

      const startTime = performance.now();

      // Process 1000 items
      for (let i = 0; i < 1000; i++) {
        const apiData: TestApiData = {
          id: `task-${i}`,
          title: `Task ${i}`,
          completed: i % 2 === 0 ? "true" : "false",
          priority: ((i % 5) + 1).toString(),
          created_at: new Date(2023, 0, 1 + i).toISOString(),
          tags: `tag-${i % 10},category-${i % 3}`,
        };

        const uiData = transformer.toUi(apiData);
        const backToApi = transformer.toApi(uiData);

        expect(uiData.id).toBe(`task-${i}`);
        expect(backToApi.id).toBe(`task-${i}`);
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Should complete in reasonable time (less than 100ms)
      expect(duration).toBeLessThan(100);
    });

    it("should handle memory efficiently", () => {
      const transformer = createDefaultTransformer<TestApiData, TestUiData>();

      const initialMemory = process.memoryUsage().heapUsed;

      // Process 10000 items
      for (let i = 0; i < 10000; i++) {
        const apiData: TestApiData = {
          id: `task-${i}`,
          title: `Task ${i}`,
          completed: i % 2 === 0 ? "true" : "false",
          priority: ((i % 5) + 1).toString(),
          created_at: new Date(2023, 0, 1 + i).toISOString(),
          tags: `tag-${i % 10},category-${i % 3}`,
          metadata: { index: i, category: `cat-${i % 5}` },
        };

        transformer.toUi(apiData);
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // Memory increase should be reasonable (less than 2MB)
      expect(memoryIncrease).toBeLessThan(2 * 1024 * 1024);
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty strings", () => {
      const transformer = createDefaultTransformer<TestApiData, TestUiData>();

      const dataWithEmptyStrings = {
        id: "",
        title: "",
        completed: "",
        priority: "",
        created_at: "",
        tags: "",
      } as any;

      const result = transformer.toUi(dataWithEmptyStrings);
      expect(result.id).toBe("");
      expect(result.title).toBe("");
      expect(result.completed).toBe("");
      expect(result.priority).toBe("");
      expect(result.tags).toBe("");
    });

    it("should handle special characters", () => {
      const transformer = createDefaultTransformer<TestApiData, TestUiData>();

      const dataWithSpecialChars = {
        id: "task-1",
        title: "Task with special chars: !@#$%^&*()",
        completed: "true",
        priority: "1",
        created_at: "2023-01-01T00:00:00.000Z",
        tags: "work,urgent,special-chars",
      };

      const result = transformer.toUi(dataWithSpecialChars);
      expect(result.title).toBe("Task with special chars: !@#$%^&*()");
      expect(result.tags).toEqual(["work", "urgent", "special-chars"]);
    });

    it("should handle very long strings", () => {
      const transformer = createDefaultTransformer<TestApiData, TestUiData>();

      const longString = "a".repeat(10000);
      const dataWithLongString = {
        id: "task-1",
        title: longString,
        completed: "true",
        priority: "1",
        created_at: "2023-01-01T00:00:00.000Z",
        tags: "work,urgent",
      };

      const result = transformer.toUi(dataWithLongString);
      expect(result.title).toBe(longString);
    });

    it("should handle circular references", () => {
      const transformer = createDefaultTransformer<TestApiData, TestUiData>();

      const circularData: any = {
        id: "task-1",
        title: "Task with circular reference",
        completed: "true",
        priority: "1",
        created_at: "2023-01-01T00:00:00.000Z",
        tags: "work,urgent",
        metadata: {},
      };

      // Create circular reference
      circularData.metadata.self = circularData;

      // Should not throw
      expect(() => transformer.toUi(circularData)).not.toThrow();

      const result = transformer.toUi(circularData);
      expect(result.metadata).toBeDefined();
    });
  });
});
