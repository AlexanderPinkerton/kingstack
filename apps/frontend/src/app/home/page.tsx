"use client";

import useAuthGuard from "@/hooks/useAuthGuard";
import { observer } from "mobx-react-lite";
import { useState } from "react";

import { AnimatedBorderContainer } from "@/components/ui/animated-border-container";
import { NeonCard } from "@/components/ui/neon-card";
import { GradientText } from "@/components/ui/gradient-text";
import { AppNavbar } from "@/components/navbar/presets/app";

import { AdvancedPostsExample } from "@/lib/examples/advanced-posts-example";
import { SimpleTodosExample } from "@/lib/examples/simple-todos-example";


export default observer(function HomePage() {
  useAuthGuard(); // This ensures user is logged in

  // Tab state
  const [activeTab, setActiveTab] = useState<"todos" | "posts">("todos");

  return (
    <>
      <div className="min-h-screen bg-gradient-to-b from-black to-slate-900 text-white flex flex-col">
        <AppNavbar />
        <main className="flex-1 flex items-center justify-center px-4 sm:px-6 lg:px-8 pt-24">
          <div
            className={`w-full mx-auto ${activeTab === "posts" ? "max-w-6xl" : "max-w-2xl"}`}
          >
            <AnimatedBorderContainer>
              <NeonCard className="p-8 flex flex-col">
                <div className="text-center mb-8">
                  <h1 className="text-4xl font-extrabold mb-4">
                    <GradientText>✨ Optimistic Store Pattern</GradientText>
                  </h1>
                  <p className="text-lg text-slate-300">
                    Simple & Advanced Examples
                  </p>
                  <p className="text-sm text-slate-400 mt-2">
                    See the power of our optimistic store pattern in action! 🚀
                  </p>
                </div>

                {/* Tab Navigation */}
                <div className="flex justify-center mb-8">
                  <div className="flex bg-slate-800/50 border border-slate-600/50 rounded-lg p-1">
                    <button
                      onClick={() => setActiveTab("todos")}
                      className={`px-6 py-3 rounded-md font-medium transition-all ${
                        activeTab === "todos"
                          ? "bg-purple-600 text-white shadow-lg"
                          : "text-slate-400 hover:text-white hover:bg-slate-700/50"
                      }`}
                    >
                      Simple Example
                      <div className="text-xs opacity-75 mt-1">
                        Todos with Default Transformer
                      </div>
                    </button>
                    <button
                      onClick={() => setActiveTab("posts")}
                      className={`px-6 py-3 rounded-md font-medium transition-all ${
                        activeTab === "posts"
                          ? "bg-purple-600 text-white shadow-lg"
                          : "text-slate-400 hover:text-white hover:bg-slate-700/50"
                      }`}
                    >
                      Advanced Example
                      <div className="text-xs opacity-75 mt-1">
                        Posts with Custom Store & Transformer
                      </div>
                    </button>
                  </div>
                </div>

                {/* Tab Content */}
                {activeTab === "todos" && <SimpleTodosExample />}

                {activeTab === "posts" && (
                  <>
                    <div className="text-center mb-6">
                      <h2 className="text-2xl font-bold text-white mb-2">
                        Advanced Posts Example
                      </h2>
                      <p className="text-slate-400 text-sm">
                        Custom store, transformer, search, filtering, and rich
                        analytics 🧠
                      </p>
                    </div>
                    <AdvancedPostsExample />
                  </>
                )}
              </NeonCard>
            </AnimatedBorderContainer>
          </div>
        </main>
      </div>
    </>
  );
});
