"use client";

import useAuthGuard from "@/hooks/useAuthGuard";
import { observer } from "mobx-react-lite";
import { useState, useEffect } from "react";

import { AnimatedBorderContainer } from "@/components/ui/animated-border-container";
import { NeonCard } from "@/components/ui/neon-card";
import { GradientText } from "@/components/ui/gradient-text";
import { ThemedButton } from "@/components/ui/themed-button";
import { AppNavbar } from "@/components/navbar/presets/app";

import { useContext } from "react";
import { RootStoreContext } from "@/context/rootStoreContext";
import { AdvancedPostsExample } from "@/lib/examples/advanced-posts-example";

export interface TodoApiData {
  id: string;
  title: string;
  done: boolean;
  user_id: string;
  created_at: string;
  updated_at: string;
}

export interface TodoUiData {
  id: string;
  title: string;
  done: boolean;
  user_id: string;
  created_at: Date;
  updated_at: Date;
}

export default observer(function HomePage() {
  useAuthGuard(); // This ensures user is logged in

  const rootStore = useContext(RootStoreContext);

  // Tab state
  const [activeTab, setActiveTab] = useState<"todos" | "posts">("todos");
  
  // Client-side only state to prevent hydration mismatches
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  // Use the optimistic store - dead simple! 🚀
  const todoStore = rootStore.todoStore;
  const { ui, api } = todoStore;

  const [newTodoTitle, setNewTodoTitle] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTodoTitle.trim() || !api) return;

    api.create({
      title: newTodoTitle.trim(),
    });

    setNewTodoTitle("");
  };

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
                {activeTab === "todos" && (
                  <>
                    {/* Show loading state while store is not ready */}
                    {!isClient && (
                      <div className="text-center py-8">
                        <div className="animate-pulse text-slate-300">
                          Initializing your todos...
                        </div>
                      </div>
                    )}

                    {/* Show loading state while store is not ready */}
                    {isClient && !todoStore.isReady && (
                      <div className="text-center py-8">
                        <div className="animate-pulse text-slate-300">
                          Initializing your todos...
                        </div>
                      </div>
                    )}

                    {/* Show loading state when store is ready but data is loading */}
                    {isClient && todoStore.isReady && api?.status.isLoading && (
                      <div className="text-center py-8">
                        <div className="animate-pulse text-slate-300">
                          Loading your todos...
                        </div>
                      </div>
                    )}

                    {/* Show error state when store is ready */}
                    {isClient && todoStore.isReady && api?.status.isError && (
                      <div className="bg-red-900/20 border border-red-500/50 rounded-lg p-4 mb-6">
                        <div className="text-red-300 mb-2">
                          ❌ Error: {api.status.error?.message}
                        </div>
                        <ThemedButton
                          onClick={() => api?.refetch()}
                          className="text-sm px-3 py-1"
                        >
                          Retry
                        </ThemedButton>
                      </div>
                    )}

                    {/* Show main content when store is ready and not loading */}
                    {isClient && todoStore.isReady && !api?.status.isLoading && (
                      <>
                        <div className="text-center mb-6">
                          <h2 className="text-2xl font-bold text-white mb-2">
                            Simple Todo Example
                          </h2>
                          <p className="text-slate-400 text-sm">
                            Basic CRUD with default transformer - just one line
                            of config! 🚀
                          </p>
                        </div>

                        {/* Create form */}
                        <form
                          onSubmit={handleSubmit}
                          className="flex flex-col gap-3 mb-8 max-w-full"
                        >
                          <div className="flex-1 min-w-0 relative">
                            <input
                              id="newTodoTitle"
                              name="newTodoTitle"
                              type="text"
                              placeholder="What needs to be done?"
                              value={newTodoTitle}
                              onChange={(e) => setNewTodoTitle(e.target.value)}
                              className="w-full px-4 py-3 bg-slate-800/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                            />
                            {/* Non-invasive loading indicator */}
                            {api?.status.isSyncing && (
                              <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                                <div className="w-4 h-4 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin"></div>
                              </div>
                            )}
                          </div>
                          <ThemedButton
                            type="submit"
                            disabled={
                              api?.status.createPending || !newTodoTitle.trim()
                            }
                            className="px-6 py-3 whitespace-nowrap flex-shrink-0"
                          >
                            {api?.status.createPending ? "Adding..." : "Add"}
                          </ThemedButton>
                        </form>

                        {/* Stats */}
                        <div className="text-center mb-6 text-slate-400 relative">
                          <span className="text-2xl font-bold text-white">
                            {ui?.count}
                          </span>{" "}
                          total,{" "}
                          <span className="text-xl font-semibold text-purple-300">
                            {ui?.filter((t: TodoUiData) => !t.done).length}
                          </span>{" "}
                          remaining
                          {/* Subtle sync indicator */}
                          {api?.status.isSyncing && (
                            <div className="absolute -right-6 top-1/2 transform -translate-y-1/2">
                              <div className="w-3 h-3 border border-purple-500/40 border-t-purple-500 rounded-full animate-spin"></div>
                            </div>
                          )}
                        </div>

                        {/* Todo list */}
                        <div className="space-y-3">
                          {ui?.list.map((todo: TodoUiData) => (
                            <div
                              key={todo.id}
                              className={`flex items-center gap-4 p-4 rounded-lg border transition-all relative ${
                                todo.done
                                  ? "bg-slate-800/30 border-slate-700/50"
                                  : "bg-slate-800/50 border-slate-600/50 hover:border-purple-500/50"
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={todo.done}
                                onChange={() =>
                                  api?.update(todo.id, {
                                    done: !todo.done,
                                  })
                                }
                                className="w-5 h-5 rounded border-slate-500 bg-slate-700 text-purple-500 focus:ring-purple-500 focus:ring-offset-0 disabled:opacity-50"
                              />

                              <span
                                className={`flex-1 transition-all ${
                                  todo.done
                                    ? "text-slate-500 line-through"
                                    : "text-white"
                                }`}
                              >
                                {todo.title}
                              </span>

                              <button
                                onClick={() => api?.remove(todo.id)}
                                className="px-3 py-1 text-xs bg-red-600/20 text-red-300 border border-red-500/50 rounded hover:bg-red-600/30 transition-colors disabled:opacity-50"
                              >
                                Delete
                              </button>
                            </div>
                          ))}
                        </div>

                        {ui?.count === 0 && !api?.status.isLoading && (
                          <div className="text-center py-12">
                            <div className="text-6xl mb-4">📝</div>
                            <div className="text-slate-400 text-lg">
                              No todos yet. Add one above! 👆
                            </div>
                          </div>
                        )}

                        {/* Pattern info */}
                        <div className="mt-8 pt-6 border-t border-slate-700/50">
                          <div className="text-xs text-slate-500 text-center space-y-1">
                            <div>
                              ✅ Optimistic updates • ✅ Auto rollback on errors
                              • ✅ Background sync
                            </div>
                            <div>
                              ✅ Loading states • ✅ Full type safety • ✅ MobX
                              reactivity
                            </div>
                          </div>
                        </div>
                      </>
                    )}
                  </>
                )}

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
