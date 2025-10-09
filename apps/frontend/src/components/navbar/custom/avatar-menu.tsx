"use client";

import React, { useContext, useCallback } from "react";
import Link from "next/link";
import { User, LogOut } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { RootStoreContext } from "@/context/rootStoreContext";
import { observer } from "mobx-react-lite";
import { createClient } from "@/lib/supabase/browserClient";
import { isPlaygroundMode } from "@kingstack/shapes";

interface AvatarMenuProps {
  className?: string;
}

export const AvatarMenu = observer(function AvatarMenu({
  className = "",
}: AvatarMenuProps) {
  const rootStore = useContext(RootStoreContext);
  const supabase = createClient();
  const session = rootStore.session;
  const user = session?.user;

  const handleLogout = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error("Error signing out:", error);
    }
  }, [supabase.auth]);

  // Don't render in playground mode
  if (isPlaygroundMode()) {
    return null;
  }

  // Don't render if no user
  if (!user) {
    return (
      <Button
        onClick={() => (window.location.href = "/login")}
        className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white border-0"
      >
        Login
      </Button>
    );
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className={`flex items-center focus:outline-none ${className}`}
          >
            <Avatar>
              <AvatarImage
                src={user?.user_metadata?.avatar_url || undefined}
                alt={user?.email || "avatar"}
              />
              <AvatarFallback>
                {user?.email?.[0]?.toUpperCase() || <User size={16} />}
              </AvatarFallback>
            </Avatar>
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent
          className="w-max rounded-xl bg-black/90 shadow-lg border border-slate-800"
          align="end"
        >
          {/* Profile Section */}
          <div className="px-4 py-3">
            <DropdownMenuLabel className="text-sm font-medium text-slate-300 mb-1">
              Profile
            </DropdownMenuLabel>
            <div className="mb-2">
              <div className="text-sm text-slate-200 font-medium">
                {rootStore.userData?.username || "No username"}
              </div>
              <div
                className="text-xs text-slate-400 max-w-xs break-all whitespace-normal truncate"
                title={user?.email}
              >
                {user?.email}
              </div>
            </div>
            <DropdownMenuItem asChild>
              <Link
                href="/profile"
                className="w-full text-left px-2 py-2 text-sm text-slate-300 hover:bg-slate-800 rounded-md flex items-center gap-2 cursor-pointer"
              >
                <User size={16} /> View Profile
              </Link>
            </DropdownMenuItem>
          </div>

          <DropdownMenuSeparator className="bg-slate-800" />

          {/* Logout Section */}
          <div className="px-4 py-3">
            <DropdownMenuItem
              onClick={handleLogout}
              className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-slate-800 rounded-md flex items-center gap-2 cursor-pointer"
            >
              <LogOut size={16} /> Logout
            </DropdownMenuItem>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
});
