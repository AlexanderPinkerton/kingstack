"use client";

import useAuthGuard from "@/hooks/useAuthGuard";
import { observer } from "mobx-react-lite";
import { useState } from "react";

import { AnimatedBorderContainer } from "@/components/ui/animated-border-container";
import { NeonCard } from "@/components/ui/neon-card";
import { GradientText } from "@/components/ui/gradient-text";
import { ThemedButton } from "@/components/ui/themed-button";
import { AppNavbar } from "@/components/navbar/presets/app";

import { createOptimisticStore } from "@/lib/optimistic-store-pattern";
import { fetchWithAuth } from "@/lib/utils";
import { useContext } from "react";
import { RootStoreContext } from "@/context/rootStoreContext";
import { DataTransformer } from "@/lib/optimistic-store-pattern";

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

class TodoTransformer implements DataTransformer<TodoApiData, TodoUiData> {
  toUi(apiData: TodoApiData): TodoUiData {
    return {
      ...apiData,
      done: apiData.done,
      created_at: new Date(apiData.created_at),
      updated_at: new Date(apiData.updated_at),
    };
  }
  toApi(uiData: TodoUiData): TodoApiData {
    return {
      ...uiData,
      done: uiData.done,
      created_at: uiData.created_at.toISOString(),
      updated_at: uiData.updated_at.toISOString(),
    };
  }
  toApiUpdate(data: Partial<TodoUiData>): Partial<TodoApiData> {
    return {
      ...data,
      done: data.done,
      created_at: data.created_at?.toISOString(),
      updated_at: data.updated_at?.toISOString(),
    };
  }
}


// Create the optimistic store hook - SUPER SIMPLE! 🚀
function useTodos() {
  const rootStore = useContext(RootStoreContext);
  const token = rootStore.session?.access_token || '';
  
  const baseUrl = process.env.NEXT_PUBLIC_NEST_BACKEND_URL || 'http://localhost:3000';
  
  return createOptimisticStore<TodoApiData, TodoUiData>({
    name: 'todos',
    queryFn: () => fetchWithAuth(token, `${baseUrl}/todos`).then(res => res.json()),
    mutations: {
      create: (data) => fetchWithAuth(token, `${baseUrl}/todos`, {
        method: 'POST',
        body: JSON.stringify(data),
      }).then(res => res.json()),
      
      update: ({ id, data }) => fetchWithAuth(token, `${baseUrl}/todos/${id}`, {
        method: 'PUT', 
        body: JSON.stringify(data),
      }).then(res => res.json()),
      
      remove: (id) => fetchWithAuth(token, `${baseUrl}/todos/${id}`, {
        method: 'DELETE',
      }).then(() => ({ id })),
    },
    transformer: new TodoTransformer(),
    staleTime: 5 * 60 * 1000, // 5 minutes
    enabled: !!token, // Only run when we have a token
  })();
}

export default observer(function HomePage() {
  useAuthGuard(); // This ensures user is logged in
  
  // Use the optimistic store - dead simple! 🚀
  const { store, actions, status } = useTodos();
  const [newTodoTitle, setNewTodoTitle] = useState('');

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

                    {/* Create form */}
                    <form onSubmit={handleSubmit} className="flex flex-col gap-3 mb-8 max-w-full">
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
                        {status.isSyncing && (
                          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                            <div className="w-4 h-4 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin"></div>
                          </div>
                        )}
                      </div>
                      <ThemedButton 
                        type="submit" 
                        disabled={status.createPending || !newTodoTitle.trim()}
                        className="px-6 py-3 whitespace-nowrap flex-shrink-0"
                      >
                        {status.createPending ? 'Adding...' : 'Add'}
                      </ThemedButton>
                    </form>

                    {/* Stats */}
                    <div className="text-center mb-6 text-slate-400 relative">
                      <span className="text-2xl font-bold text-white">{store.count}</span> total, {' '}
                      <span className="text-xl font-semibold text-purple-300">
                        {store.filter((t: TodoUiData) => !t.done).length}
                      </span> remaining
                      {/* Subtle sync indicator */}
                      {status.isSyncing && (
                        <div className="absolute -right-6 top-1/2 transform -translate-y-1/2">
                          <div className="w-3 h-3 border border-purple-500/40 border-t-purple-500 rounded-full animate-spin"></div>
                        </div>
                      )}
                    </div>

                    {/* Todo list */}
                    <div className="space-y-3">
                      {store.list.map((todo: TodoUiData) => (
                        <div 
                          key={todo.id} 
                          className={`flex items-center gap-4 p-4 rounded-lg border transition-all relative ${
                            todo.done 
                              ? 'bg-slate-800/30 border-slate-700/50' 
                              : 'bg-slate-800/50 border-slate-600/50 hover:border-purple-500/50'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={todo.done}
                            onChange={() => actions.update({ id: todo.id, data: { done: !todo.done } })}
                            className="w-5 h-5 rounded border-slate-500 bg-slate-700 text-purple-500 focus:ring-purple-500 focus:ring-offset-0 disabled:opacity-50"
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
