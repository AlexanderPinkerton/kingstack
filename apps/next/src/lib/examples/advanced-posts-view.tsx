"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowUp,
  Clock3,
  Database,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { observer } from "mobx-react-lite";
import { useStoreActivation } from "@/hooks/useStoreActivation";
import type { PostApiData } from "@/repositories/posts/types";
import {
  type OptimisticDemoPipelineRun,
  type OptimisticPostDemoController,
} from "@/stores/userApp/optimisticPostDemoController";
import {
  OptimisticPostsViewModel,
  type PostDivergence,
} from "@/stores/userApp/optimisticPostsViewModel";
import type { AdvancedPostStore, PostUiData } from "@/stores/userApp/postStore";

interface AdvancedPostsExampleViewProps {
  postStore: AdvancedPostStore;
  currentUserId: string;
  demoController?: OptimisticPostDemoController;
}

const zoneLabelClass =
  "text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-white/30";

/**
 * The five stages a mutation passes through. Edge count must stay in step with
 * `OPTIMISTIC_PIPELINE_EDGES`, which drives the run's timing.
 */
const pipelineNodes = [
  { id: "ui", label: "UI", detail: "components" },
  { id: "mobx", label: "MobX", detail: "optimistic layer" },
  { id: "transformer", label: "Transformer", detail: "toUi ⇄ toApi" },
  { id: "query", label: "TanStack Query", detail: "mutation · cache" },
  { id: "api", label: "API", detail: "POST · PUT · DELETE" },
] as const;

const TRANSFORMER_NODE_INDEX = 2;

type PipelineNodeId = (typeof pipelineNodes)[number]["id"];

interface PipelineNodeDetail {
  summary: string;
  points: string[];
  code?: string;
}

/** What the store actually does at each stage, shown when a node is selected. */
const nodeDetails: Record<PipelineNodeId, PipelineNodeDetail> = {
  ui: {
    summary:
      "Components read one observable projection and call plain methods. There are no cache keys, no invalidation, and no rollback code in the component.",
    points: [
      "store.ui is an observable list. Wrap a component in observer and it re-renders when the projection changes.",
      "Mutations are direct calls. The store decides what the interface should show while the request is in flight.",
      "Nothing here knows whether a record is optimistic — that distinction lives one layer down.",
    ],
    code: "const posts = store.ui.list;\nstore.api.create({ title });",
  },
  mobx: {
    summary:
      "The optimistic layer. The record is applied here before any request leaves the browser, and this is where a failure is undone.",
    points: [
      "onMutate builds the record from the transformer's createOptimisticUiData and upserts it under a temp- id.",
      "Every operation gets a monotonic operationSequence, so overlapping mutations can never roll back one another.",
      "Updates stack as { base, layers[] }. Two edits to one record compose instead of clobbering, and a rollback drops only the failed layer.",
      "Deletes keep the previous record so a rejection can restore it exactly.",
    ],
  },
  transformer: {
    summary:
      "The only place the shape of the data changes. It converts between the API row and the richer object the interface wants.",
    points: [
      "toUi derives UI-only fields — excerpt, word count, reading time, tags — and turns created_at into a Date.",
      "toApi reverses that for the request body.",
      "Derived fields are memoised, so components never recompute them during render.",
      "createOptimisticUiData defines what a record should look like before the server has answered.",
    ],
    code: "toUi:  { created_at: string } → { created_at: Date, excerpt, tags }\ntoApi: { created_at: Date } → { created_at: string }",
  },
  query: {
    summary:
      "Transport and caching. The query cache holds only what the server has confirmed — optimistic records never reach it.",
    points: [
      "One MutationObserver per operation, plus a QueryObserver for the list.",
      "onSuccess writes the server row and drops the matching temp record; onError restores the previous value.",
      "committedEntitySequence discards responses older than what is already committed, so a slow reply cannot overwrite a newer one.",
      "The query key is scoped, so switching users swaps the projection instead of leaking rows between accounts.",
    ],
  },
  api: {
    summary:
      "The store never calls fetch. You hand it a repository and it owns the transport from there.",
    points: [
      "A repository is four functions: list, create, update, remove.",
      "Swap an in-memory implementation in for tests and an HTTP one in the app without touching the store.",
      "This page wraps the real HTTP repository to add the latency and the one-shot rejection you control above.",
    ],
    code: "mutations: {\n  create: (data) => repository.create(data, context),\n}",
  },
};

function phaseLabel(run: OptimisticDemoPipelineRun | null): string {
  if (!run) return "Idle — run a mutation to watch data cross the boundary";
  if (run.status === "rolled_back")
    return "Rollback complete · previous UI data restored";
  if (run.status === "confirmed")
    return "Confirmation complete · UI data reconciled";

  const outbound = run.direction === "outbound";
  const from = pipelineNodes[outbound ? run.edgeIndex : run.edgeIndex + 1];
  const to = pipelineNodes[outbound ? run.edgeIndex + 1 : run.edgeIndex];

  if (outbound && run.willReject && to.id === "api") {
    return `${from.label} → simulated API rejection`;
  }

  return `${from.label} → ${to.label}`;
}

/**
 * What the transformer is doing right now. It is the only stage that changes
 * the shape of the data, so it narrates the conversion in both directions.
 */
