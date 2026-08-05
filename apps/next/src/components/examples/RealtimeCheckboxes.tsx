"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, MousePointer2, Radio, Users, Zap } from "lucide-react";
import { observer } from "mobx-react-lite";
import { useRootStore } from "@/hooks/useRootStore";
import { useSharedCursors } from "@/hooks/useSharedCursors";
import { CursorOverlay } from "@/components/collaboration/cursor-overlay";
import type { RealtimeStatus } from "@/lib/realtime-manager";
import {
  createParticipantId,
  toneForParticipantId,
} from "@/lib/realtime/presence-room";
import {
  type CheckboxPresenceParticipant,
  type RealtimeCheckboxStore,
} from "@/stores/userApp/checkboxStore";
import { RealtimeCheckboxDemoController } from "@/stores/userApp/realtimeCheckboxDemoController";
import type { SharedCursorStore } from "@/stores/userApp/sharedCursorStore";

const CHECKBOX_COUNT = 200;
const PHONE_CHECKBOX_COUNT = 16;
const DESKTOP_CHECKBOX_COUNT = 60;

/** Everyone viewing this page shares one cursor room. */
const CURSOR_SCOPE = "realtime-demo";

type DemoSide = "primary" | "collaborator";

interface CheckboxPaneProps {
  controller: RealtimeCheckboxDemoController;
  side: DemoSide;
  store: RealtimeCheckboxStore;
  participant: CheckboxPresenceParticipant;
  eyebrow: string;
  description: string;
  connected: boolean;
  status: RealtimeStatus;
}

function ConnectionStatus({
  connected,
  status,
}: {
  connected: boolean;
  status: RealtimeStatus;
}) {
  return (
    <div
      className="flex items-center gap-2 text-xs text-white/45"
      aria-label={connected ? "Connected" : status}
      role="status"
    >
      <span
        className={`size-1.5 rounded-full ${
          connected ? "bg-[#d8ff70]" : "bg-[#ff8b7b]"
        }`}
        aria-hidden="true"
      />
      <span className="hidden sm:inline">
        {connected ? "Connected" : status}
      </span>
    </div>
  );
}

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

