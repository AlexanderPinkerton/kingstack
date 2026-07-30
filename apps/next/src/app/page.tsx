import type { Metadata } from "next";
import Link from "next/link";
import { createMetadata } from "@/lib/metadata";

export const metadata: Metadata = createMetadata({
  title: "Choose Your Starting Point",
  description:
    "Explore KingStack with a backend-free frontend draft or the complete Supabase and NestJS runtime.",
  canonical: "/",
});

const paths = [
  {
    href: "/drafts",
    eyebrow: "No backend required",
    title: "Frontend drafts",
    description:
      "Explore UI ideas using the real MobX, TanStack Query, and optimistic-store patterns with in-memory repositories.",
    details: [
      "Next.js only",
      "No Supabase, NestJS, Docker, or database",
      "Swap in a real repository later",
    ],
    cta: "Explore without a backend",
    accent:
      "border-emerald-500/40 hover:border-emerald-400 bg-emerald-500/[0.06]",
    eyebrowColor: "text-emerald-300",
  },
  {
    href: "/full-stack",
    eyebrow: "Backend services required",
    title: "Full-stack showcase",
    description:
      "See the authenticated, database-backed, and realtime parts of KingStack running through Supabase and NestJS.",
    details: [
      "Supabase authentication and Postgres",
      "NestJS API and background jobs",
      "Realtime synchronization",
    ],
    cta: "Open the full stack",
    accent: "border-purple-500/40 hover:border-purple-400 bg-purple-500/[0.06]",
    eyebrowColor: "text-purple-300",
  },
] as const;

export default function StartPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-black via-slate-950 to-slate-900 px-6 py-16 text-white">
      <div className="mx-auto max-w-5xl">
        <header className="mb-12 max-w-3xl">
          <p className="mb-3 text-sm font-medium uppercase tracking-[0.2em] text-cyan-300">
            KingStack
          </p>
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            Choose how you want to explore the stack
          </h1>
          <p className="mt-5 text-lg leading-8 text-slate-300">
            Start with frontend ideas immediately, or enter the complete
            backend-connected showcase when your local services are ready.
          </p>
        </header>

        <div className="grid gap-6 md:grid-cols-2">
          {paths.map((path) => (
            <Link
              key={path.href}
              href={path.href}
              className={`group flex min-h-96 flex-col rounded-2xl border p-7 transition ${path.accent}`}
            >
              <p
                className={`text-xs font-semibold uppercase tracking-[0.16em] ${path.eyebrowColor}`}
              >
                {path.eyebrow}
              </p>
              <h2 className="mt-4 text-2xl font-semibold">{path.title}</h2>
              <p className="mt-4 leading-7 text-slate-300">
                {path.description}
              </p>
              <ul className="mt-6 space-y-3 text-sm text-slate-300">
                {path.details.map((detail) => (
                  <li key={detail} className="flex gap-3">
                    <span className={path.eyebrowColor}>✓</span>
                    <span>{detail}</span>
                  </li>
                ))}
              </ul>
              <span className="mt-auto pt-8 font-medium text-white">
                {path.cta}
                <span className="ml-2 inline-block transition-transform group-hover:translate-x-1">
                  →
                </span>
              </span>
            </Link>
          ))}
        </div>

        <div className="mt-8 flex flex-wrap gap-x-6 gap-y-3 text-sm text-slate-400">
          <Link href="/drafts/posts" className="hover:text-white">
            Advanced optimistic-store draft
          </Link>
          <Link
            href="/examples/unthemed/landing-1"
            className="hover:text-white"
          >
            Static landing-page example
          </Link>
          <Link href="/chat" className="hover:text-white">
            AI chat (provider key required)
          </Link>
        </div>
      </div>
    </main>
  );
}
