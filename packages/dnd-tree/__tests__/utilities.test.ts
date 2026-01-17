import { describe, it, expect } from "vitest";
import {
  flattenTree,
  buildTree,
  findItem,
  findItemDeep,
  removeItem,
  setProperty,
  getChildCount,
  removeChildrenOf,
} from "../src/utilities";
import type { TreeItems } from "../src/types";

// ============================================================================
// Test Data
// ============================================================================

interface TestItem {
  name: string;
  type: "folder" | "file";
}

const createSampleTree = (): TreeItems<TestItem> => [
  {
    id: "root1",
    data: { name: "Root 1", type: "folder" },
    children: [
      {
        id: "child1",
        data: { name: "Child 1", type: "folder" },
        children: [
          { id: "grandchild1", data: { name: "Grandchild 1", type: "file" }, children: [] },
          { id: "grandchild2", data: { name: "Grandchild 2", type: "file" }, children: [] },
        ],
      },
      { id: "child2", data: { name: "Child 2", type: "file" }, children: [] },
    ],
  },
  {
    id: "root2",
    data: { name: "Root 2", type: "folder" },
    children: [
      { id: "child3", data: { name: "Child 3", type: "file" }, children: [] },
    ],
  },
  { id: "root3", data: { name: "Root 3", type: "file" }, children: [] },
];

// ============================================================================
// flattenTree Tests
// ============================================================================

describe("flattenTree", () => {
  it("flattens a nested tree into a flat array", () => {
    const sampleTree = createSampleTree();
    const flattened = flattenTree(sampleTree);
    
    expect(flattened).toHaveLength(8);
    expect(flattened.map((item) => item.id)).toEqual([
      "root1",
      "child1",
      "grandchild1",
      "grandchild2",
      "child2",
      "root2",
      "child3",
      "root3",
    ]);
  });

  it("assigns correct depth to each item", () => {
    const sampleTree = createSampleTree();
    const flattened = flattenTree(sampleTree);
    
    expect(flattened.find((i) => i.id === "root1")?.depth).toBe(0);
    expect(flattened.find((i) => i.id === "child1")?.depth).toBe(1);
    expect(flattened.find((i) => i.id === "grandchild1")?.depth).toBe(2);
  });

  it("assigns correct parentId to each item", () => {
    const sampleTree = createSampleTree();
    const flattened = flattenTree(sampleTree);
    
    expect(flattened.find((i) => i.id === "root1")?.parentId).toBeNull();
    expect(flattened.find((i) => i.id === "child1")?.parentId).toBe("root1");
    expect(flattened.find((i) => i.id === "grandchild1")?.parentId).toBe("child1");
  });

  it("handles empty tree", () => {
    const flattened = flattenTree([]);
    expect(flattened).toEqual([]);
  });

  it("preserves item data", () => {
    const sampleTree = createSampleTree();
    const flattened = flattenTree(sampleTree);
    const child1 = flattened.find((i) => i.id === "child1");
    
    expect(child1?.data?.name).toBe("Child 1");
    expect(child1?.data?.type).toBe("folder");
  });
});

// ============================================================================
// buildTree Tests
// ============================================================================

describe("buildTree", () => {
  it("rebuilds a nested tree from flattened items", () => {
    const sampleTree = createSampleTree();
    const flattened = flattenTree(sampleTree);
    const rebuilt = buildTree(flattened);
    
    expect(rebuilt).toHaveLength(3);
    expect(rebuilt[0].id).toBe("root1");
    expect(rebuilt[0].children).toHaveLength(2);
    expect(rebuilt[0].children[0].children).toHaveLength(2);
  });

  it("handles empty array", () => {
    const rebuilt = buildTree([]);
    expect(rebuilt).toEqual([]);
  });

  it("preserves tree structure after flatten -> build cycle", () => {
    const sampleTree = createSampleTree();
    const flattened = flattenTree(sampleTree);
    const rebuilt = buildTree(flattened);
    
    // Check structure integrity
    expect(rebuilt[0].children[0].id).toBe("child1");
    expect(rebuilt[0].children[0].children[0].id).toBe("grandchild1");
    expect(rebuilt[1].children[0].id).toBe("child3");
  });
});

// ============================================================================
// findItem / findItemDeep Tests
// ============================================================================

describe("findItem", () => {
  it("finds an item in a flat array", () => {
    const sampleTree = createSampleTree();
    const flattened = flattenTree(sampleTree);
    const found = findItem(flattened, "child1");
    
    expect(found?.id).toBe("child1");
  });

  it("returns undefined for non-existent item", () => {
    const sampleTree = createSampleTree();
    const flattened = flattenTree(sampleTree);
    const found = findItem(flattened, "nonexistent");
    
    expect(found).toBeUndefined();
  });
});

