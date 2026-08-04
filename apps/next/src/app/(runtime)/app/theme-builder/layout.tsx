import type { Metadata } from "next";
import { createMetadata } from "@/lib/metadata";

export const metadata: Metadata = createMetadata({
  title: "Theme Builder",
  description:
    "Edit KingStack design tokens, preview the application theme, and export CSS or JSON.",
  keywords: ["theme", "customization", "CSS variables", "design system"],
  canonical: "/app/theme-builder",
});

export default function ThemeBuilderLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
