import type { Metadata } from "next";
import { createMetadata } from "@/lib/metadata";

export const metadata: Metadata = createMetadata({
  title: "Theme Builder",
  description:
    "Choose from preset themes or customize every color variable to create your perfect theme. Export your theme as CSS or JSON.",
  keywords: ["theme", "customization", "CSS variables", "design system"],
  canonical: "/home/theme-builder",
});

export default function ThemeBuilderLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
