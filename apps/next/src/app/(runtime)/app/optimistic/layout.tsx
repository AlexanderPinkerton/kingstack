import type { Metadata } from "next";
import { createMetadata } from "@/lib/metadata";

export const metadata: Metadata = createMetadata({
  title: "Optimistic UI",
  description:
    "Interactive optimistic mutations with visible latency, reconciliation, and automatic rollback.",
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
