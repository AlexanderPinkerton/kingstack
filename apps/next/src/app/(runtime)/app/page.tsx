"use client";

import Link from "next/link";
import {
  ArrowRight,
  Bot,
  DatabaseZap,
  Frame,
  Gauge,
  Palette,
  Radio,
  ShieldCheck,
  Waves,
} from "lucide-react";

const examples = [
  {
    href: "/app/optimistic",
    title: "Optimistic UI",
    description:
      "The interface and an in-memory repository side by side, with the production mutation pipeline between them. Add latency or reject a request to watch reconciliation and rollback.",
    icon: DatabaseZap,
    accent: "text-[#d8ff70] bg-[#d8ff70]/10 border-[#d8ff70]/20",
    glow: "rgba(216, 255, 112, 0.12)",
    tags: ["MobX", "TanStack Query", "advanced-optimistic-store"],
    access: "Open demo",
    accessNote: "Runs in browser memory and resets on reload.",
    featured: true,
  },
  {
    href: "/app/realtime",
    title: "Realtime collaboration",
    description:
      "Two isolated clients on one screen, sharing presence and server events while optimistic writes reconcile.",
    icon: Radio,
    accent: "text-[#bdb5ff] bg-[#8d7cff]/10 border-[#8d7cff]/25",
    glow: "rgba(141, 124, 255, 0.12)",
    tags: ["Supabase Realtime", "Presence"],
    access: "No signup",
    accessNote: "Uses a temporary guest for the bounded shared grid.",
  },
  {
    href: "/app/canvas",
    title: "Collaborative canvas",
    description:
      "A fixed world where presence is published in world coordinates, so a cursor lands on the same gridline on a laptop and a phone.",
    icon: Frame,
    accent: "text-[#8ee8ff] bg-cyan-400/10 border-cyan-300/20",
    glow: "rgba(142, 232, 255, 0.12)",
    tags: ["World space", "Presence"],
    access: "No signup",
    accessNote: "Uses a temporary guest for ephemeral presence only.",
  },
  {
    href: "/app/wave-pool",
    title: "Global wave pool",
    description:
      "One server-authoritative wave field shared by everyone, with pointer trails and taps rendered through a compact Three.js surface.",
    icon: Waves,
    accent:
      "text-[var(--accent-1-l)] bg-[color-mix(in_oklch,var(--accent-1-m)_10%,transparent)] border-[color-mix(in_oklch,var(--accent-1-m)_22%,transparent)]",
    glow: "color-mix(in oklch, var(--accent-1-m) 13%, transparent)",
    tags: ["Three.js", "Authoritative realtime"],
    access: "No signup",
    accessNote: "Creates a temporary guest only for the live connection.",
  },
  {
    href: "/app/theme-builder",
    title: "Theme system",
    description:
      "Edit the design tokens, preview the result live, and export a reusable theme.",
    icon: Palette,
    accent: "text-[#8ee8ff] bg-cyan-400/10 border-cyan-300/20",
    glow: "rgba(142, 232, 255, 0.12)",
    tags: ["Design tokens", "CSS variables"],
    access: "Open demo",
    accessNote: "Runs entirely in the browser with no session.",
  },
] as const;

