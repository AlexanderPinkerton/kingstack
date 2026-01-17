"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import {
  IconTrash,
  IconArrowBackUp,
  IconThumbUp,
  IconThumbDown,
  IconShare,
  IconFlag,
  IconBookmark,
  IconEdit,
} from "@tabler/icons-react";
import { cn } from "@/lib/utils";

import {
  CommentTree,
  CommentItems,
  CommentAction,
  CommentData,
} from "@kingstack/comment-tree";

// ============================================================================
// Types
// ============================================================================

interface Comment extends CommentData {
  id: string;
  content: string;
  author: string;
  createdAt: Date;
  upvotes?: number;
  downvotes?: number;
}

interface LogEntry {
  id: number;
  timestamp: Date;
  event: string;
  details: string;
  color: string;
}

// ============================================================================
// Sample Data
// ============================================================================

const sampleComments: CommentItems<Comment> = [
  {
    id: "1",
    data: {
      id: "1",
      content:
        "This is a really interesting post! I've been thinking about this topic for a while and I'm glad someone finally brought it up.",
      author: "alice_dev",
      createdAt: new Date(Date.now() - 3600000 * 2), // 2 hours ago
      upvotes: 42,
      downvotes: 3,
    },
    children: [
      {
        id: "1-1",
        data: {
          id: "1-1",
          content:
            "I completely agree! The way they explained the concept was very clear.",
          author: "bob_coder",
          createdAt: new Date(Date.now() - 3600000 * 1.5), // 1.5 hours ago
          upvotes: 15,
          downvotes: 0,
        },
        children: [
          {
            id: "1-1-1",
            data: {
              id: "1-1-1",
              content:
                "Thanks for the support! I spent a lot of time researching this.",
              author: "alice_dev",
              createdAt: new Date(Date.now() - 3600000), // 1 hour ago
              upvotes: 8,
              downvotes: 0,
            },
            children: [
              {
                id: "1-1-1-1",
                data: {
                  id: "1-1-1-1",
                  content: "Your research really shows. Great work!",
                  author: "curious_reader",
                  createdAt: new Date(Date.now() - 1800000), // 30 mins ago
                  upvotes: 5,
                  downvotes: 0,
                },
                children: [],
              },
            ],
          },
        ],
      },
      {
        id: "1-2",
        data: {
          id: "1-2",
          content:
            "I have a slightly different perspective on this. While the main points are valid, I think we should also consider the edge cases.",
          author: "thoughtful_thinker",
          createdAt: new Date(Date.now() - 3600000), // 1 hour ago
          upvotes: 23,
          downvotes: 2,
        },
        children: [
          {
            id: "1-2-1",
            data: {
              id: "1-2-1",
              content:
                "What edge cases are you referring to? I'd love to hear more.",
              author: "alice_dev",
              createdAt: new Date(Date.now() - 2400000), // 40 mins ago
              upvotes: 6,
              downvotes: 0,
            },
            children: [],
          },
        ],
      },
    ],
  },
  {
    id: "2",
    data: {
      id: "2",
      content:
        "Has anyone tried implementing this with TypeScript? I'm curious about the type safety aspects.",
      author: "typescript_fan",
      createdAt: new Date(Date.now() - 7200000), // 2 hours ago
      upvotes: 31,
      downvotes: 1,
    },
    children: [
      {
        id: "2-1",
        data: {
          id: "2-1",
          content:
            "Yes! I actually wrote a blog post about it. The generic types make everything much cleaner.",
          author: "generics_guru",
          createdAt: new Date(Date.now() - 5400000), // 1.5 hours ago
          upvotes: 18,
          downvotes: 0,
        },
        children: [
          {
            id: "2-1-1",
            data: {
              id: "2-1-1",
              content: "Could you share the link? I'd love to read it.",
              author: "typescript_fan",
              createdAt: new Date(Date.now() - 4800000),
              upvotes: 4,
              downvotes: 0,
            },
            children: [],
          },
        ],
      },
    ],
  },
  {
    id: "3",
    data: {
      id: "3",
      content:
        "This reminds me of a similar discussion we had last year. The community has really grown since then!",
      author: "veteran_member",
      createdAt: new Date(Date.now() - 10800000), // 3 hours ago
      upvotes: 56,
      downvotes: 4,
    },
    children: [],
  },
];

