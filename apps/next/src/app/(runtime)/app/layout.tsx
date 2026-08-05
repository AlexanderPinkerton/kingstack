import type { Metadata } from "next";
import { AppNavbar } from "@/components/navbar/presets/app";
import { createMetadata } from "@/lib/metadata";

export const metadata: Metadata = createMetadata({
  title: "Application",
  description:
    "The authenticated KingStack application workspace and full-runtime examples.",
  canonical: "/app",
});

const navLinks = [
  { title: "Overview", href: "/app" },
  { title: "Optimistic", href: "/app/optimistic" },
  { title: "Realtime", href: "/app/realtime" },
  { title: "Canvas", href: "/app/canvas" },
  { title: "Theme", href: "/app/theme-builder" },
] as const;

export default function ApplicationLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#090a0c] text-[#f5f2e8] selection:bg-[#d8ff70] selection:text-[#11130d]">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[44rem] opacity-60"
        style={{
          background:
            "radial-gradient(circle at 78% 4%, rgba(118, 85, 255, 0.2), transparent 32%), radial-gradient(circle at 12% 24%, rgba(216, 255, 112, 0.07), transparent 24%)",
        }}
      />
      <AppNavbar navLinks={[...navLinks]} />
      <main className="relative z-10 mx-auto max-w-7xl px-5 pb-20 pt-28 sm:px-8 lg:px-10">
        {children}
      </main>
    </div>
  );
}
