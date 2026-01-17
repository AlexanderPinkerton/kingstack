import type { MutableRefObject, ReactNode } from "react";
import type { UniqueIdentifier } from "@dnd-kit/core";

/**
 * Base constraint for item data - allows any object shape
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export type ItemData = {};

/**
 * Base tree item structure - extend this with your own data
 */
export interface TreeItemData {
  id: UniqueIdentifier;
  children: TreeItemData[];
  collapsed?: boolean;
}

/**
 * Extended tree item that carries custom data
 */
export interface TreeItem<T extends ItemData = ItemData> extends TreeItemData {
  data?: T;
  children: TreeItem<T>[];
}

export type TreeItems<T extends ItemData = ItemData> = TreeItem<T>[];

/**
 * Configuration for a single node type
 */
export interface TreeNodeTypeConfig {
  /** Display label for this type */
  label: string;
  /** Icon to display (React node) */
  icon?: ReactNode;
  /** Color class for the icon (Tailwind class like "text-purple-400") */
  iconColor?: string;
  /** Types that this type can contain as children. Empty array = leaf node. */
  allowedChildren: string[];
  /** Whether this type can be a root-level item */
  allowedAtRoot?: boolean;
}

/**
 * Configuration for all node types in the tree
 */
export interface TreeNodeTypes {
  [typeKey: string]: TreeNodeTypeConfig;
}

/**
 * Props for the type-aware tree configuration
 */
export interface TreeTypeConfig<T extends ItemData = ItemData> {
  /** Map of type key to type configuration */
  types: TreeNodeTypes;
  /** Function to get the type key from an item's data */
  getType: (item: TreeItem<T>) => string;
  /** Function to get the display name from an item's data */
  getName: (item: TreeItem<T>) => string;
  /** Optional function to get a custom icon for an item (overrides type icon) */
  getIcon?: (item: TreeItem<T>) => ReactNode;
}

/**
 * Flattened item used internally for rendering
 */
export interface FlattenedItem<T extends ItemData = ItemData>
  extends TreeItem<T> {
  parentId: UniqueIdentifier | null;
  depth: number;
  index: number;
}

/**
 * Sensor context for keyboard navigation
 */
export type SensorContext = MutableRefObject<{
  items: FlattenedItem[];
  offset: number;
}>;

/**
 * Item type discriminator - useful for different item styling
 */
export type ItemType = "folder" | "document" | "custom";

/**
 * Action menu item for tree nodes
 */
export interface TreeItemAction {
  /** Unique key for this action */
  key: string;
  /** Display label */
  label: string;
  /** Icon to show (React node) */
  icon?: ReactNode;
  /** Whether this action is destructive (shown in red) */
  destructive?: boolean;
  /** Whether this action is disabled */
  disabled?: boolean;
}

/**
 * Props passed to custom item renderer
 */
export interface TreeItemRenderProps<T extends ItemData = ItemData> {
  /** The item being rendered */
  item: FlattenedItem<T>;
  /** Current depth level (0 = root) */
  depth: number;
  /** Whether the item is currently collapsed */
  isCollapsed: boolean;
  /** Whether the item has children */
  hasChildren: boolean;
  /** Number of children (including nested) */
  childCount: number;
  /** Whether this item is currently selected */
  isSelected: boolean;
  /** Whether this is the ghost/clone during drag */
  isClone: boolean;
  /** Whether the item is being dragged */
  isDragging: boolean;
  /** Callback to toggle collapse state */
  onCollapse?: () => void;
  /** Callback to remove this item */
  onRemove?: () => void;
  /** Callback to select this item */
  onSelect?: () => void;
  /** Handle props for drag handle - spread on your handle element */
  handleProps?: Record<string, unknown>;
  /** Available actions for this item */
  actions?: TreeItemAction[];
  /** Callback when an action is triggered */
  onAction?: (actionKey: string) => void;
}

/**
 * Drop validation context passed to canDrop callback
 */
export interface DropValidationContext<T extends ItemData = ItemData> {
  /** The item being dragged */
  dragItem: FlattenedItem<T>;
  /** The target parent item (null if dropping at root level) */
  targetParent: FlattenedItem<T> | null;
  /** The projected depth after drop */
  projectedDepth: number;
  /** All items in the tree */
  items: TreeItems<T>;
}

/**
 * Main DndTree component props
 */
