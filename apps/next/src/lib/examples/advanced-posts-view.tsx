"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Check,
  Clock3,
  Database,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  Zap,
} from "lucide-react";
import { observer } from "mobx-react-lite";
import { useStoreActivation } from "@/hooks/useStoreActivation";
import type { PostApiData } from "@/repositories/posts/types";
import {
  type OptimisticDemoActivity,
  type OptimisticDemoPipelineRun,
  type OptimisticPostDemoController,
} from "@/stores/userApp/optimisticPostDemoController";
import { OptimisticPostsViewModel } from "@/stores/userApp/optimisticPostsViewModel";
import type { AdvancedPostStore, PostUiData } from "@/stores/userApp/postStore";

interface AdvancedPostsExampleViewProps {
  postStore: AdvancedPostStore;
  currentUserId: string;
  demoController?: OptimisticPostDemoController;
}

// Written as complete literals so Tailwind's scanner picks the templates up.
const BOUNDARY_GRID_WITH_SPINE =
  "grid gap-x-6 gap-y-6 lg:grid-cols-[minmax(0,1fr)_12.5rem_minmax(0,18rem)]";
const BOUNDARY_GRID_PLAIN =
  "grid gap-x-6 gap-y-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,18rem)]";

const zoneLabelClass =
  "text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-white/30";
const zoneDividerClass = "lg:border-l lg:border-white/[0.07] lg:pl-6";

const activityPresentation = {
  optimistic: {
    icon: Zap,
    title: "Optimistic layer applied",
    tone: "text-[#d8ff70] bg-[#d8ff70]/10 border-[#d8ff70]/20",
  },
  confirmed: {
    icon: Check,
    title: "Server confirmed",
    tone: "text-[#8ee8ff] bg-[#8ee8ff]/10 border-[#8ee8ff]/20",
  },
  rolled_back: {
    icon: RotateCcw,
    title: "Rolled back automatically",
    tone: "text-[#ffb494] bg-[#ff9c6e]/10 border-[#ff9c6e]/20",
  },
} as const;

function operationLabel(activity: OptimisticDemoActivity): string {
  if (activity.operation === "create") return `Created “${activity.label}”`;
  if (activity.operation === "remove") return `Deleted “${activity.label}”`;
  return `Updated “${activity.label}”`;
}

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
          key={`${run?.id ?? "idle"}-${run?.phase ?? "idle"}-${index}`}
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
}: {
  controller: OptimisticPostDemoController;
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
    <div className={zoneDividerClass}>
      <p className={zoneLabelClass}>The boundary</p>
      <div className="mt-4">
        {pipelineNodes.map((node, index) => {
          const isTransformer = node.id === "transformer";

          return (
            <div key={node.id}>
              <div
                className={`rounded-xl border px-2.5 py-2 text-center transition ${
                  isTransformer && transformerActive
                    ? "border-[#a89cff]/40 bg-[#a89cff]/[0.09]"
                    : "border-white/[0.07] bg-white/[0.025]"
                }`}
              >
                <p
                  className={`text-[0.65rem] font-semibold uppercase tracking-[0.12em] ${nodeTones[node.id]}`}
                >
                  {node.label}
                </p>
                <p className="mt-0.5 font-mono text-[0.6rem] leading-4 text-white/35">
                  {isTransformer ? transformer.detail : node.detail}
                </p>
                {isTransformer && (
                  <p className="font-mono text-[0.6rem] leading-4 text-white/25">
                    {transformer.shape}
                  </p>
                )}
              </div>
              {index < pipelineNodes.length - 1 && (
                <PipelineEdge index={index} run={run} />
              )}
            </div>
          );
        })}
      </div>
      <p className="mt-4 text-center text-[0.7rem] leading-5 text-white/35">
        Every mutation travels down and comes back as a confirmation or a
        rollback.
      </p>
    </div>
  );
});