function transformerCopy(run: OptimisticDemoPipelineRun | null): {
  detail: string;
  shape: string;
} {
  if (!run || run.status !== "pending") {
    return { detail: "toUi ⇄ toApi", shape: "shape boundary" };
  }
  if (run.direction === "outbound") {
    return { detail: "UI data → API data", shape: "Date → ISO string" };
  }
  if (run.result === "rolled_back") {
    return { detail: "restoring UI data", shape: "optimistic layer dropped" };
  }
  return { detail: "API data → UI data", shape: "ISO string → Date" };
}

/**
 * Reads the server-confirmed rows out of the query cache and re-renders when
 * they change. The cache is only written on mutation success, so this is the
 * counterpart to the optimistic MobX projection.
 */
function useConfirmedPosts(
  postStore: AdvancedPostStore,
): readonly PostApiData[] {
  const queryClient = useQueryClient();
  const subscribe = useCallback(
    (onStoreChange: () => void) =>
      queryClient.getQueryCache().subscribe(onStoreChange),
    [queryClient],
  );
  const getSnapshot = useCallback(
    () => postStore.confirmedApiData,
    [postStore],
  );

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

const pipelineEdgeTones = [
  { blip: "bg-[#d8ff70] shadow-[0_0_10px_#d8ff70]", line: "bg-[#d8ff70]/25" },
  { blip: "bg-[#d8ff70] shadow-[0_0_10px_#d8ff70]", line: "bg-[#d8ff70]/25" },
  { blip: "bg-[#a89cff] shadow-[0_0_10px_#a89cff]", line: "bg-[#a89cff]/25" },
  { blip: "bg-[#8ee8ff] shadow-[0_0_10px_#8ee8ff]", line: "bg-[#8ee8ff]/25" },
] as const;

/**
 * One connector between two pipeline stages. The blip travels down on the way
 * out and back up as the confirmation or rejection returns.
 */
function PipelineEdge({
  index,
  run,
}: {
  index: number;
  run: OptimisticDemoPipelineRun | null;
}) {
  const edge = pipelineEdgeTones[index] ?? pipelineEdgeTones[0];
  const backward = run?.direction === "return";
  // At zero latency the round trip is effectively instant, so nothing travels.
  const showBlip =
    run?.status === "pending" && run.stepMs > 0 && run.edgeIndex === index;
  const rolledBack = backward && run?.result === "rolled_back";
  const blipTone = backward
    ? rolledBack
      ? "bg-[#ff9c6e] shadow-[0_0_12px_#ff9c6e]"
      : "bg-[#8ee8ff] shadow-[0_0_12px_#8ee8ff]"
    : edge.blip;
  const lineTone = showBlip
    ? rolledBack
      ? "bg-[#ff9c6e]/35"
      : backward
        ? "bg-[#8ee8ff]/35"
        : edge.line
    : "bg-white/10";

  return (
    <div
      aria-hidden="true"
      className={`relative mx-auto h-6 w-px overflow-visible ${lineTone}`}
    >
      {showBlip && (
        <span
          // Remounts per traversal so the animation restarts each time.
          key={`${run?.id ?? "idle"}-${run?.direction ?? "idle"}-${index}`}
          className={`optimistic-flow-blip absolute -left-[0.1875rem] size-[0.4375rem] rounded-full ${blipTone}`}
          data-direction={backward ? "backward" : "forward"}
          style={{ animationDuration: `${run?.stepMs ?? 0}ms` }}
        />
      )}
    </div>
  );
}

/**
 * The vertical spine sitting between the optimistic and confirmed views. It is
 * the boundary a mutation crosses, so it doubles as the divider between them.
 */
const PipelineSpine = observer(function PipelineSpine({
  controller,
  selectedNodeId,
  onSelectNode,
}: {
  controller: OptimisticPostDemoController;
  selectedNodeId: PipelineNodeId | null;
  onSelectNode: (nodeId: PipelineNodeId | null) => void;
}) {
  const run = controller.pipelineRun;
  const settledTone =
    run?.status === "rolled_back"
      ? "text-[#ffb494]"
      : run?.status === "confirmed"
        ? "text-[#8ee8ff]"
        : "text-[#d8ff70]";

  const nodeTones: Record<string, string> = {
    ui: "text-white/45",
    mobx: settledTone,
    transformer: "text-[#a89cff]",
    query: "text-[#8ee8ff]",
    api: run?.result === "rolled_back" ? "text-[#ffb494]" : "text-[#8ee8ff]",
  };

  const transformer = transformerCopy(run);
  // Lit while the run is on either edge touching the transformer.
  const transformerActive =
    run?.status === "pending" &&
    (run.edgeIndex === TRANSFORMER_NODE_INDEX - 1 ||
      run.edgeIndex === TRANSFORMER_NODE_INDEX);

  return (
    <div className="min-w-0">
      <p className={zoneLabelClass}>The boundary</p>
      <div className="mt-4">
        {pipelineNodes.map((node, index) => {
          const isTransformer = node.id === "transformer";
          const selected = selectedNodeId === node.id;

          return (
            <div key={node.id}>
              <button
                type="button"
                aria-pressed={selected}
                onClick={() => onSelectNode(selected ? null : node.id)}
                className={`block w-full rounded-xl border px-2.5 py-2 text-center transition hover:border-white/25 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#a89cff]/50 ${
                  selected
                    ? "border-[#a89cff]/60 bg-[#a89cff]/[0.12]"
                    : isTransformer && transformerActive
                      ? "border-[#a89cff]/40 bg-[#a89cff]/[0.09]"
                      : "border-white/[0.07] bg-white/[0.025]"
                }`}
              >
                <span
                  className={`block text-[0.65rem] font-semibold uppercase tracking-[0.12em] ${nodeTones[node.id]}`}
                >
                  {node.label}
                </span>
                <span className="mt-0.5 block font-mono text-[0.6rem] leading-4 text-white/35">
                  {isTransformer ? transformer.detail : node.detail}
                </span>
                {isTransformer && (
                  <span className="block font-mono text-[0.6rem] leading-4 text-white/25">
                    {transformer.shape}
                  </span>
                )}
              </button>
              {index < pipelineNodes.length - 1 && (
                <PipelineEdge index={index} run={run} />
              )}
            </div>
          );
        })}
      </div>
      <p className="mt-4 text-center text-[0.7rem] leading-5 text-white/35">
        Every mutation travels down and comes back as a confirmation or a
        rollback. Select a stage to see what the store does there.
      </p>
    </div>
  );
});

/** Stacked rather than inline: it lives in a narrow rail beside the app. */
const Toolbar = observer(function Toolbar({
  controller,
}: {
  controller: OptimisticPostDemoController;
}) {
  const run = controller.pipelineRun;

  return (
    <div className="rounded-2xl border border-white/10 bg-[#0c0d10] p-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className={zoneLabelClass}>Latency</span>
        <div className="flex gap-1.5">
          {[
            { label: "None", value: 0 },
            { label: "1s", value: 1000 },
            { label: "2.5s", value: 2500 },
          ].map((option) => {
            const selected = controller.networkDelayMs === option.value;
            return (
              <button
                key={option.value}
                type="button"
                disabled={controller.isMutationPending}
                onClick={() => controller.setNetworkDelay(option.value)}
                aria-pressed={selected}
                className={`rounded-lg border px-2.5 py-1 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-40 ${
                  selected
                    ? "border-[#d8ff70]/50 bg-[#d8ff70]/10 text-[#d8ff70]"
                    : "border-white/10 bg-white/[0.03] text-white/45 hover:border-white/20 hover:text-white"
                }`}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      <button
        type="button"
        disabled={controller.isMutationPending}
        onClick={() => controller.toggleFailure()}
        aria-pressed={controller.failureArmed}
        className={`mt-2.5 flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${
          controller.failureArmed
            ? "border-[#ff9c6e]/50 bg-[#ff9c6e]/10 text-[#ffb494]"
            : "border-white/10 bg-white/[0.03] text-white/55 hover:border-white/20 hover:text-white"
        }`}
      >
        <AlertTriangle className="size-3.5 shrink-0" aria-hidden="true" />
        {controller.failureArmed
          ? "Rejection armed — next mutation rolls back"
          : "Reject next mutation"}
      </button>

      <p
        className={`mt-2.5 text-xs leading-5 ${
          run?.status === "rolled_back"
            ? "text-[#ffb494]"
            : run?.status === "confirmed"
              ? "text-[#8ee8ff]"
              : run
                ? "text-[#d8ff70]"
                : "text-white/30"
        }`}
        aria-live="polite"
      >
        {phaseLabel(run)}
      </p>
    </div>
  );
});

const CreatePostForm = observer(function CreatePostForm({
  viewModel,
}: {
  viewModel: OptimisticPostsViewModel;
}) {
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        viewModel.createPost();
      }}
      className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-3"
    >
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="block">
          <span className="sr-only">Title</span>
          <input
            value={viewModel.newTitle}
            onChange={(event) => viewModel.setNewTitle(event.target.value)}
            placeholder="Post title"
            className="min-h-10 w-full rounded-lg border border-white/10 bg-white/[0.045] px-3 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-[#d8ff70]/45"
          />
        </label>
        <label className="block">
          <span className="sr-only">Content</span>
          <input
            value={viewModel.newContent}
            onChange={(event) => viewModel.setNewContent(event.target.value)}
            placeholder="Content · #tags become chips"
            className="min-h-10 w-full rounded-lg border border-white/10 bg-white/[0.045] px-3 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-[#d8ff70]/45"
          />
        </label>
      </div>

      <div className="mt-2.5 flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-xs text-white/45">
          <input
            type="checkbox"
            checked={viewModel.newPublished}
            onChange={(event) =>
              viewModel.setNewPublished(event.target.checked)
            }
            className="size-4 accent-[#d8ff70]"
          />
          Publish immediately
        </label>
        <button
          type="submit"
          disabled={!viewModel.newTitle.trim() || viewModel.isMutationPending}
          className="inline-flex min-h-9 items-center gap-2 rounded-lg bg-[#d8ff70] px-3.5 text-sm font-semibold text-[#11130d] transition hover:bg-[#e3ff98] disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Plus className="size-3.5" aria-hidden="true" />
          Add post
        </button>
      </div>
    </form>
  );
});

const PostCard = observer(function PostCard({
  post,
  viewModel,
}: {
  post: PostUiData;
  viewModel: OptimisticPostsViewModel;
}) {
  const optimistic = post.id.startsWith("temp-");
  const divergent = viewModel.isDivergent(post);
  const canManage = viewModel.canManage(post);
  const disabled = !canManage || optimistic || viewModel.isMutationPending;

  return (
    <article
      className={`rounded-xl border p-3.5 transition ${
        divergent
          ? "border-[#d8ff70]/45 bg-[#d8ff70]/[0.055] shadow-lg shadow-[#d8ff70]/5"
          : "border-white/10 bg-white/[0.025]"
      }`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="min-w-0 flex-1 truncate text-sm font-semibold tracking-[-0.02em]">
          {post.title}
        </h3>
        <span
          className={`rounded-full border px-2 py-0.5 text-[0.6rem] font-semibold uppercase tracking-[0.1em] ${
            post.published
              ? "border-[#8ee8ff]/25 bg-[#8ee8ff]/10 text-[#8ee8ff]"
              : "border-white/10 bg-white/[0.04] text-white/40"
          }`}
        >
          {post.publishStatus}
        </span>
        {divergent && (
          <span className="inline-flex items-center gap-1 rounded-full border border-[#d8ff70]/30 bg-[#d8ff70]/10 px-2 py-0.5 text-[0.6rem] font-semibold uppercase tracking-[0.1em] text-[#d8ff70]">
            <Clock3 className="size-2.5" aria-hidden="true" />
            {optimistic ? "Optimistic" : "Unconfirmed"}
          </span>
        )}
      </div>

      <p className="mt-2 line-clamp-2 text-xs leading-5 text-white/45">
        {post.excerpt || "No post content yet."}
      </p>

      {post.tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {post.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-md bg-white/[0.045] px-1.5 py-0.5 text-[0.6rem] text-white/35"
            >
              #{tag}
            </span>
          ))}
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.07] pt-2.5">
        <div className="min-w-0">
          <span className="block truncate text-[0.65rem] text-white/35">
            By {post.author.displayName}
          </span>
          <span className="block font-mono text-[0.6rem] text-white/20">
            {post.id.startsWith("temp-") ? post.id : post.id.slice(0, 8)}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => viewModel.togglePublished(post)}
            disabled={disabled}
            className="rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[0.65rem] font-medium text-white/55 transition hover:border-white/20 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            {post.published ? "Unpublish" : "Publish"}
          </button>
          <button
            type="button"
            onClick={() => viewModel.startEditing(post)}
            disabled={disabled}
            aria-label={`Edit ${post.title}`}
            className="grid size-7 place-items-center rounded-lg border border-white/10 text-white/40 transition hover:border-white/20 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Pencil className="size-3" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => viewModel.removePost(post)}
            disabled={disabled}
            aria-label={`Delete ${post.title}`}
            className="grid size-7 place-items-center rounded-lg border border-white/10 text-white/40 transition hover:border-[#ff9c6e]/30 hover:text-[#ffb494] disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Trash2 className="size-3" aria-hidden="true" />
          </button>
        </div>
      </div>
    </article>
  );
});

