import type { ReactNode } from "react";

/**
 * Base comment data that users extend with their own fields
 */
export interface CommentData {
  id: string;
  content: string;
  author?: string;
  createdAt?: Date | string;
  [key: string]: unknown;
}

/**
 * Tree structure for comments
 */
export interface CommentItem<T extends CommentData = CommentData> {
  id: string;
  data: T;
  children: CommentItem<T>[];
  collapsed?: boolean;
}

export type CommentItems<T extends CommentData = CommentData> =
  CommentItem<T>[];

/**
 * Flattened comment for rendering
 */
export interface FlattenedComment<T extends CommentData = CommentData>
  extends CommentItem<T> {
  parentId: string | null;
  depth: number;
  index: number;
}

/**
 * Action for comment context menu
 */
export interface CommentAction {
  key: string;
  label: string;
  icon?: ReactNode;
  destructive?: boolean;
  disabled?: boolean;
}

/**
 * Props passed to custom comment renderer
 */
export interface CommentRenderProps<T extends CommentData = CommentData> {
  /** The flattened comment item being rendered */
  comment: FlattenedComment<T>;
  /** Current depth level (0 = root) */
  depth: number;
  /** Whether the comment is currently collapsed */
  isCollapsed: boolean;
  /** Whether the comment has replies */
  hasReplies: boolean;
  /** Total number of replies (including nested) */
  replyCount: number;
  /** Whether this comment is currently selected */
  isSelected: boolean;
  /** Callback to toggle collapse state */
  onCollapse?: () => void;
  /** Callback to select this comment */
  onSelect?: () => void;
  /** Available actions for this comment */
  actions?: CommentAction[];
  /** Callback when an action is triggered */
  onAction?: (actionKey: string) => void;
  /** Hex color for the current depth indicator */
  depthColor: string;
  /** Array of depth colors for rendering depth lines */
  depthColors: string[];
  /** Indentation width in pixels */
  indentationWidth: number;
  /** Maximum actions to show inline before overflow menu */
  maxInlineActions: number;
  /** Custom class names for styling */
  classNames?: CommentTreeClassNames;
  /** Whether default styles are disabled */
  unstyled: boolean;
}

/**
 * Custom class names for styling different parts of the comment tree
 */
export interface CommentTreeClassNames {
  /** Container element */
  container?: string;
  /** Individual comment wrapper */
  comment?: string;
  /** Comment when selected */
  commentSelected?: string;
  /** Depth indicator line */
  depthLine?: string;
  /** Comment content area */
  content?: string;
  /** Author name */
  author?: string;
  /** Timestamp */
  timestamp?: string;
  /** Comment text content */
  text?: string;
  /** Actions container */
  actions?: string;
  /** Individual action button */
  actionButton?: string;
  /** Destructive action button */
  actionButtonDestructive?: string;
  /** Overflow menu button (the "..." button) */
  overflowButton?: string;
  /** Overflow menu dropdown container */
  overflowMenu?: string;
  /** Overflow menu item */
  overflowMenuItem?: string;
  /** Collapse button */
  collapseButton?: string;
  /** Reply count badge */
  replyCount?: string;
}

/**
 * Main CommentTree component props
 */
export interface CommentTreeProps<T extends CommentData = CommentData> {
  /** Unique ID for this tree instance */
  id: string;
  /** Comment items data */
  items: CommentItems<T>;
  /** Callback when items change (collapse state) */
  onItemsChange?: (items: CommentItems<T>) => void;
  /** Currently selected comment ID */
  selectedId?: string | null;
  /** Callback when a comment is selected */
  onSelect?: (id: string) => void;
  /** Callback when collapse state changes */
  onCollapseChange?: (id: string, collapsed: boolean) => void;
  /** Actions available for each comment */
  commentActions?:
    | CommentAction[]
    | ((comment: FlattenedComment<T>) => CommentAction[]);
  /** Callback when an action is triggered */
  onAction?: (actionKey: string, commentId: string) => void;
  /** Whether comments can be collapsed */
  collapsible?: boolean;
  /** Indentation width in pixels per depth level */
  indentationWidth?: number;
  /** Custom comment renderer */
  renderComment?: (props: CommentRenderProps<T>) => ReactNode;
  /** Custom class name for the container */
  className?: string;
  /** Custom empty state content */
  emptyState?: ReactNode;
  /** Initially expanded comment IDs (collapsed by default if not included) */
  initialExpandedIds?: string[];
  /**
   * Fixed height for virtualization.
   * When set, only visible items are rendered.
   */
  height?: number;
  /**
   * Fixed width for the tree container.
   * Can be a number (pixels) or string (e.g., "100%", "400px").
   */
  width?: number | string;
  /**
   * Estimated height of each item in pixels (for virtualization).
   * @default 80
   */
  estimatedItemHeight?: number;
  /**
   * Overscan count for virtualization.
   * @default 5
   */
  overscan?: number;
  /**
   * Custom depth colors. If not provided, uses default Reddit-style colors.
   * Array of hex color values.
   */
  depthColors?: string[];
  /**
   * Maximum number of actions to show inline before collapsing into overflow menu.
   * @default 2
   */
  maxInlineActions?: number;
  /**
   * Custom class names for styling different parts of the tree.
   * Use this to override default styles or integrate with your design system.
   */
  classNames?: CommentTreeClassNames;
  /**
   * When true, removes all default styling, giving you full control.
   * Use with classNames or renderComment for complete customization.
   * @default false
   */
  unstyled?: boolean;
}

/**
 * Default Reddit-style depth colors (hex values for inline styles)
 */
export const DEFAULT_DEPTH_COLORS = [
  "#3b82f6", // blue-500
  "#f97316", // orange-500
  "#22c55e", // green-500
  "#a855f7", // purple-500
  "#ec4899", // pink-500
  "#eab308", // yellow-500
  "#06b6d4", // cyan-500
  "#ef4444", // red-500
  "#6366f1", // indigo-500
  "#10b981", // emerald-500
];
