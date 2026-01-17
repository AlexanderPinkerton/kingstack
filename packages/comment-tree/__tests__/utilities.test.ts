import { describe, it, expect } from "vitest";
import {
  flattenComments,
  removeCollapsedChildren,
  findComment,
  setCommentProperty,
  getReplyCount,
  getDepthColor,
  buildCommentTree,
  removeComment,
  getAncestorIds,
  getDescendantIds,
} from "../src/utilities";
import type { CommentItems, CommentData } from "../src/types";

// ============================================================================
// Test Data
// ============================================================================

interface TestComment extends CommentData {
  id: string;
  content: string;
  author: string;
}

const createSampleComments = (): CommentItems<TestComment> => [
  {
    id: "1",
    data: { id: "1", content: "First comment", author: "alice" },
    children: [
      {
        id: "1-1",
        data: { id: "1-1", content: "Reply to first", author: "bob" },
        children: [
          {
            id: "1-1-1",
            data: { id: "1-1-1", content: "Nested reply", author: "charlie" },
            children: [],
          },
          {
            id: "1-1-2",
            data: { id: "1-1-2", content: "Another nested", author: "dave" },
            children: [],
          },
        ],
      },
      {
        id: "1-2",
        data: { id: "1-2", content: "Another reply", author: "eve" },
        children: [],
      },
    ],
  },
  {
    id: "2",
    data: { id: "2", content: "Second comment", author: "frank" },
    children: [
      {
        id: "2-1",
        data: { id: "2-1", content: "Reply to second", author: "grace" },
        children: [],
      },
    ],
  },
  {
    id: "3",
    data: { id: "3", content: "Third comment", author: "henry" },
    children: [],
  },
];

// ============================================================================
// flattenComments Tests
// ============================================================================

describe("flattenComments", () => {
  it("flattens a nested comment tree into a flat array", () => {
    const comments = createSampleComments();
    const flattened = flattenComments(comments);

    expect(flattened).toHaveLength(8);
    expect(flattened.map((c) => c.id)).toEqual([
      "1",
      "1-1",
      "1-1-1",
      "1-1-2",
      "1-2",
      "2",
      "2-1",
      "3",
    ]);
  });

  it("assigns correct depth to each comment", () => {
    const comments = createSampleComments();
    const flattened = flattenComments(comments);

    expect(flattened.find((c) => c.id === "1")?.depth).toBe(0);
    expect(flattened.find((c) => c.id === "1-1")?.depth).toBe(1);
    expect(flattened.find((c) => c.id === "1-1-1")?.depth).toBe(2);
  });

  it("assigns correct parentId to each comment", () => {
    const comments = createSampleComments();
    const flattened = flattenComments(comments);

    expect(flattened.find((c) => c.id === "1")?.parentId).toBeNull();
    expect(flattened.find((c) => c.id === "1-1")?.parentId).toBe("1");
    expect(flattened.find((c) => c.id === "1-1-1")?.parentId).toBe("1-1");
  });

  it("handles empty tree", () => {
    const flattened = flattenComments([]);
    expect(flattened).toEqual([]);
  });

  it("preserves comment data", () => {
    const comments = createSampleComments();
    const flattened = flattenComments(comments);
    const comment = flattened.find((c) => c.id === "1-1");

    expect(comment?.data?.content).toBe("Reply to first");
    expect(comment?.data?.author).toBe("bob");
  });
});

// ============================================================================
// removeCollapsedChildren Tests
// ============================================================================

describe("removeCollapsedChildren", () => {
  it("removes children of collapsed items from flattened list", () => {
    const comments = createSampleComments();
    const flattened = flattenComments(comments);
    const result = removeCollapsedChildren(flattened, ["1"]);

    expect(result.find((c) => c.id === "1")).toBeDefined();
    expect(result.find((c) => c.id === "1-1")).toBeUndefined();
    expect(result.find((c) => c.id === "1-1-1")).toBeUndefined();
  });

  it("handles multiple collapsed parents", () => {
    const comments = createSampleComments();
    const flattened = flattenComments(comments);
    const result = removeCollapsedChildren(flattened, ["1", "2"]);

    expect(result.map((c) => c.id)).toContain("1");
    expect(result.map((c) => c.id)).toContain("2");
    expect(result.map((c) => c.id)).toContain("3");
    expect(result.find((c) => c.id === "1-1")).toBeUndefined();
    expect(result.find((c) => c.id === "2-1")).toBeUndefined();
  });

  it("returns all items when no ids provided", () => {
    const comments = createSampleComments();
    const flattened = flattenComments(comments);
    const result = removeCollapsedChildren(flattened, []);

    expect(result).toHaveLength(8);
  });
});

