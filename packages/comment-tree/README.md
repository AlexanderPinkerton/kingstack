# @celestial/comment-tree

A virtualized comment tree component for React with Reddit-style depth indicators.

## Features

- **Virtualization**: Efficiently renders large comment threads using `@tanstack/react-virtual`
- **Reddit-style depth indicators**: Colored vertical lines that indicate comment depth
- **Collapsible threads**: Expand/collapse comment threads with reply counts
- **Action overflow menu**: Inline actions with smart overflow menu that stays within viewport
- **Theming support**: Customize with `classNames` prop or go fully `unstyled`
- **Light & dark mode**: Easy theming for any color scheme
- **Custom rendering**: Bring your own comment renderer
- **TypeScript**: Full type safety with generics support
- **Accessible**: Proper ARIA labels and keyboard support

## Installation

```bash
npm install @celestial/comment-tree
# or
yarn add @celestial/comment-tree
# or
pnpm add @celestial/comment-tree
```

### Peer Dependencies

This package requires the following peer dependencies:

```json
{
  "react": "^18.0.0 || ^19.0.0",
  "react-dom": "^18.0.0 || ^19.0.0"
}
```

## Quick Start

```tsx
import { useState } from "react";
import { CommentTree, CommentItems, CommentData } from "@celestial/comment-tree";

interface MyComment extends CommentData {
  content: string;
  author: string;
  createdAt: Date;
}

const comments: CommentItems<MyComment> = [
  {
    id: "1",
    data: {
      id: "1",
      content: "This is a great post!",
      author: "alice",
      createdAt: new Date(),
    },
    children: [
      {
        id: "1-1",
        data: {
          id: "1-1",
          content: "I agree!",
          author: "bob",
          createdAt: new Date(),
        },
        children: [],
      },
    ],
  },
];

function MyComments() {
  const [items, setItems] = useState(comments);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  return (
    <CommentTree<MyComment>
      id="my-comments"
      items={items}
      onItemsChange={setItems}
      selectedId={selectedId}
      onSelect={setSelectedId}
      collapsible
    />
  );
}
```

## Virtualization

Enable virtualization for large comment threads by setting the `height` prop:

```tsx
<CommentTree
  id="virtualized-comments"
  items={items}
  height={400} // Enable virtualization
  estimatedItemHeight={100}
  overscan={5}
/>
```

When `height` is set, only visible comments are rendered, making it efficient for threads with thousands of comments.

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `id` | `string` | Required | Unique identifier for the tree |
| `items` | `CommentItems<T>` | Required | Comment data |
| `onItemsChange` | `(items) => void` | - | Called when items change |
| `selectedId` | `string \| null` | - | Currently selected comment |
| `onSelect` | `(id) => void` | - | Called when a comment is selected |
| `onCollapseChange` | `(id, collapsed) => void` | - | Called when collapse state changes |
| `commentActions` | `CommentAction[] \| (comment) => CommentAction[]` | - | Actions shown on each comment |
| `onAction` | `(key, id) => void` | - | Called when an action is triggered |
| `collapsible` | `boolean` | `true` | Whether comments can be collapsed |
| `indentationWidth` | `number` | `20` | Pixels per depth level |
| `renderComment` | `(props) => ReactNode` | - | Custom comment renderer |
| `height` | `number` | - | Enables virtualization |
| `width` | `number \| string` | - | Fixed width for the container |
| `estimatedItemHeight` | `number` | `80` | Estimated height for virtualization |
| `overscan` | `number` | `5` | Extra items to render outside viewport |
| `depthColors` | `string[]` | Reddit colors | Custom depth line colors (hex values) |
| `maxInlineActions` | `number` | `2` | Max actions shown inline before overflow menu |
| `classNames` | `CommentTreeClassNames` | - | Custom class names for theming |
| `unstyled` | `boolean` | `false` | Remove all default styles |
| `emptyState` | `ReactNode` | - | Content to show when no comments |
| `initialExpandedIds` | `string[]` | - | IDs of initially expanded comments |

## Actions

Add action buttons to comments. Actions beyond `maxInlineActions` appear in an overflow menu:

```tsx
const actions: CommentAction[] = [
  { key: "reply", label: "Reply", icon: <ReplyIcon /> },
  { key: "upvote", label: "Upvote", icon: <ThumbUpIcon /> },
  { key: "share", label: "Share", icon: <ShareIcon /> },
  { key: "delete", label: "Delete", icon: <TrashIcon />, destructive: true },
];

<CommentTree
  items={items}
  commentActions={actions}
  maxInlineActions={2} // Reply & Upvote inline, others in overflow menu
  onAction={(actionKey, commentId) => {
    console.log(`Action ${actionKey} on comment ${commentId}`);
  }}
/>
```

### Dynamic Actions

Pass a function to show different actions per comment:

```tsx
<CommentTree
  items={items}
  commentActions={(comment) => [
    { key: "reply", label: "Reply" },
    // Only show delete for own comments
    ...(comment.data.author === currentUser
      ? [{ key: "delete", label: "Delete", destructive: true }]
      : []),
  ]}
/>
```

## Theming

### Dark Mode (Default)

The default styling is optimized for dark backgrounds:

