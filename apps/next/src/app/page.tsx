import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Boxes,
  Check,
  Crown,
  Database,
  GitBranch,
  Layers3,
  Radio,
  Server,
  ShieldCheck,
  Wrench,
} from "lucide-react";
import { InstallCommand } from "@/components/landing/install-command";
import { createMetadata } from "@/lib/metadata";

export const metadata: Metadata = createMetadata({
  title: "Full-stack TypeScript starter — Next.js, NestJS, Supabase, Prisma",
  description:
    "KingStack generates a complete TypeScript monorepo: Next.js, NestJS on Fastify, Supabase, Prisma, and optimistic state. Start frontend-only and turn the backend on when you need it.",
  canonical: "/",
});

const stack = [
  {
    icon: Layers3,
    name: "Next.js + React",
    detail:
      "App Router frontend, server components, and route handlers for anything that belongs at the edge.",
  },
  {
    icon: Server,
    name: "NestJS on Fastify",
    detail:
      "The persistent API: REST controllers, WebSocket gateways, cron jobs, and background workers.",
  },
  {
    icon: Database,
    name: "Supabase",
    detail:
      "PostgreSQL, authentication, storage, and realtime — running locally in Docker, hosted in production.",
  },
  {
    icon: GitBranch,
    name: "Prisma",
    detail:
      "Schema modeling, versioned migrations, and typed database access on the server.",
  },
  {
    icon: Radio,
    name: "Optimistic state",
    detail:
      "MobX and TanStack Query wired through @kingstack/advanced-optimistic-store for mutations, reconciliation, and rollback.",
  },
  {
    icon: Boxes,
    name: "Turborepo monorepo",
    detail:
      "Yarn workspaces with shared types, so the frontend and backend cannot drift out of sync.",
  },
  {
    icon: ShieldCheck,
    name: "Auth and access control",
    detail:
      "Session handling, route guards, role checks, and row-level security defaults on the database.",
  },
  {
    icon: Wrench,
    name: "Tooling that stays quiet",
    detail:
      "TypeScript, ESLint, Prettier, Vitest, and Bun configured once at the root of the workspace.",
  },
] as const;

const comparison = [
  { label: "Create with", draft: "--draft", full: "--full" },
  { label: "Run with", draft: "yarn dev:frontend", full: "yarn dev" },
  { label: "Services", draft: "Next.js", full: "Next.js, NestJS, Supabase" },
  { label: "Data adapter", draft: "In-memory", full: "HTTP + PostgreSQL" },
  { label: "Docker required", draft: "No", full: "Yes" },
  { label: "Store and UI pattern", draft: "Identical", full: "Identical" },
] as const;

const operations = [
  {
    command: "yarn env:local",
    description:
      "Generate typed, validated environment config for local, development, and production.",
  },
  {
    command: "yarn prisma:migrate",
    description:
      "Create and apply schema migrations against your local PostgreSQL instance.",
  },
  {
    command: "yarn backend:enable",
    description:
      "Turn a frontend draft into the full stack: services, config, and migrations.",
  },
  {
    command: "yarn deploy:sync-secrets",
    description:
      "Push the config you already declared to Vercel and DigitalOcean as real secrets.",
  },
  {
    command: "yarn deploy:nest",
    description:
      "Build, deploy, health check, and roll back the API without hand-written glue.",
  },
] as const;

