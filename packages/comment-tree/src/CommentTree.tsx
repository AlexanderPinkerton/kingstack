"use client";

import React, { useCallback, useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { cn } from "./utils";

import type {
  CommentData,
  CommentItems,
  CommentTreeProps,
  CommentRenderProps,
} from "./types";
import { DEFAULT_DEPTH_COLORS } from "./types";
import {
  flattenComments,
  removeCollapsedChildren,
  setCommentProperty,
  getReplyCount,
  getDepthColor,
  getAncestorIds,
} from "./utilities";
import { DefaultCommentItem } from "./DefaultCommentItem";

export function CommentTree<T extends CommentData = CommentData>({
  id,
  items,
  onItemsChange,
  selectedId,
  onSelect,
  onCollapseChange,
  commentActions,
  onAction,
  collapsible = true,
  indentationWidth = 20,
  renderComment,
  className,
  emptyState,
  initialExpandedIds,
  height,
  width,
  estimatedItemHeight = 80,
  overscan = 5,
  depthColors = DEFAULT_DEPTH_COLORS,
  maxInlineActions = 2,
  classNames,
  unstyled = false,
}: CommentTreeProps<T>) {
  const isVirtualized = height !== undefined;
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Track which ancestor is being hovered (shared across all comments)
  const [hoveredAncestorId, setHoveredAncestorId] = useState<string | null>(
    null,
  );

  // Initialize collapsed state
  const [internalItems, setInternalItems] = useState<CommentItems<T>>(() => {
    if (!initialExpandedIds) return items;

    const initCollapsed = (commentItems: CommentItems<T>): CommentItems<T> => {
      return commentItems.map((item) => ({
        ...item,
        collapsed:
          item.children.length > 0 && !initialExpandedIds.includes(item.id),
        children: initCollapsed(item.children),
      }));
    };
    return initCollapsed(items);
  });

  const effectiveItems = onItemsChange ? items : internalItems;

  const flattenedItems = useMemo(() => {
    const flattened = flattenComments(effectiveItems);
    const collapsedIds = flattened
      .filter(({ collapsed, children }) => collapsed && children.length > 0)
      .map(({ id }) => id);
    return removeCollapsedChildren(flattened, collapsedIds);
  }, [effectiveItems]);

  const updateItems = useCallback(
    (newItems: CommentItems<T>) => {
      if (onItemsChange) {
        onItemsChange(newItems);
      } else {
        setInternalItems(newItems);
      }
    },
    [onItemsChange],
  );

  const handleCollapse = useCallback(
    (commentId: string) => {
      const comment = flattenedItems.find((i) => i.id === commentId);
      const newCollapsed = !comment?.collapsed;
      onCollapseChange?.(commentId, newCollapsed);
      updateItems(
        setCommentProperty(
          effectiveItems,
          commentId,
          "collapsed",
          () => newCollapsed,
        ),
      );
    },
    [flattenedItems, effectiveItems, onCollapseChange, updateItems],
  );

  const handleSelect = useCallback(
    (commentId: string) => {
      onSelect?.(commentId);
    },
    [onSelect],
  );

  const virtualizer = useVirtualizer({
    count: flattenedItems.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: () => estimatedItemHeight,
    overscan,
  });

  /**
   * Get the ancestor ID at a specific depth level for a comment.
   * If the comment is at depth 3 and we click depth line 0, we want the ancestor at depth 0.
   */
  const getAncestorAtDepth = useCallback(
    (commentId: string, targetDepth: number): string | null => {
      // Get all flattened items (including collapsed children) to find ancestors
      const allFlattened = flattenComments(effectiveItems);
      const ancestors = getAncestorIds(allFlattened, commentId);

      // ancestors is ordered from immediate parent to root
      // For a comment at depth D, ancestors[0] is at depth D-1, ancestors[1] is at depth D-2, etc.
      const comment = allFlattened.find((c) => c.id === commentId);
      if (!comment) return null;

      // Calculate which ancestor index corresponds to targetDepth
      // If comment is at depth 3 and targetDepth is 0, we need ancestor at index 2 (3-0-1=2)
      const ancestorIndex = comment.depth - targetDepth - 1;
      if (ancestorIndex >= 0 && ancestorIndex < ancestors.length) {
        return ancestors[ancestorIndex];
      }

      return null;
    },
    [effectiveItems],
  );

  const defaultRenderComment = useCallback(
    (props: CommentRenderProps<T>) => {
      const handleDepthLineClick = (depthIndex: number) => {
        // Find the ancestor at the clicked depth level and collapse it
        const ancestorId = getAncestorAtDepth(props.comment.id, depthIndex);
        if (ancestorId) {
          handleCollapse(ancestorId);
        }
      };

      // Get ancestors for this comment
      const allFlattened = flattenComments(effectiveItems);
      const ancestors = getAncestorIds(allFlattened, props.comment.id);

      return (
        <DefaultCommentItem
          comment={props.comment}
          depth={props.depth}
          isCollapsed={props.isCollapsed}
          hasReplies={props.hasReplies}
          replyCount={props.replyCount}
          isSelected={props.isSelected}
          onCollapse={props.onCollapse}
          onSelect={props.onSelect}
          actions={props.actions}
          onAction={props.onAction}
          depthColors={props.depthColors}
          indentationWidth={props.indentationWidth}
          collapsible={collapsible}
          maxInlineActions={props.maxInlineActions}
          classNames={props.classNames}
          unstyled={props.unstyled}
          onDepthLineClick={collapsible ? handleDepthLineClick : undefined}
          ancestors={ancestors}
          hoveredAncestorId={hoveredAncestorId}
          onAncestorHover={setHoveredAncestorId}
        />
      );
    },
    [
      collapsible,
      getAncestorAtDepth,
      handleCollapse,
      hoveredAncestorId,
      effectiveItems,
    ],
  );

  const effectiveRenderComment = renderComment || defaultRenderComment;

  const renderCommentItem = useCallback(
    (index: number, style?: React.CSSProperties) => {
      const comment = flattenedItems[index];
      if (!comment) return null;

      const { id: commentId, children, collapsed, depth } = comment;
      const isCollapsed = Boolean(collapsed && children.length);
      const hasReplies = children.length > 0;
      const isSelected = selectedId === commentId;
      const replyCount = getReplyCount(effectiveItems, commentId);
      const depthColor = getDepthColor(depth, depthColors);

      const actionsResolved =
        typeof commentActions === "function"
          ? commentActions(comment)
          : commentActions;

      const renderProps: CommentRenderProps<T> = {
        comment,
        depth,
        isCollapsed,
        hasReplies,
        replyCount,
        isSelected,
        onCollapse:
          collapsible && hasReplies
            ? () => handleCollapse(commentId)
            : undefined,
        onSelect: () => handleSelect(commentId),
        actions: actionsResolved,
        onAction: onAction
          ? (actionKey: string) => onAction(actionKey, commentId)
          : undefined,
        depthColor,
        depthColors,
        indentationWidth,
        maxInlineActions,
        classNames,
        unstyled,
      };

      return (
        <div key={commentId} style={style}>
          {effectiveRenderComment(renderProps)}
        </div>
      );
    },
    [
      flattenedItems,
      selectedId,
      effectiveItems,
      depthColors,
      commentActions,
      collapsible,
      handleCollapse,
      handleSelect,
      onAction,
      effectiveRenderComment,
      indentationWidth,
      maxInlineActions,
      classNames,
      unstyled,
    ],
  );

  // Container styles
  const containerStyle: React.CSSProperties = {
    width: typeof width === "number" ? `${width}px` : width,
  };

  if (effectiveItems.length === 0 && emptyState) {
    return (
      <div
        className={cn(
          !unstyled && "py-8 text-center",
          className,
          classNames?.container,
        )}
        style={containerStyle}
      >
        {emptyState}
      </div>
    );
  }

  if (isVirtualized) {
    return (
      <div
        id={id}
        ref={scrollContainerRef}
        className={cn(
          !unstyled && "overflow-auto",
          className,
          classNames?.container,
        )}
        style={{
          ...containerStyle,
          height,
          ...(unstyled
            ? {}
            : {
                scrollbarWidth: "thin",
                scrollbarColor: "#71717a transparent",
              }),
        }}
      >
        <div
          className="relative"
          style={{ height: virtualizer.getTotalSize() }}
        >
          {virtualizer.getVirtualItems().map((virtualRow) => (
            <div
              key={virtualRow.key}
              data-index={virtualRow.index}
              ref={virtualizer.measureElement}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              {renderCommentItem(virtualRow.index)}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div
      id={id}
      className={cn(className, classNames?.container)}
      style={containerStyle}
    >
      {flattenedItems.map((_, index) => renderCommentItem(index))}
    </div>
  );
}
