"use client";

import { LoginForm } from "@/components/login-form";
import { Navbar } from "@/components/core/navbar";

export default function Page() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-black to-slate-900 flex flex-col">
      <Navbar />
      <main className="flex-1 flex items-center justify-center px-4 sm:px-6 lg:px-8 pt-16">
        <div className="relative w-full max-w-md mx-auto">
          {/* Glowing animated border */}
          <div className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-cyan-400 via-purple-600 to-pink-500 opacity-60 blur-xl animate-pulse z-0" />
          <div className="relative z-10 rounded-2xl bg-black/80 border border-slate-800 shadow-2xl shadow-purple-500/20 p-8 backdrop-blur-lg">
            <h1 className="text-3xl font-extrabold text-center bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-purple-600 mb-6">
              Welcome Back
            </h1>
            <LoginForm />
          </div>
        </div>
      </main>
    </div>
  );
}