// Generate a large comment tree for virtualization demo
function generateLargeCommentTree(
  threadCount: number,
  repliesPerThread: number,
  maxDepth: number,
): CommentItems<Comment> {
  const authors = [
    "user_alpha",
    "code_ninja",
    "dev_guru",
    "tech_wizard",
    "curious_cat",
    "helpful_helper",
    "wise_owl",
    "quick_learner",
  ];
  const contents = [
    "Great point! I totally agree with this.",
    "Interesting perspective, but have you considered...",
    "This is exactly what I was looking for!",
    "Can you elaborate more on this?",
    "Thanks for sharing this information.",
    "I had a similar experience with this.",
    "This changed my understanding completely.",
    "Well said! Couldn't have put it better.",
  ];

  let idCounter = 0;

  function createComment(depth: number): CommentItems<Comment> {
    if (depth >= maxDepth) return [];

    const count = depth === 0 ? threadCount : Math.floor(repliesPerThread / (depth + 1));
    const items: CommentItems<Comment> = [];

    for (let i = 0; i < count; i++) {
      const id = `gen-${++idCounter}`;
      items.push({
        id,
        data: {
          id,
          content: contents[Math.floor(Math.random() * contents.length)],
          author: authors[Math.floor(Math.random() * authors.length)],
          createdAt: new Date(
            Date.now() - Math.floor(Math.random() * 86400000),
          ),
          upvotes: Math.floor(Math.random() * 100),
          downvotes: Math.floor(Math.random() * 10),
        },
        children: createComment(depth + 1),
      });
    }

    return items;
  }

  return createComment(0);
}

const largeCommentData = generateLargeCommentTree(20, 5, 4);

// ============================================================================
// Event Log Component
// ============================================================================