// ============================================================================
// findComment Tests
// ============================================================================

describe("findComment", () => {
  it("finds a comment at root level", () => {
    const comments = createSampleComments();
    const found = findComment(comments, "1");
    expect(found?.id).toBe("1");
  });

  it("finds a deeply nested comment", () => {
    const comments = createSampleComments();
    const found = findComment(comments, "1-1-2");
    expect(found?.id).toBe("1-1-2");
    expect(found?.data?.author).toBe("dave");
  });

  it("returns undefined for non-existent comment", () => {
    const comments = createSampleComments();
    const found = findComment(comments, "nonexistent");
    expect(found).toBeUndefined();
  });
});

// ============================================================================
// setCommentProperty Tests
// ============================================================================

describe("setCommentProperty", () => {
  it("sets a property on a root comment", () => {
    const comments = createSampleComments();
    const result = setCommentProperty(comments, "1", "collapsed", () => true);

    expect(result[0].collapsed).toBe(true);
    expect(result[1].collapsed).toBeUndefined();
  });

  it("sets a property on a nested comment", () => {
    const comments = createSampleComments();
    const result = setCommentProperty(comments, "1-1", "collapsed", () => true);

    expect(result[0].children[0].collapsed).toBe(true);
  });

  it("toggles a property", () => {
    const comments = createSampleComments();
    const tree1 = setCommentProperty(comments, "1", "collapsed", () => true);
    const tree2 = setCommentProperty(tree1, "1", "collapsed", (val) => !val);

    expect(tree2[0].collapsed).toBe(false);
  });

  it("returns new array (immutable)", () => {
    const comments = createSampleComments();
    const result = setCommentProperty(comments, "1", "collapsed", () => true);

    expect(result).not.toBe(comments);
  });
});

// ============================================================================
// getReplyCount Tests
// ============================================================================

describe("getReplyCount", () => {
  it("returns count for comment with direct replies only", () => {
    const comments = createSampleComments();
    const count = getReplyCount(comments, "2");
    expect(count).toBe(1);
  });

  it("returns 0 for leaf comment", () => {
    const comments = createSampleComments();
    const count = getReplyCount(comments, "3");
    expect(count).toBe(0);
  });

  it("returns 0 for non-existent comment", () => {
    const comments = createSampleComments();
    const count = getReplyCount(comments, "nonexistent");
    expect(count).toBe(0);
  });

  it("counts nested replies recursively", () => {
    const comments = createSampleComments();
    const count = getReplyCount(comments, "1");
    // 1 has: 1-1, 1-2 (2 direct)
    // 1-1 has: 1-1-1, 1-1-2 (2 nested)
    // Total: 4
    expect(count).toBe(4);
  });

  it("counts replies at second level", () => {
    const comments = createSampleComments();
    const count = getReplyCount(comments, "1-1");
    expect(count).toBe(2);
  });
});

// ============================================================================
// getDepthColor Tests
// ============================================================================

describe("getDepthColor", () => {
  const colors = ["#3b82f6", "#f97316", "#22c55e"]; // blue, orange, green

  it("returns transparent for depth 0", () => {
    const color = getDepthColor(0, colors);
    expect(color).toBe("transparent");
  });

  it("returns first color for depth 1", () => {
    const color = getDepthColor(1, colors);
    expect(color).toBe("#3b82f6");
  });

  it("returns second color for depth 2", () => {
    const color = getDepthColor(2, colors);
    expect(color).toBe("#f97316");
  });

  it("cycles colors when depth exceeds array length", () => {
    const color = getDepthColor(4, colors);
    expect(color).toBe("#3b82f6"); // (4-1) % 3 = 0
  });

  it("handles large depth values", () => {
    const color = getDepthColor(10, colors);
    expect(color).toBe("#3b82f6"); // (10-1) % 3 = 0 → index 0
  });
});

// ============================================================================
// buildCommentTree Tests
// ============================================================================

