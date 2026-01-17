import React, {
  forwardRef,
  type HTMLAttributes,
  type CSSProperties,
  type ReactNode,
} from "react";
import { cn } from "./utils";
import type { TreeItemAction, TreeClassNames } from "./types";

/** Default icons as SVG - users can override via props */
const ChevronRightIcon = ({
  className,
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) => (
  <svg
    className={className}
    style={style}
    width="12"
    height="12"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <path d="M9 18l6-6-6-6" />
  </svg>
);

const GripVerticalIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    width="12"
    height="12"
    viewBox="0 0 24 24"
    fill="currentColor"
  >
    <circle cx="9" cy="6" r="1.5" />
    <circle cx="15" cy="6" r="1.5" />
    <circle cx="9" cy="12" r="1.5" />
    <circle cx="15" cy="12" r="1.5" />
    <circle cx="9" cy="18" r="1.5" />
    <circle cx="15" cy="18" r="1.5" />
  </svg>
);

const CloseIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    width="12"
    height="12"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <path d="M18 6L6 18M6 6l12 12" />
  </svg>
);

const DotsVerticalIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    width="12"
    height="12"
    viewBox="0 0 24 24"
    fill="currentColor"
  >
    <circle cx="12" cy="5" r="2" />
    <circle cx="12" cy="12" r="2" />
    <circle cx="12" cy="19" r="2" />
  </svg>
);

export interface DndTreeItemProps
  extends Omit<HTMLAttributes<HTMLLIElement>, "id"> {
  childCount?: number;
  clone?: boolean;
  collapsed?: boolean;
  depth: number;
  disableInteraction?: boolean;
  disableSelection?: boolean;
  ghost?: boolean;
  handleProps?: Record<string, unknown>;
  indicator?: boolean;
  indentationWidth: number;
  value: ReactNode;
  isSelected?: boolean;
  onCollapse?(): void;
  onRemove?(): void;
  onSelect?(): void;
  wrapperRef?(node: HTMLLIElement): void;
  showHandle?: boolean;
  icon?: ReactNode;
  hasChildren?: boolean;
  /** Custom actions ReactNode (legacy) */
  actions?: ReactNode;
  /** Action menu items */
  itemActions?: TreeItemAction[];
  /** Callback when an action is triggered */
  onAction?(actionKey: string): void;
  /** Custom render function for the action menu */
  renderActionMenu?: (
    actions: TreeItemAction[],
    onAction: (key: string) => void,
  ) => ReactNode;
  /** Custom class names for styling */
  classNames?: TreeClassNames;
  /** Remove all default styles */
  unstyled?: boolean;
}

