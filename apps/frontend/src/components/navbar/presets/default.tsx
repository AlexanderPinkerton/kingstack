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
}

export function DefaultNavbar({
  className = "",
  navLinks,
  ctas,
  additionalNavLinks = [],
  additionalCtas = [],
}: DefaultNavbarProps) {
  const { theme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
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
    {
      title: "How It Works",
      href: "#how-it-works",
      onClick: () => {
        const element = document.getElementById("how-it-works");
        element?.scrollIntoView({ behavior: "smooth" });
      },
    },
    {
      title: "Games",
      href: "#games",
      onClick: () => {
        const element = document.getElementById("games");
        element?.scrollIntoView({ behavior: "smooth" });
      },
    },
    {
      title: "For Developers",
      href: "/developers",
    },
  ];

  // CTAs for marketing
  const presetCtas: CTA[] = [
    {
      title: "Play Now",
      onClick: () => (window.location.href = "/login"),
      variant: "outline",
    },
  ];

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
      transparent={true} // Marketing navbars are often transparent
      specialtyComponents={specialtyComponents}
    />
  );
}
