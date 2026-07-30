import type { Metadata } from "next";
import { createMetadata } from "@/lib/metadata";

export const metadata: Metadata = createMetadata({
  title: "Realtime Sync",
  description:
    "Multi-user real-time synchronization with optimistic updates and auto-rollback. Experience collaborative features powered by Socket.io.",
  keywords: [
    "realtime",
    "websockets",
    "socket.io",
    "collaborative",
    "multi-user",
  ],
  canonical: "/home/realtime",
});

export default function RealtimeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