// Inline style definitions
const inlineStyles = {
  menuButton: {
    padding: "2px",
    color: "#71717a",
    borderRadius: "4px",
    borderWidth: 0,
    borderStyle: "none",
    backgroundColor: "transparent",
    cursor: "pointer",
    transition: "color 150ms ease, background-color 150ms ease",
  } as CSSProperties,
  menuButtonHover: {
    color: "#d4d4d8",
    backgroundColor: "rgba(63, 63, 70, 0.5)",
  } as CSSProperties,
  menuDropdown: {
    position: "absolute",
    right: 0,
    top: "100%",
    marginTop: "4px",
    zIndex: 50,
    minWidth: "144px",
    backgroundColor: "#18181b",
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: "#27272a",
    borderRadius: "8px",
    boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.6)",
    padding: "4px 0",
  } as CSSProperties,
  menuItem: {
    width: "100%",
    padding: "6px 12px",
    textAlign: "left" as const,
    fontSize: "12px",
    display: "flex",
    alignItems: "center",
    gap: "8px",
    color: "#d4d4d8",
    backgroundColor: "transparent",
    borderWidth: 0,
    borderStyle: "none",
    cursor: "pointer",
    transition: "background-color 150ms ease, color 150ms ease",
  } as CSSProperties,
  menuItemDestructive: {
    color: "#f87171",
  } as CSSProperties,
  menuItemDisabled: {
    opacity: 0.5,
    cursor: "not-allowed",
  } as CSSProperties,
  item: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    padding: "6px 8px",
    margin: "2px 0",
    borderRadius: "4px",
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: "rgba(255, 255, 255, 0.1)",
    fontSize: "14px",
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    outline: "none",
    transition: "background-color 150ms ease, border-color 150ms ease",
  } as CSSProperties,
  itemSelected: {
    backgroundColor: "rgba(6, 182, 212, 0.1)",
    borderColor: "rgba(6, 182, 212, 0.3)",
  } as CSSProperties,
  itemDragging: {
    boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.4)",
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderColor: "rgba(255, 255, 255, 0.3)",
  } as CSSProperties,
  handle: {
    flexShrink: 0,
    color: "rgba(255, 255, 255, 0.3)",
    cursor: "grab",
  } as CSSProperties,
  collapseButton: {
    flexShrink: 0,
    color: "rgba(255, 255, 255, 0.4)",
    backgroundColor: "transparent",
    borderWidth: 0,
    borderStyle: "none",
    padding: 0,
    cursor: "pointer",
  } as CSSProperties,
  label: {
    flex: 1,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap" as const,
  } as CSSProperties,
  labelSelected: {
    color: "#67e8f9",
  } as CSSProperties,
  labelDefault: {
    color: "rgba(255, 255, 255, 0.8)",
  } as CSSProperties,
  indicator: {
    height: "2px",
    margin: "2px 0",
    borderRadius: "9999px",
    backgroundColor: "#06b6d4",
    position: "relative" as const,
  } as CSSProperties,
  indicatorDot: {
    position: "absolute" as const,
    left: "-4px",
    top: "-3px",
    width: "8px",
    height: "8px",
    borderRadius: "9999px",
    borderWidth: "2px",
    borderStyle: "solid",
    borderColor: "#06b6d4",
    backgroundColor: "#0a0a0f",
  } as CSSProperties,
  childCountBadge: {
    position: "absolute" as const,
    top: "-6px",
    right: "-6px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "16px",
    height: "16px",
    borderRadius: "9999px",
    backgroundColor: "#06b6d4",
    fontSize: "9px",
    fontWeight: "bold",
    color: "white",
  } as CSSProperties,
  actionsContainer: {
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    gap: "2px",
    opacity: 0,
    transition: "opacity 150ms ease",
  } as CSSProperties,
  removeButton: {
    color: "#71717a",
    backgroundColor: "transparent",
    borderWidth: 0,
    borderStyle: "none",
    cursor: "pointer",
    padding: "2px",
  } as CSSProperties,
};

/**
 * Default action menu renderer - a simple dropdown
 */