describe("buildCommentTree", () => {
  it("rebuilds a nested tree from flattened items", () => {
    const comments = createSampleComments();
    const flattened = flattenComments(comments);
    const rebuilt = buildCommentTree(flattened);

    expect(rebuilt).toHaveLength(3);
    expect(rebuilt[0].id).toBe("1");
    expect(rebuilt[0].children).toHaveLength(2);
    expect(rebuilt[0].children[0].children).toHaveLength(2);
  });

  it("handles empty array", () => {
    const rebuilt = buildCommentTree([]);
    expect(rebuilt).toEqual([]);
  });

  it("preserves tree structure after flatten -> build cycle", () => {
    const comments = createSampleComments();
    const flattened = flattenComments(comments);
    const rebuilt = buildCommentTree(flattened);

    expect(rebuilt[0].children[0].id).toBe("1-1");
    expect(rebuilt[0].children[0].children[0].id).toBe("1-1-1");
    expect(rebuilt[1].children[0].id).toBe("2-1");
  });
});

// ============================================================================
// removeComment Tests
// ============================================================================

describe("removeComment", () => {
  it("removes a comment from root level", () => {
    const comments = createSampleComments();
    const result = removeComment(comments, "3");

    expect(result).toHaveLength(2);
    expect(findComment(result, "3")).toBeUndefined();
  });

  it("removes a nested comment", () => {
    const comments = createSampleComments();
    const result = removeComment(comments, "1-1-1");
    const parent = findComment(result, "1-1");

    expect(parent?.children).toHaveLength(1);
    expect(findComment(result, "1-1-1")).toBeUndefined();
  });

  it("removes parent and leaves siblings intact", () => {
    const comments = createSampleComments();
    const result = removeComment(comments, "1-1");
    const root = findComment(result, "1");

    expect(root?.children).toHaveLength(1);
    expect(root?.children[0].id).toBe("1-2");
  });

  it("does nothing when comment does not exist", () => {
    const comments = createSampleComments();
    const result = removeComment(comments, "nonexistent");
    expect(result).toHaveLength(3);
  });
});

// ============================================================================
// getAncestorIds Tests
// ============================================================================

describe("getAncestorIds", () => {
  it("returns empty array for root comment", () => {
    const comments = createSampleComments();
    const flattened = flattenComments(comments);
    const ancestors = getAncestorIds(flattened, "1");

    expect(ancestors).toEqual([]);
  });

  it("returns parent for direct child", () => {
    const comments = createSampleComments();
    const flattened = flattenComments(comments);
    const ancestors = getAncestorIds(flattened, "1-1");

    expect(ancestors).toEqual(["1"]);
  });

  it("returns all ancestors for deeply nested comment", () => {
    const comments = createSampleComments();
    const flattened = flattenComments(comments);
    const ancestors = getAncestorIds(flattened, "1-1-1");

    expect(ancestors).toEqual(["1-1", "1"]);
  });

  it("returns empty array for non-existent comment", () => {
    const comments = createSampleComments();
    const flattened = flattenComments(comments);
    const ancestors = getAncestorIds(flattened, "nonexistent");

    expect(ancestors).toEqual([]);
  });
});

// ============================================================================
// getDescendantIds Tests
// ============================================================================

describe("getDescendantIds", () => {
  it("returns empty array for leaf comment", () => {
    const comments = createSampleComments();
    const descendants = getDescendantIds(comments, "3");

    expect(descendants).toEqual([]);
  });

  it("returns direct children", () => {
    const comments = createSampleComments();
    const descendants = getDescendantIds(comments, "2");

    expect(descendants).toEqual(["2-1"]);
  });

  it("returns all descendants recursively", () => {
    const comments = createSampleComments();
    const descendants = getDescendantIds(comments, "1");

    expect(descendants).toEqual(["1-1", "1-1-1", "1-1-2", "1-2"]);
  });

  it("returns empty array for non-existent comment", () => {
    const comments = createSampleComments();
    const descendants = getDescendantIds(comments, "nonexistent");

    expect(descendants).toEqual([]);
  });
});

// ============================================================================
// Integration Tests
// ============================================================================

