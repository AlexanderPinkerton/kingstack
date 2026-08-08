import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Boxes,
  Check,
  Container,
  Crown,
  FileCode2,
  KeyRound,
  Terminal,
} from "lucide-react";
import { FoundationConsole } from "@/components/landing/foundation-console";
import { InstallCommand } from "@/components/landing/install-command";
import { StackShowcase } from "@/components/landing/stack-showcase";
import { createMetadata } from "@/lib/metadata";

export const metadata: Metadata = createMetadata({
  title: "Full-stack TypeScript framework — Next.js, NestJS, Supabase, Prisma",
  description:
    "KingStack is the one-person TypeScript framework: a generated Next.js, NestJS, Supabase, and Prisma monorepo with auth, realtime, and optimistic state.",
  canonical: "/",
});

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
    name: "Configuration you can verify",
    description:
      "Typed configuration generates each environment. The matching check command catches missing values before the app starts.",
    commands: ["yarn env:local", "yarn config:check:local"],
  },
  {
    icon: Boxes,
    name: "Shared TypeScript and lint rules",
    description:
      "Shared presets for the whole monorepo. A new workspace extends them instead of copying them.",
    commands: ["yarn typecheck", "yarn lint:fix"],
  },
  {
    icon: Terminal,
    name: "Project tooling you can edit",
    description:
      "Deployments, status checks, and repository automation are ordinary TypeScript you can read, debug, and change.",
    commands: ["yarn supabase:status", "yarn workbranch"],
  },
  {
    icon: Check,
    name: "Reserved ports for every project",
    description:
      "Each project receives its own ten-port block, so its local services can run beside other KingStack projects without collisions.",
    commands: ["yarn dlx @kingstack/create-kingstack ports list"],
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
      "Push values from typed configuration to the platforms that need them, with a dry run first.",
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
              href="#foundation"
              className="transition-colors hover:text-white"
            >
              Foundation
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
            <p className="mb-6 text-xs font-medium uppercase tracking-[0.2em] text-[#d8ff70]">
              The one-person framework for TypeScript
            </p>

            <h1 className="text-[clamp(2.75rem,6.5vw,5.75rem)] font-semibold leading-[0.92] tracking-[-0.055em]">
              Ship the whole product
              <br />
              <span className="font-gambetta font-normal italic tracking-[-0.04em] text-[#d8ff70]">
                by yourself.
              </span>
            </h1>

            <p className="mt-8 max-w-2xl text-lg leading-8 text-white/60 sm:text-xl sm:leading-9">
              Rails proved one person could ship a real product. KingStack is
              that bet in TypeScript — Next.js, NestJS on Fastify, Supabase, and
              Prisma in one generated monorepo. Authentication, realtime,
              optimistic state, and deployment tooling are present from the
              first run, so you can start with product code.
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
        id="foundation"
        className="mx-auto max-w-7xl scroll-mt-16 px-5 py-24 sm:px-8 sm:py-32 lg:px-10"
      >
        <div className="grid gap-8 lg:grid-cols-2 lg:items-end">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-[#d8ff70]">
              Already taken care of
            </p>
            <h2 className="mt-5 max-w-xl text-4xl font-semibold leading-[1.04] tracking-[-0.045em] sm:text-5xl">
              You bring the idea.
              <span className="block font-gambetta font-normal italic text-white/45">
                The rest is handled.
              </span>
            </h2>
          </div>
          <p className="max-w-xl self-end text-lg leading-8 text-white/55">
            A generated project opens with auth, data access, realtime, logging,
            and environment config working as parts of the same codebase.
            Deployment scripts ship with it. You can begin at the feature layer
            instead of assembling the foundation first.
          </p>
        </div>

        <FoundationConsole />

        <div className="mt-14 grid gap-5 md:grid-cols-2">
          <article className="rounded-[1.75rem] border border-white/10 bg-white/[0.035] p-7 sm:p-9">
            <span className="grid size-10 place-items-center rounded-xl border border-white/10 bg-white/[0.05] text-[#d8ff70]">
              <KeyRound className="size-4" aria-hidden="true" />
            </span>
            <h3 className="mt-5 text-2xl font-medium tracking-[-0.035em]">
              One identity, both runtimes
            </h3>
            <p className="mt-4 leading-7 text-white/50">
              Supabase issues the session; Next.js and NestJS validate the same
              token and enforce the same role model. A feature can use either
              runtime without introducing a second identity layer.
            </p>
          </article>

          <article className="rounded-[1.75rem] border border-white/10 bg-white/[0.035] p-7 sm:p-9">
            <span className="grid size-10 place-items-center rounded-xl border border-white/10 bg-white/[0.05] text-[#bdb5ff]">
              <Container className="size-4" aria-hidden="true" />
            </span>
            <h3 className="mt-5 text-2xl font-medium tracking-[-0.035em]">
              One schema, both runtimes
            </h3>
            <p className="mt-4 leading-7 text-white/50">
              The Prisma schema, generated types, and migrations live with the
              applications they support. A model change reaches both sides in
              the same commit, where TypeScript can catch drift before runtime.
            </p>
          </article>
        </div>
      </section>

      <section
        id="stack"
        className="scroll-mt-16 border-y border-white/10 bg-[#0c0d10]"
      >
        <div className="mx-auto max-w-7xl px-5 py-24 sm:px-8 sm:py-32 lg:px-10">
          <div className="max-w-3xl">
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-[#a89cff]">
              Why this stack
            </p>
            <h2 className="mt-5 text-4xl font-semibold leading-[1.04] tracking-[-0.045em] sm:text-5xl">
              Familiar tools with clear boundaries.
            </h2>
            <p className="mt-6 text-lg leading-8 text-white/55">
              KingStack does not hide these tools behind a proprietary API. Each
              one owns a distinct concern, and the generated repository includes
              concrete examples of the integration points.
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
                Start frontend-only. Add the backend when you need it.
              </h2>
            </div>
            <p className="max-w-xl self-end text-lg leading-8 text-black/55">
              Both options generate the same source tree. Draft mode uses an
              in-memory repository and leaves backend services stopped; enabling
              them changes the adapter, not the store or UI you built.
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
            Repository upkeep
          </p>
          <h2 className="mt-5 text-4xl font-semibold leading-[1.04] tracking-[-0.045em] sm:text-5xl">
            A codebase you can keep understanding.
          </h2>
          <p className="mt-6 text-lg leading-8 text-white/55">
            Shared configuration, readable project tooling, and isolated local
            services keep routine work predictable as the repository grows.
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
              Frontend, API, and database keep their native deployment shapes: a
              Next.js build, a container, and PostgreSQL. Use the included
              targets or take each surface to another host.
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
          <a href="#foundation" className="transition-colors hover:text-white">
            Foundation
          </a>
          <Link href="/app" className="transition-colors hover:text-white">
            Demo
          </Link>
        </div>
      </footer>
    </main>
  );
}
