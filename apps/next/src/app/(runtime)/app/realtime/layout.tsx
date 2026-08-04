import type { Metadata } from "next";
import { createMetadata } from "@/lib/metadata";

export const metadata: Metadata = createMetadata({
  title: "Realtime Collaboration",
  description:
    "Side-by-side multi-user synchronization with optimistic updates and live presence.",
  keywords: [
    "realtime",
    "websockets",
    "socket.io",
    "collaborative",
    "multi-user",
    "presence",
  ],
  canonical: "/app/realtime",
});

export default function RealtimeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