```tsx
<div className="bg-zinc-900">
  <CommentTree id="comments" items={items} />
</div>
```

### Light Mode

Use `classNames` and custom `depthColors` for light themes:

```tsx
const lightColors = [
  "#2563eb", // blue-600
  "#ea580c", // orange-600
  "#16a34a", // green-600
  "#9333ea", // purple-600
  "#db2777", // pink-600
];

<CommentTree
  id="light-comments"
  items={items}
  depthColors={lightColors}
  classNames={{
    container: "bg-white",
    comment: "hover:bg-zinc-50",
    commentSelected: "!bg-blue-50",
    author: "!text-zinc-900 !font-semibold",
    timestamp: "!text-zinc-500",
    text: "!text-zinc-700",
    actionButton: "!text-zinc-500 hover:!text-zinc-900 hover:!bg-zinc-100",
    actionButtonDestructive: "!text-red-600 hover:!bg-red-50",
    collapseButton: "!text-zinc-400 hover:!text-zinc-700 hover:!bg-zinc-100",
    overflowButton: "!text-zinc-400 hover:!text-zinc-700 hover:!bg-zinc-100",
    overflowMenu: "!bg-white !border-zinc-200 !shadow-lg",
    overflowMenuItem: "!text-zinc-700 hover:!bg-zinc-100",
  }}
/>
```

### Available `classNames` Keys

| Key | Description |
|-----|-------------|
| `container` | Main container element |
| `comment` | Individual comment wrapper |
| `commentSelected` | Comment when selected |
| `depthLine` | Depth indicator line |
| `content` | Comment content area |
| `author` | Author name |
| `timestamp` | Timestamp text |
| `text` | Comment text content |
| `actions` | Actions container |
| `actionButton` | Individual action button |
| `actionButtonDestructive` | Destructive action button |
| `overflowButton` | The "..." overflow menu button |
| `overflowMenu` | Overflow menu dropdown container |
| `overflowMenuItem` | Overflow menu item |
| `collapseButton` | Collapse/expand button |
| `replyCount` | Reply count badge |

### Fully Unstyled

For complete control, use `unstyled={true}` to remove all default styles:

```tsx
<CommentTree
  items={items}
  unstyled
  classNames={{
    comment: "flex p-4 border-b border-gray-200",
    author: "font-bold text-gray-900",
    text: "mt-2 text-gray-700",
  }}
/>
```

## Custom Rendering

Provide a custom renderer for complete control over comment appearance:

```tsx
<CommentTree
  id="custom-comments"
  items={items}
  renderComment={({
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
  }) => (
    <div className="flex" onClick={onSelect}>
      {/* Render depth lines */}
      {Array.from({ length: depth }).map((_, i) => (
        <div
          key={i}
          className="border-l-2"
          style={{
            borderColor: depthColors[i % depthColors.length],
            width: indentationWidth,
          }}
        />
      ))}

      {/* Your custom comment UI */}
      <div className="flex-1 p-2">
        <p className="font-bold">{comment.data.author}</p>
        {!isCollapsed && <p>{comment.data.content}</p>}
        {isCollapsed && hasReplies && (
          <span className="text-gray-500">({replyCount} replies)</span>
        )}
      </div>
    </div>
  )}
/>
```

## Utilities

The package exports utilities for working with comment data:

```tsx
import {
  flattenComments,
  findComment,
  removeComment,
  getReplyCount,
  getDepthColor,
  DEFAULT_DEPTH_COLORS,
} from "@celestial/comment-tree";

// Flatten nested comments for rendering
const flat = flattenComments(comments);

// Find a specific comment
const comment = findComment(comments, "1-1");

// Remove a comment from the tree
const newComments = removeComment(comments, "1-1");

// Get total replies for a comment (including nested)
const count = getReplyCount(comments, "1");

// Get color for a depth level
const color = getDepthColor(2, DEFAULT_DEPTH_COLORS);
```

## Depth Colors

Default colors cycle through 10 Reddit-inspired colors:

1. Blue (`#3b82f6`)
2. Orange (`#f97316`)
3. Green (`#22c55e`)
4. Purple (`#a855f7`)
5. Pink (`#ec4899`)
6. Yellow (`#eab308`)
7. Cyan (`#06b6d4`)
8. Red (`#ef4444`)
9. Indigo (`#6366f1`)
10. Emerald (`#10b981`)

Customize with the `depthColors` prop (use hex color values):

```tsx
const myColors = [
  "#ef4444", // red
  "#3b82f6", // blue
  "#22c55e", // green
];

<CommentTree depthColors={myColors} />
```

## TypeScript

The component is fully typed with generics support:

```tsx
interface MyComment extends CommentData {
  content: string;
  author: string;
  createdAt: Date;
  upvotes: number;
  // Add any custom fields
}

// All props and callbacks are typed to MyComment
<CommentTree<MyComment>
  items={items}
  commentActions={(comment) => {
    // comment.data is typed as MyComment
    console.log(comment.data.upvotes);
    return [];
  }}
/>
```

## Browser Support

- Chrome, Firefox, Safari, Edge (latest 2 versions)
- Requires `ResizeObserver` (polyfill needed for older browsers)

## License

MIT
