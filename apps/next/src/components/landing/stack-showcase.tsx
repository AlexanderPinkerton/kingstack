"use client";

import { useState } from "react";
import {
  Boxes,
  Database,
  GitBranch,
  Palette,
  Radio,
  ScrollText,
  Sparkles,
  Zap,
  type LucideIcon,
} from "lucide-react";

interface StackLayer {
  name: string;
  role: string;
  why: string;
  detail: string;
  accent: string;
  icon: LucideIcon;
}

const layers: StackLayer[] = [
  {
    name: "Tailwind + Radix",
    role: "Interface layer",
    accent: "#8ee8ff",
    icon: Palette,
    why: "Accessible components that live in your repository, so you can edit them instead of working around them.",
    detail:
      "Every surface in the demo is built from it, including the admin tables and the live theme editor. The components sit in your repository, so restyling means editing them rather than overriding them.",
  },
  {
    name: "TanStack Query + MobX",
    role: "Client and server state",
    accent: "#d8ff70",
    icon: Zap,
    why: "Server cache and client state stay separate concerns. Optimistic updates and rollback are solved once, not rebuilt per feature.",
    detail:
      "The posts example runs through it end to end — create, edit, filter, reconcile. You can watch an optimistic update roll back on failure before writing any of your own.",
  },
  {
    name: "Vercel AI SDK",
    role: "Model access",
    accent: "#ff9c6e",
    icon: Sparkles,
    why: "Anthropic, OpenAI, and Google behind one streaming interface. Changing models is a configuration change.",
    detail:
      "The chat route streams from Anthropic, OpenAI, or Google behind a single interface, with model switching and image input already wired up.",
  },
  {
    name: "Socket.IO",
    role: "Realtime transport",
    accent: "#8d7cff",
    icon: Radio,
    why: "One realtime transport on both ends. Multi-user updates become a feature you turn on rather than a project.",
    detail:
      "A gateway on the API pushes changes to every connected client. The realtime example keeps two browser windows in sync while optimistic updates reconcile against what the server confirms.",
  },
  {
    name: "Pino",
    role: "Structured logging",
    accent: "#8ee8ff",
    icon: ScrollText,
    why: "Structured logs in both runtimes through one shared logger, so requests are traceable instead of guessed at.",
    detail:
      "The API logs every request with context and the frontend ships a matching logger. Output has the same shape locally and in production, so the thing you debug at home is the thing you read in the dashboard.",
  },
  {
    name: "Prisma",
    role: "Schema and migrations",
    accent: "#d8ff70",
    icon: GitBranch,
    why: "One schema defines the database and the types both runtimes compile against. Migrations are versioned and reviewable.",
    detail:
      "The schema package is the source of truth for the data model. Both apps generate their client from it, and the same versioned migrations run locally and in production.",
  },
  {
    name: "Supabase",
    role: "Database, auth, and storage",
    accent: "#ff9c6e",
    icon: Database,
    why: "Database, authentication, storage, and realtime from one service instead of four you integrate yourself. Underneath it is ordinary Postgres, so you are never stuck.",
    detail:
      "Boots as a local Docker stack in one command and runs unchanged in hosted environments. It provides the Postgres instance behind Prisma, the sessions both runtimes trust, and file storage.",
  },
  {
    name: "Turborepo",
    role: "Build orchestration",
    accent: "#8d7cff",
    icon: Boxes,
    why: "A cached task graph across the monorepo. Only what changed gets rebuilt.",
    detail:
      "Build, lint, typecheck, and test are one command at the root. The cache means a change in the frontend does not rebuild the API, and CI reruns only what actually moved.",
  },
];

const SLAB = 250;
const SLICE_COUNT = 9;
const SLICE_STEP = 2.5;
const REST_GAP = 30;
const OPEN_GAP = 56;
const LIFT = 34;
// Hit targets are inset from the slab so neighbouring regions never touch,
// leaving a dead zone at every edge instead of a knife-edge boundary.
const HIT_INSET = 10;
const HIT = SLAB - HIT_INSET * 2;

