import type { UniqueIdentifier } from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";

import type {
  FlattenedItem,
  TreeItem,
  TreeItems,
  ProjectedPosition,
  ItemData,
} from "./types";

/**
 * Calculate drag depth based on horizontal offset
 */
function getDragDepth(offset: number, indentationWidth: number): number {
  return Math.round(offset / indentationWidth);
}

/**
 * Calculate the projected position during a drag operation
 */
export function getProjection<T extends ItemData>(
  items: FlattenedItem<T>[],
  activeId: UniqueIdentifier,
  overId: UniqueIdentifier,
  dragOffset: number,
  indentationWidth: number,
  maxDepth?: number,
): ProjectedPosition {
  const overItemIndex = items.findIndex(({ id }) => id === overId);
  const activeItemIndex = items.findIndex(({ id }) => id === activeId);
  const activeItem = items[activeItemIndex];
  const newItems = arrayMove(items, activeItemIndex, overItemIndex);
  const previousItem = newItems[overItemIndex - 1];
  const nextItem = newItems[overItemIndex + 1];
  const dragDepth = getDragDepth(dragOffset, indentationWidth);
  const projectedDepth = activeItem.depth + dragDepth;

  const calculatedMaxDepth = getMaxDepth({ previousItem });
  const effectiveMaxDepth =
    maxDepth !== undefined
      ? Math.min(calculatedMaxDepth, maxDepth)
      : calculatedMaxDepth;
  const minDepth = getMinDepth({ nextItem });

  let depth = projectedDepth;

  if (projectedDepth >= effectiveMaxDepth) {
    depth = effectiveMaxDepth;
  } else if (projectedDepth < minDepth) {
    depth = minDepth;
  }

  return {
    depth,
    maxDepth: effectiveMaxDepth,
    minDepth,
    parentId: getParentId(),
  };

  function getParentId(): UniqueIdentifier | null {
    if (depth === 0 || !previousItem) {
      return null;
    }

    if (depth === previousItem.depth) {
      return previousItem.parentId;
    }

    if (depth > previousItem.depth) {
      return previousItem.id;
    }

    const newParent = newItems
      .slice(0, overItemIndex)
      .reverse()
      .find((item) => item.depth === depth)?.parentId;

    return newParent ?? null;
  }
}

function getMaxDepth<T extends ItemData>({
  previousItem,
}: {
  previousItem?: FlattenedItem<T>;
}): number {
  if (previousItem) {
    return previousItem.depth + 1;
  }
  return 0;
}

function getMinDepth<T extends ItemData>({
  nextItem,
}: {
  nextItem?: FlattenedItem<T>;
}): number {
  if (nextItem) {
    return nextItem.depth;
  }
  return 0;
}

/**
 * Flatten a nested tree structure into a flat array
 */
function flatten<T extends ItemData>(
  items: TreeItems<T>,
  parentId: UniqueIdentifier | null = null,
  depth = 0,
): FlattenedItem<T>[] {
  return items.reduce<FlattenedItem<T>[]>((acc, item, index) => {
    return [
      ...acc,
      { ...item, parentId, depth, index },
      ...flatten(item.children, item.id, depth + 1),
    ];
  }, []);
}

/**
 * Flatten tree items into a flat array for rendering
 */
export function flattenTree<T extends ItemData>(
  items: TreeItems<T>,
): FlattenedItem<T>[] {
  return flatten(items);
}

/**
 * Build a nested tree structure from a flat array
 */
export function buildTree<T extends ItemData>(
  flattenedItems: FlattenedItem<T>[],
): TreeItems<T> {
  const root: TreeItem<T> = { id: "root", children: [] };
  const nodes: Record<string, TreeItem<T>> = { [root.id]: root };
  const items = flattenedItems.map((item) => ({
    ...item,
    children: [] as TreeItem<T>[],
  }));

  for (const item of items) {
    const { id, children, data, collapsed } = item;
    const parentId = item.parentId ?? root.id;
    const parent = nodes[parentId] ?? findItem(items, parentId);

    const treeItem: TreeItem<T> = { id, children, data, collapsed };
    nodes[id] = treeItem;
    parent.children.push(treeItem);
  }

  return root.children;
}

