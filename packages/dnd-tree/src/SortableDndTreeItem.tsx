import React, { type CSSProperties, type ReactNode } from "react";
import type { UniqueIdentifier } from "@dnd-kit/core";
import { AnimateLayoutChanges, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { DndTreeItem, type DndTreeItemProps } from "./DndTreeItem";
import { iOS } from "./utils";

export interface SortableDndTreeItemProps
  extends Omit<
    DndTreeItemProps,
    "handleProps" | "ghost" | "disableInteraction"
  > {
  /** Unique identifier for the item */
  id: UniqueIdentifier;
  /** Whether this item is disabled from being dragged */
  disabled?: boolean;
}

const animateLayoutChanges: AnimateLayoutChanges = ({
  isSorting,
  wasDragging,
}) => (isSorting || wasDragging ? false : true);

export function SortableDndTreeItem({
  id,
  depth,
  disabled,
  ...props
}: SortableDndTreeItemProps): ReactNode {
  const {
    attributes,
    isDragging,
    isSorting,
    listeners,
    setDraggableNodeRef,
    setDroppableNodeRef,
    transform,
    transition,
  } = useSortable({
    id,
    animateLayoutChanges,
    disabled,
  });

  const style: CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
  };

  return (
    <DndTreeItem
      ref={setDraggableNodeRef}
      wrapperRef={setDroppableNodeRef}
      style={style}
      depth={depth}
      ghost={isDragging}
      disableSelection={iOS}
      disableInteraction={isSorting}
      handleProps={{
        ...attributes,
        ...listeners,
      }}
      {...props}
    />
  );
}
