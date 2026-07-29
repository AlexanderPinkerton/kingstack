// Main component
export { DndTree } from "./DndTree.js";

// Sub-components for custom rendering
export { DndTreeItem } from "./DndTreeItem.js";
export type { DndTreeItemProps } from "./DndTreeItem.js";
export { SortableDndTreeItem } from "./SortableDndTreeItem.js";
export type { SortableDndTreeItemProps } from "./SortableDndTreeItem.js";

// Types
export type {
  ItemData,
  TreeItem,
  TreeItems,
  TreeItemData,
  FlattenedItem,
  DndTreeProps,
  TreeItemRenderProps,
  ItemType,
  ProjectedPosition,
  DropValidationContext,
  TreeNodeTypeConfig,
  TreeNodeTypes,
  TreeTypeConfig,
  TreeItemAction,
  TreeClassNames,
  SensorContext,
} from "./types.js";

// Utilities for working with tree data
export {
  flattenTree,
  buildTree,
  findItem,
  findItemDeep,
  removeItem,
  setProperty,
  getChildCount,
  removeChildrenOf,
  getAncestorIds,
  getDescendantIds,
  canDropAsChild,
  getProjection,
} from "./utilities.js";

// Utils
export { cn, iOS } from "./utils.js";