export interface DndTreeProps<T extends ItemData = ItemData> {
  /**
   * Unique ID for this tree instance. Required for SSR/hydration.
   * Should be stable between server and client renders.
   */
  id: string;
  /** Tree items data */
  items: TreeItems<T>;
  /** Callback when items change (due to drag/drop or other operations) */
  onItemsChange?: (items: TreeItems<T>) => void;
  /** Currently selected item ID */
  selectedId?: UniqueIdentifier | null;
  /** Callback when an item is selected */
  onSelect?: (id: UniqueIdentifier) => void;
  /** Callback when an item is moved */
  onMove?: (
    itemId: UniqueIdentifier,
    newParentId: UniqueIdentifier | null,
    newIndex: number,
  ) => void;
  /** Callback when an item is removed */
  onRemove?: (id: UniqueIdentifier) => void;
  /** Callback when an item collapse state changes */
  onCollapseChange?: (id: UniqueIdentifier, collapsed: boolean) => void;
  /**
   * Callback to validate if a drop is allowed.
   * Return true to allow the drop, false to prevent it.
   * Use this to enforce hierarchy rules (e.g., features can't contain components)
   */
  canDrop?: (context: DropValidationContext<T>) => boolean;
  /**
   * Type configuration for automatic hierarchy validation and rendering.
   * When provided, canDrop is auto-generated based on allowedChildren rules.
   */
  typeConfig?: TreeTypeConfig<T>;
  /**
   * Actions available in the item context menu.
   * Can be a static array or a function that returns actions per item.
   */
  itemActions?:
    | TreeItemAction[]
    | ((item: FlattenedItem<T>) => TreeItemAction[]);
  /**
   * Callback when an action is triggered on an item.
   */
  onAction?: (actionKey: string, itemId: UniqueIdentifier) => void;
  /** Whether items can be collapsed */
  collapsible?: boolean;
  /** Whether to show depth indicator line during drag */
  indicator?: boolean;
  /** Whether items can be removed */
  removable?: boolean;
  /** Indentation width in pixels per depth level */
  indentationWidth?: number;
  /** Maximum allowed depth (0 = unlimited) */
  maxDepth?: number;
  /** Custom item renderer (overrides typeConfig rendering) */
  renderItem?: (props: TreeItemRenderProps<T>) => ReactNode;
  /** Custom class name for the container */
  className?: string;
  /** Whether to show grab handles */
  showHandles?: boolean;
  /** Custom empty state content */
  emptyState?: ReactNode;
  /** Initially expanded item IDs */
  initialExpandedIds?: UniqueIdentifier[];
  /** Disabled item IDs that cannot be dragged */
  disabledIds?: UniqueIdentifier[];
  /**
   * Fixed height for the tree container (enables virtualization).
   * When set, only visible items are rendered for better performance with large trees.
   * When not set, tree renders all items and expands naturally.
   */
  height?: number;
  /**
   * Estimated height of each item in pixels (for virtualization).
   * Helps the virtualizer calculate scroll position more accurately.
   * @default 32
   */
  estimatedItemHeight?: number;
  /**
   * Overscan count - how many items to render outside the visible area.
   * Higher values = smoother scrolling, more memory usage.
   * @default 5
   */
  overscan?: number;
  /**
   * Custom render function for the action menu.
   * Receives the actions array and a callback to trigger an action.
   */
  renderActionMenu?: (
    actions: TreeItemAction[],
    onAction: (key: string) => void,
  ) => ReactNode;
  /**
   * Custom class names for styling different parts of the tree.
   * Use this to override default styles or add your own theme.
   */
  classNames?: TreeClassNames;
  /**
   * When true, removes all default styling, giving you full control.
   * Use with classNames or renderItem for complete customization.
   * @default false
   */
  unstyled?: boolean;
}

/**
 * Custom class names for styling different parts of the tree
 */
export interface TreeClassNames {
  /** Container element */
  container?: string;
  /** Li wrapper element for each item */
  wrapper?: string;
  /** Individual tree item wrapper */
  item?: string;
  /** Item when selected */
  itemSelected?: string;
  /** Item when being dragged (clone/overlay) */
  itemDragging?: string;
  /** Drag handle */
  handle?: string;
  /** Collapse/expand button */
  collapseButton?: string;
  /** Item label text */
  label?: string;
  /** Drop indicator line */
  indicator?: string;
  /** Actions container */
  actions?: string;
  /** Action menu container */
  actionMenu?: string;
  /** Action menu item */
  actionMenuItem?: string;
  /** Remove button */
  removeButton?: string;
}

/**
 * Projected position during drag operation
 */
export interface ProjectedPosition {
  depth: number;
  maxDepth: number;
  minDepth: number;
  parentId: UniqueIdentifier | null;
}
