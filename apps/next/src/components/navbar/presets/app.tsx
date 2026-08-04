"use client";

import React from "react";
import Link from "next/link";
import { Crown } from "lucide-react";
import { Navbar } from "../navbar";
import type { NavLink, CTA } from "../types";

import { AvatarMenu } from "../custom/avatar-menu";

interface AppNavbarProps {
  className?: string;
  onNavLinkClick?: (href: string) => void;
  // Allow extending the default nav links and CTAs
  additionalNavLinks?: NavLink[];
  additionalCtas?: CTA[];
  // Allow overriding the default nav links and CTAs completely
  navLinks?: NavLink[];
  ctas?: CTA[];
}

export function AppNavbar({
  className = "",
  navLinks,
  ctas,
  additionalNavLinks = [],
  additionalCtas = [],
}: AppNavbarProps) {
  const [mounted, setMounted] = React.useState(false);

  // Using useLayoutEffect for synchronous update before paint to prevent hydration mismatches
  React.useLayoutEffect(() => {
    setMounted(true);
  }, []);

  // Logo component - linked to home page
  const logo = mounted ? (
    <Link
      href="/"
      className="flex items-center gap-3 font-semibold tracking-[-0.02em] transition-opacity hover:opacity-80"
      aria-label="Go to home page"
    >
      <span className="grid size-9 place-items-center rounded-full border border-white/15 bg-white/[0.06]">
        <Crown className="size-4 text-[#d8ff70]" aria-hidden="true" />
      </span>
      <span className="text-lg text-[#f5f2e8]">KingStack</span>
    </Link>
  ) : null;

  // Navigation links
  const presetNavLinks: NavLink[] = [];

  // CTAs
  const presetCtas: CTA[] = [];

  const allNavLinks = [...presetNavLinks, ...additionalNavLinks];
  const allCtas = [...presetCtas, ...additionalCtas];

  const finalNavLinks = navLinks !== undefined ? navLinks : allNavLinks;
  const finalCtas = ctas !== undefined ? ctas : allCtas;

  const specialtyComponents = [<AvatarMenu key="avatar" />].filter(Boolean);

  return (
    <Navbar
      logo={logo}
      navLinks={finalNavLinks}
      ctas={finalCtas}
      className={className}
      transparent={false}
      specialtyComponents={specialtyComponents}
    />
  );
}
