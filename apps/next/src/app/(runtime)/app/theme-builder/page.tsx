"use client";

import { AppPageHeader } from "@/components/app-showcase/app-page-header";
import { ThemeBuilder } from "@/components/theme-builder";

export default function ThemeBuilderPage() {
  return (
    <>
      <AppPageHeader
        eyebrow="Live CSS variable system"
        title="One token. Every component."
        description="Direct a complete application theme in real time. A small set of semantic CSS variables cascades through surfaces, typography, controls, charts, spacing, and shape without a refresh or theme props."
      />
      <ThemeBuilder />
    </>
  );
}