function EventLog({
  logs,
  onClear,
}: {
  logs: LogEntry[];
  onClear: () => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

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
            <div className="text-2xl mb-2">💬</div>
            <div>Interact with the comments to see events</div>
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
              <span className={cn("shrink-0 w-20 font-semibold", log.color)}>
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
// Color Legend Component
// ============================================================================

function DepthColorLegend({ colors, darkText }: { colors?: string[]; darkText?: boolean }) {
  const defaultColors = [
    { color: "#3b82f6", label: "Level 1" }, // blue
    { color: "#f97316", label: "Level 2" }, // orange
    { color: "#22c55e", label: "Level 3" }, // green
    { color: "#a855f7", label: "Level 4" }, // purple
    { color: "#ec4899", label: "Level 5" }, // pink
  ];

  const legendItems = colors
    ? colors.slice(0, 5).map((color, i) => ({
        color,
        label: `Level ${i + 1}`,
      }))
    : defaultColors;

  return (
    <div className={cn("flex flex-wrap gap-x-4 gap-y-1 text-[10px]", darkText ? "text-zinc-600" : "text-zinc-500")}>
      {legendItems.map(({ color, label }, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <div
            className="w-0.5 h-3 rounded-full"
            style={{ backgroundColor: color }}
          />
          <span>{label}</span>
        </div>
      ))}
      <span className={darkText ? "text-zinc-500" : "text-zinc-600"}>...cycles every {colors?.length || 10} levels</span>
    </div>
  );
}

// Light mode depth colors (softer, pastel-like colors that work on white/light backgrounds)
const lightModeDepthColors = [
  "#2563eb", // blue-600
  "#ea580c", // orange-600
  "#16a34a", // green-600
  "#9333ea", // purple-600
  "#db2777", // pink-600
  "#ca8a04", // yellow-600
  "#0891b2", // cyan-600
  "#dc2626", // red-600
];

// ============================================================================
// Main Page
// ============================================================================

export default function CommentTreeTestPage() {
  const [comments, setComments] = useState(sampleComments);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [largeComments, setLargeComments] = useState(largeCommentData);
  const [largeSelectedId, setLargeSelectedId] = useState<string | null>(null);

  const [lightComments, setLightComments] = useState(sampleComments);
  const [lightSelectedId, setLightSelectedId] = useState<string | null>(null);

  // Event logging
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

  // Event handlers with logging
  const handleSelect = useCallback(
    (setter: (id: string | null) => void, treeName: string) =>
      (id: string) => {
        setter(id);
        addLog("select", `${treeName}: ${id}`, "text-cyan-400");
      },
    [addLog],
  );

  const handleCollapseChange = useCallback(
    (treeName: string) => (id: string, collapsed: boolean) => {
      addLog(
        "collapse",
        `${treeName}: ${id} → ${collapsed ? "▶" : "▼"}`,
        "text-amber-400",
      );
    },
    [addLog],
  );

  const handleAction = useCallback(
    (treeName: string) => (actionKey: string, id: string) => {
      addLog("action", `${treeName}: ${actionKey} on ${id}`, "text-pink-400");
    },
    [addLog],
  );

  // Comment actions
  const commentActions: CommentAction[] = [
    { key: "reply", label: "Reply", icon: <IconArrowBackUp size={12} /> },
    { key: "upvote", label: "Upvote", icon: <IconThumbUp size={12} /> },
    { key: "downvote", label: "Downvote", icon: <IconThumbDown size={12} /> },
    { key: "share", label: "Share", icon: <IconShare size={12} /> },
    { key: "save", label: "Save", icon: <IconBookmark size={12} /> },
    { key: "edit", label: "Edit", icon: <IconEdit size={12} /> },
    { key: "report", label: "Report", icon: <IconFlag size={12} /> },
    {
      key: "delete",
      label: "Delete",
      icon: <IconTrash size={12} />,
      destructive: true,
    },
  ];

  // Count total items
  const countItems = (items: CommentItems<Comment>): number => {
    return items.reduce(
      (acc, item) => acc + 1 + countItems(item.children),
      0,
    );
  };

  return (
    <div className="min-h-screen bg-zinc-950 p-6">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-xl font-bold text-white mb-1">
          CommentTree Component Test
        </h1>
        <p className="text-sm text-zinc-500 mb-6">
          Reddit-style nested comments with colored depth indicators and
          virtualization support.
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Basic Comments */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-sm font-medium text-zinc-400">
                  Basic Comments
                </h2>
                <p className="text-xs text-zinc-600">
                  Collapsible threads with actions
                </p>
              </div>
              <div className="text-xs px-2 py-1 rounded bg-zinc-800 text-zinc-400">
                {countItems(comments)} comments
              </div>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
              <CommentTree<Comment>
                id="basic-comments"
                items={comments}
                maxInlineActions={3}
                onItemsChange={setComments}
                selectedId={selectedId}
                onSelect={handleSelect(setSelectedId, "Basic")}
                onCollapseChange={handleCollapseChange("Basic")}
                commentActions={commentActions}
                onAction={handleAction("Basic")}
                collapsible
              />
            </div>
            <div className="mt-2">
              <DepthColorLegend />
            </div>
          </div>

          {/* Virtualized Comments */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-sm font-medium text-zinc-400">
                  Virtualized (Large Tree)
                </h2>
                <p className="text-xs text-zinc-600">
                  Only visible comments are rendered
                </p>
              </div>
              <div className="text-xs px-2 py-1 rounded bg-zinc-800 text-zinc-400">
                {countItems(largeComments)} comments
              </div>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
              <CommentTree<Comment>
                id="virtualized-comments"
                items={largeComments}
                onItemsChange={setLargeComments}
                selectedId={largeSelectedId}
                onSelect={handleSelect(setLargeSelectedId, "Virtualized")}
                onCollapseChange={handleCollapseChange("Virtualized")}
                commentActions={commentActions}
                onAction={handleAction("Virtualized")}
                collapsible
                height={400}
                estimatedItemHeight={100}
                overscan={5}
              />
            </div>
            <div className="mt-2 text-[10px] text-zinc-600">
              💡 Set{" "}
              <code className="text-cyan-400">height=&#123;400&#125;</code> to
              enable virtualization
            </div>
          </div>

          {/* Light Mode Example */}
          <div className="lg:col-span-2">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-sm font-medium text-zinc-400">
                  Light Mode Theme
                </h2>
                <p className="text-xs text-zinc-600">
                  Custom styling via classNames prop
                </p>
              </div>
              <div className="text-xs px-2 py-1 rounded bg-zinc-800 text-zinc-400">
                {countItems(lightComments)} comments
              </div>
            </div>
            <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden shadow-sm">
              <CommentTree<Comment>
                id="light-mode-comments"
                items={lightComments}
                maxInlineActions={3}
                onItemsChange={setLightComments}
                selectedId={lightSelectedId}
                onSelect={handleSelect(setLightSelectedId, "Light")}
                onCollapseChange={handleCollapseChange("Light")}
                commentActions={commentActions}
                onAction={handleAction("Light")}
                collapsible
                depthColors={lightModeDepthColors}
                classNames={{
                  container: "bg-white",
                  comment: "hover:bg-zinc-50 transition-colors",
                  commentSelected: "!bg-blue-50",
                  content: "py-3 px-3",
                  author: "!text-zinc-900 !font-semibold",
                  timestamp: "!text-zinc-500",
                  text: "!text-zinc-700",
                  actions: "mt-2",
                  actionButton: "!text-zinc-500 hover:!text-zinc-900 hover:!bg-zinc-100",
                  actionButtonDestructive: "!text-red-600 hover:!bg-red-50",
                  collapseButton: "!text-zinc-400 hover:!text-zinc-700 hover:!bg-zinc-100",
                  overflowButton: "!text-zinc-400 hover:!text-zinc-700 hover:!bg-zinc-100",
                  overflowMenu: "!bg-white !border-zinc-200 !shadow-lg",
                  overflowMenuItem: "!text-zinc-700 hover:!bg-zinc-100",
                  replyCount: "!text-zinc-500",
                  depthLine: "hover:!border-l-[3px]",
                }}
              />
            </div>
            <div className="mt-2 flex items-center gap-4">
              <DepthColorLegend colors={lightModeDepthColors} darkText />
            </div>
          </div>
        </div>

        {/* Event Log */}
        <div className="mt-8">
          <div className="mb-3">
            <h2 className="text-sm font-medium text-zinc-400">Event Log</h2>
            <p className="text-xs text-zinc-600">
              All callbacks fire here. Interact with comments to see events.
            </p>
          </div>
          <EventLog logs={logs} onClear={clearLogs} />
        </div>

        {/* Code Examples */}
        <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <h2 className="text-sm font-medium text-zinc-400 mb-3">
              Basic Usage
            </h2>
            <pre className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 text-xs overflow-x-auto h-[400px]">
              <code className="text-zinc-300">{`import { CommentTree } from "@kingstack/comment-tree";

const comments = [
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
        data: { /* ... */ },
        children: [],
      },
    ],
  },
];

<CommentTree
  id="my-comments"
  items={comments}
  onItemsChange={setComments}
  selectedId={selectedId}
  onSelect={setSelectedId}
  commentActions={[
    { key: "reply", label: "Reply" },
    { key: "upvote", label: "Upvote" },
  ]}
  onAction={(action, id) => {}}
  collapsible
  height={400}  // Enable virtualization
/>`}</code>
            </pre>
          </div>

          <div>
            <h2 className="text-sm font-medium text-zinc-400 mb-3">
              Light Mode Theming
            </h2>
            <pre className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 text-xs overflow-x-auto h-[400px]">
              <code className="text-zinc-300">{`// Custom depth colors for light backgrounds
const lightColors = [
  "#2563eb", // blue-600
  "#ea580c", // orange-600
  "#16a34a", // green-600
  "#9333ea", // purple-600
  "#db2777", // pink-600
];

<CommentTree
  id="light-comments"
  items={comments}
  depthColors={lightColors}
  classNames={{
    container: "bg-white",
    comment: "hover:bg-zinc-50",
    commentSelected: "!bg-blue-50",
    author: "!text-zinc-900 !font-semibold",
    timestamp: "!text-zinc-500",
    text: "!text-zinc-700",
    actionButton: "!text-zinc-500
      hover:!text-zinc-900 hover:!bg-zinc-100",
    actionButtonDestructive: "!text-red-600
      hover:!bg-red-50",
    overflowMenu: "!bg-white !border-zinc-200",
    overflowMenuItem: "!text-zinc-700
      hover:!bg-zinc-100",
  }}
/>`}</code>
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}
