import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
} from "react";
import { createPortal } from "react-dom";
import {
  Announcements,
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragOverlay,
  DragMoveEvent,
  DragEndEvent,
  DragOverEvent,
  MeasuringStrategy,
  DropAnimation,
  Modifier,
  defaultDropAnimation,
  UniqueIdentifier,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useVirtualizer } from "@tanstack/react-virtual";
import { cn } from "./utils";

import {
  buildTree,
  flattenTree,
  getProjection,
  getChildCount,
  removeItem,
  removeChildrenOf,
  setProperty,
} from "./utilities";
import type {
  FlattenedItem,
  SensorContext,
  TreeItems,
  DndTreeProps,
  TreeItemRenderProps,
  DropValidationContext,
  ItemData,
} from "./types";
import { sortableTreeKeyboardCoordinates } from "./keyboardCoordinates";
import { SortableDndTreeItem } from "./SortableDndTreeItem";
import { DndTreeItem } from "./DndTreeItem";

const measuring = {
  droppable: {
    strategy: MeasuringStrategy.Always,
  },
};

const dropAnimationConfig: DropAnimation = {
  keyframes({ transform }) {
    return [
      { opacity: 1, transform: CSS.Transform.toString(transform.initial) },
      {
        opacity: 0,
        transform: CSS.Transform.toString({
          ...transform.final,
          x: transform.final.x + 5,
          y: transform.final.y + 5,
        }),
      },
    ];
  },
  easing: "ease-out",
  sideEffects({ active }) {
    active.node.animate([{ opacity: 0 }, { opacity: 1 }], {
      duration: defaultDropAnimation.duration,
      easing: defaultDropAnimation.easing,
    });
  },
};

const adjustTranslate: Modifier = ({ transform }) => {
  return {
    ...transform,
    y: transform.y - 25,
  };
};