const Toolbar = observer(function Toolbar({
  controller,
}: {
  controller: OptimisticPostDemoController;
}) {
  const run = controller.pipelineRun;

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-[#0c0d10] p-4 lg:flex-row lg:items-center lg:gap-6">
      <div className="flex items-center gap-3">
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
                className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-40 ${
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
        className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${
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
        className={`min-w-0 flex-1 truncate text-xs lg:text-right ${
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
  const disabled = optimistic || viewModel.isMutationPending;

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
        <span className="font-mono text-[0.6rem] text-white/25">
          {post.id.startsWith("temp-") ? post.id : post.id.slice(0, 8)}
        </span>
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

const OptimisticColumn = observer(function OptimisticColumn({
  viewModel,
}: {
  viewModel: OptimisticPostsViewModel;
}) {
  const stats = viewModel.stats;

  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <p className={zoneLabelClass}>UI data · MobX projection</p>
        <p className="text-[0.7rem] text-white/35">
          {stats.total} shown · {stats.published} published
        </p>
      </div>
      <p className="mt-1.5 text-xs text-white/35">
        What the interface believes right now. Updates before the request
        settles.
      </p>

      <div className="mt-4 space-y-3">
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
          <div className="relative ml-auto min-w-0 flex-1 sm:max-w-[13rem]">
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

        {viewModel.visiblePosts.map((post) => (
          <PostCard key={post.id} post={post} viewModel={viewModel} />
        ))}

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
    </div>
  );
});

const ConfirmedColumn = observer(function ConfirmedColumn({
  viewModel,
}: {
  viewModel: OptimisticPostsViewModel;
}) {
  const divergence = viewModel.divergence;
  const rows = viewModel.visibleConfirmedPosts;

  const divergenceParts = [
    divergence.ahead > 0 ? `${divergence.ahead} not yet confirmed` : null,
    divergence.changed > 0 ? `${divergence.changed} edited` : null,
    divergence.behind > 0 ? `${divergence.behind} pending delete` : null,
  ].filter(Boolean);

  return (
    <div className={`min-w-0 ${zoneDividerClass}`}>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <p className={zoneLabelClass}>Server data · query cache</p>
        <p className="text-[0.7rem] text-white/35">
          {viewModel.confirmedPosts.length} confirmed
        </p>
      </div>
      <p className="mt-1.5 text-xs text-white/35">
        Only written when a mutation succeeds. Optimistic layers never reach it.
      </p>

      <div
        className={`mt-4 rounded-xl border px-3 py-2.5 text-xs ${
          divergence.inSync
            ? "border-[#8ee8ff]/25 bg-[#8ee8ff]/[0.07] text-[#8ee8ff]"
            : "border-[#d8ff70]/30 bg-[#d8ff70]/[0.07] text-[#d8ff70]"
        }`}
        aria-live="polite"
      >
        {divergence.inSync
          ? "In sync — both sides agree"
          : `Interface is ahead: ${divergenceParts.join(" · ")}`}
      </div>

      <ul className="mt-3 space-y-1.5">
        {rows.map((post) => (
          <li
            key={post.id}
            className="flex items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] px-2.5 py-2"
          >
            <span
              aria-hidden="true"
              className={`size-1.5 shrink-0 rounded-full ${
                post.published ? "bg-[#8ee8ff]" : "bg-white/25"
              }`}
            />
            <span className="min-w-0 flex-1 truncate text-xs text-white/60">
              {post.title}
            </span>
            <span className="shrink-0 font-mono text-[0.6rem] text-white/25">
              {post.id.slice(0, 8)}
            </span>
          </li>
        ))}

        {rows.length === 0 && (
          <li className="rounded-xl border border-dashed border-white/10 px-4 py-8 text-center text-xs text-white/30">
            {viewModel.confirmedPosts.length === 0
              ? "Nothing confirmed yet."
              : "No confirmed rows match these filters."}
          </li>
        )}
      </ul>
    </div>
  );
});

const MutationTrace = observer(function MutationTrace({
  controller,
}: {
  controller: OptimisticPostDemoController;
}) {
  return (
    <section className="rounded-2xl border border-white/10 bg-[#0c0d10] p-4 sm:p-5">
      <div className="flex items-center justify-between gap-4">
        <h2 className={zoneLabelClass}>Mutation trace</h2>
        {controller.activity.length > 0 && (
          <button
            type="button"
            onClick={() => controller.clearActivity()}
            className="text-xs text-white/35 transition hover:text-white"
          >
            Clear
          </button>
        )}
      </div>

      {controller.activity.length === 0 ? (
        <p className="mt-3 rounded-xl border border-dashed border-white/10 px-4 py-5 text-center text-xs text-white/30">
          Create, publish, edit, or delete a post to generate a trace.
        </p>
      ) : (
        <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {controller.activity.slice(0, 6).map((activity) => {
            const presentation = activityPresentation[activity.phase];
            const Icon = presentation.icon;

            return (
              <div
                key={activity.id}
                className="flex items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.025] p-2.5"
              >
                <span
                  className={`grid size-7 shrink-0 place-items-center rounded-lg border ${presentation.tone}`}
                >
                  <Icon className="size-3.5" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium">
                    {presentation.title}
                  </p>
                  <p className="mt-0.5 truncate text-[0.7rem] text-white/35">
                    {operationLabel(activity)}
                  </p>
                </div>
                {activity.elapsedMs !== undefined && (
                  <span className="shrink-0 font-mono text-[0.65rem] text-white/30">
                    {activity.elapsedMs}ms
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
});

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
        {demoController && <Toolbar controller={demoController} />}

        {/* One container, three zones: the pipeline is literally the boundary
            between the optimistic projection and server-confirmed data. */}
        <section className="mt-4 rounded-2xl border border-white/10 bg-[#0c0d10] p-4 sm:p-6">
          <div
            className={
              demoController ? BOUNDARY_GRID_WITH_SPINE : BOUNDARY_GRID_PLAIN
            }
          >
            <OptimisticColumn viewModel={viewModel} />
            {demoController && <PipelineSpine controller={demoController} />}
            <ConfirmedColumn viewModel={viewModel} />
          </div>
        </section>

        {demoController && (
          <div className="mt-4">
            <MutationTrace controller={demoController} />
          </div>
        )}

        <EditPostDialog viewModel={viewModel} />
      </>
    );
  },
);