describe("findItemDeep", () => {
  it("finds an item at root level", () => {
    const sampleTree = createSampleTree();
    const found = findItemDeep(sampleTree, "root1");
    expect(found?.id).toBe("root1");
  });

  it("finds a deeply nested item", () => {
    const sampleTree = createSampleTree();
    const found = findItemDeep(sampleTree, "grandchild2");
    expect(found?.id).toBe("grandchild2");
  });

  it("returns undefined for non-existent item", () => {
    const sampleTree = createSampleTree();
    const found = findItemDeep(sampleTree, "nonexistent");
    expect(found).toBeUndefined();
  });
});

// ============================================================================
// removeItem Tests
// ============================================================================

describe("removeItem", () => {
  it("removes an item from root level", () => {
    const sampleTree = createSampleTree();
    const result = removeItem(sampleTree, "root3");
    
    expect(result).toHaveLength(2);
    expect(findItemDeep(result, "root3")).toBeUndefined();
  });

  it("removes a nested item", () => {
    const sampleTree = createSampleTree();
    const result = removeItem(sampleTree, "grandchild1");
    const child1 = findItemDeep(result, "child1");
    
    expect(child1?.children).toHaveLength(1);
    expect(findItemDeep(result, "grandchild1")).toBeUndefined();
  });

  it("removes parent and leaves other siblings intact", () => {
    const sampleTree = createSampleTree();
    const result = removeItem(sampleTree, "child1");
    const root1 = findItemDeep(result, "root1");
    
    expect(root1?.children).toHaveLength(1);
    expect(root1?.children[0].id).toBe("child2");
  });

  it("does nothing when item does not exist", () => {
    const sampleTree = createSampleTree();
    const result = removeItem(sampleTree, "nonexistent");
    expect(result).toHaveLength(3);
  });
});

// ============================================================================
// setProperty Tests
// ============================================================================

describe("setProperty", () => {
  it("sets a property on a root item", () => {
    const sampleTree = createSampleTree();
    const result = setProperty(sampleTree, "root1", "collapsed", () => true);
    
    expect(result[0].collapsed).toBe(true);
    expect(result[1].collapsed).toBeUndefined();
  });

  it("toggles a property", () => {
    const sampleTree = createSampleTree();
    const tree1 = setProperty(sampleTree, "root1", "collapsed", () => true);
    const tree2 = setProperty(tree1, "root1", "collapsed", (val) => !val);
    
    expect(tree2[0].collapsed).toBe(false);
  });

  it("returns new array (immutable)", () => {
    const sampleTree = createSampleTree();
    const result = setProperty(sampleTree, "root1", "collapsed", () => true);
    
    expect(result).not.toBe(sampleTree);
  });
});

// ============================================================================
// getChildCount Tests
// ============================================================================

describe("getChildCount", () => {
  it("returns count for item with one level of children", () => {
    const sampleTree = createSampleTree();
    const count = getChildCount(sampleTree, "root2");
    expect(count).toBe(1); // child3
  });

  it("returns 0 for leaf node", () => {
    const sampleTree = createSampleTree();
    const count = getChildCount(sampleTree, "root3");
    expect(count).toBe(0);
  });

  it("returns 0 for non-existent item", () => {
    const sampleTree = createSampleTree();
    const count = getChildCount(sampleTree, "nonexistent");
    expect(count).toBe(0);
  });

  it("counts nested children recursively", () => {
    const sampleTree = createSampleTree();
    const count = getChildCount(sampleTree, "child1");
    expect(count).toBe(2); // grandchild1, grandchild2
  });
});

// ============================================================================
// removeChildrenOf Tests
// ============================================================================

describe("removeChildrenOf", () => {
  it("removes children of collapsed items from flattened list", () => {
    const sampleTree = createSampleTree();
    const flattened = flattenTree(sampleTree);
    const result = removeChildrenOf(flattened, ["root1"]);
    
    // Should keep root1 but remove all its descendants
    expect(result.find((i) => i.id === "root1")).toBeDefined();
    expect(result.find((i) => i.id === "child1")).toBeUndefined();
    expect(result.find((i) => i.id === "grandchild1")).toBeUndefined();
  });

  it("handles multiple collapsed parents", () => {
    const sampleTree = createSampleTree();
    const flattened = flattenTree(sampleTree);
    const result = removeChildrenOf(flattened, ["root1", "root2"]);
    
    // Only root items and root3 should remain
    expect(result.map((i) => i.id)).toContain("root1");
    expect(result.map((i) => i.id)).toContain("root2");
    expect(result.map((i) => i.id)).toContain("root3");
    expect(result.find((i) => i.id === "child1")).toBeUndefined();
    expect(result.find((i) => i.id === "child3")).toBeUndefined();
  });

  it("returns all items when no ids provided", () => {
    const sampleTree = createSampleTree();
    const flattened = flattenTree(sampleTree);
    const result = removeChildrenOf(flattened, []);
    
    expect(result).toHaveLength(8);
  });
});

// ============================================================================
// Integration: Full Cycle Tests
// ============================================================================

