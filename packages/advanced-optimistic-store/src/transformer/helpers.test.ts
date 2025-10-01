import { describe, it, expect } from "vitest";
import { createTransformer } from "./helpers";
import type { Entity, DataTransformer } from "../core/types";

// Test data types
interface TestApiData extends Entity {
  id: string;
  title: string;
}

interface TestUiData extends Entity {
  id: string;
  title: string;
}

describe("createTransformer", () => {
  it("should return undefined when transformer is false", () => {
    const result = createTransformer<TestApiData, TestUiData>(false);
    expect(result).toBeUndefined();
  });

  it("should return the custom transformer when provided", () => {
    const customTransformer: DataTransformer<TestApiData, TestUiData> = {
      toUi: (apiData) => ({
        id: apiData.id,
        title: apiData.title.toUpperCase(),
      }),
      toApi: (uiData) => ({
        id: uiData.id,
        title: uiData.title.toLowerCase(),
      }),
    };

    const result = createTransformer<TestApiData, TestUiData>(
      customTransformer,
    );

    expect(result).toBe(customTransformer);
    expect(result).toHaveProperty("toUi");
    expect(result).toHaveProperty("toApi");
  });

  it("should return default transformer when transformer is undefined", () => {
    const result = createTransformer<TestApiData, TestUiData>(undefined);

    expect(result).toBeDefined();
    expect(result).toHaveProperty("toUi");
    expect(result).toHaveProperty("toApi");

    // Test that it behaves like the default transformer
    const apiData: TestApiData = {
      id: "123",
      title: "Test",
    };

    const uiData = result!.toUi(apiData);
    expect(uiData.id).toBe("123");
    expect(uiData.title).toBe("Test");

    const backToApi = result!.toApi(uiData);
    expect(backToApi.id).toBe("123");
    expect(backToApi.title).toBe("Test");
  });

  it("should return default transformer when transformer is null", () => {
    const result = createTransformer<TestApiData, TestUiData>(null as any);

    expect(result).toBeDefined();
    expect(result).toHaveProperty("toUi");
    expect(result).toHaveProperty("toApi");
  });

  it("should work with custom transformer that has different behavior", () => {
    const customTransformer: DataTransformer<TestApiData, TestUiData> = {
      toUi: (apiData) => ({
        id: `ui-${apiData.id}`,
        title: `UI: ${apiData.title}`,
      }),
      toApi: (uiData) => ({
        id: uiData.id.replace("ui-", ""),
        title: uiData.title.replace("UI: ", ""),
      }),
    };

    const result = createTransformer<TestApiData, TestUiData>(
      customTransformer,
    );

    expect(result).toBe(customTransformer);

    // Test the custom behavior
    const apiData: TestApiData = {
      id: "123",
      title: "Test",
    };

    const uiData = result!.toUi(apiData);
    expect(uiData.id).toBe("ui-123");
    expect(uiData.title).toBe("UI: Test");

    const backToApi = result!.toApi(uiData);
    expect(backToApi.id).toBe("123");
    expect(backToApi.title).toBe("Test");
  });

  it("should handle transformer with custom methods", () => {
    // Define a simple interface for this test
    interface SimpleApiData extends Entity {
      id: string;
      title: string;
    }

    interface SimpleUiData extends Entity {
      id: string;
      title: string;
    }

    const asyncTransformer: DataTransformer<SimpleApiData, SimpleUiData> = {
      toUi: (apiData) => ({
        id: apiData.id,
        title: apiData.title.toUpperCase(),
      }),
      toApi: (uiData) => ({
        id: uiData.id,
        title: uiData.title.toLowerCase(),
      }),
    };

    const result = createTransformer<SimpleApiData, SimpleUiData>(
      asyncTransformer,
    );

    expect(result).toBe(asyncTransformer);
    expect(result).toHaveProperty("toUi");
    expect(result).toHaveProperty("toApi");
  });

  it("should handle transformer with complex transformations", () => {
    interface ComplexApiData extends Entity {
      id: string;
      user_name: string;
      created_at: string;
      is_active: string;
      tags: string;
    }

    interface ComplexUiData extends Entity {
      id: string;
      userName: string;
      createdAt: Date;
      isActive: boolean;
      tags: string[];
    }

    const complexTransformer: DataTransformer<ComplexApiData, ComplexUiData> = {
      toUi: (apiData) => ({
        id: apiData.id,
        userName: apiData.user_name
          .replace(/_/g, " ")
          .replace(/\b\w/g, (l) => l.toUpperCase()),
        createdAt: new Date(apiData.created_at),
        isActive: apiData.is_active === "true",
        tags: apiData.tags.split(",").map((tag) => tag.trim()),
      }),
      toApi: (uiData) => ({
        id: uiData.id,
        user_name: uiData.userName.toLowerCase().replace(/\s+/g, "_"),
        created_at: uiData.createdAt.toISOString(),
        is_active: uiData.isActive.toString(),
        tags: uiData.tags.join(","),
      }),
    };

    const result = createTransformer<ComplexApiData, ComplexUiData>(
      complexTransformer,
    );

    expect(result).toBe(complexTransformer);

    // Test the complex transformation
    const apiData: ComplexApiData = {
      id: "123",
      user_name: "john_doe",
      created_at: "2023-01-01T00:00:00.000Z",
      is_active: "true",
      tags: "admin,user,premium",
    };

    const uiData = result!.toUi(apiData);
    expect(uiData.id).toBe("123");
    expect(uiData.userName).toBe("John Doe");
    expect(uiData.createdAt).toBeInstanceOf(Date);
    expect(uiData.isActive).toBe(true);
    expect(uiData.tags).toEqual(["admin", "user", "premium"]);

    const backToApi = result!.toApi(uiData);
    expect(backToApi.id).toBe("123");
    expect(backToApi.user_name).toBe("john_doe");
    expect(backToApi.created_at).toBe("2023-01-01T00:00:00.000Z");
    expect(backToApi.is_active).toBe("true");
    expect(backToApi.tags).toBe("admin,user,premium");
  });

  it("should handle edge cases with falsy values", () => {
    // Test with empty string (falsy but not false)
    const result1 = createTransformer<TestApiData, TestUiData>("" as any);
    expect(result1).toBeDefined();
    expect(result1).toHaveProperty("toUi");
    expect(result1).toHaveProperty("toApi");

    // Test with 0 (falsy but not false)
    const result2 = createTransformer<TestApiData, TestUiData>(0 as any);
    expect(result2).toBeDefined();
    expect(result2).toHaveProperty("toUi");
    expect(result2).toHaveProperty("toApi");
  });

  it("should maintain reference equality for custom transformers", () => {
    const customTransformer: DataTransformer<TestApiData, TestUiData> = {
      toUi: (apiData) => apiData as any,
      toApi: (uiData) => uiData as any,
    };

    const result1 = createTransformer<TestApiData, TestUiData>(
      customTransformer,
    );
    const result2 = createTransformer<TestApiData, TestUiData>(
      customTransformer,
    );

    expect(result1).toBe(customTransformer);
    expect(result2).toBe(customTransformer);
    expect(result1).toBe(result2);
  });

  it("should create new default transformer instances", () => {
    const result1 = createTransformer<TestApiData, TestUiData>(undefined);
    const result2 = createTransformer<TestApiData, TestUiData>(undefined);

    // Should be different instances but functionally equivalent
    expect(result1).not.toBe(result2);
    expect(result1).toBeDefined();
    expect(result2).toBeDefined();

    // Test that they behave the same
    const apiData: TestApiData = { id: "123", title: "Test" };
    const uiData1 = result1!.toUi(apiData);
    const uiData2 = result2!.toUi(apiData);

    expect(uiData1).toEqual(uiData2);
  });
});
