import type { Metadata } from "next";
import { createMetadata } from "@/lib/metadata";

export const metadata: Metadata = createMetadata({
  title: "Optimistic Store",
  description:
    "Advanced state management with custom transformers, search, filtering, and analytics. See optimistic updates in action.",
  keywords: [
    "optimistic updates",
    "state management",
    "mobx",
    "tanstack query",
    "transformer",
  ],
  canonical: "/home/optimistic",
});

export default function OptimisticLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
