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

/**
 * Default action menu renderer - a simple dropdown
 */
function DefaultActionMenu({
  actions,
  onAction,
}: {
  actions: TreeItemAction[];
  onAction: (key: string) => void;
}) {
  const [isOpen, setIsOpen] = React.useState(false);
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
    <div ref={menuRef} className="relative">
      <button
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className="p-0.5 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-700/50 rounded transition-colors"
      >
        <DotsVerticalIcon />
      </button>
      {isOpen && (
        <div className="absolute right-0 top-full mt-1 z-50 min-w-36 bg-zinc-900 border border-zinc-800 rounded-lg shadow-xl shadow-black/60 py-1 backdrop-blur-sm">
          {actions.map((action) => (
            <button
              key={action.key}
              onClick={(e) => {
                e.stopPropagation();
                onAction(action.key);
                setIsOpen(false);
              }}
              disabled={action.disabled}
              className={cn(
                "w-full px-3 py-1.5 text-left text-xs flex items-center gap-2",
                "text-zinc-300 hover:bg-zinc-800/80 hover:text-zinc-100 transition-colors",
                action.disabled && "opacity-50 cursor-not-allowed",
                action.destructive &&
                  "text-red-400 hover:text-red-400 hover:bg-red-500/10",
              )}
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
    const showCollapseButton = onCollapse && hasChildren;
    const isGhostIndicator = ghost && indicator;
    const hasItemActions = itemActions && itemActions.length > 0;

    // Default styles (can be disabled with unstyled prop)
    const defaultStyles = {
      item: "group flex items-center gap-1.5 py-1.5 px-2 my-0.5 rounded border text-sm bg-white/[0.03] border-white/10 hover:bg-white/[0.06] hover:border-white/20 outline-none",
      itemSelected: "bg-cyan-500/10 border-cyan-500/30",
      itemDragging:
        "shadow-lg shadow-black/40 bg-white/[0.08] border-white/30 ring-1 ring-cyan-500/50",
      handle: "flex-shrink-0 text-white/30 hover:text-white/60 cursor-grab",
      collapseButton: "flex-shrink-0 text-white/40 hover:text-white/70",
      label: "flex-1 truncate",
      labelSelected: "text-cyan-300",
      labelDefault: "text-white/80",
      indicator: "h-0.5 my-0.5 rounded-full bg-cyan-500 relative",
      indicatorDot:
        "absolute -left-1 -top-[3px] w-2 h-2 rounded-full border-2 border-cyan-500 bg-[#0a0a0f]",
    };

    return (
      <li
        className={cn(
          "list-none",
          clone && "inline-block pointer-events-none pl-2 pt-1",
          ghost && !indicator && "opacity-40",
          ghost && indicator && "relative z-[1]",
          disableSelection && "select-none",
          disableInteraction && "pointer-events-none",
        )}
        ref={wrapperRef}
        style={
          {
            paddingLeft: clone ? undefined : `${indentationWidth * depth}px`,
          } as CSSProperties
        }
        {...props}
      >
        {isGhostIndicator ? (
          <div
            ref={ref}
            style={style}
            className={cn(
              !unstyled && defaultStyles.indicator,
              classNames?.indicator,
            )}
          >
            <div className={cn(!unstyled && defaultStyles.indicatorDot)} />
          </div>
        ) : (
          <div
            ref={ref}
            style={style}
            onClick={onSelect}
            className={cn(
              !unstyled && defaultStyles.item,
              !unstyled && isSelected && defaultStyles.itemSelected,
              !unstyled && clone && defaultStyles.itemDragging,
              onSelect && !clone && "cursor-pointer",
              classNames?.item,
              isSelected && classNames?.itemSelected,
              clone && classNames?.itemDragging,
              className,
            )}
          >
            {showHandle && (
              <span
                className={cn(
                  !unstyled && defaultStyles.handle,
                  classNames?.handle,
                )}
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
                className={cn(
                  !unstyled && defaultStyles.collapseButton,
                  classNames?.collapseButton,
                )}
              >
                <ChevronRightIcon
                  className="transition-transform duration-150"
                  style={{
                    transform: collapsed ? "rotate(0deg)" : "rotate(90deg)",
                  }}
                />
              </button>
            )}

            {icon && <span className="flex-shrink-0">{icon}</span>}

            <span
              className={cn(
                !unstyled && defaultStyles.label,
                !unstyled &&
                  (isSelected
                    ? defaultStyles.labelSelected
                    : defaultStyles.labelDefault),
                classNames?.label,
              )}
              title={typeof value === "string" ? value : undefined}
            >
              {value}
            </span>

            {clone && childCount && childCount > 1 && (
              <span className="absolute -top-1.5 -right-1.5 flex items-center justify-center w-4 h-4 rounded-full bg-cyan-500 text-[9px] font-bold text-white">
                {childCount}
              </span>
            )}

            {!clone && (actions || onRemove || hasItemActions) && (
              <div
                className={cn(
                  "flex-shrink-0 flex items-center gap-0.5",
                  !unstyled && "opacity-0 group-hover:opacity-100",
                )}
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
                    />
                  ))}
                {onRemove && !hasItemActions && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemove();
                    }}
                    className="text-zinc-500 hover:text-red-400"
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
