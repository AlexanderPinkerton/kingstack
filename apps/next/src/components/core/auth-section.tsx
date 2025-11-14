"use client";

import { useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Shield, Lock, Users, UserCheck } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export function AuthSection() {
  const sectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setTimeout(() => {
              if (entry.target.classList.contains("opacity-0")) {
                entry.target.classList.remove("opacity-0");
                entry.target.classList.add("opacity-100");
                entry.target.classList.add("translate-y-0");
                entry.target.classList.add("transition-all");
                entry.target.classList.add("duration-700");
              }
            }, 100);
          }
        });
      },
      { threshold: 0.1, rootMargin: "0px 0px -100px 0px" },
    );

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }

    return () => {
      if (sectionRef.current) {
        observer.unobserve(sectionRef.current);
      }
    };
  }, []);

  return (
    <section className="py-24 px-4 sm:px-6 lg:px-8">
      <div
        ref={sectionRef}
        className="max-w-7xl mx-auto opacity-0 translate-y-8 transition-all duration-700"
      >
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center mb-4">
            <Shield className="h-12 w-12 text-cyan-400" />
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-purple-600">
              Supabase Authentication System
            </span>
          </h2>
          <p className="text-xl text-gray-300 max-w-3xl mx-auto">
            Built-in authentication with user and admin guards for both frontend
            and backend. Secure, type-safe, and ready to use.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
          {/* User Auth Card */}
          <div
            className={cn(
              "bg-slate-900/50 backdrop-blur-sm border border-slate-800 rounded-xl p-8",
              "hover:border-cyan-500/50 hover:shadow-lg hover:shadow-cyan-500/10 transition-all duration-300",
            )}
          >
            <div className="flex items-center gap-4 mb-4">
              <div className="p-3 bg-cyan-500/20 rounded-lg">
                <Users className="h-6 w-6 text-cyan-400" />
              </div>
              <h3 className="text-2xl font-bold">User Authentication</h3>
            </div>
            <p className="text-gray-400 mb-6">
              Secure user authentication with Supabase. Protected routes, JWT
              validation, and seamless session management.
            </p>
            <ul className="space-y-2 mb-6 text-sm text-gray-300">
              <li className="flex items-center gap-2">
                <Lock className="h-4 w-4 text-cyan-400" />
                <span>JWT-based authentication</span>
              </li>
              <li className="flex items-center gap-2">
                <Lock className="h-4 w-4 text-cyan-400" />
                <span>Frontend & backend guards</span>
              </li>
              <li className="flex items-center gap-2">
                <Lock className="h-4 w-4 text-cyan-400" />
                <span>Type-safe auth utilities</span>
              </li>
            </ul>
            <Link href="/home">
              <Button className="w-full bg-cyan-500/10 border-2 border-cyan-500/50 text-cyan-300 hover:bg-cyan-500/20 hover:border-cyan-400 hover:text-cyan-200 font-semibold">
                Go to User App
              </Button>
            </Link>
          </div>

          {/* Admin Auth Card */}
          <div
            className={cn(
              "bg-slate-900/50 backdrop-blur-sm border border-slate-800 rounded-xl p-8",
              "hover:border-purple-500/50 hover:shadow-lg hover:shadow-purple-500/10 transition-all duration-300",
            )}
          >
            <div className="flex items-center gap-4 mb-4">
              <div className="p-3 bg-purple-500/20 rounded-lg">
                <UserCheck className="h-6 w-6 text-purple-400" />
              </div>
              <h3 className="text-2xl font-bold">Admin Authentication</h3>
            </div>
            <p className="text-gray-400 mb-6">
              Role-based admin access with email-based permissions. Separate
              guards for admin routes in both Next.js and NestJS.
            </p>
            <ul className="space-y-2 mb-6 text-sm text-gray-300">
              <li className="flex items-center gap-2">
                <Lock className="h-4 w-4 text-purple-400" />
                <span>Email-based admin system</span>
              </li>
              <li className="flex items-center gap-2">
                <Lock className="h-4 w-4 text-purple-400" />
                <span>AdminGuard for routes</span>
              </li>
              <li className="flex items-center gap-2">
                <Lock className="h-4 w-4 text-purple-400" />
                <span>useAdminGuard hook</span>
              </li>
            </ul>
            <Link href="/admin/dashboard">
              <Button className="w-full bg-purple-500/10 border-2 border-purple-500/50 text-purple-300 hover:bg-purple-500/20 hover:border-purple-400 hover:text-purple-200 font-semibold">
                Go to Admin Dashboard
              </Button>
            </Link>
          </div>
        </div>

        <div className="bg-slate-900/30 backdrop-blur-sm border border-slate-800 rounded-xl p-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div>
              <h4 className="text-lg font-semibold mb-2">
                Full-Stack Auth Guards
              </h4>
              <p className="text-sm text-gray-400">
                Consistent authentication across Next.js API routes and NestJS
                controllers. Same JWT, same validation, seamless experience.
              </p>
            </div>
            <div className="flex gap-3">
              <code className="px-3 py-1.5 bg-slate-800 rounded text-xs text-cyan-400 border border-slate-700">
                @UseGuards(AdminGuard)
              </code>
              <code className="px-3 py-1.5 bg-slate-800 rounded text-xs text-purple-400 border border-slate-700">
                useAdminGuard()
              </code>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
