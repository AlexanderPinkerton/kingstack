"use client";

import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { cn } from "./utils";

import type {
  CommentAction,
  CommentData,
  FlattenedComment,
  CommentTreeClassNames,
} from "./types";

export interface DefaultCommentItemProps<T extends CommentData = CommentData> {
  comment: FlattenedComment<T>;
  depth: number;
  isCollapsed: boolean;
  hasReplies: boolean;
  replyCount: number;
  isSelected: boolean;
  onCollapse?: () => void;
  onSelect?: () => void;
  actions?: CommentAction[];
  onAction?: (actionKey: string) => void;
  depthColors: string[];
  indentationWidth: number;
  collapsible: boolean;
  maxInlineActions: number;
  classNames?: CommentTreeClassNames;
  unstyled: boolean;
  /** Callback when a depth line is clicked, receives depth index (0-based) */
  onDepthLineClick?: (depthIndex: number) => void;
  /** Ancestor IDs for this comment, ordered from immediate parent to root */
  ancestors?: string[];
  /** Currently hovered ancestor ID (shared across all comment items) */
  hoveredAncestorId?: string | null;
  /** Callback to set the hovered ancestor ID */
  onAncestorHover?: (ancestorId: string | null) => void;
}

/**
 * Get color for a specific depth index
 */
function getDepthColorForIndex(index: number, colors: string[]): string {
  return colors[index % colors.length];
}

/**
 * Format a date as relative time
 */
function formatRelativeTime(date: Date | string | undefined): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString();
}

/**
 * Chevron icon component
 */
function ChevronIcon({
  direction,
  size = 14,
}: {
  direction: "right" | "down";
  size?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{
        transform: direction === "down" ? "rotate(90deg)" : "rotate(0deg)",
        transition: "transform 150ms ease",
      }}
    >
      <path d="M9 18l6-6-6-6" />
    </svg>
  );
}

/**
 * More/ellipsis icon component
 */
function MoreIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <circle cx="5" cy="12" r="2" />
      <circle cx="12" cy="12" r="2" />
      <circle cx="19" cy="12" r="2" />
    </svg>
  );
}

/**
 * Simple dropdown menu for overflow actions (renders via portal to escape container overflow)
 */
function OverflowMenu({
  actions,
  onAction,
  classNames,
  unstyled,
}: {
  actions: CommentAction[];
  onAction?: (key: string) => void;
  classNames?: CommentTreeClassNames;
  unstyled: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const [placement, setPlacement] = useState<"below" | "above">("below");
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        buttonRef.current &&
        !buttonRef.current.contains(target) &&
        menuRef.current &&
        !menuRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    };

    // Close on scroll (menu position would be stale)
    const handleScroll = () => setIsOpen(false);

    document.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("scroll", handleScroll, true);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("scroll", handleScroll, true);
    };
  }, [isOpen]);

  // Calculate position when opening
  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();

    if (!isOpen && buttonRef.current) {
      const buttonRect = buttonRef.current.getBoundingClientRect();
      const menuHeight = actions.length * 32 + 8; // Approximate menu height
      const menuWidth = 140; // Matches min-w-[140px]
      const spaceBelow = window.innerHeight - buttonRect.bottom;
      const spaceAbove = buttonRect.top;

      // Decide vertical placement
      const shouldPlaceAbove =
        spaceBelow < menuHeight && spaceAbove > spaceBelow;
      setPlacement(shouldPlaceAbove ? "above" : "below");

      // Calculate horizontal position (keep menu within viewport)
      let left = buttonRect.left;
      if (left + menuWidth > window.innerWidth) {
        // Align to right edge of button, but don't go off left edge
        left = Math.max(8, buttonRect.right - menuWidth);
      }

      // Calculate position (fixed positioning is relative to viewport, no scroll offset needed)
      if (shouldPlaceAbove) {
        setMenuPosition({
          top: buttonRect.top - menuHeight - 4,
          left,
        });
      } else {
        setMenuPosition({
          top: buttonRect.bottom + 4,
          left,
        });
      }
    }

    setIsOpen(!isOpen);
  };

  // Check if we can render portal (client-side only)
  const canUsePortal = typeof document !== "undefined";

  const menuContent = isOpen && (
    <div
      ref={menuRef}
      className={cn(
        !unstyled &&
          "fixed z-[9999] min-w-[140px] rounded-md border border-zinc-700 bg-zinc-800 py-1 shadow-lg",
        classNames?.overflowMenu,
      )}
      style={{
        top: menuPosition.top,
        left: menuPosition.left,
      }}
    >
      {actions.map((action) => (
        <button
          key={action.key}
          onClick={(e) => {
            e.stopPropagation();
            onAction?.(action.key);
            setIsOpen(false);
          }}
          disabled={action.disabled}
          className={cn(
            !unstyled &&
              "w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left transition-colors",
            !unstyled &&
              !action.destructive &&
              "text-zinc-300 hover:bg-zinc-700",
            !unstyled &&
              action.destructive &&
              "text-red-400 hover:bg-red-500/10",
            !unstyled && action.disabled && "opacity-50 cursor-not-allowed",
            classNames?.overflowMenuItem,
            action.destructive
              ? classNames?.actionButtonDestructive
              : classNames?.actionButton,
          )}
        >
          {action.icon}
          {action.label}
        </button>
      ))}
    </div>
  );

  return (
    <>
      <button
        ref={buttonRef}
        onClick={handleToggle}
        className={cn(
          !unstyled &&
            "p-1 rounded transition-colors text-zinc-500 hover:bg-zinc-700/50 hover:text-zinc-300",
          classNames?.overflowButton,
        )}
        aria-label="More actions"
      >
        <MoreIcon size={14} />
      </button>

      {canUsePortal && menuContent && createPortal(menuContent, document.body)}
    </>
  );
}

