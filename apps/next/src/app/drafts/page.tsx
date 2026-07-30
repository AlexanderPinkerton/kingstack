import type { Metadata } from "next";
import Link from "next/link";
import { createMetadata } from "@/lib/metadata";

export const metadata: Metadata = createMetadata({
  title: "Frontend Drafts",
  description:
    "Backend-free KingStack design drafts that retain production store patterns.",
  canonical: "/drafts",
  noIndex: true,
});

export default function DraftsPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-black to-slate-900 px-6 py-16 text-white">
      <div className="mx-auto max-w-4xl">
        <Link
          href="/"
          className="mb-8 inline-block text-sm text-slate-400 transition hover:text-white"
        >
          ← Choose another path
        </Link>
        <div className="mb-10">
          <p className="mb-3 text-sm font-medium uppercase tracking-[0.2em] text-purple-300">
            Backend-free workspace
          </p>
          <h1 className="text-4xl font-bold">Frontend drafts</h1>
          <p className="mt-4 max-w-2xl text-slate-300">
            These routes use the same domain stores and optimistic behavior as
            the full application, with in-memory repositories in place of
            backend adapters.
          </p>
        </div>

        <Link
          href="/drafts/posts"
          className="block rounded-xl border border-purple-500/40 bg-slate-800/40 p-6 transition hover:border-purple-400 hover:bg-slate-800/70"
        >
          <div className="text-xl font-semibold">Advanced posts</div>
          <p className="mt-2 text-slate-300">
            Create, edit, publish, filter, and delete posts through the real
            AdvancedPostStore and its optimistic mutation pipeline.
          </p>
        </Link>

        <div className="mt-8 rounded-xl border border-slate-700 bg-slate-900/40 p-5 text-sm text-slate-300">
          Ready to connect the backend? Start Supabase and NestJS, then open{" "}
          <Link
            href="/full-stack"
            className="font-medium text-purple-300 hover:text-purple-200"
          >
            the full-stack showcase
          </Link>
          .
        </div>
      </div>
    </main>
  );
}