/**
 * The demo product, framed as its own window so it reads as the application a
 * user would see rather than as part of the explanation around it.
 */
const ExampleApplication = observer(function ExampleApplication({
  viewModel,
}: {
  viewModel: OptimisticPostsViewModel;
}) {
  const stats = viewModel.stats;

  return (
    <section className="overflow-hidden rounded-2xl border border-white/[0.14] bg-[#15171c] shadow-2xl shadow-black/40">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-white/10 bg-white/[0.03] px-4 py-2.5">
        <span className="flex shrink-0 gap-1.5" aria-hidden="true">
          <span className="size-2.5 rounded-full bg-[#ff5f57]" />
          <span className="size-2.5 rounded-full bg-[#febc2e]" />
          <span className="size-2.5 rounded-full bg-[#28c840]" />
        </span>
        <h2 className="text-xs font-medium text-white/55">
          Example application
        </h2>
        <p className="ml-auto text-[0.65rem] text-white/30">
          {stats.total} posts · {stats.published} published
          {stats.optimistic > 0 && (
            <span className="text-[#d8ff70]">
              {" "}
              · {stats.optimistic} pending
            </span>
          )}
        </p>
      </div>

      <div className="space-y-4 p-4 sm:p-6">
        <CreatePostForm viewModel={viewModel} />

        <div className="flex flex-wrap items-center gap-2">
          {(["all", "published", "draft"] as const).map((filter) => (
            <button
              key={filter}
              type="button"
              onClick={() => viewModel.setSelectedFilter(filter)}
              aria-pressed={viewModel.selectedFilter === filter}
              className={`rounded-full border px-3 py-1 text-[0.65rem] font-semibold capitalize transition ${
                viewModel.selectedFilter === filter
                  ? "border-[#a89cff]/40 bg-[#a89cff]/10 text-[#bdb5ff]"
                  : "border-white/10 text-white/35 hover:text-white"
              }`}
            >
              {filter}
            </button>
          ))}
          <div className="relative ml-auto min-w-0 flex-1 sm:max-w-[14rem]">
            <Search
              className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-white/25"
              aria-hidden="true"
            />
            <input
              value={viewModel.searchQuery}
              onChange={(event) => viewModel.setSearchQuery(event.target.value)}
              placeholder="Search"
              aria-label="Search posts"
              className="min-h-8 w-full rounded-lg border border-white/10 bg-white/[0.035] pl-9 pr-3 text-xs text-white outline-none placeholder:text-white/20 focus:border-[#a89cff]/45"
            />
          </div>
        </div>

        <div className="space-y-3">
          {viewModel.visiblePosts.map((post) => (
            <PostCard key={post.id} post={post} viewModel={viewModel} />
          ))}
        </div>

        {viewModel.filteredPosts.length === 0 && (
          <div className="rounded-xl border border-dashed border-white/10 px-6 py-10 text-center">
            <Database
              className="mx-auto size-5 text-white/20"
              aria-hidden="true"
            />
            <p className="mt-3 text-xs text-white/35">
              {viewModel.searchQuery || viewModel.selectedFilter !== "all"
                ? "No posts match these filters."
                : "Create the first post to start the demo."}
            </p>
          </div>
        )}

        {viewModel.filteredPosts.length > viewModel.visiblePosts.length && (
          <p className="text-center text-[0.7rem] text-white/25">
            Showing the first {viewModel.visiblePosts.length} of{" "}
            {viewModel.filteredPosts.length} matching posts.
          </p>
        )}
      </div>
    </section>
  );
});