describe("Integration: Tree Manipulation Cycle", () => {
  it("flatten and rebuild produces equivalent structure", () => {
    const sampleTree = createSampleTree();
    const flattened = flattenTree(sampleTree);
    const rebuilt = buildTree(flattened);
    
    // Compare IDs at each level
    expect(rebuilt.map((i) => i.id)).toEqual(sampleTree.map((i) => i.id));
    expect(rebuilt[0].children.map((i) => i.id)).toEqual(sampleTree[0].children.map((i) => i.id));
  });

  it("remove and rebuild maintains integrity", () => {
    const sampleTree = createSampleTree();
    const modified = removeItem(sampleTree, "child1");
    const flattened = flattenTree(modified);
    const rebuilt = buildTree(flattened);
    
    expect(findItemDeep(rebuilt, "child1")).toBeUndefined();
    expect(findItemDeep(rebuilt, "root1")?.children).toHaveLength(1);
  });

  it("setProperty on root preserves structure", () => {
    const sampleTree = createSampleTree();
    const modified = setProperty(sampleTree, "root1", "collapsed", () => true);
    
    expect(modified[0].collapsed).toBe(true);
    expect(modified[0].children).toHaveLength(2);
    expect(modified[0].children[0].id).toBe("child1");
  });
});

// ============================================================================
// Edge Cases
// ============================================================================

describe("Edge Cases", () => {
  it("handles single-item tree", () => {
    const tree: TreeItems<TestItem> = [
      { id: "only", data: { name: "Only", type: "file" }, children: [] },
    ];
    
    const flattened = flattenTree(tree);
    expect(flattened).toHaveLength(1);
    expect(flattened[0].parentId).toBeNull();
    expect(flattened[0].depth).toBe(0);
    
    const rebuilt = buildTree(flattened);
    expect(rebuilt).toHaveLength(1);
    expect(rebuilt[0].id).toBe("only");
  });

  it("handles deeply nested structure (5 levels)", () => {
    const tree: TreeItems = [
      {
        id: "l1",
        children: [{
          id: "l2",
          children: [{
            id: "l3",
            children: [{
              id: "l4",
              children: [{
                id: "l5",
                children: [],
              }],
            }],
          }],
        }],
      },
    ];
    
    const flattened = flattenTree(tree);
    expect(flattened).toHaveLength(5);
    expect(flattened[4].depth).toBe(4);
    expect(flattened[4].parentId).toBe("l4");
  });

  it("handles items with no data", () => {
    const tree: TreeItems = [
      { id: "nodata1", children: [] },
      { id: "nodata2", children: [{ id: "nodata3", children: [] }] },
    ];
    
    const flattened = flattenTree(tree);
    expect(flattened).toHaveLength(3);
    expect(flattened[0].data).toBeUndefined();
  });

  it("handles numeric IDs", () => {
    const tree: TreeItems = [
      { id: 1, children: [{ id: 2, children: [] }] },
      { id: 3, children: [] },
    ];
    
    const flattened = flattenTree(tree);
    expect(flattened.find((i) => i.id === 1)).toBeDefined();
    expect(flattened.find((i) => i.id === 2)?.parentId).toBe(1);
  });

  it("preserves collapsed state through flatten/rebuild", () => {
    const tree: TreeItems = [
      { id: "a", collapsed: true, children: [{ id: "b", children: [] }] },
    ];
    
    const flattened = flattenTree(tree);
    const rebuilt = buildTree(flattened);
    
    expect(rebuilt[0].collapsed).toBe(true);
  });
});

// ============================================================================
// Large Tree Performance Tests
// ============================================================================

describe("Large Tree Performance", () => {
  function generateLargeTree(count: number): TreeItems {
    const items: TreeItems = [];
    for (let i = 0; i < count; i++) {
      items.push({
        id: `item-${i}`,
        children: i % 10 === 0 ? [{ id: `child-of-${i}`, children: [] }] : [],
      });
    }
    return items;
  }

  it("handles 100 items efficiently", () => {
    const tree = generateLargeTree(100);
    
    const start = performance.now();
    const flattened = flattenTree(tree);
    const duration = performance.now() - start;
    
    expect(flattened.length).toBe(110); // 100 + 10 children
    expect(duration).toBeLessThan(50); // Should be very fast
  });

  it("handles 1000 items efficiently", () => {
    const tree = generateLargeTree(1000);
    
    const start = performance.now();
    const flattened = flattenTree(tree);
    const duration = performance.now() - start;
    
    expect(flattened.length).toBe(1100); // 1000 + 100 children
    expect(duration).toBeLessThan(100); // Should still be fast
  });

  it("flatten and rebuild 1000 items roundtrip", () => {
    const tree = generateLargeTree(1000);
    
    const start = performance.now();
    const flattened = flattenTree(tree);
    const rebuilt = buildTree(flattened);
    const duration = performance.now() - start;
    
    expect(rebuilt.length).toBe(1000);
    expect(duration).toBeLessThan(200);
  });
});