describe("Integration: Comment Tree Manipulation Cycle", () => {
  it("flatten and rebuild produces equivalent structure", () => {
    const comments = createSampleComments();
    const flattened = flattenComments(comments);
    const rebuilt = buildCommentTree(flattened);

    expect(rebuilt.map((c) => c.id)).toEqual(comments.map((c) => c.id));
    expect(rebuilt[0].children.map((c) => c.id)).toEqual(
      comments[0].children.map((c) => c.id),
    );
  });

  it("remove and rebuild maintains integrity", () => {
    const comments = createSampleComments();
    const modified = removeComment(comments, "1-1");
    const flattened = flattenComments(modified);
    const rebuilt = buildCommentTree(flattened);

    expect(findComment(rebuilt, "1-1")).toBeUndefined();
    expect(findComment(rebuilt, "1")?.children).toHaveLength(1);
  });

  it("setProperty preserves structure", () => {
    const comments = createSampleComments();
    const modified = setCommentProperty(comments, "1", "collapsed", () => true);

    expect(modified[0].collapsed).toBe(true);
    expect(modified[0].children).toHaveLength(2);
    expect(modified[0].children[0].id).toBe("1-1");
  });
});

// ============================================================================
// Edge Cases
// ============================================================================

describe("Edge Cases", () => {
  it("handles single-comment tree", () => {
    const tree: CommentItems<TestComment> = [
      {
        id: "only",
        data: { id: "only", content: "Only comment", author: "solo" },
        children: [],
      },
    ];

    const flattened = flattenComments(tree);
    expect(flattened).toHaveLength(1);
    expect(flattened[0].parentId).toBeNull();
    expect(flattened[0].depth).toBe(0);

    const rebuilt = buildCommentTree(flattened);
    expect(rebuilt).toHaveLength(1);
    expect(rebuilt[0].id).toBe("only");
  });

  it("handles deeply nested structure (5 levels)", () => {
    const tree: CommentItems<TestComment> = [
      {
        id: "l1",
        data: { id: "l1", content: "Level 1", author: "a" },
        children: [
          {
            id: "l2",
            data: { id: "l2", content: "Level 2", author: "b" },
            children: [
              {
                id: "l3",
                data: { id: "l3", content: "Level 3", author: "c" },
                children: [
                  {
                    id: "l4",
                    data: { id: "l4", content: "Level 4", author: "d" },
                    children: [
                      {
                        id: "l5",
                        data: { id: "l5", content: "Level 5", author: "e" },
                        children: [],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    ];

    const flattened = flattenComments(tree);
    expect(flattened).toHaveLength(5);
    expect(flattened[4].depth).toBe(4);
    expect(flattened[4].parentId).toBe("l4");
  });

  it("preserves collapsed state through flatten/rebuild", () => {
    const tree: CommentItems<TestComment> = [
      {
        id: "a",
        data: { id: "a", content: "Comment", author: "x" },
        collapsed: true,
        children: [
          {
            id: "b",
            data: { id: "b", content: "Reply", author: "y" },
            children: [],
          },
        ],
      },
    ];

    const flattened = flattenComments(tree);
    const rebuilt = buildCommentTree(flattened);

    expect(rebuilt[0].collapsed).toBe(true);
  });
});

// ============================================================================
// Performance Tests
// ============================================================================

describe("Large Comment Tree Performance", () => {
  function generateLargeTree(count: number): CommentItems<TestComment> {
    const items: CommentItems<TestComment> = [];
    for (let i = 0; i < count; i++) {
      items.push({
        id: `item-${i}`,
        data: { id: `item-${i}`, content: `Comment ${i}`, author: `user${i}` },
        children:
          i % 10 === 0
            ? [
                {
                  id: `child-of-${i}`,
                  data: {
                    id: `child-of-${i}`,
                    content: "Reply",
                    author: "replier",
                  },
                  children: [],
                },
              ]
            : [],
      });
    }
    return items;
  }

  it("handles 100 items efficiently", () => {
    const tree = generateLargeTree(100);

    const start = performance.now();
    const flattened = flattenComments(tree);
    const duration = performance.now() - start;

    expect(flattened.length).toBe(110); // 100 + 10 children
    expect(duration).toBeLessThan(50);
  });

  it("handles 1000 items efficiently", () => {
    const tree = generateLargeTree(1000);

    const start = performance.now();
    const flattened = flattenComments(tree);
    const duration = performance.now() - start;

    expect(flattened.length).toBe(1100); // 1000 + 100 children
    expect(duration).toBeLessThan(100);
  });

  it("flatten and rebuild 1000 items roundtrip", () => {
    const tree = generateLargeTree(1000);

    const start = performance.now();
    const flattened = flattenComments(tree);
    const rebuilt = buildCommentTree(flattened);
    const duration = performance.now() - start;

    expect(rebuilt.length).toBe(1000);
    expect(duration).toBeLessThan(200);
  });
});
