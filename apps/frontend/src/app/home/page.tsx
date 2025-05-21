"use client";

import { useContext, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Navbar } from "@/components/core/navbar";
import { RootStoreContext } from "@/context/rootStoreContext";

export default function HomePage() {
  const rootStore = useContext(RootStoreContext);
  const router = useRouter();

  useEffect(() => {
    // If session is null or undefined, redirect to /login
    if (!rootStore.session || !rootStore.session.data?.session) {
      router.replace("/login");
    }
  }, [rootStore.session, router]);

  // Optionally, show nothing or a loader while checking auth
  if (!rootStore.session || !rootStore.session.data?.session) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-black to-slate-900 text-white flex flex-col">
      <Navbar />
      <main className="flex-1 flex items-center justify-center pt-16">
        {/* Blank landing area - add content here later */}
        <div className="text-center text-2xl opacity-60">
          Welcome to Kingstack Home
        </div>
      </main>
    </div>
  );
}
