import { describe, it, expect } from "vitest";
import { createDefaultTransformer, createTransformer } from "../../src/transformer/index";
import type { Entity, DataTransformer } from "../core/types";

// Test data types
interface TodoApiData extends Entity {
  id: string;
  title: string;
  description: string;
  completed: string;
  created_at: string;
  updated_at: string;
  priority: string;
  tags: string;
  user_id: string;
}

interface TodoUiData extends Entity {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  created_at: Date; // Field names stay the same in default transformer
  updated_at: Date;
  priority: number;
  tags: string[];
  user_id: string;
}

describe("Transformer Module Integration", () => {
  describe("createDefaultTransformer", () => {
    it("should be exported and work correctly", () => {
      const transformer = createDefaultTransformer<TodoApiData, TodoUiData>();

      expect(transformer).toBeDefined();
      expect(transformer).toHaveProperty("toUi");
      expect(transformer).toHaveProperty("toApi");

      // Test basic functionality
      const apiData: TodoApiData = {
        id: "123",
        title: "Test Todo",
        description: "A test todo item",
        completed: "true",
        created_at: "2023-01-01T00:00:00.000Z",
        updated_at: "2023-01-02T00:00:00.000Z",
        priority: "5",
        tags: "work,urgent,important",
        user_id: "user-456",
      };

      const uiData = transformer.toUi(apiData);
      expect(uiData.id).toBe("123");
      expect(uiData.title).toBe("Test Todo");
      expect(uiData.completed).toBe(true);
      expect(uiData.created_at).toBeInstanceOf(Date); // Field name stays the same
      expect(uiData.priority).toBe(5);
      expect(uiData.tags).toEqual(["work", "urgent", "important"]);
    });
  });

  describe("createTransformer", () => {
    it("should be exported and work correctly", () => {
      const transformer = createTransformer<TodoApiData, TodoUiData>(undefined);

      expect(transformer).toBeDefined();
      expect(transformer).toHaveProperty("toUi");
      expect(transformer).toHaveProperty("toApi");
    });

    it("should work with custom transformer", () => {
      const customTransformer: DataTransformer<TodoApiData, TodoUiData> = {
        toUi: (apiData) => ({
          id: apiData.id,
          title: apiData.title.toUpperCase(),
          description: apiData.description,
          completed: apiData.completed === "true",
          created_at: new Date(apiData.created_at),
          updated_at: new Date(apiData.updated_at),
          priority: parseInt(apiData.priority),
          tags: apiData.tags.split(",").map((tag) => tag.trim()),
          user_id: apiData.user_id,
        }),
        toApi: (uiData) => ({
          id: uiData.id,
          title: uiData.title.toLowerCase(),
          description: uiData.description,
          completed: uiData.completed.toString(),
          created_at: uiData.created_at.toISOString(),
          updated_at: uiData.updated_at.toISOString(),
          priority: uiData.priority.toString(),
          tags: uiData.tags.join(","),
          user_id: uiData.user_id,
        }),
      };

      const transformer = createTransformer<TodoApiData, TodoUiData>(
        customTransformer,
      );

      expect(transformer).toBe(customTransformer);

      const apiData: TodoApiData = {
        id: "123",
        title: "Test Todo",
        description: "A test todo item",
        completed: "true",
        created_at: "2023-01-01T00:00:00.000Z",
        updated_at: "2023-01-02T00:00:00.000Z",
        priority: "5",
        tags: "work,urgent,important",
        user_id: "user-456",
      };

      const uiData = transformer!.toUi(apiData);
      expect(uiData.title).toBe("TEST TODO"); // Custom transformation
      expect(uiData.completed).toBe(true);
      expect(uiData.tags).toEqual(["work", "urgent", "important"]);
    });

    it("should return undefined when transformer is false", () => {
      const transformer = createTransformer<TodoApiData, TodoUiData>(false);
      expect(transformer).toBeUndefined();
    });
  });

  describe("Real-world scenarios", () => {
    it("should handle a complete todo CRUD workflow", () => {
      const transformer = createDefaultTransformer<TodoApiData, TodoUiData>();

      // 1. Create - API data from server
      const createApiData: TodoApiData = {
        id: "new-todo-123",
        title: "Learn TypeScript",
        description: "Complete the TypeScript tutorial",
        completed: "false",
        created_at: "2023-01-01T10:00:00.000Z",
        updated_at: "2023-01-01T10:00:00.000Z",
        priority: "3",
        tags: "learning,programming,typescript",
        user_id: "user-456",
      };

      // 2. Convert to UI data
      const uiData = transformer.toUi(createApiData);
      expect(uiData.completed).toBe(false);
      expect(uiData.created_at).toBeInstanceOf(Date);
      expect(uiData.priority).toBe(3);
      expect(uiData.tags).toEqual(["learning", "programming", "typescript"]);

      // 3. User updates in UI
      const updatedUiData: TodoUiData = {
        ...uiData,
        completed: true,
        priority: 5,
        tags: [...uiData.tags, "completed"],
        updated_at: new Date("2023-01-02T15:30:00.000Z"),
      };

      // 4. Convert back to API format for update
      const updateApiData = transformer.toApi(updatedUiData);
      expect(updateApiData.completed).toBe("true");
      expect(updateApiData.priority).toBe(5);
      expect(updateApiData.tags).toBe(
        "learning,programming,typescript,completed",
      );
      expect(updateApiData.updated_at).toBe("2023-01-02T15:30:00.000Z");
    });

    it("should handle batch operations", () => {
      const transformer = createDefaultTransformer<TodoApiData, TodoUiData>();

      const apiTodos: TodoApiData[] = [
        {
          id: "1",
          title: "Todo 1",
          description: "First todo",
          completed: "true",
          created_at: "2023-01-01T00:00:00.000Z",
          updated_at: "2023-01-01T00:00:00.000Z",
          priority: "1",
          tags: "urgent",
          user_id: "user-1",
        },
        {
          id: "2",
          title: "Todo 2",
          description: "Second todo",
          completed: "false",
          created_at: "2023-01-02T00:00:00.000Z",
          updated_at: "2023-01-02T00:00:00.000Z",
          priority: "3",
          tags: "work,important",
          user_id: "user-1",
        },
      ];

      // Convert all to UI format
      const uiTodos = apiTodos.map((todo) => transformer.toUi(todo));

      expect(uiTodos).toHaveLength(2);
      expect(uiTodos[0].completed).toBe(true);
      expect(uiTodos[0].priority).toBe(1);
      expect(uiTodos[0].tags).toBe("urgent"); // Single item doesn't get converted to array
      expect(uiTodos[1].completed).toBe(false);
      expect(uiTodos[1].priority).toBe(3);
      expect(uiTodos[1].tags).toEqual(["work", "important"]);

      // Convert all back to API format
      const backToApiTodos = uiTodos.map((todo) => transformer.toApi(todo));

      expect(backToApiTodos).toHaveLength(2);
      expect(backToApiTodos[0].completed).toBe("true");
      expect(backToApiTodos[0].priority).toBe(1);
      expect(backToApiTodos[0].tags).toBe("urgent");
      expect(backToApiTodos[1].completed).toBe("false");
      expect(backToApiTodos[1].priority).toBe(3);
      expect(backToApiTodos[1].tags).toBe("work,important");
    });

    it("should handle optimistic updates", () => {
      const transformer = createDefaultTransformer<TodoApiData, TodoUiData>();

      // Original server data
      const serverData: TodoApiData = {
        id: "123",
        title: "Original Todo",
        description: "Original description",
        completed: "false",
        created_at: "2023-01-01T00:00:00.000Z",
        updated_at: "2023-01-01T00:00:00.000Z",
        priority: "1",
        tags: "original",
        user_id: "user-1",
      };

      // Convert to UI
      const uiData = transformer.toUi(serverData);

      // Apply optimistic update (user marks as completed)
      const optimisticUpdateTime = new Date("2023-01-02T15:30:00.000Z");
      const optimisticUiData: TodoUiData = {
        ...uiData,
        completed: true,
        title: "Original Todo (Completed)",
        updated_at: optimisticUpdateTime,
      };

      // Convert back to API format for the mutation
      const optimisticApiData = transformer.toApi(optimisticUiData);

      expect(optimisticApiData.completed).toBe("true");
      expect(optimisticApiData.title).toBe("Original Todo (Completed)");
      expect(optimisticApiData.updated_at).toBe(
        optimisticUpdateTime.toISOString(),
      );

      // Later: Server responds with actual data
      const serverResponse: TodoApiData = {
        ...serverData,
        completed: "true",
        title: "Original Todo (Completed)",
        updated_at: "2023-01-02T12:00:00.000Z", // Server timestamp
      };

      // Convert server response to UI
      const finalUiData = transformer.toUi(serverResponse);

      expect(finalUiData.completed).toBe(true);
      expect(finalUiData.title).toBe("Original Todo (Completed)");
      expect(finalUiData.updated_at).toBeInstanceOf(Date);
      expect(finalUiData.updated_at.getTime()).toBe(
        new Date("2023-01-02T12:00:00.000Z").getTime(),
      );
    });
  });

  describe("Type safety", () => {
    it("should maintain type safety with generic parameters", () => {
      interface CustomApiData extends Entity {
        id: string;
        custom_field: string;
      }

      interface CustomUiData extends Entity {
        id: string;
        custom_field: string; // Default transformer preserves field names
      }

      const transformer = createDefaultTransformer<
        CustomApiData,
        CustomUiData
      >();

      const apiData: CustomApiData = {
        id: "123",
        custom_field: "test",
      };

      const uiData = transformer.toUi(apiData);

      // TypeScript should infer the correct types
      expect(uiData.id).toBe("123");
      expect(uiData.custom_field).toBe("test"); // Default transformer preserves field names as-is
    });

    it("should work with minimal Entity interface", () => {
      interface MinimalApiData extends Entity {
        id: string;
      }

      interface MinimalUiData extends Entity {
        id: string;
      }

      const transformer = createDefaultTransformer<
        MinimalApiData,
        MinimalUiData
      >();

      const apiData: MinimalApiData = { id: "123" };
      const uiData = transformer.toUi(apiData);
      const backToApi = transformer.toApi(uiData);

      expect(uiData.id).toBe("123");
      expect(backToApi.id).toBe("123");
    });
  });
});