export function StackShowcase() {
  const [active, setActive] = useState<number | null>(null);

  const gap = active === null ? REST_GAP : OPEN_GAP;
  const depth = (layers.length - 1) * gap;
  const restDepth = (layers.length - 1) * REST_GAP;
  const current = active === null ? null : layers[active];

  return (
    <div className="mt-16">
      <div className="hidden lg:grid lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-10">
        <div
          className="relative h-[560px] select-none"
          style={{ perspective: "1600px" }}
          onMouseLeave={() => setActive(null)}
        >
          <div
            aria-hidden="true"
            className="pointer-events-none absolute left-1/2 top-1/2 size-[30rem] -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl transition-colors duration-500"
            style={{
              background: current
                ? `radial-gradient(circle, ${current.accent}1f, transparent 68%)`
                : "radial-gradient(circle, rgba(141,124,255,0.13), transparent 68%)",
            }}
          />

          <ul
            className="absolute left-1/2 top-1/2 size-0"
            style={{
              transformStyle: "preserve-3d",
              transform: "rotateX(60deg) rotateZ(-45deg)",
            }}
          >
            {layers.map((layer, index) => {
              const isActive = active === index;
              const isMuted = active !== null && !isActive;
              const seat = layers.length - 1 - index;
              const restZ = seat * REST_GAP - restDepth / 2;
              const visualZ = seat * gap - depth / 2 + (isActive ? LIFT : 0);
              const shift = visualZ - restZ;
              const Icon = layer.icon;

              return (
                <li
                  key={layer.name}
                  className="absolute"
                  style={{ transformStyle: "preserve-3d" }}
                >
                  <button
                    type="button"
                    aria-pressed={isActive}
                    onMouseEnter={() => setActive(index)}
                    onFocus={() => setActive(index)}
                    onBlur={() => setActive(null)}
                    className="absolute cursor-pointer rounded-[3rem] focus:outline-none"
                    style={{
                      width: HIT,
                      height: HIT,
                      marginLeft: -HIT / 2,
                      marginTop: -HIT / 2,
                      transformStyle: "preserve-3d",
                      transform: `translateZ(${restZ}px)`,
                    }}
                  >
                    <span
                      className="pointer-events-none absolute transition-transform duration-500 ease-out motion-reduce:transition-none"
                      style={{
                        width: SLAB,
                        height: SLAB,
                        left: "50%",
                        top: "50%",
                        marginLeft: -SLAB / 2,
                        marginTop: -SLAB / 2,
                        transformStyle: "preserve-3d",
                        transform: `translateZ(${shift}px)`,
                      }}
                    >
                      {Array.from({ length: SLICE_COUNT }).map((_, slice) => (
                        <span
                          key={slice}
                          aria-hidden="true"
                          className="absolute inset-0 rounded-[3rem] transition-colors duration-500 motion-reduce:transition-none"
                          style={{
                            transform: `translateZ(${-(slice + 1) * SLICE_STEP}px)`,
                            background: isActive
                              ? "#1b1f26"
                              : isMuted
                                ? "transparent"
                                : "#141519",
                            borderWidth: 1,
                            borderStyle: "solid",
                            borderColor: isActive
                              ? `${layer.accent}33`
                              : isMuted
                                ? "transparent"
                                : "rgba(255,255,255,0.05)",
                          }}
                        />
                      ))}

                      <span
                        className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-[3rem] px-6 text-center transition-[background,box-shadow,border-color] duration-500 motion-reduce:transition-none"
                        style={{
                          background: isActive
                            ? `linear-gradient(140deg, ${layer.accent}26, rgba(20,22,27,0.96) 62%)`
                            : isMuted
                              ? "rgba(255,255,255,0.02)"
                              : "linear-gradient(140deg, rgba(255,255,255,0.07), rgba(16,17,21,0.97) 62%)",
                          borderWidth: 1,
                          borderStyle: "solid",
                          borderColor: isActive
                            ? `${layer.accent}80`
                            : isMuted
                              ? "rgba(255,255,255,0.12)"
                              : "rgba(255,255,255,0.1)",
                          boxShadow: isActive
                            ? `0 0 70px ${layer.accent}4d, inset 0 0 50px ${layer.accent}1a`
                            : isMuted
                              ? "none"
                              : "inset 0 0 40px rgba(0,0,0,0.45)",
                        }}
                      >
                        <Icon
                          className="size-7 transition-colors duration-500 motion-reduce:transition-none"
                          style={{
                            color: isActive
                              ? layer.accent
                              : isMuted
                                ? "rgba(245,242,232,0.22)"
                                : "rgba(245,242,232,0.5)",
                          }}
                          aria-hidden="true"
                        />
                        <span
                          className="text-xl font-medium leading-tight tracking-[-0.02em] transition-colors duration-500 motion-reduce:transition-none"
                          style={{
                            color: isActive
                              ? "#f5f2e8"
                              : isMuted
                                ? "rgba(245,242,232,0.3)"
                                : "rgba(245,242,232,0.62)",
                          }}
                        >
                          {layer.name}
                        </span>
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="min-h-[20rem] rounded-[1.75rem] border border-white/10 bg-white/[0.035] p-8 sm:p-10">
          {current ? (
            <>
              <p
                className="text-xs font-medium uppercase tracking-[0.18em]"
                style={{ color: current.accent }}
              >
                {current.role}
              </p>
              <h3 className="mt-4 text-3xl font-medium tracking-[-0.035em]">
                {current.name}
              </h3>
              <p className="mt-5 leading-7 text-white/60">{current.why}</p>
              <div className="mt-6 border-t border-white/10 pt-6">
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-white/35">
                  How it is used here
                </p>
                <p className="mt-3 leading-7 text-white/50">{current.detail}</p>
              </div>
            </>
          ) : (
            <>
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-white/35">
                Eight layers, one repository
              </p>
              <h3 className="mt-4 text-3xl font-medium tracking-[-0.035em]">
                Take the stack apart.
              </h3>
              <p className="mt-5 leading-7 text-white/50">
                Hover or tab through a layer to see what it does and how this
                project already uses it. Nothing here is a placeholder waiting
                for you to wire it up.
              </p>
              <ul className="mt-8 flex flex-wrap gap-2">
                {layers.map((layer) => (
                  <li
                    key={layer.name}
                    className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-white/45"
                  >
                    {layer.name}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>

      <div className="grid gap-px overflow-hidden rounded-[1.75rem] border border-white/10 bg-white/10 sm:grid-cols-2 lg:hidden">
        {layers.map((layer) => {
          const Icon = layer.icon;

          return (
            <article key={layer.name} className="bg-[#0d0e11] p-7 sm:p-8">
              <div className="flex items-center gap-3">
                <span
                  className="grid size-9 shrink-0 place-items-center rounded-lg border bg-white/[0.04]"
                  style={{
                    color: layer.accent,
                    borderColor: `${layer.accent}33`,
                  }}
                >
                  <Icon className="size-4" aria-hidden="true" />
                </span>
                <h3 className="text-lg font-medium tracking-[-0.02em]">
                  {layer.name}
                </h3>
              </div>
              <p className="mt-4 leading-7 text-white/45">{layer.why}</p>
              <p className="mt-3 leading-7 text-white/35">{layer.detail}</p>
            </article>
          );
        })}
      </div>
    </div>
  );
}
