"use client";

import useAuthGuard from "@/hooks/useAuthGuard";
import { observer } from "mobx-react-lite";
import { useState, useContext, useMemo } from "react";
import { RootStoreContext } from "@/context/rootStoreContext";

import { AnimatedBorderContainer } from "@/components/ui/animated-border-container";
import { NeonCard } from "@/components/ui/neon-card";
import { GradientText } from "@/components/ui/gradient-text";
import { ThemedButton } from "@/components/ui/themed-button";
import { AppNavbar } from "@/components/navbar/presets/app";

import { createEntityController } from "@/lib/optimistic-store-pattern";
import { OptimisticStore } from "@/lib/optimistic-store-pattern";
import { TodoAPI, Todo, CreateTodoDto, UpdateTodoDto } from "@/lib/api/todoAPI";

// Create store instance (stable across renders)
const todoStore = new OptimisticStore<Todo>();

// Create a proper React hook that handles token changes
function useTodos(token?: string) {
  // Memoize the API instance based on the token
  const todoAPI = useMemo(() => {
    // Always create a valid API instance - if no token, we'll disable the query
    return new TodoAPI(token || 'placeholder');
  }, [token]);
  
  const controller = createEntityController<Todo, Todo, CreateTodoDto, UpdateTodoDto>({
    queryKey: ['todos'],
    api: todoAPI,
    store: todoStore,
    staleTime: 5 * 60 * 1000, // 5 minutes
    enabled: !!token, // Only enable the query if we have a valid token
  });

  // Return the result of the controller hook - always call it
  return controller();
}

export default observer(function HomePage() {
  useAuthGuard();
  
  const rootStore = useContext(RootStoreContext);
  const token = rootStore.session?.access_token;
  
  // Always call the hook - it handles token validation internally
  const { store, actions, status } = useTodos(token);
  const [newTodoTitle, setNewTodoTitle] = useState('');

  // Early return if no token - but after all hooks are called
  if (!token) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-black to-slate-900 text-white flex items-center justify-center">
        <div className="text-slate-300">Loading...</div>
      </div>
    );
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTodoTitle.trim()) return;
    
    actions.create({ 
      title: newTodoTitle.trim()
    });
    
    setNewTodoTitle('');
  };

  return (
    <>
      <div className="min-h-screen bg-gradient-to-b from-black to-slate-900 text-white flex flex-col">
        <AppNavbar/>
        <main className="flex-1 flex items-center justify-center px-4 sm:px-6 lg:px-8 pt-24">
          <div className="w-full max-w-2xl mx-auto">
            <AnimatedBorderContainer>
              <NeonCard className="p-8 flex flex-col">
                <div className="text-center mb-8">
                  <h1 className="text-4xl font-extrabold mb-4">
                    <GradientText>✨ Kingstack Todos</GradientText>
                  </h1>
                  <p className="text-lg text-slate-300">
                    Powered by our optimistic store pattern!
                  </p>
                  <p className="text-sm text-slate-400 mt-2">
                    This entire app was created with just one line of configuration 🚀
                  </p>
                </div>

                {status.isLoading && (
                  <div className="text-center py-8">
                    <div className="animate-pulse text-slate-300">Loading your todos...</div>
                  </div>
                )}

                {status.isError && (
                  <div className="bg-red-900/20 border border-red-500/50 rounded-lg p-4 mb-6">
                    <div className="text-red-300 mb-2">
                      ❌ Error: {status.error?.message}
                    </div>
                    <ThemedButton onClick={() => actions.refetch()} className="text-sm px-3 py-1">
                      Retry
                    </ThemedButton>
                  </div>
                )}

                {!status.isLoading && (
                  <>
                    {/* Sync indicator */}
                    {status.isSyncing && (
                      <div className="bg-blue-900/20 border border-blue-500/50 rounded-lg p-3 mb-6">
                        <div className="text-blue-300 text-sm">
                          🔄 Syncing with server...
                        </div>
                      </div>
                    )}

                    {/* Create form */}
                    <form onSubmit={handleSubmit} className="flex gap-3 mb-8">
                      <input
                        type="text"
                        placeholder="What needs to be done?"
                        value={newTodoTitle}
                        onChange={(e) => setNewTodoTitle(e.target.value)}
                        className="flex-1 px-4 py-3 bg-slate-800/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      />
                      <ThemedButton 
                        type="submit" 
                        disabled={status.createPending || !newTodoTitle.trim()}
                        className="px-6"
                      >
                        {status.createPending ? 'Adding...' : 'Add'}
                      </ThemedButton>
                    </form>

                    {/* Stats */}
                    <div className="text-center mb-6 text-slate-400">
                      <span className="text-2xl font-bold text-white">{store.count}</span> total, {' '}
                      <span className="text-xl font-semibold text-purple-300">
                        {store.filter((t: Todo) => !t.done).length}
                      </span> remaining
                    </div>

                    {/* Todo list */}
                    <div className="space-y-3">
                      {store.list.map((todo: Todo) => (
                        <div 
                          key={todo.id} 
                          className={`flex items-center gap-4 p-4 rounded-lg border transition-all ${
                            todo.done 
                              ? 'bg-slate-800/30 border-slate-700/50' 
                              : 'bg-slate-800/50 border-slate-600/50 hover:border-purple-500/50'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={todo.done}
                            onChange={() => actions.update(todo.id, { done: !todo.done })}
                            className="w-5 h-5 rounded border-slate-500 bg-slate-700 text-purple-500 focus:ring-purple-500 focus:ring-offset-0"
                          />
                          
                          <span className={`flex-1 transition-all ${
                            todo.done 
                              ? 'text-slate-500 line-through' 
                              : 'text-white'
                          }`}>
                            {todo.title}
                          </span>
                          
                          <button
                            onClick={() => actions.remove(todo.id)}
                            disabled={status.deletePending}
                            className="px-3 py-1 text-xs bg-red-600/20 text-red-300 border border-red-500/50 rounded hover:bg-red-600/30 transition-colors disabled:opacity-50"
                          >
                            Delete
                          </button>
                        </div>
                      ))}
                    </div>

                    {store.count === 0 && !status.isLoading && (
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
                          ✅ Optimistic updates • ✅ Auto rollback on errors • ✅ Background sync
                        </div>
                        <div>
                          ✅ Loading states • ✅ Full type safety • ✅ MobX reactivity
                        </div>
                      </div>
                    </div>
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
