"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { UniqueIdentifier } from "@dnd-kit/core";
import {
  IconFolder,
  IconFile,
  IconBox,
  IconDiamonds,
  IconAssembly,
  IconTrash,
  IconEdit,
  IconDotsVertical,
  IconCopy,
  IconArrowRight,
} from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

import {
  DndTree,
  TreeItems,
  TreeTypeConfig,
  TreeItemAction,
} from "@celestial/dnd-tree";

// ============================================================================
// Types
// ============================================================================

interface FileItem {
  name: string;
  type: "folder" | "file";
}

interface SpecItem {
  name: string;
  type: "component" | "feature" | "system";
  entries?: number;
}

interface LogEntry {
  id: number;
  timestamp: Date;
  event: string;
  details: string;
  color: string;
}

// ============================================================================
// Type Configurations (the declarative way!)
// ============================================================================

// File system type config - folders can contain folders and files
const fileTypeConfig: TreeTypeConfig<FileItem> = {
  types: {
    folder: {
      label: "Folder",
      icon: <IconFolder size={14} className="text-amber-400" />,
      allowedChildren: ["folder", "file"], // Folders can contain folders and files
    },
    file: {
      label: "File",
      icon: <IconFile size={14} className="text-blue-400" />,
      allowedChildren: [], // Files are leaf nodes
    },
  },
  getType: (item) => item.data?.type || "file",
  getName: (item) => item.data?.name || String(item.id),
};

// Spec type config - components can nest, features/systems are leaves
const specTypeConfig: TreeTypeConfig<SpecItem> = {
  types: {
    component: {
      label: "Component",
      icon: <IconBox size={14} className="text-purple-400" />,
      allowedChildren: ["component", "feature"], // Components can contain components and features
    },
    feature: {
      label: "Feature",
      icon: <IconDiamonds size={14} className="text-amber-400" />,
      allowedChildren: [], // Features are leaf nodes
    },
    system: {
      label: "System",
      icon: <IconAssembly size={14} className="text-cyan-400" />,
      allowedChildren: [], // Systems are leaf nodes
    },
  },
  getType: (item) => item.data?.type || "component",
  getName: (item) => {
    const name = item.data?.name || String(item.id);
    const entries = item.data?.entries;
    return entries ? `${name} (${entries})` : name;
  },
};

// ============================================================================
// Sample Data
// ============================================================================

const simpleData: TreeItems = [
  { id: "Home", children: [] },
  {
    id: "Products",
    children: [
      { id: "Electronics", children: [] },
      { id: "Clothing", children: [] },
    ],
  },
  { id: "About", children: [] },
];

const fileData: TreeItems<FileItem> = [
  {
    id: "src",
    data: { name: "src", type: "folder" },
    children: [
      {
        id: "components",
        data: { name: "components", type: "folder" },
        children: [
          {
            id: "Button.tsx",
            data: { name: "Button.tsx", type: "file" },
            children: [],
          },
          {
            id: "Input.tsx",
            data: { name: "Input.tsx", type: "file" },
            children: [],
          },
        ],
      },
      { id: "App.tsx", data: { name: "App.tsx", type: "file" }, children: [] },
    ],
  },
  {
    id: "package.json",
    data: { name: "package.json", type: "file" },
    children: [],
  },
];

const specData: TreeItems<SpecItem> = [
  {
    id: "auth",
    data: { name: "Authentication", type: "component" },
    children: [
      {
        id: "login",
        data: { name: "Login Flow", type: "feature", entries: 12 },
        children: [],
      },
      {
        id: "signup",
        data: { name: "Signup Flow", type: "feature", entries: 8 },
        children: [],
      },
    ],
  },
  {
    id: "dashboard",
    data: { name: "Dashboard", type: "component" },
    children: [
      {
        id: "analytics",
        data: { name: "Analytics", type: "feature", entries: 15 },
        children: [],
      },
    ],
  },
  {
    id: "api",
    data: { name: "API Layer", type: "system", entries: 23 },
    children: [],
  },
];

// Generate a large tree for virtualization demo
function generateLargeTree(
  folderCount: number,
  filesPerFolder: number,
): TreeItems<FileItem> {
  const items: TreeItems<FileItem> = [];
  for (let i = 0; i < folderCount; i++) {
    const children: TreeItems<FileItem> = [];
    for (let j = 0; j < filesPerFolder; j++) {
      children.push({
        id: `file-${i}-${j}`,
        data: { name: `file-${j}.ts`, type: "file" },
        children: [],
      });
    }
    items.push({
      id: `folder-${i}`,
      data: { name: `folder-${i}`, type: "folder" },
      children,
    });
  }
  return items;
}

// 50 folders × 10 files = 500+ items
const largeTreeData = generateLargeTree(50, 10);

// ============================================================================
// Callback History Component
// ============================================================================

