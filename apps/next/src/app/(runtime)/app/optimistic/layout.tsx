import type { Metadata } from "next";
import { createMetadata } from "@/lib/metadata";

export const metadata: Metadata = createMetadata({
  title: "Optimistic Store",
  description:
    "Advanced state management with custom transformers, search, filtering, analytics, and optimistic updates.",
  keywords: [
    "optimistic updates",
    "state management",
    "mobx",
    "tanstack query",
    "transformer",
  ],
  canonical: "/app/optimistic",
});

export default function OptimisticLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
