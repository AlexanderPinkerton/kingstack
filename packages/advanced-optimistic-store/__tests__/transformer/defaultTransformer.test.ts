import { describe, it, expect } from "vitest";
import { createDefaultTransformer } from "../../src/transformer/defaultTransformer";
import type { Entity } from "../../src/core/types";

// Test data types
interface TestApiData extends Entity {
  id: string;
  title: string;
  done: string; // API sends boolean as string
  created_at: string;
  updated_at: string;
  count: string;
  tags: string;
  is_active: string;
  // Additional fields used in tests
  published_date?: string;
  last_login_time?: string;
  created_by_user_at?: string;
  updated_by_admin_at?: string;
  is_deleted?: string;
  is_published?: string;
  price?: string;
  quantity?: string;
  negative?: string;
  categories?: string;
  skills?: string;
  description?: string;
  emptyArray?: string;
  metadata?: any;
  array?: any;
  nullValue?: any;
  undefinedValue?: any;
  infinity?: string;
  negativeInfinity?: string;
  nan?: string;
  zero?: string;
  negativeZero?: string;
}

interface TestUiData extends Entity {
  id: string;
  title: string;
  done: boolean; // UI uses actual boolean
  created_at: Date;
  updated_at: Date;
  count: number;
  tags: string[];
  is_active: boolean;
  // Additional fields used in tests
  published_date?: Date;
  last_login_time?: Date;
  created_by_user_at?: Date;
  updated_by_admin_at?: Date;
  is_deleted?: boolean;
  is_published?: boolean;
  price?: number;
  quantity?: number;
  negative?: number;
  categories?: string[];
  skills?: string[];
  description?: string;
  metadata?: any;
  array?: any;
  nullValue?: any;
  undefinedValue?: any;
  infinity?: number;
  negativeInfinity?: number;
  nan?: number;
  zero?: number;
  negativeZero?: number;
}