export default function LandingPage() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#090a0c] text-[#f5f2e8] selection:bg-[#d8ff70] selection:text-[#11130d]">
      <div className="relative">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-[48rem] opacity-70"
          style={{
            background:
              "radial-gradient(circle at 78% 8%, rgba(118, 85, 255, 0.22), transparent 34%), radial-gradient(circle at 10% 26%, rgba(216, 255, 112, 0.08), transparent 28%)",
          }}
        />

        <header className="relative z-20 mx-auto flex max-w-7xl items-center justify-between px-5 py-6 sm:px-8 lg:px-10">
          <Link
            href="/"
            className="flex items-center gap-3 font-semibold tracking-[-0.02em]"
            aria-label="KingStack home"
          >
            <span className="grid size-9 place-items-center rounded-full border border-white/15 bg-white/[0.06]">
              <Crown className="size-4 text-[#d8ff70]" aria-hidden="true" />
            </span>
            <span className="text-lg">KingStack</span>
          </Link>

          <nav
            className="hidden items-center gap-7 text-sm text-white/55 md:flex"
            aria-label="Page sections"
          >
            <a href="#stack" className="transition-colors hover:text-white">
              The stack
            </a>
            <a
              href="#architecture"
              className="transition-colors hover:text-white"
            >
              Architecture
            </a>
            <a
              href="#operations"
              className="transition-colors hover:text-white"
            >
              Operations
            </a>
          </nav>

          <Link
            href="/app"
            className="group inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-4 py-2 text-sm font-medium transition hover:border-white/30 hover:bg-white/[0.1]"
          >
            Live demo
            <ArrowUpRight
              className="size-3.5 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
              aria-hidden="true"
            />
          </Link>
        </header>

        <section className="relative z-10 mx-auto max-w-7xl px-5 pb-20 pt-14 sm:px-8 sm:pt-20 lg:px-10 lg:pb-28">
          <div className="max-w-4xl">
            <h1 className="text-[clamp(2.75rem,6.5vw,5.75rem)] font-semibold leading-[0.92] tracking-[-0.055em]">
              The full-stack TypeScript
              <br />
              starter you don’t
              <span className="font-gambetta font-normal italic tracking-[-0.04em] text-[#d8ff70]">
                {" "}
                outgrow.
              </span>
            </h1>

            <p className="mt-8 max-w-2xl text-lg leading-8 text-white/60 sm:text-xl sm:leading-9">
              Next.js, NestJS on Fastify, Supabase, and Prisma in one generated
              monorepo — with authentication, realtime, optimistic state, and
              deployment already wired together. Start frontend-only in seconds
              and turn the backend on when the idea earns it.
            </p>

            <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center">
              <InstallCommand
                command="npx create-kingstack my-app"
                className="w-full sm:w-auto sm:min-w-[22rem]"
              />
              <Link
                href="/app"
                className="group inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#d8ff70] px-6 font-semibold text-[#11130d] transition hover:bg-[#e3ff98]"
              >
                See it running
                <ArrowRight
                  className="size-4 transition-transform group-hover:translate-x-1"
                  aria-hidden="true"
                />
              </Link>
            </div>

            <p className="mt-6 text-sm text-white/40">
              MIT licensed. Your source code, your database, your deployment —
              no proprietary runtime.
            </p>
          </div>
        </section>
      </div>

      <section className="border-y border-white/10 bg-white/[0.025]">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-8 gap-y-3 px-5 py-6 text-sm text-white/45 sm:px-8 lg:px-10">
          <span className="text-xs font-medium uppercase tracking-[0.18em] text-white/30">
            Included
          </span>
          {[
            "TypeScript",
            "Next.js",
            "NestJS",
            "Supabase",
            "Prisma",
            "PostgreSQL",
            "MobX",
            "TanStack Query",
            "Turborepo",
            "Vitest",
          ].map((tool) => (
            <span key={tool}>{tool}</span>
          ))}
        </div>
      </section>

      <section
        id="architecture"
        className="mx-auto max-w-7xl scroll-mt-16 px-5 py-24 sm:px-8 sm:py-32 lg:px-10"
      >
        <div className="grid gap-10 lg:grid-cols-[0.95fr_1.05fr] lg:gap-16">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-[#d8ff70]">
              Why the draft isn’t throwaway
            </p>
            <h2 className="mt-5 text-4xl font-semibold leading-[1.04] tracking-[-0.045em] sm:text-5xl">
              One contract, two adapters.
            </h2>
            <p className="mt-6 max-w-xl text-lg leading-8 text-white/55">
              Domain stores depend on a repository contract instead of importing
              a database client. Swap the adapter and the same feature runs on
              in-memory fixtures or on PostgreSQL through NestJS.
            </p>
            <p className="mt-5 max-w-xl leading-7 text-white/45">
              That means the frontend-only draft already exercises the real MobX
              projections, TanStack Query lifecycle, optimistic mutations, and
              rollback behavior. Adding a backend changes how the feature is
              composed — not the UI, and not the store.
            </p>
          </div>

          <figure className="rounded-[1.75rem] border border-white/10 bg-white/[0.03] p-6 sm:p-8">
            <figcaption className="sr-only">
              Data flow from a React feature through a domain store and
              repository contract to either an in-memory adapter or an HTTP
              adapter backed by NestJS, Prisma, and PostgreSQL.
            </figcaption>

            <div className="space-y-2 text-center">
              <div className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-medium">
                React feature
              </div>
              <div
                aria-hidden="true"
                className="mx-auto h-5 w-px bg-white/15"
              />
              <div className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-medium">
                Domain store
                <span className="mt-1 block text-xs font-normal text-white/40">
                  MobX projections, optimistic mutations, rollback
                </span>
              </div>
              <div
                aria-hidden="true"
                className="mx-auto h-5 w-px bg-white/15"
              />
              <div className="rounded-xl border border-[#d8ff70]/25 bg-[#d8ff70]/[0.07] px-4 py-3 text-sm font-medium text-[#d8ff70]">
                Repository contract
              </div>
            </div>

            <div
              aria-hidden="true"
              className="mx-auto mt-2 h-5 w-px bg-white/15"
            />

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-white/10 bg-[#0d0e11] p-4">
                <p className="font-mono text-xs text-white/35">ADAPTER 01</p>
                <p className="mt-2 text-sm font-medium">In-memory</p>
                <p className="mt-2 text-sm leading-6 text-white/45">
                  Fixture data, no services. Resets on reload.
                </p>
                <code className="mt-4 inline-flex rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 font-mono text-xs text-white/55">
                  yarn dev:frontend
                </code>
              </div>
              <div className="rounded-xl border border-[#8d7cff]/30 bg-[#8d7cff]/[0.09] p-4">
                <p className="font-mono text-xs text-white/35">ADAPTER 02</p>
                <p className="mt-2 text-sm font-medium">HTTP</p>
                <p className="mt-2 text-sm leading-6 text-white/50">
                  NestJS → Prisma → PostgreSQL, with realtime.
                </p>
                <code className="mt-4 inline-flex rounded-lg border border-[#8d7cff]/25 bg-black/20 px-2.5 py-1.5 font-mono text-xs text-[#bdb5ff]">
                  yarn dev
                </code>
              </div>
            </div>
          </figure>
        </div>
      </section>

      <section
        id="stack"
        className="scroll-mt-16 border-y border-white/10 bg-[#0c0d10]"
      >
        <div className="mx-auto max-w-7xl px-5 py-24 sm:px-8 sm:py-32 lg:px-10">
          <div className="max-w-3xl">
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-[#a89cff]">
              What gets generated
            </p>
            <h2 className="mt-5 text-4xl font-semibold leading-[1.04] tracking-[-0.045em] sm:text-5xl">
              Every piece, already connected.
            </h2>
            <p className="mt-6 text-lg leading-8 text-white/55">
              Not a list of dependencies you still have to integrate. These
              layers ship talking to each other, with working examples for the
              parts that are usually the hardest to get right.
            </p>
          </div>

          <div className="mt-16 grid gap-px overflow-hidden rounded-[1.75rem] border border-white/10 bg-white/10 sm:grid-cols-2 lg:grid-cols-4">
            {stack.map((item) => {
              const Icon = item.icon;

              return (
                <article
                  key={item.name}
                  className="bg-[#0d0e11] p-6 transition-colors hover:bg-[#111317]"
                >
                  <span className="grid size-10 place-items-center rounded-xl border border-white/10 bg-white/[0.04] text-[#d8ff70]">
                    <Icon className="size-4" aria-hidden="true" />
                  </span>
                  <h3 className="mt-5 text-lg font-medium tracking-[-0.02em]">
                    {item.name}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-white/45">
                    {item.detail}
                  </p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="border-b border-white/10 bg-[#f1eee5] text-[#171812]">
        <div className="mx-auto max-w-7xl px-5 py-24 sm:px-8 sm:py-32 lg:px-10">
          <div className="grid gap-8 lg:grid-cols-2 lg:items-end">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#6555d9]">
                Two ways to start
              </p>
              <h2 className="mt-5 max-w-xl text-4xl font-semibold leading-[1.04] tracking-[-0.05em] sm:text-5xl">
                Skip Docker today. Add it Thursday.
              </h2>
            </div>
            <p className="max-w-xl self-end text-lg leading-8 text-black/55">
              Both options generate the same codebase. The flag only decides how
              much infrastructure boots on day one — draft mode isn’t a reduced
              template, and it doesn’t delete the backend.
            </p>
          </div>

          <div className="mt-14 overflow-x-auto">
            <table className="w-full min-w-[36rem] border-collapse text-left">
              <thead>
                <tr className="border-b border-black/15">
                  <th
                    scope="col"
                    className="py-4 pr-6 text-sm font-medium text-black/45"
                  >
                    <span className="sr-only">Property</span>
                  </th>
                  <th
                    scope="col"
                    className="py-4 pr-6 text-lg font-semibold tracking-[-0.02em]"
                  >
                    Frontend draft
                  </th>
                  <th
                    scope="col"
                    className="py-4 text-lg font-semibold tracking-[-0.02em] text-[#6555d9]"
                  >
                    Full stack
                  </th>
                </tr>
              </thead>
              <tbody>
                {comparison.map((row) => (
                  <tr key={row.label} className="border-b border-black/10">
                    <th
                      scope="row"
                      className="py-4 pr-6 text-sm font-medium text-black/50"
                    >
                      {row.label}
                    </th>
                    <td className="py-4 pr-6 font-mono text-sm">{row.draft}</td>
                    <td className="py-4 font-mono text-sm text-[#6555d9]">
                      {row.full}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-12 grid gap-4 sm:grid-cols-2">
            <InstallCommand
              command="npx create-kingstack my-app --draft"
              tone="light"
            />
            <InstallCommand
              command="npx create-kingstack my-app --full"
              tone="light"
            />
          </div>
        </div>
      </section>

      <section
        id="operations"
        className="mx-auto max-w-7xl scroll-mt-16 px-5 py-24 sm:px-8 sm:py-32 lg:px-10"
      >
        <div className="grid gap-12 lg:grid-cols-[0.85fr_1.15fr] lg:gap-16">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-[#d8ff70]">
              After the demo
            </p>
            <h2 className="mt-5 text-4xl font-semibold leading-[1.04] tracking-[-0.045em] sm:text-5xl">
              The boring parts are
              <span className="block font-gambetta font-normal italic text-white/45">
                already scripted.
              </span>
            </h2>
            <p className="mt-6 max-w-lg leading-7 text-white/50">
              Generated apps usually stall at the point where you need
              environments, migrations, secrets, and a deploy that can roll
              back. Those are commands here, not a weekend.
            </p>
          </div>

          <ul className="divide-y divide-white/10 border-y border-white/10">
            {operations.map((operation) => (
              <li
                key={operation.command}
                className="grid gap-2 py-5 sm:grid-cols-[16rem_1fr] sm:items-baseline sm:gap-8"
              >
                <code className="font-mono text-sm text-[#d8ff70]">
                  {operation.command}
                </code>
                <p className="leading-7 text-white/50">
                  {operation.description}
                </p>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-6 grid gap-5 rounded-[1.75rem] border border-white/10 bg-white/[0.035] p-7 sm:p-9 lg:grid-cols-[0.45fr_1fr] lg:items-center">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-[#bdb5ff]">
              Working with agents
            </p>
            <h3 className="mt-3 text-2xl font-medium tracking-[-0.035em]">
              Point them at AGENTS.md
            </h3>
          </div>
          <p className="max-w-3xl leading-7 text-white/50">
            The repository ships project rules, architecture guides, and nearby
            working examples, so an agent extends the system that exists instead
            of inventing a parallel one. Let the repo carry the implementation
            context; your prompt carries the product outcome.
          </p>
        </div>
      </section>

      <section className="px-5 pb-5 sm:px-8 lg:px-10">
        <div className="relative mx-auto max-w-7xl overflow-hidden rounded-[2rem] bg-[#d8ff70] px-6 py-20 text-[#11130d] sm:px-12 sm:py-24 lg:px-16">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-28 -top-36 size-[28rem] rounded-full border-[5rem] border-black/[0.06]"
          />
          <div className="relative max-w-3xl">
            <h2 className="text-4xl font-semibold leading-[1] tracking-[-0.055em] sm:text-6xl">
              Start in a minute. Keep it for years.
            </h2>
            <p className="mt-6 max-w-xl text-lg leading-8 text-black/60">
              One command generates the monorepo, installs dependencies, picks
              an open port block, initializes Git, and starts the runtime you
              chose.
            </p>

            <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
              <InstallCommand
                command="npx create-kingstack my-app"
                tone="light"
                className="w-full border-black/20 bg-black/[0.06] sm:w-auto sm:min-w-[22rem]"
              />
              <Link
                href="/app"
                className="group inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#11130d] px-6 font-semibold text-white transition hover:bg-black"
              >
                Explore the demo
                <ArrowRight
                  className="size-4 transition-transform group-hover:translate-x-1"
                  aria-hidden="true"
                />
              </Link>
            </div>

            <ul className="mt-9 flex flex-wrap gap-x-7 gap-y-3 text-sm font-medium text-black/60">
              {["MIT licensed", "No vendor lock-in", "Node 24+"].map((item) => (
                <li key={item} className="flex items-center gap-2">
                  <Check className="size-4" aria-hidden="true" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <footer className="mx-auto flex max-w-7xl flex-col gap-5 px-5 py-10 text-sm text-white/35 sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-10">
        <div className="flex items-center gap-2.5 text-white/65">
          <Crown className="size-4 text-[#d8ff70]" aria-hidden="true" />
          <span className="font-semibold">KingStack</span>
        </div>
        <div className="flex gap-5">
          <a href="#stack" className="transition-colors hover:text-white">
            The stack
          </a>
          <Link href="/app" className="transition-colors hover:text-white">
            Demo
          </Link>
          <Link href="/chat" className="transition-colors hover:text-white">
            AI chat
          </Link>
        </div>
      </footer>
    </main>
  );
}