function DefaultActionMenu({
  actions,
  onAction,
  unstyled,
}: {
  actions: TreeItemAction[];
  onAction: (key: string) => void;
  unstyled?: boolean;
}) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [hoveredButton, setHoveredButton] = React.useState(false);
  const [hoveredItem, setHoveredItem] = React.useState<string | null>(null);
  const menuRef = React.useRef<HTMLDivElement>(null);

  // Close on click outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  return (
    <div ref={menuRef} style={{ position: "relative" }}>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        onMouseEnter={() => setHoveredButton(true)}
        onMouseLeave={() => setHoveredButton(false)}
        style={
          unstyled
            ? undefined
            : {
                ...inlineStyles.menuButton,
                ...(hoveredButton ? inlineStyles.menuButtonHover : {}),
              }
        }
      >
        <DotsVerticalIcon />
      </button>
      {isOpen && (
        <div style={unstyled ? undefined : inlineStyles.menuDropdown}>
          {actions.map((action) => (
            <button
              key={action.key}
              onClick={(e) => {
                e.stopPropagation();
                onAction(action.key);
                setIsOpen(false);
              }}
              disabled={action.disabled}
              onMouseEnter={() => setHoveredItem(action.key)}
              onMouseLeave={() => setHoveredItem(null)}
              style={
                unstyled
                  ? undefined
                  : {
                      ...inlineStyles.menuItem,
                      ...(action.destructive
                        ? inlineStyles.menuItemDestructive
                        : {}),
                      ...(action.disabled ? inlineStyles.menuItemDisabled : {}),
                      ...(hoveredItem === action.key && !action.disabled
                        ? {
                            backgroundColor: action.destructive
                              ? "rgba(239, 68, 68, 0.1)"
                              : "rgba(39, 39, 42, 0.8)",
                            color: action.destructive ? "#f87171" : "#f4f4f5",
                          }
                        : {}),
                    }
              }
            >
              {action.icon}
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export const DndTreeItem = forwardRef<HTMLDivElement, DndTreeItemProps>(
  (
    {
      childCount,
      clone,
      depth,
      disableSelection,
      disableInteraction,
      ghost,
      handleProps,
      indentationWidth,
      indicator,
      collapsed,
      onCollapse,
      onRemove,
      onSelect,
      style,
      value,
      isSelected,
      wrapperRef,
      showHandle = true,
      icon,
      hasChildren,
      actions,
      itemActions,
      onAction,
      renderActionMenu,
      classNames,
      unstyled,
      className,
      ...props
    },
    ref,
  ) => {
    const [isHovered, setIsHovered] = React.useState(false);
    const showCollapseButton = onCollapse && hasChildren;
    const isGhostIndicator = ghost && indicator;
    const hasItemActions = itemActions && itemActions.length > 0;

    // Compute li wrapper styles
    const liStyle: CSSProperties = {
      listStyle: "none",
      paddingLeft: clone ? undefined : `${indentationWidth * depth}px`,
      ...(clone
        ? {
            display: "inline-block",
            pointerEvents: "none",
            paddingLeft: "8px",
            paddingTop: "4px",
          }
        : {}),
      ...(ghost && !indicator ? { opacity: 0.4 } : {}),
      ...(ghost && indicator ? { position: "relative", zIndex: 1 } : {}),
      ...(disableSelection ? { userSelect: "none" } : {}),
      ...(disableInteraction ? { pointerEvents: "none" } : {}),
    };

    // Compute item styles
    const itemStyle: CSSProperties = {
      ...style,
      ...(unstyled ? {} : inlineStyles.item),
      ...(unstyled ? {} : isSelected ? inlineStyles.itemSelected : {}),
      ...(unstyled ? {} : clone ? inlineStyles.itemDragging : {}),
      ...(onSelect && !clone ? { cursor: "pointer" } : {}),
      ...(isHovered && !unstyled && !clone
        ? {
            backgroundColor: isSelected
              ? "rgba(6, 182, 212, 0.15)"
              : "rgba(255, 255, 255, 0.06)",
            borderColor: isSelected
              ? "rgba(6, 182, 212, 0.4)"
              : "rgba(255, 255, 255, 0.2)",
          }
        : {}),
    };

    return (
      <li
        className={cn(classNames?.wrapper)}
        ref={wrapperRef}
        style={liStyle}
        {...props}
      >
        {isGhostIndicator ? (
          <div
            ref={ref}
            style={{ ...style, ...(unstyled ? {} : inlineStyles.indicator) }}
            className={classNames?.indicator}
          >
            <div style={unstyled ? undefined : inlineStyles.indicatorDot} />
          </div>
        ) : (
          <div
            ref={ref}
            style={itemStyle}
            onClick={onSelect}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            className={cn(
              classNames?.item,
              isSelected && classNames?.itemSelected,
              clone && classNames?.itemDragging,
              className,
            )}
          >
            {showHandle && (
              <span
                style={unstyled ? undefined : inlineStyles.handle}
                className={classNames?.handle}
                {...handleProps}
              >
                <GripVerticalIcon />
              </span>
            )}

            {showCollapseButton && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onCollapse?.();
                }}
                style={unstyled ? undefined : inlineStyles.collapseButton}
                className={classNames?.collapseButton}
              >
                <ChevronRightIcon
                  style={{
                    transition: "transform 150ms ease",
                    transform: collapsed ? "rotate(0deg)" : "rotate(90deg)",
                  }}
                />
              </button>
            )}

            {icon && <span style={{ flexShrink: 0 }}>{icon}</span>}

            <span
              style={{
                ...(unstyled ? {} : inlineStyles.label),
                ...(unstyled
                  ? {}
                  : isSelected
                    ? inlineStyles.labelSelected
                    : inlineStyles.labelDefault),
              }}
              className={classNames?.label}
              title={typeof value === "string" ? value : undefined}
            >
              {value}
            </span>

            {clone && childCount && childCount > 1 && (
              <span style={unstyled ? undefined : inlineStyles.childCountBadge}>
                {childCount}
              </span>
            )}

            {!clone && (actions || onRemove || hasItemActions) && (
              <div
                style={{
                  ...(unstyled ? {} : inlineStyles.actionsContainer),
                  ...(isHovered && !unstyled ? { opacity: 1 } : {}),
                }}
                className={classNames?.actions}
              >
                {actions}
                {hasItemActions &&
                  onAction &&
                  (renderActionMenu ? (
                    renderActionMenu(itemActions!, onAction)
                  ) : (
                    <DefaultActionMenu
                      actions={itemActions!}
                      onAction={onAction}
                      unstyled={unstyled}
                    />
                  ))}
                {onRemove && !hasItemActions && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemove();
                    }}
                    style={unstyled ? undefined : inlineStyles.removeButton}
                    className={classNames?.removeButton}
                  >
                    <CloseIcon />
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </li>
    );
  },
);

DndTreeItem.displayName = "DndTreeItem";