export function DefaultCommentItem<T extends CommentData = CommentData>({
  comment,
  depth,
  isCollapsed,
  hasReplies,
  replyCount,
  isSelected,
  onCollapse,
  onSelect,
  actions,
  onAction,
  depthColors,
  indentationWidth,
  collapsible,
  maxInlineActions,
  classNames,
  unstyled,
  onDepthLineClick,
  ancestors = [],
  hoveredAncestorId,
  onAncestorHover,
}: DefaultCommentItemProps<T>) {
  const { data } = comment;

  // Split actions into inline and overflow
  const inlineActions = actions?.slice(0, maxInlineActions) ?? [];
  const overflowActions = actions?.slice(maxInlineActions) ?? [];

  return (
    <div
      className={cn(
        !unstyled && "flex",
        !unstyled && isSelected && "bg-zinc-800/50",
        classNames?.comment,
        isSelected && classNames?.commentSelected,
      )}
      onClick={onSelect}
    >
      {/* Depth indicator lines */}
      <div style={{ display: "flex", flexShrink: 0 }}>
        {Array.from({ length: depth }).map((_, i) => {
          // ancestors is ordered [parent, grandparent, ..., root]
          // For bar at index i (representing depth i), we need ancestors[depth - 1 - i]
          const ancestorIndex = depth - 1 - i;
          const ancestorId = ancestors[ancestorIndex];
          const isHovered =
            ancestorId != null && hoveredAncestorId === ancestorId;

          return (
            <div
              key={i}
              data-depth-line={i}
              className={cn(
                !unstyled && "group/depthline",
                classNames?.depthLine,
              )}
              onClick={(e) => {
                e.stopPropagation();
                // Clear hover state when clicking
                onAncestorHover?.(null);
                onDepthLineClick?.(i);
              }}
              onMouseEnter={() => {
                if (!unstyled && onAncestorHover && ancestorId) {
                  onAncestorHover(ancestorId);
                }
              }}
              onMouseLeave={() => {
                if (!unstyled && onAncestorHover) {
                  onAncestorHover(null);
                }
              }}
              style={{
                width: indentationWidth,
                marginLeft: i === 0 ? 8 : 0,
                borderLeftWidth: isHovered ? 3 : 2,
                borderLeftStyle: "solid",
                borderLeftColor: getDepthColorForIndex(i, depthColors),
                filter: isHovered ? "brightness(1.3)" : "none",
                cursor: onDepthLineClick ? "pointer" : undefined,
                transition: "all 10ms ease",
              }}
              title={onDepthLineClick ? "Click to collapse" : undefined}
            />
          );
        })}
      </div>

      {/* Comment content */}
      <div
        className={cn(
          !unstyled && "flex-1 py-2 px-2 min-w-0",
          classNames?.content,
        )}
      >
        {/* Header: author + time + collapse */}
        <div className={cn(!unstyled && "flex items-center gap-2 text-xs")}>
          {collapsible && hasReplies && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onCollapse?.();
              }}
              className={cn(
                !unstyled &&
                  "p-0.5 -ml-1 hover:bg-zinc-700/50 rounded transition-colors text-zinc-500 hover:text-zinc-300",
                classNames?.collapseButton,
              )}
            >
              <ChevronIcon direction={isCollapsed ? "right" : "down"} />
            </button>
          )}
          {data.author && (
            <span
              className={cn(
                !unstyled && "font-medium text-zinc-300",
                classNames?.author,
              )}
            >
              {data.author}
            </span>
          )}
          {data.createdAt && (
            <span
              className={cn(
                !unstyled && "text-zinc-500",
                classNames?.timestamp,
              )}
              suppressHydrationWarning
            >
              {formatRelativeTime(data.createdAt)}
            </span>
          )}
          {isCollapsed && replyCount > 0 && (
            <span
              className={cn(
                !unstyled && "text-zinc-500",
                classNames?.replyCount,
              )}
            >
              ({replyCount} {replyCount === 1 ? "reply" : "replies"})
            </span>
          )}
        </div>

        {/* Collapsible content wrapper with animation */}
        <div
          aria-hidden={isCollapsed}
          style={{
            display: "grid",
            gridTemplateRows: isCollapsed ? "0fr" : "1fr",
            transition: unstyled
              ? undefined
              : "grid-template-rows 150ms ease-out",
          }}
        >
          <div style={{ overflow: "hidden" }}>
            {/* Content */}
            <div
              className={cn(
                !unstyled && "mt-1 text-sm text-zinc-300 break-words",
                classNames?.text,
              )}
              style={{
                opacity: isCollapsed ? 0 : 1,
                transition: unstyled ? undefined : "opacity 100ms ease-out",
              }}
            >
              {data.content}
            </div>

            {/* Actions row */}
            {actions && actions.length > 0 && (
              <div
                className={cn(
                  !unstyled && "mt-2 flex items-center gap-1",
                  classNames?.actions,
                )}
                style={{
                  opacity: isCollapsed ? 0 : 1,
                  transition: unstyled ? undefined : "opacity 100ms ease-out",
                }}
              >
                {/* Inline actions */}
                {inlineActions.map((action) => (
                  <button
                    key={action.key}
                    onClick={(e) => {
                      e.stopPropagation();
                      onAction?.(action.key);
                    }}
                    disabled={action.disabled}
                    className={cn(
                      !unstyled &&
                        "flex items-center gap-1 px-2 py-1 text-xs rounded transition-colors",
                      !unstyled &&
                        !action.destructive &&
                        "text-zinc-500 hover:bg-zinc-700/50 hover:text-zinc-300",
                      !unstyled &&
                        action.destructive &&
                        "text-red-400 hover:bg-red-500/10",
                      !unstyled &&
                        action.disabled &&
                        "opacity-50 cursor-not-allowed",
                      action.destructive
                        ? classNames?.actionButtonDestructive
                        : classNames?.actionButton,
                    )}
                  >
                    {action.icon}
                    {action.label}
                  </button>
                ))}

                {/* Overflow menu */}
                {overflowActions.length > 0 && (
                  <OverflowMenu
                    actions={overflowActions}
                    onAction={onAction}
                    classNames={classNames}
                    unstyled={unstyled}
                  />
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