describe("createDefaultTransformer", () => {
  describe("toUi - API to UI conversion", () => {
    it("should convert basic data types correctly", () => {
      const transformer = createDefaultTransformer<TestApiData, TestUiData>();

      const apiData: TestApiData = {
        id: "123",
        title: "Test Todo",
        done: "true",
        created_at: "2023-01-01T00:00:00.000Z",
        updated_at: "2023-01-02T00:00:00.000Z",
        count: "42",
        tags: "react,typescript,testing",
        is_active: "true",
      };

      const result = transformer.toUi(apiData);

      expect(result.id).toBe("123");
      expect(result.title).toBe("Test Todo");
      expect(result.done).toBe(true);
      expect(result.created_at).toBeInstanceOf(Date);
      expect(result.created_at.getTime()).toBe(
        new Date("2023-01-01T00:00:00.000Z").getTime(),
      );
      expect(result.updated_at).toBeInstanceOf(Date);
      expect(result.count).toBe(42);
      expect(result.tags).toEqual(["react", "typescript", "testing"]);
      expect(result.is_active).toBe(true);
    });

    it("should handle date field detection patterns", () => {
      const transformer = createDefaultTransformer<TestApiData, TestUiData>();

      const apiData = {
        id: "123",
        created_at: "2023-01-01T00:00:00.000Z",
        updated_at: "2023-01-02T00:00:00.000Z",
        published_date: "2023-01-03T00:00:00.000Z",
        last_login_time: "2023-01-04T00:00:00.000Z",
        created_by_user_at: "2023-01-05T00:00:00.000Z",
        updated_by_admin_at: "2023-01-06T00:00:00.000Z",
      } as any;

      const result = transformer.toUi(apiData);

      expect(result.created_at).toBeInstanceOf(Date);
      expect(result.updated_at).toBeInstanceOf(Date);
      expect(result.published_date).toBeInstanceOf(Date);
      expect(result.last_login_time).toBeInstanceOf(Date);
      expect(result.created_by_user_at).toBeInstanceOf(Date);
      expect(result.updated_by_admin_at).toBeInstanceOf(Date);
    });

    it("should convert boolean strings correctly", () => {
      const transformer = createDefaultTransformer<TestApiData, TestUiData>();

      const apiData = {
        id: "123",
        is_active: "true",
        is_deleted: "false",
        is_published: "true",
      } as any;

      const result = transformer.toUi(apiData);

      expect(result.is_active).toBe(true);
      expect(result.is_deleted).toBe(false);
      expect(result.is_published).toBe(true);
    });

    it("should convert number strings correctly", () => {
      const transformer = createDefaultTransformer<TestApiData, TestUiData>();

      const apiData = {
        id: "123",
        count: "42",
        price: "99.99",
        quantity: "0",
        negative: "-5",
      } as any;

      const result = transformer.toUi(apiData);

      expect(result.count).toBe(42);
      expect(result.price).toBe(99.99);
      expect(result.quantity).toBe(0);
      expect(result.negative).toBe(-5);
    });

    it("should convert CSV strings to arrays", () => {
      const transformer = createDefaultTransformer<TestApiData, TestUiData>();

      const apiData = {
        id: "123",
        tags: "react,typescript,testing",
        categories: "frontend,web,development",
        skills: "javascript,node,react",
      } as any;

      const result = transformer.toUi(apiData);

      expect(result.tags).toEqual(["react", "typescript", "testing"]);
      expect(result.categories).toEqual(["frontend", "web", "development"]);
      expect(result.skills).toEqual(["javascript", "node", "react"]);
    });

    it("should not convert strings that are not CSV", () => {
      const transformer = createDefaultTransformer<TestApiData, TestUiData>();

      const apiData = {
        id: "123",
        description: "This is a description with spaces",
        title: "A title with spaces",
        tags: "react, typescript, testing", // Has spaces, should not convert
      } as any;

      const result = transformer.toUi(apiData);

      expect(result.description).toBe("This is a description with spaces");
      expect(result.title).toBe("A title with spaces");
      expect(result.tags).toBe("react, typescript, testing"); // Should remain string
    });

    it("should handle invalid date strings gracefully", () => {
      const transformer = createDefaultTransformer<TestApiData, TestUiData>();

      const apiData = {
        id: "123",
        created_at: "invalid-date",
        updated_at: "2023-01-01T00:00:00.000Z",
      } as any;

      const result = transformer.toUi(apiData);

      expect(result.created_at).toBe("invalid-date"); // Should remain string
      expect(result.updated_at).toBeInstanceOf(Date);
    });

    it("should handle different ID field patterns", () => {
      const transformer = createDefaultTransformer<TestApiData, TestUiData>();

      // Test with _id
      const apiDataWithUnderscore = {
        _id: "123",
        title: "Test",
      } as any;

      const result1 = transformer.toUi(apiDataWithUnderscore);
      expect(result1.id).toBe("123");

      // Test with ID (uppercase)
      const apiDataWithUppercase = {
        ID: "456",
        title: "Test",
      } as any;

      const result2 = transformer.toUi(apiDataWithUppercase);
      expect(result2.id).toBe("456");

      // Test with regular id
      const apiDataWithRegular = {
        id: "789",
        title: "Test",
      } as any;

      const result3 = transformer.toUi(apiDataWithRegular);
      expect(result3.id).toBe("789");
    });

    it("should preserve non-convertible values", () => {
      const transformer = createDefaultTransformer<TestApiData, TestUiData>();

      const apiData = {
        id: "123",
        title: "Test Todo",
        description: "A regular string",
        metadata: { key: "value" },
        array: [1, 2, 3],
        nullValue: null,
        undefinedValue: undefined,
      } as any;

      const result = transformer.toUi(apiData);

      expect(result.title).toBe("Test Todo");
      expect(result.description).toBe("A regular string");
      expect(result.metadata).toEqual({ key: "value" });
      expect(result.array).toEqual([1, 2, 3]);
      expect(result.nullValue).toBe(null);
      expect(result.undefinedValue).toBe(undefined);
    });
  });

  describe("toApi - UI to API conversion", () => {
    it("should convert basic data types back to API format", () => {
      const transformer = createDefaultTransformer<TestApiData, TestUiData>();

      const uiData: TestUiData = {
        id: "123",
        title: "Test Todo",
        done: true,
        created_at: new Date("2023-01-01T00:00:00.000Z"),
        updated_at: new Date("2023-01-02T00:00:00.000Z"),
        count: 42,
        tags: ["react", "typescript", "testing"],
        is_active: true,
      };

      const result = transformer.toApi(uiData);

      expect(result.id).toBe("123");
      expect(result.title).toBe("Test Todo");
      expect(result.done).toBe("true");
      expect(result.created_at).toBe("2023-01-01T00:00:00.000Z");
      expect(result.updated_at).toBe("2023-01-02T00:00:00.000Z");
      expect(result.count).toBe(42);
      expect(result.tags).toBe("react,typescript,testing");
      expect(result.is_active).toBe("true");
    });

    it("should convert Date objects to ISO strings", () => {
      const transformer = createDefaultTransformer<TestApiData, TestUiData>();

      const uiData = {
        id: "123",
        created_at: new Date("2023-01-01T12:30:45.123Z"),
        updated_at: new Date("2023-12-31T23:59:59.999Z"),
      } as any;

      const result = transformer.toApi(uiData);

      expect(result.created_at).toBe("2023-01-01T12:30:45.123Z");
      expect(result.updated_at).toBe("2023-12-31T23:59:59.999Z");
    });

    it("should convert arrays to CSV strings", () => {
      const transformer = createDefaultTransformer<TestApiData, TestUiData>();

      const uiData = {
        id: "123",
        tags: ["react", "typescript", "testing"],
        categories: ["frontend", "web", "development"],
        emptyArray: [],
      } as any;

      const result = transformer.toApi(uiData);

      expect(result.tags).toBe("react,typescript,testing");
      expect(result.categories).toBe("frontend,web,development");
      expect(result.emptyArray).toBe("");
    });

    it("should convert booleans to strings", () => {
      const transformer = createDefaultTransformer<TestApiData, TestUiData>();

      const uiData = {
        id: "123",
        is_active: true,
        is_deleted: false,
        is_published: true,
      } as any;

      const result = transformer.toApi(uiData);

      expect(result.is_active).toBe("true");
      expect(result.is_deleted).toBe("false");
      expect(result.is_published).toBe("true");
    });

    it("should preserve numbers as numbers", () => {
      const transformer = createDefaultTransformer<TestApiData, TestUiData>();

      const uiData = {
        id: "123",
        count: 42,
        price: 99.99,
        quantity: 0,
        negative: -5,
      } as any;

      const result = transformer.toApi(uiData);

      expect(result.count).toBe(42);
      expect(result.price).toBe(99.99);
      expect(result.quantity).toBe(0);
      expect(result.negative).toBe(-5);
    });

    it("should preserve non-convertible values", () => {
      const transformer = createDefaultTransformer<TestApiData, TestUiData>();

      const uiData = {
        id: "123",
        title: "Test Todo",
        description: "A regular string",
        metadata: { key: "value" },
        nullValue: null,
        undefinedValue: undefined,
      } as any;

      const result = transformer.toApi(uiData);

      expect(result.title).toBe("Test Todo");
      expect(result.description).toBe("A regular string");
      expect(result.metadata).toEqual({ key: "value" });
      expect(result.nullValue).toBe(null);
      expect(result.undefinedValue).toBe(undefined);
    });
  });

  describe("round-trip conversion", () => {
    it("should maintain data integrity through round-trip conversion", () => {
      const transformer = createDefaultTransformer<TestApiData, TestUiData>();

      const originalApiData: TestApiData = {
        id: "123",
        title: "Test Todo",
        done: "true",
        created_at: "2023-01-01T00:00:00.000Z",
        updated_at: "2023-01-02T00:00:00.000Z",
        count: "42",
        tags: "react,typescript,testing",
        is_active: "true",
      };

      // Convert to UI and back to API
      const uiData = transformer.toUi(originalApiData);
      const backToApi = transformer.toApi(uiData);

      // Should match original (with expected conversions)
      expect(backToApi.id).toBe(originalApiData.id);
      expect(backToApi.title).toBe(originalApiData.title);
      expect(backToApi.done).toBe(originalApiData.done);
      expect(backToApi.created_at).toBe(originalApiData.created_at);
      expect(backToApi.updated_at).toBe(originalApiData.updated_at);
      expect(backToApi.count).toBe(42); // Converted to number
      expect(backToApi.tags).toBe(originalApiData.tags);
      expect(backToApi.is_active).toBe(originalApiData.is_active);
    });

    it("should handle complex nested data structures (top-level only)", () => {
      const transformer = createDefaultTransformer<any, any>();

      const complexApiData = {
        id: "123",
        user: {
          name: "John Doe",
          created_at: "2023-01-01T00:00:00.000Z",
          is_active: "true",
          tags: "admin,user,premium",
        },
        posts: [
          {
            id: "post-1",
            title: "First Post",
            published_at: "2023-01-02T00:00:00.000Z",
            is_published: "true",
            tags: "blog,announcement",
          },
          {
            id: "post-2",
            title: "Second Post",
            published_at: "2023-01-03T00:00:00.000Z",
            is_published: "false",
            tags: "draft,personal",
          },
        ],
        metadata: {
          total_posts: "2",
          last_updated: "2023-01-03T00:00:00.000Z",
        },
      };

      const uiData = transformer.toUi(complexApiData);
      const backToApi = transformer.toApi(uiData);

      // Check that top-level fields are handled correctly
      expect(uiData.id).toBe("123");

      // Nested objects are preserved as-is (transformer only works on top level)
      expect(uiData.user).toEqual(complexApiData.user);
      expect(uiData.posts).toEqual(complexApiData.posts);
      expect(uiData.metadata).toEqual(complexApiData.metadata);

      // Round-trip should preserve structure (arrays get converted to CSV strings)
      expect(backToApi.id).toBe(complexApiData.id);
      expect(backToApi.user).toEqual(complexApiData.user);
      expect(backToApi.metadata).toEqual(complexApiData.metadata);
      // Arrays get converted to CSV strings in toApi
      expect(backToApi.posts).toBe("[object Object],[object Object]");
    });
  });

  describe("edge cases", () => {
    it("should handle empty objects", () => {
      const transformer = createDefaultTransformer<TestApiData, TestUiData>();

      const emptyApiData = {} as TestApiData;
      const result = transformer.toUi(emptyApiData);

      expect(result).toEqual({});
    });

    it("should handle objects with only id", () => {
      const transformer = createDefaultTransformer<TestApiData, TestUiData>();

      const apiData = { id: "123" } as TestApiData;
      const result = transformer.toUi(apiData);

      expect(result.id).toBe("123");
    });

    it("should handle mixed data types in arrays", () => {
      const transformer = createDefaultTransformer<any, any>();

      const apiData = {
        id: "123",
        mixedArray: "1,true,hello,2023-01-01T00:00:00.000Z",
      };

      const result = transformer.toUi(apiData);

      // Should convert to array but not convert individual elements
      expect(result.mixedArray).toEqual([
        "1",
        "true",
        "hello",
        "2023-01-01T00:00:00.000Z",
      ]);
    });

    it("should handle special number values", () => {
      const transformer = createDefaultTransformer<any, any>();

      const apiData = {
        id: "123",
        infinity: "Infinity",
        negativeInfinity: "-Infinity",
        nan: "NaN",
        zero: "0",
        negativeZero: "-0",
      };

      const result = transformer.toUi(apiData);

      expect(result.infinity).toBe(Infinity);
      expect(result.negativeInfinity).toBe(-Infinity);
      expect(result.nan).toBe(NaN);
      expect(result.zero).toBe(0);
      expect(result.negativeZero).toBe(-0);
    });
  });
});