function CallbackHistory({
  logs,
  onClear,
}: {
  logs: LogEntry[];
  onClear: () => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new logs are added
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs.length]);

  return (
    <div className="bg-zinc-900/80 border border-zinc-700/50 rounded-lg overflow-hidden shadow-lg shadow-black/20">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-700/50 bg-zinc-800/50">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-sm font-medium text-zinc-300">Event Log</span>
          <span className="text-xs text-zinc-500">({logs.length})</span>
        </div>
        <button
          onClick={onClear}
          className="p-1 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-700/50 rounded transition-colors"
          title="Clear logs"
        >
          <IconTrash size={14} />
        </button>
      </div>
      <div
        ref={scrollRef}
        className="h-80 overflow-y-auto p-3 space-y-1 text-xs font-mono bg-zinc-950/50"
      >
        {logs.length === 0 ? (
          <div className="text-zinc-600 text-center py-8">
            <div className="text-2xl mb-2">📋</div>
            <div>Interact with the trees to see events</div>
          </div>
        ) : (
          logs.map((log) => (
            <div
              key={log.id}
              className="flex gap-3 py-1 px-2 rounded hover:bg-zinc-800/50 transition-colors"
            >
              <span className="text-zinc-500 shrink-0 tabular-nums">
                {log.timestamp.toLocaleTimeString("en-US", { hour12: false })}.
                {String(log.timestamp.getMilliseconds())
                  .padStart(3, "0")
                  .slice(0, 2)}
              </span>
              <span className={cn("shrink-0 w-24 font-semibold", log.color)}>
                {log.event}
              </span>
              <span className="text-zinc-400">{log.details}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Main Page
// ============================================================================

export default function DndTreeTestPage() {
  const [simple, setSimple] = useState(simpleData);
  const [simpleSelected, setSimpleSelected] = useState<UniqueIdentifier | null>(
    null,
  );

  const [files, setFiles] = useState(fileData);
  const [fileSelected, setFileSelected] = useState<UniqueIdentifier | null>(
    null,
  );

  const [specs, setSpecs] = useState(specData);
  const [specSelected, setSpecSelected] = useState<UniqueIdentifier | null>(
    null,
  );

  const [largeTree, setLargeTree] = useState(largeTreeData);
  const [largeSelected, setLargeSelected] = useState<UniqueIdentifier | null>(
    null,
  );

  // Callback history
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const logIdRef = useRef(0);

  const addLog = useCallback(
    (event: string, details: string, color: string) => {
      const id = ++logIdRef.current;
      setLogs((prev) => [
        ...prev.slice(-100),
        { id, timestamp: new Date(), event, details, color },
      ]);
    },
    [],
  );

  const clearLogs = useCallback(() => setLogs([]), []);

  // Wrapped callbacks with logging
  const handleSelect = useCallback(
    (tree: string, setter: (id: UniqueIdentifier | null) => void) =>
      (id: UniqueIdentifier) => {
        setter(id);
        addLog("onSelect", `${tree}: ${id}`, "text-cyan-400");
      },
    [addLog],
  );

  const handleMove = useCallback(
    (tree: string) =>
      (
        id: UniqueIdentifier,
        parentId: UniqueIdentifier | null,
        index: number,
      ) => {
        addLog(
          "onMove",
          `${tree}: ${id} → ${parentId ?? "root"}[${index}]`,
          "text-purple-400",
        );
      },
    [addLog],
  );

  const handleRemove = useCallback(
    (tree: string) => (id: UniqueIdentifier) => {
      addLog("onRemove", `${tree}: ${id}`, "text-red-400");
    },
    [addLog],
  );

  const handleCollapseChange = useCallback(
    (tree: string) => (id: UniqueIdentifier, collapsed: boolean) => {
      addLog(
        "onCollapse",
        `${tree}: ${id} → ${collapsed ? "▶" : "▼"}`,
        "text-amber-400",
      );
    },
    [addLog],
  );

  const handleAction = useCallback(
    (tree: string) => (actionKey: string, id: UniqueIdentifier) => {
      addLog("onAction", `${tree}: ${actionKey} on ${id}`, "text-pink-400");
    },
    [addLog],
  );

  // Define actions for spec items
  const specActions: TreeItemAction[] = [
    { key: "rename", label: "Rename", icon: <IconEdit size={14} /> },
    { key: "duplicate", label: "Duplicate", icon: <IconCopy size={14} /> },
    { key: "move", label: "Move to...", icon: <IconArrowRight size={14} /> },
    {
      key: "delete",
      label: "Delete",
      icon: <IconTrash size={14} />,
      destructive: true,
    },
  ];

  return (
    <div className="min-h-screen bg-zinc-950 p-6">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-xl font-bold text-white mb-1">
          DndTree Component Test
        </h1>
        <p className="text-sm text-zinc-500 mb-6">
          Declarative type configuration with hierarchy rules. Try dragging
          items between levels.
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Basic - no type config */}
          <div>
            <h2 className="text-xs font-medium text-zinc-500 uppercase mb-2">
              Basic (no config)
            </h2>
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3">
              <DndTree
                id="basic-tree"
                items={simple}
                onItemsChange={setSimple}
                selectedId={simpleSelected}
                onSelect={handleSelect("Basic", setSimpleSelected)}
                onMove={handleMove("Basic")}
                onCollapseChange={handleCollapseChange("Basic")}
                collapsible
                indicator
              />
            </div>
          </div>

          {/* Files - with typeConfig */}
          <div>
            <h2 className="text-xs font-medium text-zinc-500 uppercase mb-2">
              Files (typeConfig)
            </h2>
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3">
              <DndTree
                id="files-tree"
                items={files}
                onItemsChange={setFiles}
                selectedId={fileSelected}
                onSelect={handleSelect("Files", setFileSelected)}
                onMove={handleMove("Files")}
                onRemove={handleRemove("Files")}
                onCollapseChange={handleCollapseChange("Files")}
                typeConfig={fileTypeConfig}
                collapsible
                removable
                indicator
              />
            </div>
            <TypeLegend config={fileTypeConfig} />
          </div>

          {/* Specs - with typeConfig and actions */}
          <div>
            <h2 className="text-xs font-medium text-zinc-500 uppercase mb-2">
              Specs (with actions)
            </h2>
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3">
              <DndTree
                id="specs-tree"
                items={specs}
                onItemsChange={setSpecs}
                selectedId={specSelected}
                onSelect={handleSelect("Specs", setSpecSelected)}
                onMove={handleMove("Specs")}
                onCollapseChange={handleCollapseChange("Specs")}
                onAction={handleAction("Specs")}
                typeConfig={specTypeConfig}
                itemActions={specActions}
                collapsible
                indicator
              />
            </div>
            <TypeLegend config={specTypeConfig} />
          </div>
        </div>

        {/* Virtualized Tree + Event Log Row */}
        <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Virtualized Tree Demo */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-sm font-medium text-zinc-400">
                  Virtualized Tree (500+ items)
                </h2>
                <p className="text-xs text-zinc-600">
                  Only visible items are rendered. Scroll smoothly through 500+
                  items.
                </p>
              </div>
              <div className="text-xs px-2 py-1 rounded bg-zinc-800 text-zinc-400">
                {largeTree.reduce(
                  (acc, folder) => acc + 1 + folder.children.length,
                  0,
                )}{" "}
                items
              </div>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3">
              <DndTree
                id="virtualized-tree"
                items={largeTree}
                onItemsChange={setLargeTree}
                selectedId={largeSelected}
                onSelect={handleSelect("Virtualized", setLargeSelected)}
                onMove={handleMove("Virtualized")}
                onCollapseChange={handleCollapseChange("Virtualized")}
                typeConfig={fileTypeConfig}
                collapsible
                indicator
                height={320}
                estimatedItemHeight={32}
                overscan={10}
              />
            </div>
            <div className="mt-2 text-[10px] text-zinc-600">
              💡 Set{" "}
              <code className="text-cyan-400">height=&#123;320&#125;</code> to
              enable virtualization
            </div>
          </div>

          {/* Event Log */}
          <div>
            <div className="mb-3">
              <h2 className="text-sm font-medium text-zinc-400">Event Log</h2>
              <p className="text-xs text-zinc-600">
                All callbacks fire here. Interact with any tree to see events.
              </p>
            </div>
            <CallbackHistory logs={logs} onClear={clearLogs} />
          </div>
        </div>

        {/* Code example */}
        <div className="mt-8">
          <h2 className="text-sm font-medium text-zinc-400 mb-3">
            TypeConfig Example
          </h2>
          <pre className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 text-xs overflow-x-auto">
            <code className="text-zinc-300">{`const specTypeConfig: TreeTypeConfig<SpecItem> = {
  types: {
    component: {
      label: "Component",
      icon: <IconBox size={14} className="text-purple-400" />,
      allowedChildren: ["component", "feature"], // Can hold these types
    },
    feature: {
      label: "Feature", 
      icon: <IconDiamonds size={14} className="text-amber-400" />,
      allowedChildren: [], // Leaf node - cannot have children
    },
    system: {
      label: "System",
      icon: <IconAssembly size={14} className="text-cyan-400" />,
      allowedChildren: [], // Leaf node
    },
  },
  getType: (item) => item.data?.type || "component",
  getName: (item) => item.data?.name || String(item.id),
};

<DndTree
  id="my-tree"
  items={items}
  typeConfig={specTypeConfig}
  // Hierarchy rules automatically enforced from allowedChildren!
/>`}</code>
          </pre>
        </div>
      </div>
    </div>
  );
}

// Type legend component

function TypeLegend({ config }: { config: any }) {
  return (
    <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-zinc-500">
      {Object.entries(config.types).map(([key, type]: [string, any]) => (
        <div key={key} className="flex items-center gap-1">
          {type.icon}
          <span>{type.label}</span>
          <span className="text-zinc-700">
            →{" "}
            {type.allowedChildren.length > 0
              ? type.allowedChildren.join(", ")
              : "leaf"}
          </span>
        </div>
      ))}
    </div>
  );
}
