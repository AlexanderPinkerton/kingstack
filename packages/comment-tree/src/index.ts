// Main component
export { CommentTree } from "./CommentTree.js";

// Default item component for custom rendering
export { DefaultCommentItem } from "./DefaultCommentItem.js";
export type { DefaultCommentItemProps } from "./DefaultCommentItem.js";

// Types
export type {
  CommentData,
  CommentItem,
  CommentItems,
  FlattenedComment,
  CommentAction,
  CommentRenderProps,
  CommentTreeProps,
  CommentTreeClassNames,
} from "./types.js";

export { DEFAULT_DEPTH_COLORS } from "./types.js";

// Utilities for working with comment data
export {
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
} from "./utilities.js";

// Utils
export { cn } from "./utils.js";
