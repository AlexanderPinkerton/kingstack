"use client";

import React, { useState } from "react";
import { Menu, X } from "lucide-react";
import { NavLink, CTA } from "./types";
import { useIsMobile } from "@/hooks/use-mobile";
import { ThemedButton } from "@/components/ui/themed-button";
import { Button } from "@/components/ui/button";

interface NavbarMobileProps {
  navLinks: NavLink[];
  ctas: CTA[];
  specialtyComponents?: React.ReactNode[];
  isOpen: boolean;
  onToggle: () => void;
  onNavLinkClick?: (tab: string) => void;
}

export const NavbarMobile: React.FC<NavbarMobileProps> = ({
  navLinks,
  ctas,
  specialtyComponents = [],
  isOpen,
  onToggle,
  onNavLinkClick,
}) => {
  const isMobile = useIsMobile();

  // Handle nav link clicks - if onNavLinkClick exists, use it instead of normal navigation
  const handleNavLinkClick = (
    link: NavLink,
    event: React.MouseEvent<HTMLAnchorElement>,
  ) => {
    if (onNavLinkClick) {
      // Custom navigation handler exists - prevent default and call it
      event.preventDefault();
      onNavLinkClick(link.href);
      onToggle(); // Close menu after navigation
    } else if (link.onClick) {
      // Individual link click handler exists
      event.preventDefault();
      link.onClick();
      onToggle(); // Close menu after custom click handler
    }
    // If neither exists, let default navigation happen naturally
  };

  // Only render on mobile
  if (!isMobile) {
    return null;
  }

  return (
    <>
      {/* Mobile Navigation Menu */}
      {isOpen && (
        <div className="md:hidden bg-black/85 backdrop-blur-md border-b border-slate-700/50 animate-in slide-in-from-top duration-300 shadow-lg">
          <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
            {/* Nav Links */}
            {navLinks.map((link, index) => (
              <a
                key={index}
                href={link.href}
                onClick={(event) => handleNavLinkClick(link, event)}
                className="block px-3 py-2 text-base font-medium text-gray-300 hover:text-white hover:bg-gradient-to-r hover:from-[var(--accent-1-m)] hover:to-[var(--accent-2-m)] rounded-md transition-all duration-300"
              >
                {link.title}
              </a>
            ))}

            {/* CTAs */}
            {ctas.length > 0 && (
              <div className="pt-4 pb-2 space-y-2">
                {ctas.map((cta, index) => {
                  if (cta.variant === "themed") {
                    return (
                      <ThemedButton
                        key={index}
                        onClick={() => {
                          cta.onClick();
                          onToggle();
                        }}
                        className={`w-full ${cta.className || ""}`}
                      >
                        {cta.title}
                      </ThemedButton>
                    );
                  }

                  return (
                    <Button
                      key={index}
                      onClick={() => {
                        cta.onClick();
                        onToggle();
                      }}
                      variant={
                        cta.variant === "outline" ? "outline" : "default"
                      }
                      className={`w-full ${cta.className || ""}`}
                    >
                      {cta.title}
                    </Button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};