/** Compact mirror of the projection, sized to sit opposite the server ledger. */
const ledgerRowClass =
  "flex items-center gap-2 rounded-lg border px-2.5 py-1.5 transition";

function LedgerRow({
  title,
  published,
  idLabel,
  divergent = false,
}: {
  title: string;
  published: boolean;
  idLabel: string;
  divergent?: boolean;
}) {
  return (
    <li
      className={`${ledgerRowClass} ${
        divergent
          ? "border-[#d8ff70]/40 bg-[#d8ff70]/[0.07]"
          : "border-white/[0.06] bg-white/[0.02]"
      }`}
    >
      <span
        aria-hidden="true"
        className={`size-1.5 shrink-0 rounded-full ${
          published ? "bg-[#8ee8ff]" : "bg-white/25"
        }`}
      />
      <span className="min-w-0 flex-1 truncate text-xs text-white/60">
        {title}
      </span>
      <span
        className={`shrink-0 font-mono text-[0.6rem] ${
          divergent ? "text-[#d8ff70]" : "text-white/25"
        }`}
      >
        {idLabel}
      </span>
    </li>
  );
}

/**
 * Both sides of the boundary, stacked. The projection holds optimistic records
 * the cache has never seen, so the two lists only match once everything settles.
 */
const DataComparisonPanel = observer(function DataComparisonPanel({
  viewModel,
  onClose,
}: {
  viewModel: OptimisticPostsViewModel;
  onClose: () => void;
}) {
  const divergence = viewModel.divergence;
  const uiRows = viewModel.uiRecords.slice(0, 5);
  const serverRows = viewModel.confirmedRecords.slice(0, 5);

  return (
    <div className="min-w-0">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className={zoneLabelClass}>Both sides</p>
          <h3 className="mt-1.5 text-base font-semibold tracking-[-0.02em]">
            Projection vs. cache
          </h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close data comparison"
          className="grid size-7 shrink-0 place-items-center rounded-lg border border-white/10 text-white/40 transition hover:border-white/25 hover:text-white"
        >
          <X className="size-3.5" aria-hidden="true" />
        </button>
      </div>

      <div
        className={`mt-3 rounded-xl border px-3 py-2 text-xs ${
          divergence.inSync
            ? "border-[#8ee8ff]/25 bg-[#8ee8ff]/[0.07] text-[#8ee8ff]"
            : "border-[#d8ff70]/30 bg-[#d8ff70]/[0.07] text-[#d8ff70]"
        }`}
        aria-live="polite"
      >
        {divergenceSummary(divergence)}
      </div>

      <div className="mt-4">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <p className={zoneLabelClass}>UI data · MobX</p>
          <p className="text-[0.7rem] text-white/35">
            {viewModel.uiRecords.length}
          </p>
        </div>
        <ul className="mt-2 space-y-1.5">
          {uiRows.map((post) => (
            <LedgerRow
              key={post.id}
              title={post.title}
              published={post.published}
              divergent={viewModel.isDivergent(post)}
              idLabel={
                post.id.startsWith("temp-") ? "temp" : post.id.slice(0, 8)
              }
            />
          ))}
          {uiRows.length === 0 && (
            <li className="rounded-lg border border-dashed border-white/10 px-3 py-4 text-center text-xs text-white/30">
              Nothing in the projection yet.
            </li>
          )}
        </ul>
      </div>

      <div className="mt-4 border-t border-white/[0.07] pt-4">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <p className={zoneLabelClass}>Server data · cache</p>
          <p className="text-[0.7rem] text-white/35">
            {viewModel.confirmedRecords.length}
          </p>
        </div>
        <ul className="mt-2 space-y-1.5">
          {serverRows.map((post) => (
            <LedgerRow
              key={post.id}
              title={post.title}
              published={post.published}
              idLabel={post.id.slice(0, 8)}
            />
          ))}
          {serverRows.length === 0 && (
            <li className="rounded-lg border border-dashed border-white/10 px-3 py-4 text-center text-xs text-white/30">
              Nothing confirmed yet.
            </li>
          )}
        </ul>
        <p className="mt-2 text-[0.7rem] leading-4 text-white/25">
          Only written when a mutation succeeds. Optimistic records never reach
          it.
        </p>
      </div>
    </div>
  );
});

