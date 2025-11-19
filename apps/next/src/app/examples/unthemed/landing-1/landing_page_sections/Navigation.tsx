"use client";

import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";

export function Navigation() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  type DropdownKey = "Resources" | "Company";

  const navItems = [
    { name: "Features", href: "#features", hasDropdown: false },
    { name: "How it Works", href: "#how-it-works", hasDropdown: false },
    { name: "Pricing", href: "#pricing", hasDropdown: false },
    { name: "Resources" as DropdownKey, href: "#resources", hasDropdown: true },
    { name: "Company" as DropdownKey, href: "#company", hasDropdown: true },
  ];

  const dropdownItems: Record<
    DropdownKey,
    Array<{ name: string; href: string; description: string }>
  > = {
    Resources: [
      {
        name: "Documentation",
        href: "#docs",
        description: "Comprehensive guides and API references",
      },
      {
        name: "Blog",
        href: "#blog",
        description: "Latest insights and product updates",
      },
      {
        name: "Help Center",
        href: "#help",
        description: "Get help and support from our team",
      },
      {
        name: "API Reference",
        href: "#api",
        description: "Complete API documentation and examples",
      },
    ],
    Company: [
      {
        name: "About Us",
        href: "#about",
        description: "Learn more about our mission and team",
      },
      {
        name: "Careers",
        href: "#careers",
        description: "Join our team and build the future",
      },
      {
        name: "Contact",
        href: "#contact",
        description: "Get in touch with our team",
      },
      {
        name: "Press Kit",
        href: "#press",
        description: "Media resources and brand assets",
      },
    ],
  };

  return (
    <>
      <motion.nav
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          isScrolled
            ? "bg-cream-100/95 backdrop-blur-md shadow-lg border-b border-gray-200/50"
            : "bg-cream-100 border-b border-gray-200"
        }`}
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" as const }}
      >
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <motion.div
              className="flex items-center space-x-2"
              whileHover={{ scale: 1.02 }}
              transition={{ duration: 0.2 }}
            >
              <div className="w-8 h-8 bg-red-500 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">A</span>
              </div>
              <span className="text-xl font-bold text-gray-900">AppName</span>
            </motion.div>

            {/* Desktop Navigation */}
            <div className="hidden lg:flex items-center space-x-1">
              {navItems.map((item, index) => (
                <NavItem
                  key={item.name}
                  item={item}
                  dropdownItems={
                    item.name in dropdownItems
                      ? dropdownItems[item.name as DropdownKey]
                      : undefined
                  }
                  delay={index * 0.1}
                />
              ))}
            </div>

            {/* Right side buttons */}
            <div className="flex items-center space-x-4">
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6, delay: 0.8 }}
                className="hidden md:block"
              >
                <Button
                  variant="ghost"
                  className="text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                >
                  Sign In
                </Button>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6, delay: 0.9 }}
              >
                <motion.div
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Button className="bg-gray-900 text-white hover:bg-gray-800 shadow-lg">
                    Try Free
                  </Button>
                </motion.div>
              </motion.div>

              {/* Mobile menu button */}
              <motion.button
                className="lg:hidden p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-colors"
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                whileTap={{ scale: 0.95 }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.6, delay: 1.0 }}
              >
                <motion.div
                  animate={isMobileMenuOpen ? { rotate: 45 } : { rotate: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  {isMobileMenuOpen ? (
                    <svg
                      className="w-6 h-6"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  ) : (
                    <svg
                      className="w-6 h-6"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 6h16M4 12h16M4 18h16"
                      />
                    </svg>
                  )}
                </motion.div>
              </motion.button>
            </div>
          </div>
        </div>
      </motion.nav>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            className="fixed inset-0 z-40 lg:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            {/* Backdrop */}
            <motion.div
              className="absolute inset-0 bg-black/20 backdrop-blur-sm"
              onClick={() => setIsMobileMenuOpen(false)}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            />

            {/* Menu Panel */}
            <motion.div
              className="absolute right-0 top-16 bottom-0 w-80 bg-cream-100 shadow-xl border-l border-gray-200"
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
            >
              <div className="p-6 space-y-6">
                {navItems.map((item, index) => (
                  <motion.div
                    key={item.name}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3, delay: index * 0.1 }}
                  >
                    <a
                      href={item.href}
                      className="block text-lg font-medium text-gray-900 hover:text-gray-600 transition-colors py-2"
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      {item.name}
                    </a>
                    {item.hasDropdown &&
                      item.name in dropdownItems &&
                      dropdownItems[item.name as DropdownKey] && (
                        <div className="ml-4 mt-2 space-y-2">
                          {dropdownItems[item.name as DropdownKey].map(
                            (subItem) => (
                              <a
                                key={subItem.name}
                                href={subItem.href}
                                className="block text-sm text-gray-600 hover:text-gray-900 transition-colors py-1"
                                onClick={() => setIsMobileMenuOpen(false)}
                              >
                                {subItem.name}
                              </a>
                            ),
                          )}
                        </div>
                      )}
                  </motion.div>
                ))}

                <div className="pt-6 border-t border-gray-200 space-y-4">
                  <Button
                    variant="ghost"
                    className="w-full justify-start text-left"
                  >
                    Sign In
                  </Button>
                  <Button className="w-full bg-gray-900 text-white hover:bg-gray-800">
                    Try Free
                  </Button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Spacer for fixed navbar */}
      <div className="h-16" />
    </>
  );
}

interface NavItemProps {
  item: { name: string; href: string; hasDropdown: boolean };
  dropdownItems?: Array<{ name: string; href: string; description: string }>;
  delay: number;
}

function NavItem({ item, dropdownItems, delay }: NavItemProps) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <motion.div
      className="relative"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay }}
    >
      <motion.a
        href={item.href}
        className="flex items-center px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors rounded-lg hover:bg-gray-50"
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
        {item.name}
        {item.hasDropdown && (
          <motion.svg
            className="ml-1 w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            animate={{ rotate: isHovered ? 180 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </motion.svg>
        )}
      </motion.a>

      {/* Dropdown */}
      <AnimatePresence>
        {item.hasDropdown && isHovered && dropdownItems && (
          <motion.div
            className="absolute top-full left-0 mt-2 w-80 bg-cream-100 rounded-xl shadow-lg border border-gray-200 py-2 z-50"
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.2 }}
          >
            {dropdownItems.map((subItem, index) => (
              <motion.a
                key={subItem.name}
                href={subItem.href}
                className="block px-4 py-3 text-left hover:bg-gray-50 transition-colors"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.2, delay: index * 0.05 }}
                whileHover={{ x: 4 }}
              >
                <div className="text-sm font-medium text-gray-900 text-left">
                  {subItem.name}
                </div>
                <div className="text-xs text-gray-600 mt-1 text-left">
                  {subItem.description}
                </div>
              </motion.a>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
