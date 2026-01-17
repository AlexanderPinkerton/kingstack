// Main component
export { CommentTree } from "./CommentTree";

// Default item component for custom rendering
export { DefaultCommentItem } from "./DefaultCommentItem";
export type { DefaultCommentItemProps } from "./DefaultCommentItem";

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
} from "./types";

export { DEFAULT_DEPTH_COLORS } from "./types";

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
} from "./utilities";

// Utils
export { cn } from "./utils";
