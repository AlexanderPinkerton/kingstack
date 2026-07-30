import type { Metadata } from "next";
import { createMetadata } from "@/lib/metadata";
import { DraftPostsClient } from "./DraftPostsClient";

export const metadata: Metadata = createMetadata({
  title: "Advanced Posts Draft",
  description:
    "Use KingStack's optimistic post store with an in-memory repository.",
  canonical: "/drafts/posts",
  noIndex: true,
});

export default function DraftPostsPage() {
  return <DraftPostsClient />;
}
