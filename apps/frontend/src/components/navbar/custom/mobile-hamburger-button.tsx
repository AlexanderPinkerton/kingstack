"use client";

import React from "react";
import { Menu, X } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";

interface MobileHamburgerButtonProps {
  isOpen: boolean;
  onToggle: () => void;
  specialtyComponents?: React.ReactNode[];
}

export const MobileHamburgerButton: React.FC<MobileHamburgerButtonProps> = ({
  isOpen,
  onToggle,
  specialtyComponents = [],
}) => {
  const isMobile = useIsMobile();

  // Only render on mobile
  if (!isMobile) {
    return null;
  }

  return (
    <div className="md:hidden flex items-center gap-2">
      {/* Specialty Components (shown in navbar) */}
      {specialtyComponents.map((component, index) => (
        <div key={index}>{component}</div>
      ))}

      {/* Hamburger/X Button */}
      <button
        onClick={onToggle}
        className="inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-white hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white"
        aria-label={isOpen ? "Close menu" : "Open menu"}
      >
        {isOpen ? (
          <X className="h-6 w-6" aria-hidden="true" />
        ) : (
          <Menu className="h-6 w-6" aria-hidden="true" />
        )}
      </button>
    </div>
  );
};
