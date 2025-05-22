"use client";

import { useState, useEffect, useContext } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Menu, X, LogOut, User, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { RootStoreContext } from "@/context/rootStoreContext";
import { SupabaseClientContext } from "@/context/supabaseClientContext";
import { observer } from "mobx-react-lite";
import { useRouter } from "next/navigation";

export interface NavbarProps {
  navLinks?: { name: string; href: string }[];
  cta?: React.ReactNode;
  showLogin?: boolean;
}

const defaultNavLinks = [
  { name: "Home", href: "#" },
  { name: "Features", href: "#features" },
  { name: "Pricing", href: "#pricing" },
  { name: "About", href: "#about" },
];

export const Navbar = observer(function Navbar({ navLinks = defaultNavLinks, cta, showLogin = true }: NavbarProps) {
  const router = useRouter();
  // Default CTA if not provided
  const defaultCTA = (
    <Button className="bg-gradient-to-r from-cyan-500 to-purple-600 hover:from-cyan-600 hover:to-purple-700 text-white border-0"
    onClick={() => {
      router.push("/login");
    }}>
      Get Started
    </Button>
  );
  const renderCTA = cta === undefined ? defaultCTA : cta;

  const rootStore = useContext(RootStoreContext);
  const supabase = useContext(SupabaseClientContext);
  const session = rootStore.session
  const user = session?.user;

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [mobileDropdownOpen, setMobileDropdownOpen] = useState(false);

  const handleLogin = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin + "/login",
      },
    });
    if (error) {
      console.error("Error signing in:", error);
    }
  };

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error("Error signing out:", error);
    }
    setDropdownOpen(false);
    setMobileDropdownOpen(false);
  };

  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const isMobile = useIsMobile();

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 10);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <nav
      className={cn(
        "fixed top-0 z-50 w-full transition-all duration-300",
        scrolled
          ? "bg-black/80 backdrop-blur-md border-b border-slate-800"
          : "bg-transparent",
      )}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 w-full">
          {/* Logo */}
          <Link href="/" className="flex items-center">
            <span className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-[var(--gradient-from)] to-[var(--gradient-to)]">
              KINGSTACK
            </span>
          </Link>
          {/* Spacer */}
          <div className="flex-1" />
          {/* Desktop nav links + CTA */}
          <div className="hidden md:flex items-center space-x-8">
            {navLinks.map((link) => (
              <Link
                key={link.name}
                href={link.href}
                className="text-gray-300 hover:text-white transition-colors relative group"
              >
                {link.name}
                <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-cyan-400 transition-all duration-300 group-hover:w-full"></span>
              </Link>
            ))}
            {renderCTA}
          </div>
          {/* Desktop auth controls */}
          {showLogin && <div className="hidden md:flex items-center ml-6">
            {session ? (
              <div className="relative">
                <button
                  onClick={() => setDropdownOpen((v) => !v)}
                  className="flex items-center focus:outline-none"
                  aria-label="Open user menu"
                >
                  <Avatar>
                    <AvatarImage src={user?.user_metadata?.avatar_url || undefined} alt={user?.email || "avatar"} />
                    <AvatarFallback>
                      {user?.email?.[0]?.toUpperCase() || <User size={16} />}
                    </AvatarFallback>
                  </Avatar>
                </button>
                {dropdownOpen && (
                  <div className="absolute right-0 mt-2 w-max rounded-xl bg-black/90 shadow-lg border border-slate-800 z-50">
                    <div className="px-4 py-2 text-xs text-slate-400 max-w-xs break-all whitespace-normal truncate" title={user?.email}>{user?.email || "No Email"}</div>
                    <button disabled className="w-full text-left px-4 py-2 text-sm text-slate-300 hover:bg-slate-800 cursor-not-allowed flex items-center gap-2"><User size={16}/> Profile</button>
                    <button onClick={handleLogout} className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-slate-800 flex items-center gap-2"><LogOut size={16}/> Logout</button>
                  </div>
                )}
              </div>
            ) : (
              <Button onClick={handleLogin} className="bg-gradient-to-r from-cyan-500 to-purple-600 hover:from-cyan-600 hover:to-purple-700 text-white border-0">
                Login
              </Button>
            )}
          </div>}
          {/* Mobile menu button */}
          <div className="md:hidden">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-white focus:outline-none"
            >
              {mobileMenuOpen ? (
                <X className="h-6 w-6" aria-hidden="true" />
              ) : (
                <Menu className="h-6 w-6" aria-hidden="true" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {isMobile && mobileMenuOpen && (
        <div className="md:hidden bg-black/95 backdrop-blur-lg border-b border-slate-800 animate-in slide-in-from-top duration-300">
          <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
            {navLinks.map((link) => (
              <Link
                key={link.name}
                href={link.href}
                className="block px-3 py-2 text-base font-medium text-gray-300 hover:text-white"
                onClick={() => setMobileMenuOpen(false)}
              >
                {link.name}
              </Link>
            ))}
            {renderCTA && (
              <div className="pt-2">{renderCTA}</div>
            )}
            {showLogin && <div className="pt-2">
              {session ? (
                <div className="relative">
                  <button
                    onClick={() => setMobileDropdownOpen((v) => !v)}
                    className="flex items-center w-full focus:outline-none px-3 py-2"
                    aria-label="Open user menu"
                  >
                    <Avatar>
                      <AvatarImage src={user?.user_metadata?.avatar_url || undefined} alt={user?.email || "avatar"} />
                      <AvatarFallback>
                        {user?.email?.[0]?.toUpperCase() || <User size={16} />}
                      </AvatarFallback>
                    </Avatar>
                    <span className="ml-2 text-gray-300 flex items-center gap-1">{user?.email || "Account"} <Settings className="inline-block ml-1 text-slate-400" size={16} /></span>
                  </button>
                  {mobileDropdownOpen && (
                    <div className="absolute right-0 mt-2 w-48 rounded-xl bg-black/90 shadow-lg border border-slate-800 z-50">
                      <div className="px-4 py-2 text-xs text-slate-400 max-w-xs break-all whitespace-normal truncate" title={user?.email}>{user?.email || "No Email"}</div>
                      <button disabled className="w-full text-left px-4 py-2 text-sm text-slate-300 hover:bg-slate-800 cursor-not-allowed flex items-center gap-2"><User size={16}/> Profile</button>
                      <button onClick={handleLogout} className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-slate-800 flex items-center gap-2"><LogOut size={16}/> Logout</button>
                    </div>
                  )}
                </div>
              ) : (
                <Button onClick={handleLogin} className="w-full bg-gradient-to-r from-cyan-500 to-purple-600 hover:from-cyan-600 hover:to-purple-700 text-white border-0">
                  Login
                </Button>
              )}
            </div>}
          </div>
        </div>
      )}
    </nav>
  );
});