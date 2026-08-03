import type { Metadata } from "next";
import { createMetadata } from "@/lib/metadata";

export const metadata: Metadata = createMetadata({
  title: "Realtime Sync",
  description:
    "Multi-user realtime synchronization with optimistic updates and automatic rollback.",
  keywords: [
    "realtime",
    "websockets",
    "socket.io",
    "collaborative",
    "multi-user",
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
