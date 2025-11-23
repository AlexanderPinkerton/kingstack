import type { Metadata } from "next";
import { createMetadata } from "@/lib/metadata";

export const metadata: Metadata = createMetadata({
  title: "Admin Dashboard",
  description: "Administrative dashboard for managing KingStack application.",
  canonical: "/admin/dashboard",
  noIndex: true, // Prevent search engines from indexing admin pages
});

export default function AdminDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}