/**
 * Find an item in a flat array
 */
export function findItem<T extends ItemData>(
  items: TreeItem<T>[],
  itemId: UniqueIdentifier,
): TreeItem<T> | undefined {
  return items.find(({ id }) => id === itemId);
}

/**
 * Find an item recursively in a nested tree
 */
export function findItemDeep<T extends ItemData>(
  items: TreeItems<T>,
  itemId: UniqueIdentifier,
): TreeItem<T> | undefined {
  for (const item of items) {
    const { id, children } = item;

    if (id === itemId) {
      return item;
    }

    if (children.length) {
      const child = findItemDeep(children, itemId);
      if (child) {
        return child;
      }
    }
  }

  return undefined;
}

/**
 * Remove an item from the tree
 */
export function removeItem<T extends ItemData>(
  items: TreeItems<T>,
  id: UniqueIdentifier,
): TreeItems<T> {
  const newItems: TreeItems<T> = [];

  for (const item of items) {
    if (item.id === id) {
      continue;
    }

    if (item.children.length) {
      item.children = removeItem(item.children, id);
    }

    newItems.push(item);
  }

  return newItems;
}

/**
 * Set a property on a tree item
 */
export function setProperty<T extends ItemData, K extends keyof TreeItem<T>>(
  items: TreeItems<T>,
  id: UniqueIdentifier,
  property: K,
  setter: (value: TreeItem<T>[K]) => TreeItem<T>[K],
): TreeItems<T> {
  for (const item of items) {
    if (item.id === id) {
      item[property] = setter(item[property]);
      continue;
    }

    if (item.children.length) {
      item.children = setProperty(item.children, id, property, setter);
    }
  }

  return [...items];
}

/**
 * Count all children recursively
 */
function countChildren<T extends ItemData>(
  items: TreeItem<T>[],
  count = 0,
): number {
  return items.reduce((acc, { children }) => {
    if (children.length) {
      return countChildren(children, acc + 1);
    }
    return acc + 1;
  }, count);
}

/**
 * Get the total count of children for an item
 */
export function getChildCount<T extends ItemData>(
  items: TreeItems<T>,
  id: UniqueIdentifier,
): number {
  const item = findItemDeep(items, id);
  return item ? countChildren(item.children) : 0;
}

/**
 * Remove children of collapsed items from the flat list
 */
export function removeChildrenOf<T extends ItemData>(
  items: FlattenedItem<T>[],
  ids: UniqueIdentifier[],
): FlattenedItem<T>[] {
  const excludeParentIds = [...ids];

  return items.filter((item) => {
    if (item.parentId && excludeParentIds.includes(item.parentId)) {
      if (item.children.length) {
        excludeParentIds.push(item.id);
      }
      return false;
    }

    return true;
  });
}

/**
 * Get all ancestor IDs for an item
 */
export function getAncestorIds<T extends ItemData>(
  items: FlattenedItem<T>[],
  id: UniqueIdentifier,
): UniqueIdentifier[] {
  const item = items.find((i) => i.id === id);
  if (!item || !item.parentId) return [];

  const parentItem = items.find((i) => i.id === item.parentId);
  if (!parentItem) return [];

  return [item.parentId, ...getAncestorIds(items, item.parentId)];
}

/**
 * Get all descendant IDs for an item
 */
export function getDescendantIds<T extends ItemData>(
  items: TreeItems<T>,
  id: UniqueIdentifier,
): UniqueIdentifier[] {
  const item = findItemDeep(items, id);
  if (!item) return [];

  const ids: UniqueIdentifier[] = [];
  const collectIds = (children: TreeItems<T>) => {
    for (const child of children) {
      ids.push(child.id);
      if (child.children.length) {
        collectIds(child.children);
      }
    }
  };

  collectIds(item.children);
  return ids;
}

/**
 * Check if an item can be dropped as a child of another item
 * (prevents circular references)
 */
export function canDropAsChild<T extends ItemData>(
  items: TreeItems<T>,
  dragId: UniqueIdentifier,
  targetId: UniqueIdentifier,
): boolean {
  if (dragId === targetId) return false;

  const descendantIds = getDescendantIds(items, dragId);
  return !descendantIds.includes(targetId);
}
