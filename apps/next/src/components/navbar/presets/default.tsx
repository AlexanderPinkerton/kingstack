"use client";

import React from "react";
import Image from "next/image";
import Link from "next/link";
import { Navbar } from "../navbar";
import type { NavLink, CTA } from "../types";
import { useTheme } from "next-themes";
import { useState, useEffect } from "react";
import { GradientText } from "@/components/ui/gradient-text";

import { AvatarMenu } from "../custom/avatar-menu";

interface DefaultNavbarProps {
  className?: string;
  onNavLinkClick?: (href: string) => void;
  // Allow extending the default nav links and CTAs
  additionalNavLinks?: NavLink[];
  additionalCtas?: CTA[];
  // Allow overriding the default nav links and CTAs completely
  navLinks?: NavLink[];
  ctas?: CTA[];
  specialtyComponents?: React.ReactNode[];
}

export function DefaultNavbar({
  className = "",
  navLinks,
  ctas,
  additionalNavLinks = [],
  additionalCtas = [],
  specialtyComponents = [],
}: DefaultNavbarProps) {
  const { theme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Using useLayoutEffect for synchronous update before paint to prevent hydration mismatches
  React.useLayoutEffect(() => {
    setMounted(true);
  }, []);

  // Logo component - linked to home page
  const logo = mounted ? (
    <Link
      href="/"
      className="flex items-center transition-opacity hover:opacity-80"
      aria-label="Go to home page"
    >
      <GradientText>
        <span className="text-2xl font-bold">KingStack</span>
      </GradientText>
    </Link>
  ) : null;

  // Navigation links for marketing pages
  const presetNavLinks: NavLink[] = [
    {
      title: "Features",
      href: "#features",
      onClick: () => {
        const element = document.getElementById("features");
        element?.scrollIntoView({ behavior: "smooth" });
      },
    },
  ];

  // CTAs for marketing
  const presetCtas: CTA[] = [
    {
      title: "Log In",
      onClick: () => (window.location.href = "/login"),
    },
  ];

  const allNavLinks = [...presetNavLinks, ...additionalNavLinks];
  const allCtas = [...presetCtas, ...additionalCtas];

  const finalNavLinks = navLinks !== undefined ? navLinks : allNavLinks;
  const finalCtas = ctas !== undefined ? ctas : allCtas;

  const finalSpecialtyComponents =
    specialtyComponents !== undefined
      ? specialtyComponents
      : [<AvatarMenu key="avatar-menu" />].filter(Boolean);

  return (
    <Navbar
      logo={logo}
      navLinks={finalNavLinks}
      ctas={finalCtas}
      className={className}
      transparent={true} // Marketing navbars are often transparent
      specialtyComponents={finalSpecialtyComponents}
    />
  );
}
