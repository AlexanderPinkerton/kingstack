import type {
  CommentData,
  CommentItem,
  CommentItems,
  FlattenedComment,
} from "./types";

/**
 * Flatten a nested comment tree into a flat array
 */
function flatten<T extends CommentData>(
  items: CommentItems<T>,
  parentId: string | null = null,
  depth = 0,
): FlattenedComment<T>[] {
  return items.reduce<FlattenedComment<T>[]>((acc, item, index) => {
    return [
      ...acc,
      { ...item, parentId, depth, index },
      ...flatten(item.children, item.id, depth + 1),
    ];
  }, []);
}

/**
 * Flatten comment items into a flat array for rendering
 */
export function flattenComments<T extends CommentData>(
  items: CommentItems<T>,
): FlattenedComment<T>[] {
  return flatten(items);
}

/**
 * Remove children of collapsed items from the flat list
 */
export function removeCollapsedChildren<T extends CommentData>(
  items: FlattenedComment<T>[],
  collapsedIds: string[],
): FlattenedComment<T>[] {
  const excludeParentIds = [...collapsedIds];

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
 * Find a comment recursively in a nested tree
 */
export function findComment<T extends CommentData>(
  items: CommentItems<T>,
  id: string,
): CommentItem<T> | undefined {
  for (const item of items) {
    if (item.id === id) {
      return item;
    }

    if (item.children.length) {
      const child = findComment(item.children, id);
      if (child) {
        return child;
      }
    }
  }

  return undefined;
}

/**
 * Set a property on a comment item (returns new tree, immutable)
 */
export function setCommentProperty<
  T extends CommentData,
  K extends keyof CommentItem<T>,
>(
  items: CommentItems<T>,
  id: string,
  property: K,
  setter: (value: CommentItem<T>[K]) => CommentItem<T>[K],
): CommentItems<T> {
  return items.map((item) => {
    if (item.id === id) {
      return { ...item, [property]: setter(item[property]) };
    }

    if (item.children.length) {
      return {
        ...item,
        children: setCommentProperty(item.children, id, property, setter),
      };
    }

    return item;
  });
}

/**
 * Count all replies recursively
 */
function countReplies<T extends CommentData>(
  items: CommentItem<T>[],
  count = 0,
): number {
  return items.reduce((acc, { children }) => {
    if (children.length) {
      return countReplies(children, acc + children.length);
    }
    return acc;
  }, count);
}

/**
 * Get the total count of replies for a comment
 */
export function getReplyCount<T extends CommentData>(
  items: CommentItems<T>,
  id: string,
): number {
  const item = findComment(items, id);
  return item ? item.children.length + countReplies(item.children) : 0;
}

/**
 * Get depth color from the color array (cycles through if depth exceeds array length)
 * Returns "transparent" for depth 0, otherwise returns the color at (depth-1) % colors.length
 */
export function getDepthColor(depth: number, colors: string[]): string {
  if (depth === 0) return "transparent";
  return colors[(depth - 1) % colors.length];
}

/**
 * Build a nested tree from a flat array of comments
 */
export function buildCommentTree<T extends CommentData>(
  flattenedItems: FlattenedComment<T>[],
): CommentItems<T> {
  const root: CommentItem<T> = { id: "root", data: {} as T, children: [] };
  const nodes: Record<string, CommentItem<T>> = { [root.id]: root };
  const items = flattenedItems.map((item) => ({
    ...item,
    children: [] as CommentItem<T>[],
  }));

  for (const item of items) {
    const { id, children, data, collapsed } = item;
    const parentId = item.parentId ?? root.id;
    const parent =
      nodes[parentId] ?? items.find((i) => i.id === parentId) ?? root;

    const treeItem: CommentItem<T> = { id, children, data, collapsed };
    nodes[id] = treeItem;
    parent.children.push(treeItem);
  }

  return root.children;
}

/**
 * Remove a comment from the tree
 */
export function removeComment<T extends CommentData>(
  items: CommentItems<T>,
  id: string,
): CommentItems<T> {
  const newItems: CommentItems<T> = [];

  for (const item of items) {
    if (item.id === id) {
      continue;
    }

    if (item.children.length) {
      newItems.push({
        ...item,
        children: removeComment(item.children, id),
      });
    } else {
      newItems.push(item);
    }
  }

  return newItems;
}

/**
 * Get all ancestor IDs for a comment
 */
export function getAncestorIds<T extends CommentData>(
  items: FlattenedComment<T>[],
  id: string,
): string[] {
  const item = items.find((i) => i.id === id);
  if (!item || !item.parentId) return [];

  const parentItem = items.find((i) => i.id === item.parentId);
  if (!parentItem) return [];

  return [item.parentId, ...getAncestorIds(items, item.parentId)];
}

/**
 * Get all descendant IDs for a comment
 */
export function getDescendantIds<T extends CommentData>(
  items: CommentItems<T>,
  id: string,
): string[] {
  const item = findComment(items, id);
  if (!item) return [];

  const ids: string[] = [];
  const collectIds = (children: CommentItems<T>) => {
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