function divergenceSummary(divergence: PostDivergence): string {
  if (divergence.inSync) return "In sync — both sides agree";

  const parts = [
    divergence.ahead > 0 ? `${divergence.ahead} not yet confirmed` : null,
    divergence.changed > 0 ? `${divergence.changed} edited` : null,
    divergence.behind > 0 ? `${divergence.behind} pending delete` : null,
  ].filter(Boolean);

  return `Interface is ahead: ${parts.join(" · ")}`;
}

/**
 * Resting state of the detail column. Its job is to make the diagram look
 * clickable and to keep the interface-vs-server signal on screen.
 */
const GuidePanel = observer(function GuidePanel({
  viewModel,
  onShowServerData,
}: {
  viewModel: OptimisticPostsViewModel;
  onShowServerData: () => void;
}) {
  const divergence = viewModel.divergence;

  return (
    <div className="flex min-w-0 flex-col">
      <p className={zoneLabelClass}>Inside the store</p>
      <h2 className="mt-1.5 text-lg font-semibold tracking-[-0.025em]">
        Click a node to learn more
      </h2>
      <p className="mt-2 text-xs leading-5 text-white/45">
        The spine is the path every mutation takes. Pick a stage to see what the
        store does there, and what it saves you from writing.
      </p>

      {/* Points at the spine: beside this column on wide screens, above it
          once the layout stacks. */}
      <div className="flex flex-1 items-center justify-center py-10">
        <span className="grid size-14 place-items-center rounded-full border border-[#d8ff70]/30 bg-[#d8ff70]/[0.08] text-[#d8ff70]">
          <ArrowUp className="size-6 sm:hidden" aria-hidden="true" />
          <ArrowLeft className="hidden size-6 sm:block" aria-hidden="true" />
        </span>
      </div>

      <div className="border-t border-white/[0.07] pt-4">
        <p
          className={`text-xs ${
            divergence.inSync ? "text-[#8ee8ff]" : "text-[#d8ff70]"
          }`}
          aria-live="polite"
        >
          {divergenceSummary(divergence)}
        </p>
        <button
          type="button"
          onClick={onShowServerData}
          className="mt-2 text-xs text-white/35 transition hover:text-white"
        >
          Compare both sides →
        </button>
      </div>
    </div>
  );
});

