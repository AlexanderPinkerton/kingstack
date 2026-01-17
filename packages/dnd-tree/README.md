# @celestial/dnd-tree

A beautiful, accessible drag-and-drop tree component for React with virtualization support.

## Features

- 🎯 **Drag & Drop** - Smooth drag and drop powered by [dnd-kit](https://dndkit.com/)
- 🌳 **Nested Trees** - Full support for deeply nested hierarchies
- ⚡ **Virtualization** - Render 1000s of items with smooth 60fps scrolling
- ♿ **Accessible** - Full keyboard navigation and screen reader support
- 🎨 **Customizable** - Style with Tailwind CSS or custom renderers
- 📱 **Touch Support** - Works on mobile devices
- 🔒 **Type Safe** - Full TypeScript support with generics

## Installation

```bash
npm install @celestial/dnd-tree
# or
yarn add @celestial/dnd-tree
# or
pnpm add @celestial/dnd-tree
```

## Quick Start

```tsx
import { DndTree, TreeItems } from "@celestial/dnd-tree";

const items: TreeItems = [
  { id: "1", children: [
    { id: "1.1", children: [] },
    { id: "1.2", children: [] },
  ]},
  { id: "2", children: [] },
];

function MyTree() {
  const [treeItems, setTreeItems] = useState(items);
  
  return (
    <DndTree
      id="my-tree"
      items={treeItems}
      onItemsChange={setTreeItems}
      collapsible
      indicator
    />
  );
}
```

## Props

### Core Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `id` | `string` | required | Unique ID for the tree (required for SSR) |
| `items` | `TreeItems<T>` | required | Tree data |
| `onItemsChange` | `(items: TreeItems<T>) => void` | - | Called when items change |
| `selectedId` | `UniqueIdentifier \| null` | - | Currently selected item ID |
| `onSelect` | `(id: UniqueIdentifier) => void` | - | Called when an item is selected |
| `onMove` | `(id, parentId, index) => void` | - | Called when an item is moved |
| `onRemove` | `(id: UniqueIdentifier) => void` | - | Called when an item is removed |
| `onCollapseChange` | `(id, collapsed) => void` | - | Called when collapse state changes |

### Behavior Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `collapsible` | `boolean` | `true` | Allow collapsing items with children |
| `indicator` | `boolean` | `true` | Show depth indicator during drag |
| `removable` | `boolean` | `false` | Show remove button on items |
| `showHandles` | `boolean` | `true` | Show drag handles |
| `indentationWidth` | `number` | `24` | Pixels per depth level |
| `maxDepth` | `number` | - | Maximum nesting depth |
| `disabledIds` | `UniqueIdentifier[]` | `[]` | IDs of items that can't be dragged |

### Virtualization Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `height` | `number` | - | Fixed height enables virtualization |
| `estimatedItemHeight` | `number` | `32` | Estimated item height for scrollbar |
| `overscan` | `number` | `5` | Items to render outside viewport |

### Type System Props

| Prop | Type | Description |
|------|------|-------------|
| `typeConfig` | `TreeTypeConfig<T>` | Auto-generates hierarchy rules from type definitions |
| `canDrop` | `(context: DropValidationContext<T>) => boolean` | Custom drop validation |

### Actions Props

| Prop | Type | Description |
|------|------|-------------|
| `itemActions` | `TreeItemAction[] \| (item) => TreeItemAction[]` | Actions for context menu |
| `onAction` | `(actionKey, itemId) => void` | Called when action is triggered |
| `renderActionMenu` | `(actions, onAction) => ReactNode` | Custom action menu renderer |

### Customization Props

| Prop | Type | Description |
|------|------|-------------|
| `className` | `string` | Class for container |
| `renderItem` | `(props: TreeItemRenderProps<T>) => ReactNode` | Custom item renderer |
| `emptyState` | `ReactNode` | Content when tree is empty |

## Type Configuration

Define node types with automatic hierarchy enforcement:

```tsx
interface FileItem {
  name: string;
  type: "folder" | "file";
}

const typeConfig: TreeTypeConfig<FileItem> = {
  types: {
    folder: {
      label: "Folder",
      icon: <FolderIcon />,
      allowedChildren: ["folder", "file"], // Can contain folders and files
    },
    file: {
      label: "File",
      icon: <FileIcon />,
      allowedChildren: [], // Leaf node - no children allowed
    },
  },
  getType: (item) => item.data?.type || "file",
  getName: (item) => item.data?.name || String(item.id),
};

<DndTree
  items={items}
  typeConfig={typeConfig}
  // Hierarchy rules are automatically enforced!
/>
```

## Virtualization

Enable virtualization for large trees by providing a `height`:

```tsx
// Non-virtualized (all items rendered)
<DndTree items={smallTree} />

// Virtualized (only visible items rendered)
<DndTree 
  items={largeTree} 
  height={400}
  estimatedItemHeight={32}
  overscan={10}
/>
```

## Styling & Customization

### Option 1: Override with classNames

Override specific parts without replacing everything:

```tsx
<DndTree
  items={items}
  classNames={{
    item: "bg-slate-800 border-slate-600",      // Base item styles
    itemSelected: "bg-blue-900 border-blue-500", // Selected state
    itemDragging: "ring-2 ring-blue-400",        // During drag
    handle: "text-slate-400",                     // Drag handle
    collapseButton: "text-slate-500",             // Expand/collapse
    label: "text-slate-200",                      // Item text
    indicator: "bg-blue-500",                     // Drop indicator
  }}
/>
```

### Option 2: Unstyled Mode

Remove all default styles for complete control:

```tsx
<DndTree
  items={items}
  unstyled  // Removes all default Tailwind classes
  classNames={{
    item: "your-custom-item-class",
    // ... define all your own styles
  }}
/>
```

### Option 3: Custom Item Renderer

Full control over item appearance:

```tsx
<DndTree
  items={items}
  renderItem={({ item, depth, isSelected, isCollapsed, onCollapse, onSelect }) => (
    <div 
      style={{ paddingLeft: depth * 20 }}
      onClick={onSelect}
      className={isSelected ? "selected" : ""}
    >
      {item.children.length > 0 && (
        <button onClick={onCollapse}>
          {isCollapsed ? "▶" : "▼"}
        </button>
      )}
      {item.data?.name}
    </div>
  )}
/>
```

## Action Menus

Add context menus to tree items:

```tsx
const actions: TreeItemAction[] = [
  { key: "rename", label: "Rename", icon: <EditIcon /> },
  { key: "delete", label: "Delete", icon: <TrashIcon />, destructive: true },
];

<DndTree
  items={items}
  itemActions={actions}
  onAction={(actionKey, itemId) => {
    if (actionKey === "rename") {
      // Handle rename
    }
  }}
/>
```

## Utility Functions

Work with tree data programmatically:

```tsx
import {
  flattenTree,    // Convert nested tree to flat array
  buildTree,      // Convert flat array back to nested tree
  findItemDeep,   // Find item by ID in nested tree
  removeItem,     // Remove item from tree
  setProperty,    // Set property on item
  getChildCount,  // Count all descendants
  getAncestorIds, // Get all parent IDs
  getDescendantIds, // Get all child IDs
} from "@celestial/dnd-tree";

// Example: Flatten, modify, rebuild
const flat = flattenTree(items);
const modified = flat.map(item => ({ ...item, someProperty: true }));
const rebuilt = buildTree(modified);
```

## Styling Summary

The component ships with a dark theme using Tailwind CSS. Customize easily with:

| Method | Use Case | Effort |
|--------|----------|--------|
| `classNames` prop | Override specific parts | Low |
| `unstyled` prop | Complete custom theme | Medium |
| `renderItem` prop | Fully custom components | High |
| `renderActionMenu` prop | Custom dropdown menus | Medium |

### Default Theme Colors
- Background: `zinc-900`
- Borders: `zinc-800`  
- Selected: `cyan-500`
- Hover: `zinc-800`
- Text: `zinc-300`

## Accessibility

- Full keyboard navigation (Arrow keys, Enter, Space)
- ARIA labels and live regions
- Screen reader announcements for drag operations
- Focus management

## Browser Support

- Chrome, Firefox, Safari, Edge (latest)
- iOS Safari, Android Chrome
- Touch and mouse input

## License

MIT

