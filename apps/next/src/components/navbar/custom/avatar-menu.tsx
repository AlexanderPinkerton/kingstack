"use client";

import React, { useCallback } from "react";
import Link from "next/link";
import { LogIn, LogOut, User } from "lucide-react";
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
import { useRootStore } from "@/hooks/useRootStore";
import { observer } from "mobx-react-lite";
import { browserLogger } from "@/lib/browser-logger";

const logger = browserLogger.child({ component: "AvatarMenu" });

interface AvatarMenuProps {
  className?: string;
}

export const AvatarMenu = observer(function AvatarMenu({
  className = "",
}: AvatarMenuProps) {
  const rootStore = useRootStore();
  const session = rootStore.session;
  const user = session?.user;

  const handleLogout = useCallback(async () => {
    try {
      await rootStore.signOut();
    } catch (error) {
      logger.error("auth.sign_out_failed", { error });
    }
  }, [rootStore]);

  // Don't render if no user
  if (!user) {
    return (
      <Button
        asChild
        className="border-0 bg-[#d8ff70] text-[#11130d] hover:bg-[#e3ff98]"
      >
        <Link href="/login">Login</Link>
      </Button>
    );
  }

  if (rootStore.isGuest) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            className="border-white/15 bg-white/[0.05] text-white hover:bg-white/10 hover:text-white"
          >
            <User aria-hidden="true" />
            Guest
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          className="w-56 rounded-xl border border-slate-800 bg-black/90 shadow-lg"
          align="end"
        >
          <DropdownMenuLabel className="px-4 py-3">
            <span className="block text-sm font-medium text-slate-200">
              Guest session
            </span>
            <span className="mt-1 block text-xs font-normal text-slate-400">
              Temporary realtime demo access
            </span>
          </DropdownMenuLabel>
          <DropdownMenuSeparator className="bg-slate-800" />
          <DropdownMenuItem asChild>
            <Link
              href="/login"
              className="mx-2 flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-sm text-slate-200 hover:bg-slate-800"
            >
              <LogIn aria-hidden="true" />
              Log in or register
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => void handleLogout()}
            className="mx-2 flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-sm text-red-400 hover:bg-slate-800"
          >
            <LogOut aria-hidden="true" />
            Log out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
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
              onClick={() => void handleLogout()}
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
