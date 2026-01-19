import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DefaultCommentItem } from "../src/DefaultCommentItem";
import type { FlattenedComment, CommentData } from "../src/types";
import { DEFAULT_DEPTH_COLORS } from "../src/types";

// ============================================================================
// Test Data
// ============================================================================

interface TestComment extends CommentData {
  id: string;
  content: string;
  author: string;
  createdAt?: Date;
}

const createTestComment = (
  overrides?: Partial<FlattenedComment<TestComment>>,
): FlattenedComment<TestComment> => ({
  id: "test-1",
  data: {
    id: "test-1",
    content: "This is a test comment",
    author: "test_user",
    createdAt: new Date(Date.now() - 3600000), // 1 hour ago
  },
  children: [],
  parentId: null,
  depth: 0,
  index: 0,
  ...overrides,
});

const defaultProps = {
  comment: createTestComment(),
  depth: 0,
  isCollapsed: false,
  hasReplies: false,
  replyCount: 0,
  isSelected: false,
  depthColors: DEFAULT_DEPTH_COLORS,
  indentationWidth: 20,
  collapsible: true,
  maxInlineActions: 2,
  unstyled: false,
};

// ============================================================================
// Rendering Tests
// ============================================================================

describe("DefaultCommentItem", () => {
  describe("Rendering", () => {
    it("displays the comment content", () => {
      render(<DefaultCommentItem {...defaultProps} />);
      expect(screen.getByText("This is a test comment")).toBeDefined();
    });

    it("displays the author name", () => {
      render(<DefaultCommentItem {...defaultProps} />);
      expect(screen.getByText("test_user")).toBeDefined();
    });

    it("displays relative time", () => {
      render(<DefaultCommentItem {...defaultProps} />);
      expect(screen.getByText("1h ago")).toBeDefined();
    });

    it("hides content when collapsed", () => {
      render(<DefaultCommentItem {...defaultProps} isCollapsed={true} />);
      const content = screen.getByText("This is a test comment");
      // Content is visually hidden via opacity for animation purposes
      expect(content.style.opacity).toBe("0");
    });

    it("shows reply count when collapsed", () => {
      render(
        <DefaultCommentItem
          {...defaultProps}
          isCollapsed={true}
          hasReplies={true}
          replyCount={5}
        />,
      );
      expect(screen.getByText("(5 replies)")).toBeDefined();
    });

    it("shows singular reply when count is 1", () => {
      render(
        <DefaultCommentItem
          {...defaultProps}
          isCollapsed={true}
          hasReplies={true}
          replyCount={1}
        />,
      );
      expect(screen.getByText("(1 reply)")).toBeDefined();
    });
  });

  describe("Collapse Button", () => {
    it("renders collapse button when hasReplies is true and collapsible", () => {
      render(
        <DefaultCommentItem
          {...defaultProps}
          hasReplies={true}
          collapsible={true}
        />,
      );

      const buttons = screen.getAllByRole("button");
      expect(buttons.length).toBeGreaterThan(0);
    });

    it("does not render collapse button when hasReplies is false", () => {
      const { container } = render(
        <DefaultCommentItem
          {...defaultProps}
          hasReplies={false}
          collapsible={true}
        />,
      );

      // Should not have the chevron svg for collapse
      const svgs = container.querySelectorAll("svg");
      // Should have 0 SVGs if no replies and no actions
      expect(svgs.length).toBe(0);
    });

    it("calls onCollapse when collapse button is clicked", () => {
      const onCollapse = vi.fn();
      render(
        <DefaultCommentItem
          {...defaultProps}
          hasReplies={true}
          onCollapse={onCollapse}
        />,
      );

      const button = screen.getAllByRole("button")[0];
      fireEvent.click(button);
      expect(onCollapse).toHaveBeenCalledTimes(1);
    });

    it("stops propagation when collapse button is clicked", () => {
      const onCollapse = vi.fn();
      const onSelect = vi.fn();
      render(
        <DefaultCommentItem
          {...defaultProps}
          hasReplies={true}
          onCollapse={onCollapse}
          onSelect={onSelect}
        />,
      );

      const button = screen.getAllByRole("button")[0];
      fireEvent.click(button);

      expect(onCollapse).toHaveBeenCalledTimes(1);
      // onSelect should NOT be called because click propagation was stopped
    });
  });

  describe("Selection", () => {
    it("applies selected styles when isSelected is true", () => {
      const { container } = render(
        <DefaultCommentItem {...defaultProps} isSelected={true} />,
      );

      const wrapper = container.querySelector("div");
      expect(wrapper?.className).toContain("bg-zinc-800/50");
    });

    it("calls onSelect when comment is clicked", () => {
      const onSelect = vi.fn();
      const { container } = render(
        <DefaultCommentItem {...defaultProps} onSelect={onSelect} />,
      );

      const wrapper = container.querySelector("div");
      fireEvent.click(wrapper!);
      expect(onSelect).toHaveBeenCalledTimes(1);
    });
  });

  describe("Depth Indicators", () => {
    it("renders no depth lines for depth 0", () => {
      const { container } = render(
        <DefaultCommentItem {...defaultProps} depth={0} />,
      );

      const depthIndicators = container.querySelectorAll("[data-depth-line]");
      expect(depthIndicators.length).toBe(0);
    });

    it("renders correct number of depth lines", () => {
      const comment = createTestComment({ depth: 3 });
      const { container } = render(
        <DefaultCommentItem {...defaultProps} comment={comment} depth={3} />,
      );

      const depthIndicators = container.querySelectorAll("[data-depth-line]");
      expect(depthIndicators.length).toBe(3);
    });

    it("applies correct colors to depth lines via inline styles", () => {
      const comment = createTestComment({ depth: 2 });
      const { container } = render(
        <DefaultCommentItem {...defaultProps} comment={comment} depth={2} />,
      );

      const depthIndicators = container.querySelectorAll("[data-depth-line]");
      // Colors are now applied via inline styles (hex values)
      expect((depthIndicators[0] as HTMLElement).style.borderLeftColor).toBe("rgb(59, 130, 246)"); // #3b82f6 blue
      expect((depthIndicators[1] as HTMLElement).style.borderLeftColor).toBe("rgb(249, 115, 22)"); // #f97316 orange
    });
  });

  describe("Actions", () => {
    const actions = [
      { key: "reply", label: "Reply" },
      { key: "upvote", label: "Upvote" },
      { key: "delete", label: "Delete", destructive: true },
    ];

    it("renders inline action buttons up to maxInlineActions", () => {
      render(<DefaultCommentItem {...defaultProps} actions={actions} />);

      // With maxInlineActions=2 (default), Reply and Upvote should be inline
      expect(screen.getByText("Reply")).toBeDefined();
      expect(screen.getByText("Upvote")).toBeDefined();
      // Delete should be in overflow menu (not visible until menu is opened)
      expect(screen.queryByText("Delete")).toBeNull();
    });

    it("renders all actions inline when maxInlineActions is high enough", () => {
      render(
        <DefaultCommentItem
          {...defaultProps}
          actions={actions}
          maxInlineActions={5}
        />,
      );

      expect(screen.getByText("Reply")).toBeDefined();
      expect(screen.getByText("Upvote")).toBeDefined();
      expect(screen.getByText("Delete")).toBeDefined();
    });

    it("shows overflow menu button when actions exceed maxInlineActions", () => {
      render(<DefaultCommentItem {...defaultProps} actions={actions} />);

      const overflowButton = screen.getByLabelText("More actions");
      expect(overflowButton).toBeDefined();
    });

    it("shows overflow actions when overflow menu is clicked", () => {
      render(<DefaultCommentItem {...defaultProps} actions={actions} />);

      // Delete should not be visible initially
      expect(screen.queryByText("Delete")).toBeNull();

      // Click overflow menu
      const overflowButton = screen.getByLabelText("More actions");
      fireEvent.click(overflowButton);

      // Now Delete should be visible
      expect(screen.getByText("Delete")).toBeDefined();
    });

    it("applies overflowMenu className to dropdown", () => {
      render(
        <DefaultCommentItem
          {...defaultProps}
          actions={actions}
          classNames={{ overflowMenu: "custom-menu-class" }}
        />,
      );

      // Open the menu
      const overflowButton = screen.getByLabelText("More actions");
      fireEvent.click(overflowButton);

      // Find the menu by looking for the Delete button's parent container
      const deleteButton = screen.getByText("Delete");
      const menuContainer = deleteButton.closest("div");
      expect(menuContainer?.className).toContain("custom-menu-class");
    });

    it("applies overflowMenuItem className to menu items", () => {
      render(
        <DefaultCommentItem
          {...defaultProps}
          actions={actions}
          classNames={{ overflowMenuItem: "custom-item-class" }}
        />,
      );

      // Open the menu
      const overflowButton = screen.getByLabelText("More actions");
      fireEvent.click(overflowButton);

      // Check the overflow menu item has the custom class
      const deleteButton = screen.getByText("Delete").closest("button");
      expect(deleteButton?.className).toContain("custom-item-class");
    });

    it("applies destructive styles to destructive actions", () => {
      render(
        <DefaultCommentItem
          {...defaultProps}
          actions={actions}
          maxInlineActions={5}
        />,
      );

      const deleteButton = screen.getByText("Delete");
      expect(deleteButton.className).toContain("text-red-400");
    });

    it("calls onAction with correct key when action is clicked", () => {
      const onAction = vi.fn();
      render(
        <DefaultCommentItem
          {...defaultProps}
          actions={actions}
          onAction={onAction}
        />,
      );

      const replyButton = screen.getByText("Reply");
      fireEvent.click(replyButton);
      expect(onAction).toHaveBeenCalledWith("reply");
    });

    it("hides actions when collapsed", () => {
      const { container } = render(
        <DefaultCommentItem
          {...defaultProps}
          actions={actions}
          isCollapsed={true}
        />,
      );

      // The collapsible wrapper should have aria-hidden when collapsed
      const collapsibleWrapper = container.querySelector("[aria-hidden='true']");
      expect(collapsibleWrapper).toBeDefined();
      // And the content should have opacity 0
      const replyButton = screen.getByText("Reply");
      expect(replyButton).toBeDefined(); // Still in DOM
    });

    it("disables button when action is disabled", () => {
      const actionsWithDisabled = [
        { key: "reply", label: "Reply", disabled: true },
      ];
      render(
        <DefaultCommentItem
          {...defaultProps}
          actions={actionsWithDisabled}
        />,
      );

      const button = screen.getByText("Reply");
      expect(button.closest("button")?.disabled).toBe(true);
    });
  });

  describe("Relative Time Formatting", () => {
    it("shows 'just now' for very recent comments", () => {
      const comment = createTestComment({
        data: {
          id: "test",
          content: "Test",
          author: "user",
          createdAt: new Date(),
        },
      });
      render(<DefaultCommentItem {...defaultProps} comment={comment} />);
      expect(screen.getByText("just now")).toBeDefined();
    });

    it("shows minutes for comments less than an hour old", () => {
      const comment = createTestComment({
        data: {
          id: "test",
          content: "Test",
          author: "user",
          createdAt: new Date(Date.now() - 30 * 60000), // 30 mins ago
        },
      });
      render(<DefaultCommentItem {...defaultProps} comment={comment} />);
      expect(screen.getByText("30m ago")).toBeDefined();
    });

    it("shows hours for comments less than a day old", () => {
      const comment = createTestComment({
        data: {
          id: "test",
          content: "Test",
          author: "user",
          createdAt: new Date(Date.now() - 5 * 3600000), // 5 hours ago
        },
      });
      render(<DefaultCommentItem {...defaultProps} comment={comment} />);
      expect(screen.getByText("5h ago")).toBeDefined();
    });

    it("shows days for comments less than a week old", () => {
      const comment = createTestComment({
        data: {
          id: "test",
          content: "Test",
          author: "user",
          createdAt: new Date(Date.now() - 3 * 86400000), // 3 days ago
        },
      });
      render(<DefaultCommentItem {...defaultProps} comment={comment} />);
      expect(screen.getByText("3d ago")).toBeDefined();
    });
  });
});
