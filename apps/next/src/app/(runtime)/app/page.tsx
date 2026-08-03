"use client";

import Link from "next/link";
import {
  ArrowRight,
  Bot,
  DatabaseZap,
  Gauge,
  MessageSquare,
  Palette,
  Radio,
  ShieldCheck,
} from "lucide-react";
import useAuthGuard from "@/hooks/useAuthGuard";

const examples = [
  {
    href: "/app/optimistic",
    title: "Optimistic state",
    description:
      "Create, update, filter, and reconcile data through the application’s production state path.",
    icon: DatabaseZap,
    accent: "text-[#d8ff70] bg-[#d8ff70]/10 border-[#d8ff70]/20",
  },
  {
    href: "/app/realtime",
    title: "Realtime synchronization",
    description:
      "Exercise multi-user updates, optimistic feedback, and server reconciliation together.",
    icon: Radio,
    accent: "text-[#bdb5ff] bg-[#8d7cff]/10 border-[#8d7cff]/25",
  },
  {
    href: "/chat",
    title: "AI chat",
    description:
      "Stream responses through a provider-backed chat surface with model selection and image support.",
    icon: MessageSquare,
    accent: "text-[#ffb494] bg-[#ff9c6e]/10 border-[#ff9c6e]/20",
  },
  {
    href: "/app/theme-builder",
    title: "Theme system",
    description:
      "Edit the application’s design tokens, preview the result, and export a reusable theme.",
    icon: Palette,
    accent: "text-[#8ee8ff] bg-cyan-400/10 border-cyan-300/20",
  },
  {
    href: "/admin/dashboard",
    title: "Admin workflows",
    description:
      "See protected administration, role checks, data tables, and dashboard composition.",
    icon: ShieldCheck,
    accent: "text-[#f9da7f] bg-amber-300/10 border-amber-300/20",
  },
] as const;

export default function ApplicationPage() {
  useAuthGuard();

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
            Full runtime
          </p>
          <h1 className="mt-4 max-w-4xl text-5xl font-semibold leading-[0.98] tracking-[-0.055em] sm:text-7xl">
            The application workspace.
          </h1>
        </div>
        <p className="max-w-xl text-lg leading-8 text-white/55">
          Build routes here when they need authentication, persistent data,
          realtime connections, or backend processes. These examples run inside
          the complete KingStack runtime.
        </p>
      </section>

      <section className="grid gap-4 border-b border-white/10 py-8 sm:grid-cols-3">
        {[
          { icon: Gauge, label: "Runtime", value: "Full stack" },
          { icon: Bot, label: "Agent guidance", value: "Repository-owned" },
          { icon: ShieldCheck, label: "Access", value: "Authenticated" },
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
            Trace a working pattern before building a new one.
          </h2>
          <p className="mt-5 leading-7 text-white/50">
            Each example is a place for people and agents to inspect how a
            complete feature is composed inside the full runtime.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {examples.map((example) => {
            const Icon = example.icon;

            return (
              <Link
                key={example.href}
                href={example.href}
                className="group flex min-h-72 flex-col rounded-[1.75rem] border border-white/10 bg-[#111216]/85 p-7 transition hover:-translate-y-1 hover:border-white/20 hover:bg-[#15161b]"
              >
                <span
                  className={`grid size-11 place-items-center rounded-full border ${example.accent}`}
                >
                  <Icon className="size-4.5" aria-hidden="true" />
                </span>
                <div className="mt-auto pt-14">
                  <h3 className="text-2xl font-medium tracking-[-0.035em]">
                    {example.title}
                  </h3>
                  <p className="mt-3 leading-7 text-white/45">
                    {example.description}
                  </p>
                  <span className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-white/70">
                    Open example
                    <ArrowRight
                      className="size-4 transition-transform group-hover:translate-x-1"
                      aria-hidden="true"
                    />
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </section>
    </>
  );
}