/**
 * Takes over the confirmed-data column while a pipeline node is selected, so
 * the diagram doubles as a guided tour of the store.
 */
function NodeDetailColumn({
  nodeId,
  onClose,
}: {
  nodeId: PipelineNodeId;
  onClose: () => void;
}) {
  const node = pipelineNodes.find((candidate) => candidate.id === nodeId);
  const detail = nodeDetails[nodeId];
  if (!node) return null;

  return (
    <div className="min-w-0">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className={zoneLabelClass}>Inside the store</p>
          <h2 className="mt-1.5 text-lg font-semibold tracking-[-0.025em]">
            {node.label}
          </h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close stage detail"
          className="grid size-7 shrink-0 place-items-center rounded-lg border border-white/10 text-white/40 transition hover:border-white/25 hover:text-white"
        >
          <X className="size-3.5" aria-hidden="true" />
        </button>
      </div>

      <p className="mt-3 text-xs leading-5 text-white/50">{detail.summary}</p>

      <ul className="mt-3 space-y-2">
        {detail.points.map((point) => (
          <li
            key={point}
            className="flex gap-2 text-xs leading-5 text-white/45"
          >
            <span
              aria-hidden="true"
              className="mt-[0.4rem] size-1 shrink-0 rounded-full bg-[#a89cff]"
            />
            <span className="min-w-0">{point}</span>
          </li>
        ))}
      </ul>

      {detail.code && <CodeBlock code={detail.code} />}

      <button
        type="button"
        onClick={onClose}
        className="mt-4 text-xs text-white/35 transition hover:text-white"
      >
        ← Back to server data
      </button>
    </div>
  );
}

type TokenKind =
  "comment" | "string" | "jsx" | "keyword" | "number" | "fn" | "prop" | "ident";

/**
 * Ordered alternation — the first branch that matches wins, so comments and
 * strings are consumed before anything inside them can be mistaken for code.
 * Deliberately small: it only has to cover the snippets on this page.
 */
const TOKEN_PATTERN = new RegExp(
  [
    "(?<comment>//[^\\n]*)",
    "(?<string>\"(?:[^\"\\\\]|\\\\.)*\"|'(?:[^'\\\\]|\\\\.)*'|`(?:[^`\\\\]|\\\\.)*`)",
    "(?<jsx></?[A-Za-z][\\w.]*)",
    "(?<keyword>\\b(?:const|let|var|function|return|new|await|async|import|export|from|type|interface)\\b)",
    "(?<number>\\b\\d+(?:\\.\\d+)?\\b)",
    "(?<fn>[A-Za-z_$][\\w$]*(?=\\())",
    "(?<prop>[A-Za-z_$][\\w$]*(?=\\s*:))",
    "(?<ident>[A-Za-z_$][\\w$]*)",
  ].join("|"),
  "g",
);

