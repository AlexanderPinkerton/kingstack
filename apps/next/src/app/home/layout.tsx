import type { Metadata } from "next";
import { createMetadata } from "@/lib/metadata";

export const metadata: Metadata = createMetadata({
  title: "Dashboard",
  description:
    "Welcome to your KingStack dashboard. Explore features like optimistic updates, realtime sync, AI chat, and theme customization.",
  keywords: ["dashboard", "features", "optimistic updates", "realtime"],
  canonical: "/home",
});

export default function HomeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}

