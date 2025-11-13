"use client";

import React, { useContext, useEffect, useState } from "react";
import { observer } from "mobx-react-lite";
import { RootStoreContext } from "@/context/rootStoreContext";
import { isPlaygroundMode } from "@kingstack/shared";

export const PublicTodos = observer(() => {
  const rootStore = useContext(RootStoreContext);
  const { publicTodoStore } = rootStore;
  const [isClient, setIsClient] = useState(false);
  const [newTodoTitle, setNewTodoTitle] = useState("");

  // Prevent hydration mismatch by only rendering after client mount
  useEffect(() => {
    setIsClient(true);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTodoTitle.trim() || !publicTodoStore.api) return;

    publicTodoStore.api.create({
      title: newTodoTitle.trim(),
    });

    setNewTodoTitle("");
  };

  // Show loading state during hydration
  if (!isClient || publicTodoStore.isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-lg">Loading todos...</div>
      </div>
    );
  }

  if (publicTodoStore.isError) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-lg text-red-500">
          Error loading todos: {publicTodoStore.error?.message}
        </div>
      </div>
    );
  }

  const { ui, api } = publicTodoStore;
  const remainingCount = ui?.filter((t) => !t.done).length || 0;

  return (
    <div className="p-8 bg-gradient-to-br from-slate-800/60 to-slate-900/60 backdrop-blur-sm rounded-2xl border border-slate-600 shadow-2xl">
      {/* Header Section */}
      <div className="text-center mb-8">
        <div
          className={`inline-flex items-center px-4 py-2 rounded-full text-sm font-medium mb-4 ${
            isClient && isPlaygroundMode()
              ? "bg-yellow-500/20 border border-yellow-500/30 text-yellow-400"
              : "bg-emerald-500/20 border border-emerald-500/30 text-emerald-400"
          }`}
        >
          <div
            className={`w-2 h-2 rounded-full animate-pulse mr-2 ${
              isClient && isPlaygroundMode()
                ? "bg-yellow-400"
                : "bg-emerald-400"
            }`}
          />
          {isClient && isPlaygroundMode() ? "Mock Demo" : "Live Demo"}
        </div>
        <h2 className="text-4xl font-bold mb-4 bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">
          Optimistic Todo Store
        </h2>
        {isClient && isPlaygroundMode() && (
          <p className="text-yellow-200 text-sm mb-4">
            Playground mode is active. Enable Supabase for a full experience.
          </p>
        )}
        <p className="text-slate-300 text-lg max-w-2xl mx-auto leading-relaxed">
          Experience instant UI updates with automatic rollback on errors. Try
          adding, completing, or deleting todos to see the optimistic store in
          action!
        </p>
      </div>

      {/* Feature Highlights */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="flex items-center space-x-3 p-4 bg-slate-700/30 rounded-lg border border-slate-600">
          <div className="w-8 h-8 bg-blue-500/20 rounded-lg flex items-center justify-center">
            <svg
              className="w-4 h-4 text-blue-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 10V3L4 14h7v7l9-11h-7z"
              />
            </svg>
          </div>
          <div>
            <div className="text-white font-semibold">Instant Updates</div>
            <div className="text-slate-400 text-sm">
              UI responds immediately
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-3 p-4 bg-slate-700/30 rounded-lg border border-slate-600">
          <div className="w-8 h-8 bg-emerald-500/20 rounded-lg flex items-center justify-center">
            <svg
              className="w-4 h-4 text-emerald-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
          </div>
          <div>
            <div className="text-white font-semibold">Auto Rollback</div>
            <div className="text-slate-400 text-sm">
              Failed operations revert
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-3 p-4 bg-slate-700/30 rounded-lg border border-slate-600">
          <div className="w-8 h-8 bg-purple-500/20 rounded-lg flex items-center justify-center">
            <svg
              className="w-4 h-4 text-purple-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <div>
            <div className="text-white font-semibold">Type Safe</div>
            <div className="text-slate-400 text-sm">
              Full TypeScript support
            </div>
          </div>
        </div>
      </div>

      {/* Todo Form */}
      <div className="mb-6">
        <form onSubmit={handleSubmit} className="flex gap-3">
          <input
            type="text"
            placeholder="What needs to be done?"
            value={newTodoTitle}
            onChange={(e) => setNewTodoTitle(e.target.value)}
            className="flex-1 px-4 py-3 bg-slate-800/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
          <button
            type="submit"
            disabled={publicTodoStore.createPending || !newTodoTitle.trim()}
            className="px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:from-purple-700 hover:to-blue-700 transition-all duration-200 font-semibold shadow-lg hover:shadow-xl transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
          >
            {publicTodoStore.createPending ? "Adding..." : "Add Todo"}
          </button>
        </form>
      </div>

      {/* Stats */}
      <div className="text-center mb-6 text-slate-400">
        <span className="text-2xl font-bold text-white">{ui?.count || 0}</span>{" "}
        total,{" "}
        <span className="text-xl font-semibold text-purple-300">
          {remainingCount}
        </span>{" "}
        remaining
        {(publicTodoStore.updatePending ||
          publicTodoStore.createPending ||
          publicTodoStore.deletePending) && (
          <span className="ml-2 text-blue-400">• Syncing...</span>
        )}
      </div>

      {/* Todo List */}
      <div className="space-y-3 max-h-96 overflow-y-auto">
        {ui?.list.map((todo) => (
          <div
            key={todo.id}
            className={`flex items-center gap-4 p-4 rounded-lg border transition-all ${
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
                todo.done ? "text-slate-500 line-through" : "text-white"
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

      {ui?.count === 0 && !publicTodoStore.isLoading && (
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
            ✅ Optimistic updates • ✅ Auto rollback on errors • ✅ Background
            sync
          </div>
          <div>
            ✅ Loading states • ✅ Full type safety • ✅ MobX reactivity
          </div>
        </div>
      </div>
    </div>
  );
});
