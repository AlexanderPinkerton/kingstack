import type { Metadata } from "next";
import Link from "next/link";
import { HeroSection } from "@/components/core/hero-section";
import { FeaturesSection } from "@/components/core/features-section";
import { AuthSection } from "@/components/core/auth-section";
import { CtaSection } from "@/components/core/cta-section";
import { Footer } from "@/components/core/footer";
import { AppNavbar } from "@/components/navbar/presets/app";
import { RealtimeCheckboxes } from "@/components/examples/RealtimeCheckboxes";
import { PublicTodos } from "@/components/examples/PublicTodos";
import { createMetadata } from "@/lib/metadata";

export const metadata: Metadata = createMetadata({
  title: "Full-stack Demo",
  description:
    "A modern full-stack TypeScript monorepo with Next.js, NestJS, Supabase, and powerful state management. Explore realtime features, optimistic updates, and more.",
  keywords: [
    "full-stack development",
    "typescript monorepo",
    "nextjs",
    "nestjs",
    "realtime",
    "optimistic updates",
  ],
  canonical: "/full-stack",
});

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-black to-slate-900 text-white">
      <AppNavbar />
      <section className="px-4 pt-24">
        <div className="mx-auto flex max-w-5xl flex-col justify-between gap-3 rounded-xl border border-purple-500/30 bg-purple-500/10 px-5 py-4 text-sm text-slate-300 sm:flex-row sm:items-center">
          <span>
            <strong className="text-purple-200">Full-stack runtime:</strong>{" "}
            this path uses Supabase, NestJS, Postgres, and realtime services.
          </span>
          <Link href="/" className="font-medium text-white hover:text-cyan-300">
            Choose another path
          </Link>
        </div>
      </section>
      <HeroSection />
      <FeaturesSection />
      <AuthSection />

      {/* Public Todo Example - First Experience */}
      <section className="py-16 px-4">
        <div className="max-w-4xl mx-auto">
          <PublicTodos />
        </div>
      </section>

      {/* Realtime Checkboxes Example */}
      <section className="py-16 px-4">
        <div className="max-w-6xl mx-auto">
          <RealtimeCheckboxes />
        </div>
      </section>

      <CtaSection />
      <Footer />
    </main>
  );
}
