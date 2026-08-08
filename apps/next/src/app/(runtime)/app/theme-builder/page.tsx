"use client";

import { AppPageHeader } from "@/components/app-showcase/app-page-header";
import { ThemeBuilder } from "@/components/theme-builder";

export default function ThemeBuilderPage() {
  return (
    <>
      <AppPageHeader
        eyebrow="Public example"
        title="Theme system"
        description="Choose a preset or edit the application’s color variables directly, then export the result as CSS or JSON."
      />
      <section className="rounded-[2rem] border border-white/10 bg-[#111216]/85 p-4 shadow-2xl shadow-black/20 sm:p-8">
        <ThemeBuilder />
      </section>
    </>
  );
}
