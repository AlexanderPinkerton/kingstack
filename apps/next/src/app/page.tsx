import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Boxes,
  Check,
  Cloud,
  Container,
  Crown,
  FileCode2,
  KeyRound,
  Server,
  Terminal,
} from "lucide-react";
import { InstallCommand } from "@/components/landing/install-command";
import { StackShowcase } from "@/components/landing/stack-showcase";
import { createMetadata } from "@/lib/metadata";

export const metadata: Metadata = createMetadata({
  title: "Full-stack TypeScript starter — Next.js, NestJS, Supabase, Prisma",
  description:
    "KingStack generates a complete TypeScript monorepo: Next.js, NestJS on Fastify, Supabase, Prisma, and optimistic state. Deploy the frontend, the API, or both — no vendor lock-in.",
  canonical: "/",
});

const runtimes = [
  {
    icon: Cloud,
    label: "Runtime 01",
    name: "Next.js",
    role: "Frontend and serverless backend",
    description:
      "For most features, this is the whole backend. Pages and API routes ship together, and nothing has to stay running between requests.",
    points: [
      "Pages and API routes in one app",
      "Authentication already wired in",
      "Runs anywhere Node runs",
    ],
    accent: "lime",
  },
  {
    icon: Server,
    label: "Runtime 02",
    name: "NestJS on Fastify",
    role: "Persistent backend",
    description:
      "For everything a serverless function can’t do — connections that stay open, work that runs on a schedule, jobs that outlive the request that started them.",
    points: [
      "Realtime, cron, and background jobs",
      "The same authentication, enforced server-side",
      "Ships as a container",
    ],
    accent: "violet",
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

const qualityOfLife = [
  {
    icon: FileCode2,
    name: "Environment config you declare once",
    description:
      "Every value lives in one typed schema. The env files are generated, so the key you added for staging can’t go missing.",
    commands: ["yarn env:local", "yarn config:check:local"],
  },
  {
    icon: Boxes,
    name: "One TypeScript and lint setup",
    description:
      "Shared presets for the whole monorepo. A new workspace extends them instead of copying them.",
    commands: ["yarn typecheck", "yarn lint:fix"],
  },
  {
    icon: Terminal,
    name: "Tooling written in TypeScript",
    description:
      "Deploys, status checks, and project scripts are TypeScript you can read and change — not accumulated shell nobody wants to touch.",
    commands: ["yarn supabase:status", "yarn workbranch"],
  },
  {
    icon: Check,
    name: "Projects that stay out of each other’s way",
    description:
      "Every project reserves its own port block, so several run side by side. One command runs the tests for all of them.",
    commands: ["yarn test"],
  },
] as const;

const deployTargets = [
  {
    surface: "Frontend",
    detail:
      "A stock Next build. One command ships it to Vercel, or take it to any host that runs Node.",
    command: "yarn vercel:prod",
  },
  {
    surface: "API",
    detail:
      "One command provisions, deploys, health checks, and rolls back. It’s a container, so it runs anywhere containers do.",
    command: "yarn deploy:nest",
  },
  {
    surface: "Database",
    detail:
      "Hosted Supabase or any Postgres you like. The same migrations apply either way.",
    command: "yarn prisma:deploy",
  },
  {
    surface: "Secrets",
    detail:
      "Push the values you already declared to the platforms that need them, with a dry run first.",
    command: "yarn deploy:sync-secrets",
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
            <a
              href="#architecture"
              className="transition-colors hover:text-white"
            >
              Architecture
            </a>
            <a href="#stack" className="transition-colors hover:text-white">
              The stack
            </a>
            <a href="#deploy" className="transition-colors hover:text-white">
              Deploy
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
        <div className="grid gap-8 lg:grid-cols-2 lg:items-end">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-[#d8ff70]">
              Architecture
            </p>
            <h2 className="mt-5 max-w-xl text-4xl font-semibold leading-[1.04] tracking-[-0.045em] sm:text-5xl">
              Two runtimes. Use one,
              <span className="block font-gambetta font-normal italic text-white/45">
                or both.
              </span>
            </h2>
          </div>
          <p className="max-w-xl self-end text-lg leading-8 text-white/55">
            Most projects don’t need a dedicated API server on day one, and some
            never will. You get both in one repository, so that decision stays
            reversible instead of structural.
          </p>
        </div>

        <div className="mt-14 grid gap-5 lg:grid-cols-2">
          {runtimes.map((runtime) => {
            const Icon = runtime.icon;
            const isLime = runtime.accent === "lime";

            return (
              <article
                key={runtime.name}
                className={`flex flex-col rounded-[1.75rem] border p-7 sm:p-9 ${
                  isLime
                    ? "border-[#d8ff70]/25 bg-[#d8ff70]/[0.06]"
                    : "border-[#8d7cff]/30 bg-[#8d7cff]/[0.08]"
                }`}
              >
                <div className="flex items-center justify-between gap-4">
                  <span className="font-mono text-xs text-white/35">
                    {runtime.label}
                  </span>
                  <span
                    className={`grid size-10 place-items-center rounded-xl border bg-black/20 ${
                      isLime
                        ? "border-[#d8ff70]/25 text-[#d8ff70]"
                        : "border-[#8d7cff]/30 text-[#bdb5ff]"
                    }`}
                  >
                    <Icon className="size-4" aria-hidden="true" />
                  </span>
                </div>

                <h3 className="mt-6 text-3xl font-medium tracking-[-0.04em]">
                  {runtime.name}
                </h3>
                <p
                  className={`mt-2 text-sm font-medium uppercase tracking-[0.14em] ${
                    isLime ? "text-[#d8ff70]" : "text-[#bdb5ff]"
                  }`}
                >
                  {runtime.role}
                </p>
                <p className="mt-5 leading-7 text-white/55">
                  {runtime.description}
                </p>

                <ul className="mt-7 space-y-3 border-t border-white/10 pt-6 text-sm">
                  {runtime.points.map((point) => (
                    <li key={point} className="flex items-start gap-3">
                      <Check
                        className={`mt-0.5 size-4 shrink-0 ${
                          isLime ? "text-[#d8ff70]" : "text-[#bdb5ff]"
                        }`}
                        aria-hidden="true"
                      />
                      <span className="text-white/70">{point}</span>
                    </li>
                  ))}
                </ul>
              </article>
            );
          })}
        </div>

        <div className="mt-5 grid gap-5 md:grid-cols-2">
          <article className="rounded-[1.75rem] border border-white/10 bg-white/[0.035] p-7 sm:p-9">
            <span className="grid size-10 place-items-center rounded-xl border border-white/10 bg-white/[0.05] text-[#d8ff70]">
              <KeyRound className="size-4" aria-hidden="true" />
            </span>
            <h3 className="mt-5 text-2xl font-medium tracking-[-0.035em]">
              One identity, both runtimes
            </h3>
            <p className="mt-4 leading-7 text-white/50">
              Sign-in, sessions, and role checks are configured once. Whichever
              runtime serves the request already knows who the user is — you
              never build the same auth twice.
            </p>
          </article>

          <article className="rounded-[1.75rem] border border-white/10 bg-white/[0.035] p-7 sm:p-9">
            <span className="grid size-10 place-items-center rounded-xl border border-white/10 bg-white/[0.05] text-[#bdb5ff]">
              <Container className="size-4" aria-hidden="true" />
            </span>
            <h3 className="mt-5 text-2xl font-medium tracking-[-0.035em]">
              Shared code, not a generated client
            </h3>
            <p className="mt-4 leading-7 text-white/50">
              Both apps sit in one repository and share the same schema, types,
              and tooling. Change the data model and both sides fail to compile
              in the same commit, instead of drifting until production notices.
            </p>
          </article>
        </div>

        <div className="mt-5 rounded-[1.75rem] border border-white/10 bg-white/[0.035] p-7 sm:p-9">
          <div className="grid gap-6 lg:grid-cols-[0.4fr_1fr] lg:items-center">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-[#d8ff70]">
                Deployment shapes
              </p>
              <h3 className="mt-3 text-2xl font-medium tracking-[-0.035em]">
                Ship what you actually use
              </h3>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                {
                  title: "Next only",
                  body: "No container, no server to keep alive.",
                },
                {
                  title: "Nest only",
                  body: "An API for a mobile client or another frontend.",
                },
                {
                  title: "Both",
                  body: "Serverless at the edge, long-running work behind it.",
                },
              ].map((shape) => (
                <div
                  key={shape.title}
                  className="rounded-xl border border-white/10 bg-[#0d0e11] p-4"
                >
                  <p className="text-sm font-medium">{shape.title}</p>
                  <p className="mt-2 text-sm leading-6 text-white/45">
                    {shape.body}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section
        id="stack"
        className="scroll-mt-16 border-y border-white/10 bg-[#0c0d10]"
      >
        <div className="mx-auto max-w-7xl px-5 py-24 sm:px-8 sm:py-32 lg:px-10">
          <div className="max-w-3xl">
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-[#a89cff]">
              The rest of the stack
            </p>
            <h2 className="mt-5 text-4xl font-semibold leading-[1.04] tracking-[-0.045em] sm:text-5xl">
              Chosen on purpose, not by default.
            </h2>
            <p className="mt-6 text-lg leading-8 text-white/55">
              Every dependency here is one you would have reached for anyway.
              The difference is that they already work together, with a real
              example for the parts that are usually hardest to get right.
            </p>
          </div>

          <StackShowcase />
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
              Both options generate the same codebase — draft mode isn’t a
              reduced template and it doesn’t delete the backend. What you build
              without a database keeps working once there is one.
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

      <section className="mx-auto max-w-7xl px-5 py-24 sm:px-8 sm:py-32 lg:px-10">
        <div className="max-w-3xl">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-[#d8ff70]">
            Quality of life
          </p>
          <h2 className="mt-5 text-4xl font-semibold leading-[1.04] tracking-[-0.045em] sm:text-5xl">
            The setup work is
            <span className="font-gambetta font-normal italic text-white/45">
              {" "}
              already done.
            </span>
          </h2>
          <p className="mt-6 text-lg leading-8 text-white/55">
            The parts of a monorepo that quietly rot — environment files, four
            copies of a tsconfig, scripts nobody understands — are already
            handled.
          </p>
        </div>

        <div className="mt-14 grid gap-5 md:grid-cols-2">
          {qualityOfLife.map((item) => {
            const Icon = item.icon;

            return (
              <article
                key={item.name}
                className="flex flex-col rounded-[1.75rem] border border-white/10 bg-white/[0.035] p-7 sm:p-8"
              >
                <div className="flex items-center gap-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-lg border border-white/10 bg-white/[0.05] text-[#d8ff70]">
                    <Icon className="size-4" aria-hidden="true" />
                  </span>
                  <h3 className="text-lg font-medium tracking-[-0.02em]">
                    {item.name}
                  </h3>
                </div>
                <p className="mt-4 leading-7 text-white/50">
                  {item.description}
                </p>
                <div className="mt-6 flex flex-wrap gap-2">
                  {item.commands.map((command) => (
                    <code
                      key={command}
                      className="rounded-lg border border-white/10 bg-black/25 px-2.5 py-1.5 font-mono text-xs text-white/60"
                    >
                      {command}
                    </code>
                  ))}
                </div>
              </article>
            );
          })}
        </div>

        <div className="mt-5 grid gap-5 rounded-[1.75rem] border border-white/10 bg-white/[0.035] p-7 sm:p-9 lg:grid-cols-[0.45fr_1fr] lg:items-center">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-[#bdb5ff]">
              Working with agents
            </p>
            <h3 className="mt-3 text-2xl font-medium tracking-[-0.035em]">
              Point them at AGENTS.md
            </h3>
          </div>
          <p className="max-w-3xl leading-7 text-white/50">
            The repository carries its own rules, architecture guides, and
            working examples, so agents extend the system that exists instead of
            inventing a parallel one. The repo holds the context; your prompt
            just holds the outcome.
          </p>
        </div>
      </section>

      <section
        id="deploy"
        className="scroll-mt-16 border-y border-white/10 bg-[#0c0d10]"
      >
        <div className="mx-auto max-w-7xl px-5 py-24 sm:px-8 sm:py-32 lg:px-10">
          <div className="grid gap-8 lg:grid-cols-2 lg:items-end">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-[#d8ff70]">
                Deployment
              </p>
              <h2 className="mt-5 max-w-xl text-4xl font-semibold leading-[1.04] tracking-[-0.045em] sm:text-5xl">
                Deploy where you want.
              </h2>
            </div>
            <p className="max-w-xl self-end text-lg leading-8 text-white/55">
              Nothing here runs on a proprietary platform. A standard build, a
              standard container, and a standard Postgres database — three
              things every host already knows how to run.
            </p>
          </div>

          <ul className="mt-14 divide-y divide-white/10 border-y border-white/10">
            {deployTargets.map((target) => (
              <li
                key={target.surface}
                className="grid gap-3 py-6 sm:grid-cols-[9rem_1fr_15rem] sm:items-baseline sm:gap-8"
              >
                <h3 className="text-lg font-medium tracking-[-0.02em]">
                  {target.surface}
                </h3>
                <p className="leading-7 text-white/50">{target.detail}</p>
                <code className="font-mono text-sm text-[#d8ff70] sm:text-right">
                  {target.command}
                </code>
              </li>
            ))}
          </ul>

          <p className="mt-8 max-w-3xl leading-7 text-white/40">
            The included scripts cover DigitalOcean and Vercel today. That is a
            convenience, not a boundary — moving to Fly, Railway, AWS, or a box
            you own is a change of configuration, not of architecture.
          </p>
        </div>
      </section>

      <section className="px-5 py-5 sm:px-8 lg:px-10">
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
          <a
            href="#architecture"
            className="transition-colors hover:text-white"
          >
            Architecture
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