export default function ApplicationPage() {
  return (
    <>
      <section className="grid gap-10 border-b border-white/10 pb-16 lg:grid-cols-[1fr_0.6fr] lg:items-end">
        <div>
          <Link
            href="/"
            className="mb-8 inline-flex items-center gap-2 text-sm text-white/45 transition-colors hover:text-white"
          >
            <ArrowRight className="size-4 rotate-180" aria-hidden="true" />
            Back to the KingStack guide
          </Link>
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-[#d8ff70]">
            Live feature demos
          </p>
          <h1 className="mt-4 max-w-4xl text-5xl font-semibold leading-[0.98] tracking-[-0.055em] sm:text-7xl">
            See the stack working.
          </h1>
        </div>
        <p className="max-w-xl text-lg leading-8 text-white/55">
          Every card is a runnable KingStack demo. The catalog is public, and
          every demo runs without creating a permanent account. Browser-local
          examples open directly; collaborative examples create one temporary
          guest session.
        </p>
      </section>

      <section className="grid gap-4 border-b border-white/10 py-8 sm:grid-cols-3">
        {[
          { icon: Gauge, label: "Runtime", value: "Full stack" },
          { icon: Bot, label: "Agent guidance", value: "Repository-owned" },
          { icon: ShieldCheck, label: "Demo access", value: "Clearly labeled" },
        ].map((item) => {
          const Icon = item.icon;

          return (
            <div key={item.label} className="flex items-center gap-3 py-2">
              <span className="grid size-9 place-items-center rounded-full border border-white/10 bg-white/[0.04] text-[#d8ff70]">
                <Icon className="size-4" aria-hidden="true" />
              </span>
              <div>
                <p className="text-xs uppercase tracking-[0.14em] text-white/30">
                  {item.label}
                </p>
                <p className="mt-1 text-sm text-white/75">{item.value}</p>
              </div>
            </div>
          );
        })}
      </section>

      <section className="py-16">
        <div className="mb-10 max-w-2xl">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-[#a89cff]">
            Reference features
          </p>
          <h2 className="mt-4 text-3xl font-semibold tracking-[-0.04em] sm:text-5xl">
            Pick a feature and run the real implementation.
          </h2>
          <p className="mt-5 leading-7 text-white/50">
            These are working examples, not screenshots. Live collaboration
            still exercises the real authentication boundary, but KingStack
            creates the temporary identity without a login form.
          </p>
        </div>

        {/* The featured card spans two columns to anchor the grid. */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {examples.map((example) => {
            const Icon = example.icon;
            const featured = "featured" in example && example.featured;

            return (
              <Link
                key={example.href}
                href={example.href}
                className={`group relative flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#111216]/85 p-6 transition duration-200 hover:-translate-y-0.5 hover:border-white/25 hover:bg-[#15161b] ${
                  featured ? "md:col-span-2 lg:col-span-2" : ""
                }`}
              >
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                  style={{
                    background: `radial-gradient(circle at 12% 0%, ${example.glow}, transparent 55%)`,
                  }}
                />

                <div className="relative flex items-center gap-3">
                  <span
                    className={`grid size-10 shrink-0 place-items-center rounded-xl border ${example.accent}`}
                  >
                    <Icon className="size-4" aria-hidden="true" />
                  </span>
                  <h3
                    className={`min-w-0 flex-1 font-medium tracking-[-0.025em] ${
                      featured ? "text-xl" : "text-lg"
                    }`}
                  >
                    {example.title}
                  </h3>
                  <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-1 font-mono text-[0.58rem] uppercase tracking-[0.12em] text-white/40">
                    {example.access}
                  </span>
                  <ArrowRight
                    className="size-4 shrink-0 text-white/25 transition duration-200 group-hover:translate-x-0.5 group-hover:text-white"
                    aria-hidden="true"
                  />
                </div>

                <p
                  className={`relative mt-4 text-sm leading-6 text-white/45 ${
                    featured ? "max-w-xl" : ""
                  }`}
                >
                  {example.description}
                </p>

                <p className="relative mt-5 border-l border-white/15 pl-3 text-xs leading-5 text-white/40">
                  <span className="font-medium text-white/65">
                    {example.access}.
                  </span>{" "}
                  {example.accessNote}
                </p>

                <div className="relative mt-auto flex flex-wrap gap-1.5 pt-5">
                  {example.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-md border border-white/[0.08] bg-white/[0.03] px-2 py-1 font-mono text-[0.65rem] text-white/40"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </Link>
            );
          })}
        </div>
      </section>
    </>
  );
}
