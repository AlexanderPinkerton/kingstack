/**
 * Super Simple API Example
 * 
 * This shows how easy it is to get started with the optimistic store pattern.
 * Just provide your API and data types - everything else is automatic!
 */

import React, { useState } from "react";
import { observer } from "mobx-react-lite";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { EntityAPI, createOptimisticStore } from "../optimistic-store-pattern";

// ---------- Your Data Types ----------
interface Todo {
  id: string;
  title: string;
  done: boolean;
}

// ---------- Your API Implementation ----------
class TodoAPI implements EntityAPI<Todo> {
  private todos: Record<string, Todo> = {
    "1": { id: "1", title: "Learn the pattern", done: false },
    "2": { id: "2", title: "Build something awesome", done: false },
  };

  async list(): Promise<Todo[]> {
    await new Promise(resolve => setTimeout(resolve, 300)); // Simulate network
    console.log('📡 API: Fetching todos');
    return Object.values(this.todos);
  }

  async create(data: Omit<Todo, 'id'>): Promise<Todo> {
    await new Promise(resolve => setTimeout(resolve, 500));
    console.log('📡 API: Creating todo', data);
    
    const id = Math.random().toString(36).slice(2, 9);
    const todo: Todo = { id, ...data };
    this.todos[id] = todo;
    return todo;
  }

  async update(id: string, data: Partial<Todo>): Promise<Todo> {
    await new Promise(resolve => setTimeout(resolve, 400));
    console.log('📡 API: Updating todo', id, data);
    
    const existing = this.todos[id];
    if (!existing) throw new Error('Todo not found');
    
    const updated = { ...existing, ...data };
    this.todos[id] = updated;
    return updated;
  }

  async delete(id: string): Promise<{ id: string }> {
    await new Promise(resolve => setTimeout(resolve, 300));
    console.log('📡 API: Deleting todo', id);
    
    if (!this.todos[id]) throw new Error('Todo not found');
    delete this.todos[id];
    return { id };
  }
}

// ---------- Create Your Optimistic Store (ONE LINE!) ----------
const useTodos = createOptimisticStore({
  name: 'todos',
  api: new TodoAPI(),
});

// ---------- Use It In Your Components ----------
const TodoApp = observer(() => {
  const { store, actions, status } = useTodos();
  const [newTodoTitle, setNewTodoTitle] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTodoTitle.trim()) return;
    
    actions.create({ 
      title: newTodoTitle.trim(), 
      done: false 
    });
    
    setNewTodoTitle('');
  };

  if (status.isLoading) {
    return <div style={{ padding: '20px' }}>Loading...</div>;
  }

  if (status.isError) {
    return (
      <div style={{ padding: '20px', color: 'red' }}>
        Error: {status.error?.message}
        <button onClick={() => actions.refetch()}>Retry</button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', padding: '20px' }}>
      <h1>✨ Super Simple Todos</h1>
      <p>This entire app was created with just one line of configuration!</p>
      
      {status.isSyncing && (
        <div style={{ 
          padding: '8px', 
          background: '#e3f2fd', 
          borderRadius: '4px', 
          marginBottom: '16px' 
        }}>
          🔄 Syncing with server...
        </div>
      )}

      {/* Create form */}
      <form onSubmit={handleSubmit} style={{ 
        display: 'flex', 
        gap: '8px', 
        marginBottom: '24px' 
      }}>
        <input
          type="text"
          placeholder="What needs to be done?"
          value={newTodoTitle}
          onChange={(e) => setNewTodoTitle(e.target.value)}
          style={{
            flex: 1,
            padding: '12px',
            border: '1px solid #ddd',
            borderRadius: '4px',
            fontSize: '16px',
          }}
        />
        <button 
          type="submit" 
          disabled={status.createPending || !newTodoTitle.trim()}
          style={{
            padding: '12px 24px',
            backgroundColor: '#2196f3',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '16px',
          }}
        >
          {status.createPending ? 'Adding...' : 'Add'}
        </button>
      </form>

      {/* Stats */}
      <div style={{ 
        marginBottom: '16px', 
        color: '#666',
        fontSize: '14px' 
      }}>
        {store.count} total, {store.filter(t => !t.done).length} remaining
      </div>

      {/* Todo list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {store.list.map(todo => (
          <div 
            key={todo.id} 
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '12px',
              border: '1px solid #ddd',
              borderRadius: '4px',
              backgroundColor: todo.done ? '#f5f5f5' : 'white',
            }}
          >
            <input
              type="checkbox"
              checked={todo.done}
              onChange={() => actions.update(todo.id, { done: !todo.done })}
              style={{ transform: 'scale(1.2)' }}
            />
            
            <span style={{
              flex: 1,
              textDecoration: todo.done ? 'line-through' : 'none',
              opacity: todo.done ? 0.6 : 1,
            }}>
              {todo.title}
            </span>
            
            <button
              onClick={() => actions.remove(todo.id)}
              disabled={status.deletePending}
              style={{
                padding: '4px 8px',
                backgroundColor: '#f44336',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '12px',
              }}
            >
              Delete
            </button>
          </div>
        ))}
      </div>

      {store.count === 0 && (
        <div style={{
          textAlign: 'center',
          padding: '40px',
          color: '#999',
          fontStyle: 'italic',
        }}>
          No todos yet. Add one above! 👆
        </div>
      )}
    </div>
  );
});

// ---------- App Root ----------
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TodoApp />
    </QueryClientProvider>
  );
}

/*
🎯 THAT'S IT! 

The entire optimistic store setup was just:

```ts
const useTodos = createOptimisticStore({
  name: 'todos',
  api: new TodoAPI(),
});
```

You get:
✅ Optimistic updates
✅ Automatic rollback on errors  
✅ Loading states
✅ Error handling
✅ Background sync
✅ Full type safety
✅ MobX reactivity

No boilerplate, no complex setup, just works! 🚀
*/