/** Keys are checked in this order when resolving which group matched. */
const TOKEN_TONES: Record<TokenKind, string> = {
  comment: "text-white/25",
  string: "text-[#d8ff70]",
  jsx: "text-[#8ee8ff]",
  keyword: "text-[#a89cff]",
  number: "text-[#ffb494]",
  fn: "text-[#8ee8ff]",
  prop: "text-white/55",
  ident: "text-white/70",
};

function highlightLine(line: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  let lastIndex = 0;
  let key = 0;

  TOKEN_PATTERN.lastIndex = 0;
  let match = TOKEN_PATTERN.exec(line);

  while (match !== null) {
    if (match.index > lastIndex) {
      nodes.push(line.slice(lastIndex, match.index));
    }

    const groups = match.groups ?? {};
    const kind = (Object.keys(TOKEN_TONES) as TokenKind[]).find(
      (candidate) => groups[candidate] !== undefined,
    );

    nodes.push(
      kind ? (
        <span key={key++} className={TOKEN_TONES[kind]}>
          {match[0]}
        </span>
      ) : (
        match[0]
      ),
    );

    lastIndex = match.index + match[0].length;
    match = TOKEN_PATTERN.exec(line);
  }

  if (lastIndex < line.length) nodes.push(line.slice(lastIndex));
  return nodes;
}

function CodeBlock({ code }: { code: string }) {
  return (
    <pre className="mt-3 overflow-x-auto rounded-xl border border-white/[0.07] bg-black/30 p-3 font-mono text-[0.7rem] leading-5 text-white/30">
      <code>
        {code.split("\n").map((line, index) => (
          <span key={index} className="block">
            {line ? highlightLine(line) : " "}
          </span>
        ))}
      </code>
    </pre>
  );
}

const implementationSteps = [
  {
    title: "Describe the shape",
    body: "One transformer owns the boundary between the API row and the object your components want.",
    code: `const transformer = {
  toUi: (row) => ({
    ...row,
    created_at: new Date(row.created_at),
    excerpt: row.content.slice(0, 150),
  }),
  toApi: (post) => ({
    ...post,
    created_at: post.created_at.toISOString(),
  }),
  // How a record looks before the server replies
  optimisticDefaults: {
    createOptimisticUiData: (input) => ({
      ...input,
      created_at: new Date(),
    }),
  },
};`,
  },
  {
    title: "Create the store",
    body: "Hand it a query, a repository, and the transformer. It owns the cache, the optimistic layer, and rollback.",
    code: `const store = createOptimisticStore(
  {
    name: "posts",
    queryKey: () => ["posts", userId],
    queryFn: () => repository.list(),
    mutations: {
      create: (data) => repository.create(data),
      update: ({ id, data }) =>
        repository.update(id, data),
      remove: (id) => repository.remove(id),
    },
    transformer,
  },
  queryClient,
);`,
  },
  {
    title: "Render and mutate",
    body: "Components read one observable list and call plain methods. No cache keys, no invalidation, no rollback code.",
    code: `const Posts = observer(() => (
  <ul>
    {store.ui.list.map((post) => (
      <li key={post.id}>{post.title}</li>
    ))}
  </ul>
));

// Applied now, reconciled or rolled back later
store.api.create({ title: "New Post" });`,
  },
] as const;

function ImplementationGuide() {
  return (
    <section className="rounded-2xl border border-white/10 bg-[#0c0d10] p-4 sm:p-6">
      <p className={zoneLabelClass}>How it&rsquo;s wired</p>
      <h2 className="mt-1.5 text-lg font-semibold tracking-[-0.025em]">
        Three steps to everything above
      </h2>
      <p className="mt-2 max-w-2xl text-xs leading-5 text-white/45">
        The whole page — optimistic writes, reconciliation, rollback, and the
        scoped cache — is this much wiring.
      </p>

      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        {implementationSteps.map((step, index) => (
          <div key={step.title} className="min-w-0">
            <div className="flex items-center gap-2.5">
              <span className="grid size-6 shrink-0 place-items-center rounded-md border border-[#d8ff70]/25 bg-[#d8ff70]/10 font-mono text-[0.65rem] text-[#d8ff70]">
                {index + 1}
              </span>
              <h3 className="text-sm font-semibold">{step.title}</h3>
            </div>
            <p className="mt-2 text-xs leading-5 text-white/40">{step.body}</p>
            <CodeBlock code={step.code} />
          </div>
        ))}
      </div>
    </section>
  );
}