const CollaboratorList = observer(function CollaboratorList({
  controller,
}: {
  controller: RealtimeCheckboxDemoController;
}) {
  const participants = controller.primaryStore.getPresentParticipants();
  const primaryId = controller.primaryParticipant.id;
  const collaboratorId = controller.collaboratorParticipant.id;

  return (
    <section className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-3 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-[#d8ff70]">
            Who is here?
          </p>
          <p className="mt-1 text-sm text-white/40">
            {participants.length}{" "}
            {participants.length === 1 ? "person" : "people"} present
          </p>
        </div>

        <div className="flex flex-wrap justify-end gap-2">
          {participants.map((participant) => {
            const isPrimary = participant.id === primaryId;
            const isDemoCollaborator = participant.id === collaboratorId;
            const isLime = participant.tone === "lime";

            return (
              <div
                key={participant.id}
                className="flex items-center gap-2 rounded-full border border-white/10 bg-[#0c0d10] py-1.5 pl-1.5 pr-3"
              >
                <span
                  className={`grid size-7 place-items-center rounded-full text-[0.6rem] font-bold text-[#11130d] ${
                    isLime ? "bg-[#d8ff70]" : "bg-[#a89cff]"
                  }`}
                  aria-hidden="true"
                >
                  {getInitials(participant.name)}
                </span>
                <span className="max-w-28 truncate text-xs font-medium sm:max-w-40 sm:text-sm">
                  {participant.name}
                </span>
                {(isPrimary || isDemoCollaborator) && (
                  <span className="hidden text-[0.6rem] uppercase tracking-[0.12em] text-white/30 sm:inline">
                    {isPrimary ? "You" : "Demo"}
                  </span>
                )}
                <span
                  className="size-1.5 rounded-full bg-[#d8ff70]"
                  aria-label="Present"
                  role="status"
                />
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
});

/**
 * Cursor presence is invisible when nobody else is looking, which reads as a
 * bug rather than as an empty room. Say which it is.
 */
const LiveCursorBadge = observer(function LiveCursorBadge({
  store,
}: {
  store: SharedCursorStore;
}) {
  const count = store.cursors.length;

  return (
    <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.045] px-3 py-1.5 text-xs text-white/55">
      <MousePointer2
        className={`size-3 ${count > 0 ? "text-[#d8ff70]" : "text-white/30"}`}
        aria-hidden="true"
      />
      {count > 0
        ? `${count} live ${count === 1 ? "cursor" : "cursors"} on this page`
        : "Open this page in another window to see live cursors"}
    </div>
  );
});

const CheckboxPane = observer(function CheckboxPane({
  controller,
  side,
  store,
  participant,
  eyebrow,
  description,
  connected,
  status,
}: CheckboxPaneProps) {
  const isPending =
    store.updatePending || store.createPending || store.deletePending;

  return (
    <article className="min-w-0 rounded-2xl border border-white/10 bg-[#0c0d10] p-2 sm:rounded-[1.5rem] sm:p-4 lg:p-6">
      <div className="flex items-start justify-between gap-2 border-b border-white/10 pb-3 sm:gap-4 sm:pb-5">
        <div className="min-w-0">
          <p
            className={`text-[0.65rem] font-semibold uppercase tracking-[0.18em] ${
              side === "primary" ? "text-[#d8ff70]" : "text-[#a89cff]"
            }`}
          >
            {eyebrow}
          </p>
          <div className="mt-1 flex items-center gap-2 sm:mt-2">
            <h3 className="truncate text-base font-semibold tracking-[-0.035em] sm:text-xl">
              {participant.name}
            </h3>
            {side === "primary" && (
              <span className="hidden rounded-full border border-white/10 bg-white/[0.05] px-2 py-0.5 text-[0.65rem] text-white/45 sm:inline">
                You
              </span>
            )}
          </div>
          <p className="mt-2 hidden text-sm leading-6 text-white/45 sm:block">
            {description}
          </p>
        </div>
        <div className="shrink-0 rounded-full border border-white/10 bg-white/[0.035] p-2 sm:px-3 sm:py-2">
          <ConnectionStatus connected={connected} status={status} />
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between text-[0.65rem] text-white/35 sm:mt-5 sm:text-xs">
        <span className="lg:hidden">
          {Math.min(PHONE_CHECKBOX_COUNT, store.count)}/{store.count} shown
        </span>
        <span className="hidden lg:inline xl:hidden">
          {Math.min(DESKTOP_CHECKBOX_COUNT, store.count)}/{store.count} shown
        </span>
        <span className="hidden xl:inline">{store.count} shared items</span>
        <span
          className={`hidden sm:inline ${isPending ? "text-[#d8ff70]" : ""}`}
        >
          {isPending ? "Syncing change…" : "Up to date"}
        </span>
      </div>

      {store.isLoading ? (
        <div className="mt-4 grid min-h-64 place-items-center rounded-xl border border-white/10 bg-white/[0.025] text-sm text-white/45">
          Loading this client…
        </div>
      ) : store.isError ? (
        <div className="mt-4 grid min-h-64 place-items-center rounded-xl border border-[#ff8b7b]/30 bg-[#ff8b7b]/5 px-6 text-center text-sm text-[#ffb6ac]">
          {store.error?.message ?? "This client could not load checkboxes."}
        </div>
      ) : (
        <div className="mt-3 grid grid-cols-4 gap-1 rounded-lg border border-white/10 bg-black/20 p-1.5 sm:mt-4 sm:rounded-xl sm:p-3 lg:grid-cols-10 lg:gap-1.5 lg:p-4 xl:grid-cols-20">
          {Array.from({ length: CHECKBOX_COUNT }, (_, index) => {
            const isChecked = store.isCheckboxChecked(index);
            const visitors = store.getPresenceAt(index, participant.id);
            const visitor = visitors[0];
            const visitorIsLime = visitor?.tone === "lime";
            const visibilityClass =
              index < PHONE_CHECKBOX_COUNT
                ? "grid"
                : index < DESKTOP_CHECKBOX_COUNT
                  ? "hidden lg:grid"
                  : "hidden xl:grid";

            return (
              <button
                key={index}
                type="button"
                role="checkbox"
                aria-checked={isChecked}
                aria-label={`Checkbox ${index + 1}, ${
                  isChecked ? "checked" : "unchecked"
                }`}
                onClick={() => store.toggleCheckbox(index)}
                onPointerEnter={() => controller.highlight(side, index)}
                onPointerLeave={(event) => {
                  if (document.activeElement !== event.currentTarget) {
                    controller.clearHighlight(side);
                  }
                }}
                onFocus={() => controller.highlight(side, index)}
                onBlur={() => controller.clearHighlight(side)}
                className={`${visibilityClass} relative aspect-square min-h-5 w-full place-items-center rounded-[0.3rem] border transition-colors focus-visible:outline-none ${
                  isChecked
                    ? "border-[#d8ff70] bg-[#d8ff70] text-[#11130d]"
                    : "border-white/15 bg-white/[0.055] text-transparent hover:border-white/35 hover:bg-white/[0.09]"
                } ${
                  visitor
                    ? visitorIsLime
                      ? "z-20 border-[#d8ff70] ring-2 ring-[#d8ff70]/80 ring-offset-2 ring-offset-[#0c0d10]"
                      : "z-20 border-[#a89cff] ring-2 ring-[#a89cff]/80 ring-offset-2 ring-offset-[#0c0d10]"
                    : "focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0c0d10]"
                }`}
              >
                {isChecked && (
                  <Check
                    className="size-3 stroke-[3] xl:size-2.5"
                    aria-hidden="true"
                  />
                )}

                {visitor && (
                  <span
                    className={`pointer-events-none absolute -top-7 left-1/2 z-30 max-w-28 -translate-x-1/2 truncate rounded-md px-2 py-1 text-[0.6rem] font-semibold shadow-lg ${
                      visitorIsLime
                        ? "bg-[#d8ff70] text-[#11130d]"
                        : "bg-[#a89cff] text-[#11130d]"
                    }`}
                    title={visitor.name}
                  >
                    {visitor.name}
                    {visitors.length > 1 ? ` +${visitors.length - 1}` : ""}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </article>
  );
});

export const RealtimeCheckboxes = observer(function RealtimeCheckboxes() {
  const rootStore = useRootStore();
  const checkboxStore = rootStore.userStore.checkboxStore;
  const sessionUser = rootStore.session?.user;
  const primaryName =
    rootStore.userData?.displayName ||
    sessionUser?.user_metadata?.username ||
    sessionUser?.email?.split("@")[0] ||
    "You";
  const [controller] = useState(
    () => new RealtimeCheckboxDemoController(checkboxStore, primaryName),
  );
  const [isClient, setIsClient] = useState(false);

  // Cursor identity is per tab so two tabs of one account read as two people.
  const [cursorParticipantId] = useState(() => createParticipantId("cursor"));
  const cursorParticipant = useMemo(
    () => ({
      id: cursorParticipantId,
      name: primaryName,
      tone: toneForParticipantId(cursorParticipantId),
    }),
    [cursorParticipantId, primaryName],
  );
  const { store: cursorStore, surfaceRef } = useSharedCursors(
    CURSOR_SCOPE,
    cursorParticipant,
  );

  useEffect(() => controller.mount(), [controller]);

  useEffect(() => {
    controller.setAccessToken(rootStore.session?.access_token ?? null);
  }, [controller, rootStore.session?.access_token]);

  useEffect(() => {
    controller.setPrimaryName(primaryName);
  }, [controller, primaryName]);

  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient || checkboxStore.isLoading) {
    return (
      <section className="grid min-h-[30rem] place-items-center rounded-[2rem] border border-white/10 bg-[#111216]/85 text-white/45">
        Preparing two isolated realtime clients…
      </section>
    );
  }

  if (checkboxStore.isError) {
    return (
      <section className="grid min-h-80 place-items-center rounded-[2rem] border border-[#ff8b7b]/30 bg-[#ff8b7b]/5 px-6 text-center text-[#ffb6ac]">
        Error loading checkboxes: {checkboxStore.error?.message}
      </section>
    );
  }

  if (checkboxStore.count === 0) {
    return (
      <section className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[#111216]/85 p-6 sm:p-10">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-60"
          style={{
            background:
              "radial-gradient(circle at 88% 0%, rgba(118, 85, 255, 0.2), transparent 34%), radial-gradient(circle at 8% 100%, rgba(216, 255, 112, 0.08), transparent 30%)",
          }}
        />
        <div className="relative max-w-2xl">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-[#d8ff70]">
            One-time setup
          </p>
          <h2 className="mt-4 text-3xl font-semibold tracking-[-0.045em] sm:text-4xl">
            Seed the shared canvas.
          </h2>
          <p className="mt-4 text-lg leading-8 text-white/50">
            The demo needs 200 checkbox records so both clients can reconcile
            against the same backend state.
          </p>
          <button
            type="button"
            onClick={() => {
              void checkboxStore
                .initializeCheckboxes(CHECKBOX_COUNT)
                .catch(() => undefined);
            }}
            className="mt-8 inline-flex min-h-12 items-center justify-center rounded-xl bg-[#d8ff70] px-6 font-semibold text-[#11130d] transition hover:bg-[#e3ff98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#111216]"
          >
            Initialize 200 checkboxes
          </button>
        </div>
      </section>
    );
  }

  return (
    <section
      ref={surfaceRef}
      className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[#111216]/85 p-2 shadow-2xl shadow-black/20 sm:p-8"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-80 opacity-60"
        style={{
          background:
            "radial-gradient(circle at 92% 0%, rgba(118, 85, 255, 0.18), transparent 36%), radial-gradient(circle at 8% 0%, rgba(216, 255, 112, 0.07), transparent 28%)",
        }}
      />

      <div className="relative">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.045] px-3 py-1.5 text-xs text-white/55">
            <Radio className="size-3 text-[#d8ff70]" aria-hidden="true" />
            Live collaboration sandbox
          </div>
          <h2 className="mt-5 text-3xl font-semibold leading-tight tracking-[-0.045em] sm:text-5xl">
            Two clients. One shared state.
            <span className="block font-gambetta font-normal italic text-white/45">
              No second tab required.
            </span>
          </h2>
          <p className="mt-5 max-w-2xl text-base leading-7 text-white/50 sm:text-lg sm:leading-8">
            Tap, hover, or keyboard-focus a square in either pane. The other
            client shows that person’s name and border; clicks still travel
            through the optimistic update and realtime reconciliation path.
          </p>
          <LiveCursorBadge store={cursorStore} />
        </div>

        <CollaboratorList controller={controller} />

        <div className="mt-8 hidden gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/10 lg:grid lg:grid-cols-3">
          {[
            {
              icon: Users,
              label: "Independent clients",
              detail: "Separate cache and socket",
            },
            {
              icon: Radio,
              label: "Ephemeral presence",
              detail: "Clears on leave or disconnect",
            },
            {
              icon: Zap,
              label: "Optimistic writes",
              detail: "Immediate feedback, then reconcile",
            },
          ].map(({ icon: Icon, label, detail }) => (
            <div key={label} className="bg-[#0c0d10] px-5 py-4">
              <Icon className="size-4 text-[#d8ff70]" aria-hidden="true" />
              <p className="mt-3 text-sm font-medium">{label}</p>
              <p className="mt-1 text-xs text-white/35">{detail}</p>
            </div>
          ))}
        </div>

        <div className="mt-6 grid grid-cols-2 gap-1 sm:gap-4">
          <CheckboxPane
            controller={controller}
            side="primary"
            store={controller.primaryStore}
            participant={controller.primaryParticipant}
            eyebrow="Your view"
            description="Your authenticated app runtime. Maya’s focus appears here."
            connected={rootStore.realtimeConnected}
            status={rootStore.realtimeStatus}
          />
          <CheckboxPane
            controller={controller}
            side="collaborator"
            store={controller.collaboratorStore}
            participant={controller.collaboratorParticipant}
            eyebrow="Collaborator"
            description="A second query cache and socket. Your focus appears here."
            connected={controller.collaboratorConnected}
            status={controller.collaboratorStatus}
          />
        </div>
      </div>

      <CursorOverlay store={cursorStore} />
    </section>
  );
});