export function DndTree<T extends ItemData = ItemData>({
  id,
  items: externalItems,
  onItemsChange,
  selectedId,
  onSelect,
  onMove,
  onRemove,
  onCollapseChange,
  canDrop: canDropProp,
  typeConfig,
  itemActions,
  onAction,
  collapsible = true,
  indicator = true,
  removable = false,
  indentationWidth = 24,
  maxDepth,
  renderItem,
  className,
  showHandles = true,
  emptyState,
  initialExpandedIds,
  disabledIds = [],
  height,
  estimatedItemHeight = 32,
  overscan = 5,
  renderActionMenu,
}: DndTreeProps<T>) {
  // Virtualization is enabled when height is provided
  const isVirtualized = height !== undefined;
  // Use internal state if no external control
  const [internalItems, setInternalItems] = useState<TreeItems<T>>(
    () => externalItems,
  );
  const items = externalItems;

  // For client-side only rendering to avoid hydration issues with portals
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Initialize collapsed state based on initialExpandedIds
  useEffect(() => {
    if (initialExpandedIds && initialExpandedIds.length > 0) {
      const newItems = JSON.parse(JSON.stringify(items)) as TreeItems<T>;
      const setInitialCollapsed = (treeItems: TreeItems<T>) => {
        for (const item of treeItems) {
          if (item.children.length > 0) {
            item.collapsed = !initialExpandedIds.includes(item.id);
          }
          setInitialCollapsed(item.children);
        }
      };
      setInitialCollapsed(newItems);
      onItemsChange?.(newItems);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null);
  const [overId, setOverId] = useState<UniqueIdentifier | null>(null);
  const [offsetLeft, setOffsetLeft] = useState(0);
  const [currentPosition, setCurrentPosition] = useState<{
    parentId: UniqueIdentifier | null;
    overId: UniqueIdentifier;
  } | null>(null);
  const [isDropAllowed, setIsDropAllowed] = useState(true);

  const flattenedItems = useMemo(() => {
    const flattenedTree = flattenTree(items);
    const collapsedItems = flattenedTree.reduce<UniqueIdentifier[]>(
      (acc, { children, collapsed, id }) =>
        collapsed && children.length ? [...acc, id] : acc,
      [],
    );

    return removeChildrenOf(
      flattenedTree,
      activeId != null ? [activeId, ...collapsedItems] : collapsedItems,
    );
  }, [activeId, items]);

  const projected =
    activeId && overId
      ? getProjection(
          flattenedItems,
          activeId,
          overId,
          offsetLeft,
          indentationWidth,
          maxDepth,
        )
      : null;

  // Auto-generate canDrop from typeConfig if provided
  const canDrop = useMemo(() => {
    if (canDropProp) return canDropProp;
    if (!typeConfig) return undefined;

    return (context: DropValidationContext<T>): boolean => {
      const { dragItem, targetParent } = context;
      const dragType = typeConfig.getType(dragItem);

      // Dropping at root level
      if (!targetParent) {
        const typeConf = typeConfig.types[dragType];
        return typeConf?.allowedAtRoot !== false; // Default to true
      }

      const targetType = typeConfig.getType(targetParent);
      const targetConf = typeConfig.types[targetType];

      if (!targetConf) return true; // Unknown type, allow

      // Check if target allows this type as a child
      return targetConf.allowedChildren.includes(dragType);
    };
  }, [canDropProp, typeConfig]);

  // Check if drop is allowed based on canDrop callback
  const checkDropAllowed = useCallback(
    (
      projectedParentId: UniqueIdentifier | null,
      projectedDepth: number,
    ): boolean => {
      if (!canDrop || !activeId) return true;

      const dragItem = flattenedItems.find((item) => item.id === activeId);
      if (!dragItem) return true;

      const targetParent = projectedParentId
        ? (flattenedItems.find((item) => item.id === projectedParentId) ?? null)
        : null;

      const context: DropValidationContext<T> = {
        dragItem,
        targetParent,
        projectedDepth,
        items,
      };

      return canDrop(context);
    },
    [canDrop, activeId, flattenedItems, items],
  );

  // Update drop allowed state when projection changes
  useEffect(() => {
    if (projected) {
      const allowed = checkDropAllowed(projected.parentId, projected.depth);
      setIsDropAllowed(allowed);
    } else {
      setIsDropAllowed(true);
    }
  }, [projected, checkDropAllowed]);

  const sensorContext: SensorContext = useRef({
    items: flattenedItems,
    offset: offsetLeft,
  });

  const [coordinateGetter] = useState(() =>
    sortableTreeKeyboardCoordinates(sensorContext, indicator, indentationWidth),
  );

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter,
    }),
  );

  const sortedIds = useMemo(
    () => flattenedItems.map(({ id }) => id),
    [flattenedItems],
  );

  const activeItem = activeId
    ? flattenedItems.find(({ id }) => id === activeId)
    : null;

  useEffect(() => {
    sensorContext.current = {
      items: flattenedItems,
      offset: offsetLeft,
    };
  }, [flattenedItems, offsetLeft]);

  const updateItems = useCallback(
    (newItems: TreeItems<T>) => {
      if (onItemsChange) {
        onItemsChange(newItems);
      } else {
        setInternalItems(newItems);
      }
    },
    [onItemsChange],
  );

  const handleRemove = useCallback(
    (id: UniqueIdentifier) => {
      onRemove?.(id);
      updateItems(removeItem(items, id));
    },
    [items, onRemove, updateItems],
  );

  const handleCollapse = useCallback(
    (id: UniqueIdentifier) => {
      const item = flattenedItems.find((i) => i.id === id);
      const newCollapsed = !item?.collapsed;
      onCollapseChange?.(id, newCollapsed);
      updateItems(setProperty(items, id, "collapsed", (value) => !value));
    },
    [flattenedItems, items, onCollapseChange, updateItems],
  );

  const handleSelect = useCallback(
    (id: UniqueIdentifier) => {
      onSelect?.(id);
    },
    [onSelect],
  );

  const announcements: Announcements = {
    onDragStart({ active }) {
      return `Picked up ${active.id}.`;
    },
    onDragMove({ active, over }) {
      return getMovementAnnouncement("onDragMove", active.id, over?.id);
    },
    onDragOver({ active, over }) {
      return getMovementAnnouncement("onDragOver", active.id, over?.id);
    },
    onDragEnd({ active, over }) {
      return getMovementAnnouncement("onDragEnd", active.id, over?.id);
    },
    onDragCancel({ active }) {
      return `Moving was cancelled. ${active.id} was dropped in its original position.`;
    },
  };

  function handleDragStart({ active: { id: activeId } }: DragStartEvent) {
    setActiveId(activeId);
    setOverId(activeId);

    const activeItem = flattenedItems.find(({ id }) => id === activeId);

    if (activeItem) {
      setCurrentPosition({
        parentId: activeItem.parentId,
        overId: activeId,
      });
    }

    document.body.style.setProperty("cursor", "grabbing");
  }

  function handleDragMove({ delta }: DragMoveEvent) {
    setOffsetLeft(delta.x);
  }

  function handleDragOver({ over }: DragOverEvent) {
    setOverId(over?.id ?? null);
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    resetState();

    if (projected && over) {
      // Check if drop is allowed before applying
      const dropAllowed = checkDropAllowed(projected.parentId, projected.depth);
      if (!dropAllowed) {
        return; // Cancel the drop
      }

      const { depth, parentId } = projected;
      const clonedItems: FlattenedItem<T>[] = JSON.parse(
        JSON.stringify(flattenTree(items)),
      );
      const overIndex = clonedItems.findIndex(({ id }) => id === over.id);
      const activeIndex = clonedItems.findIndex(({ id }) => id === active.id);
      const activeTreeItem = clonedItems[activeIndex];

      clonedItems[activeIndex] = { ...activeTreeItem, depth, parentId };

      const sortedItems = arrayMove(clonedItems, activeIndex, overIndex);
      const newItems = buildTree(sortedItems);

      // Calculate new index among siblings
      const siblings = parentId
        ? newItems.flatMap(function findChildren(item): typeof newItems {
            if (item.id === parentId) return item.children;
            return item.children.flatMap(findChildren);
          })
        : newItems;
      const newIndex = siblings.findIndex((item) => item.id === active.id);

      onMove?.(active.id, parentId, newIndex);
      updateItems(newItems);
    }
  }

  function handleDragCancel() {
    resetState();
  }

  function resetState() {
    setOverId(null);
    setActiveId(null);
    setOffsetLeft(0);
    setCurrentPosition(null);
    setIsDropAllowed(true);

    document.body.style.setProperty("cursor", "");
  }

  function getMovementAnnouncement(
    eventName: string,
    activeId: UniqueIdentifier,
    overId?: UniqueIdentifier,
  ) {
    if (overId && projected) {
      if (eventName !== "onDragEnd") {
        if (
          currentPosition &&
          projected.parentId === currentPosition.parentId &&
          overId === currentPosition.overId
        ) {
          return;
        } else {
          setCurrentPosition({
            parentId: projected.parentId,
            overId,
          });
        }
      }

      const clonedItems: FlattenedItem<T>[] = JSON.parse(
        JSON.stringify(flattenTree(items)),
      );
      const overIndex = clonedItems.findIndex(({ id }) => id === overId);
      const activeIndex = clonedItems.findIndex(({ id }) => id === activeId);
      const sortedItems = arrayMove(clonedItems, activeIndex, overIndex);

      const previousItem = sortedItems[overIndex - 1];

      let announcement;
      const movedVerb = eventName === "onDragEnd" ? "dropped" : "moved";
      const nestedVerb = eventName === "onDragEnd" ? "dropped" : "nested";

      if (!previousItem) {
        const nextItem = sortedItems[overIndex + 1];
        announcement = `${activeId} was ${movedVerb} before ${nextItem.id}.`;
      } else {
        if (projected.depth > previousItem.depth) {
          announcement = `${activeId} was ${nestedVerb} under ${previousItem.id}.`;
        } else {
          let previousSibling: FlattenedItem<T> | undefined = previousItem;
          while (previousSibling && projected.depth < previousSibling.depth) {
            const parentId: UniqueIdentifier | null = previousSibling.parentId;
            previousSibling = sortedItems.find(({ id }) => id === parentId);
          }

          if (previousSibling) {
            announcement = `${activeId} was ${movedVerb} after ${previousSibling.id}.`;
          }
        }
      }

      return announcement;
    }

    return;
  }

  // Type-config based item renderer
  const typeConfigRenderItem = useCallback(
    (props: TreeItemRenderProps<T>) => {
      if (!typeConfig) return null;

      const {
        item,
        depth,
        isCollapsed,
        hasChildren,
        isSelected,
        isClone,
        childCount,
        onCollapse,
        onRemove: itemOnRemove,
        onSelect: itemOnSelect,
        actions: itemActionsList,
        onAction: itemOnAction,
      } = props;

      const itemType = typeConfig.getType(item);
      const typeConf = typeConfig.types[itemType];
      const displayName = typeConfig.getName(item);

      // Use getIcon if provided (for per-item dynamic icons), otherwise fall back to type icon
      const icon = typeConfig.getIcon
        ? typeConfig.getIcon(item)
        : typeConf?.icon;

      return (
        <SortableDndTreeItem
          id={item.id}
          depth={depth}
          value={displayName}
          collapsed={isCollapsed}
          hasChildren={hasChildren}
          isSelected={isSelected}
          clone={isClone}
          childCount={childCount}
          indentationWidth={indentationWidth}
          indicator={indicator}
          showHandle={showHandles}
          disabled={disabledIds.includes(item.id)}
          onCollapse={collapsible && hasChildren ? onCollapse : undefined}
          onRemove={removable ? itemOnRemove : undefined}
          onSelect={itemOnSelect}
          icon={icon}
          className={typeConf?.iconColor}
          itemActions={itemActionsList}
          onAction={itemOnAction}
          renderActionMenu={renderActionMenu}
        />
      );
    },
    [
      typeConfig,
      indentationWidth,
      indicator,
      showHandles,
      collapsible,
      removable,
      disabledIds,
      renderActionMenu,
    ],
  );

  // Default item renderer (no typeConfig)
  const defaultRenderItem = useCallback(
    (props: TreeItemRenderProps<T>) => {
      const {
        item,
        depth,
        isCollapsed,
        hasChildren,
        isSelected,
        isClone,
        childCount,
        onCollapse,
        onRemove: itemOnRemove,
        onSelect: itemOnSelect,
      } = props;

      // Get display value - try data.name, data.title, or fall back to id
      const data = item.data as Record<string, unknown> | undefined;
      const displayValue =
        (data?.name as string) || (data?.title as string) || String(item.id);

      return (
        <SortableDndTreeItem
          id={item.id}
          depth={depth}
          value={displayValue}
          collapsed={isCollapsed}
          hasChildren={hasChildren}
          isSelected={isSelected}
          clone={isClone}
          childCount={childCount}
          indentationWidth={indentationWidth}
          indicator={indicator}
          showHandle={showHandles}
          disabled={disabledIds.includes(item.id)}
          onCollapse={collapsible && hasChildren ? onCollapse : undefined}
          onRemove={removable ? itemOnRemove : undefined}
          onSelect={itemOnSelect}
          renderActionMenu={renderActionMenu}
        />
      );
    },
    [
      indentationWidth,
      indicator,
      showHandles,
      collapsible,
      removable,
      disabledIds,
      renderActionMenu,
    ],
  );

  // Choose the appropriate renderer
  const effectiveRenderItem =
    renderItem || (typeConfig ? typeConfigRenderItem : defaultRenderItem);

  // Get display name for overlay
  const getDisplayName = useCallback(
    (item: FlattenedItem<T>) => {
      if (typeConfig) {
        return typeConfig.getName(item);
      }
      const data = item.data as Record<string, unknown> | undefined;
      return (
        (data?.name as string) || (data?.title as string) || String(item.id)
      );
    },
    [typeConfig],
  );

  // Get icon for overlay
  const getOverlayIcon = useCallback(
    (item: FlattenedItem<T>) => {
      if (typeConfig) {
        const itemType = typeConfig.getType(item);
        return typeConfig.types[itemType]?.icon;
      }
      return undefined;
    },
    [typeConfig],
  );

  // Ref for virtualized scroll container
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Virtualizer setup
  const virtualizer = useVirtualizer({
    count: flattenedItems.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: () => estimatedItemHeight,
    overscan,
  });

  // Helper to render a single item
  const renderTreeItem = useCallback(
    (index: number, style?: React.CSSProperties) => {
      const item = flattenedItems[index];
      if (!item) return null;

      const { id, children, collapsed, depth } = item;
      const isCollapsed = Boolean(collapsed && children.length);
      const hasChildren = children.length > 0;
      const isSelected = selectedId === id;
      const childCount = getChildCount(items, id);
      const projectedDepth =
        id === activeId && projected ? projected.depth : depth;

      // Get actions for this item
      const itemActionsResolved =
        typeof itemActions === "function" ? itemActions(item) : itemActions;

      const renderProps: TreeItemRenderProps<T> = {
        item,
        depth: projectedDepth,
        isCollapsed,
        hasChildren,
        childCount: childCount + 1,
        isSelected,
        isClone: false,
        isDragging: id === activeId,
        onCollapse: () => handleCollapse(id),
        onRemove: () => handleRemove(id),
        onSelect: () => handleSelect(id),
        handleProps: undefined,
        actions: itemActionsResolved,
        onAction: onAction
          ? (actionKey: string) => onAction(actionKey, id)
          : undefined,
      };

      return (
        <div key={id} style={style}>
          {effectiveRenderItem(renderProps)}
        </div>
      );
    },
    [
      flattenedItems,
      selectedId,
      items,
      activeId,
      projected,
      itemActions,
      handleCollapse,
      handleRemove,
      handleSelect,
      onAction,
      effectiveRenderItem,
    ],
  );

  if (items.length === 0 && emptyState) {
    return (
      <div
        className={className}
        style={{ padding: "32px 0", textAlign: "center" }}
      >
        {emptyState}
      </div>
    );
  }

  // Drag overlay portal (shared between virtualized and non-virtualized)
  const dragOverlayPortal = isMounted
    ? createPortal(
        <DragOverlay
          dropAnimation={dropAnimationConfig}
          modifiers={indicator ? [adjustTranslate] : undefined}
        >
          {activeId && activeItem ? (
            <DndTreeItem
              depth={activeItem.depth}
              clone
              childCount={getChildCount(items, activeId) + 1}
              value={getDisplayName(activeItem)}
              indentationWidth={indentationWidth}
              showHandle={showHandles}
              icon={getOverlayIcon(activeItem)}
              className={
                !isDropAllowed ? "ring-red-500/50 border-red-500/50" : undefined
              }
            />
          ) : null}
        </DragOverlay>,
        document.body,
      )
    : null;

  return (
    <DndContext
      id={id}
      accessibility={{ announcements }}
      sensors={sensors}
      collisionDetection={closestCenter}
      measuring={measuring}
      onDragStart={handleDragStart}
      onDragMove={handleDragMove}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <SortableContext items={sortedIds} strategy={verticalListSortingStrategy}>
        {isVirtualized ? (
          // Virtualized rendering for large trees
          <>
            <style>{`
              .dnd-tree-scroll::-webkit-scrollbar { width: 8px; height: 8px; }
              .dnd-tree-scroll::-webkit-scrollbar-track { background: transparent; }
              .dnd-tree-scroll::-webkit-scrollbar-thumb { background: #71717a; border-radius: 4px; }
              .dnd-tree-scroll::-webkit-scrollbar-thumb:hover { background: #a1a1aa; }
            `}</style>
            <div
              ref={scrollContainerRef}
              className={cn("dnd-tree-scroll", className)}
              style={{
                height,
                overflow: "auto",
                scrollbarWidth: "thin",
                scrollbarColor: "#71717a transparent",
              }}
            >
              <ul
                style={{
                  listStyle: "none",
                  margin: 0,
                  padding: 0,
                  position: "relative",
                  height: virtualizer.getTotalSize(),
                  transition: "height 200ms ease-out",
                }}
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
                      transition: "transform 150ms ease-out",
                    }}
                  >
                    {renderTreeItem(virtualRow.index)}
                  </div>
                ))}
              </ul>
            </div>
          </>
        ) : (
          // Standard rendering for smaller trees
          <ul
            className={className}
            style={{ listStyle: "none", margin: 0, padding: 0 }}
          >
            {flattenedItems.map((_, index) => renderTreeItem(index))}
          </ul>
        )}
        {dragOverlayPortal}
      </SortableContext>
    </DndContext>
  );
}
