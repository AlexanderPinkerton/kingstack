// Main component
export { DndTree } from "./DndTree";

// Sub-components for custom rendering
export { DndTreeItem } from "./DndTreeItem";
export type { DndTreeItemProps } from "./DndTreeItem";
export { SortableDndTreeItem } from "./SortableDndTreeItem";
export type { SortableDndTreeItemProps } from "./SortableDndTreeItem";

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
} from "./types";

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
} from "./utilities";

// Utils
export { cn, iOS } from "./utils";