const EditPostDialog = observer(function EditPostDialog({
  viewModel,
}: {
  viewModel: OptimisticPostsViewModel;
}) {
  if (!viewModel.editingPost) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Edit post"
      className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/75 p-4 backdrop-blur-sm"
      onClick={(event) => {
        if (event.target === event.currentTarget) viewModel.cancelEditing();
      }}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          viewModel.saveEdit();
        }}
        className="w-full max-w-xl rounded-[1.5rem] border border-white/10 bg-[#111216] p-5 shadow-2xl sm:p-7"
      >
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-[#a89cff]">
          Optimistic edit
        </p>
        <h2 className="mt-3 text-2xl font-semibold tracking-[-0.035em]">
          Update this post
        </h2>
        <label className="mt-6 block">
          <span className="text-xs font-medium text-white/45">Title</span>
          <input
            value={viewModel.editTitle}
            onChange={(event) => viewModel.setEditTitle(event.target.value)}
            className="mt-2 min-h-11 w-full rounded-xl border border-white/10 bg-white/[0.045] px-3 text-sm text-white outline-none focus:border-[#a89cff]/45"
          />
        </label>
        <label className="mt-3 block">
          <span className="text-xs font-medium text-white/45">Content</span>
          <textarea
            value={viewModel.editContent}
            onChange={(event) => viewModel.setEditContent(event.target.value)}
            rows={6}
            className="mt-2 w-full resize-none rounded-xl border border-white/10 bg-white/[0.045] p-3 text-sm leading-6 text-white outline-none focus:border-[#a89cff]/45"
          />
        </label>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <label className="flex items-center gap-2 text-xs text-white/45">
            <input
              type="checkbox"
              checked={viewModel.editPublished}
              onChange={(event) =>
                viewModel.setEditPublished(event.target.checked)
              }
              className="size-4 accent-[#d8ff70]"
            />
            Published
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => viewModel.cancelEditing()}
              className="rounded-xl border border-white/10 px-4 py-2 text-sm text-white/50 transition hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={
                !viewModel.editTitle.trim() || viewModel.isMutationPending
              }
              className="rounded-xl bg-[#a89cff] px-4 py-2 text-sm font-semibold text-[#11130d] transition hover:bg-[#bdb5ff] disabled:opacity-40"
            >
              Save immediately
            </button>
          </div>
        </div>
      </form>
    </div>
  );
});

export const AdvancedPostsExampleView = observer(
  ({
    postStore,
    currentUserId,
    demoController,
  }: AdvancedPostsExampleViewProps) => {
    useStoreActivation(postStore);
    const [isClient, setIsClient] = useState(false);
    const [viewModel] = useState(
      () =>
        new OptimisticPostsViewModel(postStore, currentUserId, demoController),
    );
    const confirmedPosts = useConfirmedPosts(postStore);
    // The detail column rests on the guide, and opens either a pipeline stage
    // or the server-confirmed rows.
    const [detailPanel, setDetailPanel] = useState<
      PipelineNodeId | "server" | null
    >(null);
    const selectedNodeId = detailPanel === "server" ? null : detailPanel;

    useEffect(() => {
      setIsClient(true);
    }, []);

    useEffect(() => {
      viewModel.setCurrentUserId(currentUserId);
    }, [currentUserId, viewModel]);

    useEffect(() => {
      viewModel.setConfirmedPosts(confirmedPosts);
    }, [confirmedPosts, viewModel]);

    useEffect(() => {
      if (!viewModel.editingPost) return;

      const onKeyDown = (event: KeyboardEvent) => {
        if (event.key === "Escape") viewModel.cancelEditing();
      };
      window.addEventListener("keydown", onKeyDown);
      return () => window.removeEventListener("keydown", onKeyDown);
    }, [viewModel, viewModel.editingPost]);

    if (!isClient || !postStore.isReady || postStore.api.status.isLoading) {
      return (
        <section className="grid min-h-[24rem] place-items-center rounded-2xl border border-white/10 bg-[#0c0d10] text-white/45">
          Preparing the optimistic mutation lab…
        </section>
      );
    }

    if (postStore.api.status.isError) {
      return (
        <section className="rounded-2xl border border-[#ff9c6e]/30 bg-[#ff9c6e]/5 p-8 text-center">
          <p className="text-[#ffb494]">
            {postStore.api.status.error?.message ??
              "Posts could not be loaded."}
          </p>
          <button
            type="button"
            onClick={() => void postStore.api.refetch()}
            className="mt-5 rounded-xl border border-[#ff9c6e]/30 px-4 py-2 text-sm text-[#ffb494] transition hover:bg-[#ff9c6e]/10"
          >
            Try again
          </button>
        </section>
      );
    }

    return (
      <>
        {/* Side by side so the pipeline stays on screen while you drive the
            application next to it. */}
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,30rem)] lg:gap-8">
          <ExampleApplication viewModel={viewModel} />

          <div className="min-w-0 lg:border-l lg:border-white/[0.07] lg:pl-8">
            <h2 className="text-xl font-semibold tracking-[-0.03em]">
              Under the hood
            </h2>
            <p className="mt-1 text-xs text-white/40">
              What the store does while you use the application.
            </p>

            {demoController && (
              <div className="mt-4">
                <Toolbar controller={demoController} />
              </div>
            )}

            <div className="mt-4 grid gap-5 sm:grid-cols-[10.5rem_minmax(0,1fr)]">
              {demoController && (
                <PipelineSpine
                  controller={demoController}
                  selectedNodeId={selectedNodeId}
                  onSelectNode={setDetailPanel}
                />
              )}
              {detailPanel === null ? (
                <GuidePanel
                  viewModel={viewModel}
                  onShowServerData={() => setDetailPanel("server")}
                />
              ) : detailPanel === "server" ? (
                <DataComparisonPanel
                  viewModel={viewModel}
                  onClose={() => setDetailPanel(null)}
                />
              ) : (
                <NodeDetailColumn
                  nodeId={detailPanel}
                  onClose={() => setDetailPanel(null)}
                />
              )}
            </div>
          </div>
        </div>

        <div className="mt-8">
          <ImplementationGuide />
        </div>

        <EditPostDialog viewModel={viewModel} />
      </>
    );
  },
);
