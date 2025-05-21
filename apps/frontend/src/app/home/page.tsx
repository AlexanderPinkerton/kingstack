"use client";

import { useContext, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Navbar } from "@/components/core/navbar";
import { RootStoreContext } from "@/context/rootStoreContext";
import { observer } from "mobx-react-lite";

export default observer(function HomePage() {
  const rootStore = useContext(RootStoreContext);
  const router = useRouter();


  useEffect(() => {

    console.log("Login useEffect", rootStore);

    if (!rootStore.session) {
      console.log("Session not found", rootStore.session);

      router.replace("/login");
    }

  }, [rootStore.session]);


  return (
    <div className="min-h-screen bg-gradient-to-b from-black to-slate-900 text-white flex flex-col">
      <Navbar />
      <main className="flex-1 flex items-center justify-center px-4 sm:px-6 lg:px-8 pt-24">
        <div className="relative w-full max-w-xl mx-auto">
          {/* Glowing animated border */}
          <div className="absolute -inset-1 rounded-3xl bg-gradient-to-r from-cyan-400 via-purple-600 to-pink-500 opacity-60 blur-xl animate-pulse z-0" />
          <div className="relative z-10 rounded-3xl bg-black/80 border border-slate-800 shadow-2xl shadow-purple-500/20 p-12 backdrop-blur-lg flex flex-col items-center">
            <h1 className="text-4xl font-extrabold text-center bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-purple-600 mb-4">
              Welcome to Kingstack
            </h1>
            <p className="text-lg text-slate-300 text-center mb-6">
              You are logged in! Enjoy the futuristic experience.
            </p>
            <span className="text-xs text-slate-500">(This page matches the neon/glassmorphism theme of the core components.)</span>
          </div>
        </div>
      </main>
    </div>
  );
});   
