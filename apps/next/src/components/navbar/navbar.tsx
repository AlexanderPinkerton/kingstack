"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { useIsMobile } from "@/hooks/use-mobile";
import { NavbarMobile } from "./navbar-mobile";
import { MobileHamburgerButton } from "./custom/mobile-hamburger-button";
import { ThemedButton } from "@/components/ui/themed-button";
import { Button } from "@/components/ui/button";
import { NavbarProps, NavLink, CTA } from "./types";
// import RequireIDBanner from "@/components/RequireIDBanner";
import dynamic from "next/dynamic";

// const IDUploadModal = dynamic(() => import("@/components/IDUploadModal"), {
//   ssr: false,
// });

// Re-export types for convenience
export type { NavbarProps, NavLink, CTA };

export const Navbar: React.FC<NavbarProps> = ({
  leftContent,
  centerContent,
  rightContent,
  navLinks = [],
  ctas = [],
  onNavLinkClick,
  logo,
  specialtyComponents = [],
  className = "",
  height = "h-16",
  sticky = true,
  transparent = true,
}) => {
  const isMobile = useIsMobile();
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [showIDUpload, setShowIDUpload] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Check if we're on the home page to show the banner
  const isHomePage = pathname === "/home";

  // Mount guard to prevent hydration mismatches
  // Using useLayoutEffect for synchronous update before paint
  React.useLayoutEffect(() => {
    setMounted(true);
  }, []);

  // Handle nav link clicks - if onNavLinkClick exists, use it instead of normal navigation
  const handleNavLinkClick = (
    link: NavLink,
    event: React.MouseEvent<HTMLAnchorElement>,
  ) => {
    if (onNavLinkClick) {
      // Custom navigation handler exists - prevent default and call it
      event.preventDefault();
      onNavLinkClick(link.href);
    } else if (link.onClick) {
      // Individual link click handler exists
      event.preventDefault();
      link.onClick();
    }
    // If neither exists, let default navigation happen naturally
  };

  // Force initial transparent state for better UX
  // Using useLayoutEffect for synchronous update before paint
  React.useLayoutEffect(() => {
    setScrolled(false); // Ensure navbar starts transparent
  }, []);

  // Handle scroll-based styling changes
  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.scrollY;
      setScrolled(scrollTop > 10);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll(); // Set initial state

    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Default logo if none provided - linked to home page
  const defaultLogo = (
    <Link
      href="/"
      className="flex items-center justify-center transition-opacity hover:opacity-80"
      aria-label="Go to home page"
    >
      <span className="text-xl font-bold text-white">LOGO</span>
    </Link>
  );

  const renderLogo = logo || defaultLogo;

  // Default left content is the logo
  const finalLeftContent = leftContent || renderLogo;

  // Default right content combines nav links, CTAs, specialty components, and mobile button
  const defaultRightContent = (
    <div className="flex items-center gap-4">
      {/* Desktop Nav Links */}
      {navLinks.length > 0 && (
        <div className="hidden md:flex items-center gap-6">
          {navLinks.map((link, index) => (
            <a
              key={index}
              href={link.href}
              onClick={(event) => handleNavLinkClick(link, event)}
              className="text-gray-300 hover:text-white transition-colors relative group cursor-pointer"
            >
              {link.title}
              <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-gradient-to-r from-[var(--accent-1-m)] to-[var(--accent-2-m)] transition-all duration-300 group-hover:w-full"></span>
            </a>
          ))}
        </div>
      )}

      {/* Desktop CTAs */}
      {ctas.length > 0 && (
        <div className="hidden md:flex items-center gap-2">
          {ctas.map((cta, index) => {
            if (cta.variant === "themed") {
              return (
                <ThemedButton
                  key={index}
                  onClick={cta.onClick}
                  className={`w-auto ${cta.className || ""}`}
                >
                  {cta.title}
                </ThemedButton>
              );
            }

            return (
              <Button
                key={index}
                onClick={cta.onClick}
                variant={cta.variant === "outline" ? "outline" : "default"}
                className={`w-auto hover:bg-gradient-to-r hover:from-[var(--accent-1-m)] hover:to-[var(--accent-2-m)] hover:text-white transition-all duration-300 ${cta.className || ""}`}
              >
                {cta.title}
              </Button>
            );
          })}
        </div>
      )}

      {/* Specialty Components (only render when mounted to prevent hydration issues) */}
      {mounted &&
        specialtyComponents.map((component, index) => (
          <div key={index}>{component}</div>
        ))}

      {/* Mobile Hamburger Button (only on mobile) */}
      {isMobile && (
        <MobileHamburgerButton
          isOpen={mobileMenuOpen}
          onToggle={() => setMobileMenuOpen(!mobileMenuOpen)}
        />
      )}
    </div>
  );

  const finalRightContent = rightContent || defaultRightContent;

  // Simple, clear navbar styling logic
  const isTransparentMode = transparent !== false; // Default true, false only if explicitly set

  const navbarBackground = mobileMenuOpen
    ? "bg-black/90 backdrop-blur-md border-b border-slate-700/50 shadow-lg" // Match mobile menu when open
    : isTransparentMode && !scrolled
      ? "bg-transparent"
      : "bg-black/85 backdrop-blur-md border-b border-slate-700/50 shadow-lg";

  const navbarClasses = `
    w-full transition-all duration-300 ${height}
    ${sticky ? "fixed top-0 z-50" : ""}
    ${navbarBackground}
    ${className}
  `.trim();

  return (
    <nav className={navbarClasses}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full">
        <div className="flex items-center justify-between h-full">
          {/* Left Section */}
          <div className="flex items-center">{finalLeftContent}</div>

          {/* Center Section */}
          <div className="flex items-center">{centerContent}</div>

          {/* Right Section */}
          <div className="flex items-center">{finalRightContent}</div>
        </div>
      </div>

      {/* Mobile Navigation Menu (only the expanded menu, button is handled in rightContent) */}
      <NavbarMobile
        navLinks={navLinks}
        ctas={ctas}
        isOpen={mobileMenuOpen}
        onToggle={() => setMobileMenuOpen(!mobileMenuOpen)}
        onNavLinkClick={onNavLinkClick}
      />

      {/* ID Verification Banner - only show on homepage and when mounted */}
      {/* {mounted && isHomePage && (
        <RequireIDBanner onUpload={() => setShowIDUpload(true)} />
      )} */}

      {/* ID Upload Modal */}
      {/* <IDUploadModal open={showIDUpload} onOpenChange={setShowIDUpload} /> */}
    </nav>
  );
};
