/**
 * Complete DateTime Transformation Example
 * 
 * A fully functional Todo app demonstrating the entire optimistic store pattern with date transformations.
 * 
 * Features demonstrated:
 * - API data (ISO strings) ↔ UI data (Date objects) transformation
 * - Optimistic updates with automatic rollback on errors
 * - Rich computed properties based on transformed dates
 * - Real-time stats and filtering
 * - Complete CRUD operations with custom actions
 * 
 * To use: Import the default App component and render it in your React app.
 * The mock API simulates realistic network delays and occasional errors.
 */

import React, { useState } from "react";
import { observer } from "mobx-react-lite";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { EntityAPI, OptimisticStore, createEntityController, DataTransformer, OptimisticAction } from "../optimistic-store-pattern";

// ---------- API Types (what comes from server) ----------
export interface TodoApiData {
  id: string;
  title: string;
  done: boolean;
  createdAt: string; // ISO string from API
  dueDate: string | null; // ISO string or null
}

export interface CreateTodoApiData {
  title: string;
  dueDate?: string | null;
}

export interface UpdateTodoApiData {
  title?: string;
  done?: boolean;
  dueDate?: string | null;
}

// ---------- UI Types (what we want in the store) ----------
export interface TodoUiData {
  id: string;
  title: string;
  done: boolean;
  createdAt: Date; // Transformed to Date object
  dueDate: Date | null; // Transformed to Date object or null
  
  // Computed UI properties (not from API)
  isOverdue: boolean;
  timeUntilDue: string;
  formattedDueDate: string;
  daysSinceCreated: number;
}

// ---------- Data Transformer ----------
export class TodoTransformer implements DataTransformer<TodoApiData, TodoUiData> {
  toUi(apiData: TodoApiData): TodoUiData {
    const createdAt = new Date(apiData.createdAt);
    const dueDate = apiData.dueDate ? new Date(apiData.dueDate) : null;

    return {
      id: apiData.id,
      title: apiData.title,
      done: apiData.done,
      createdAt,
      dueDate,
      
      // Computed properties
      isOverdue: dueDate ? dueDate < new Date() && !apiData.done : false,
      timeUntilDue: this.formatTimeUntilDue(dueDate),
      formattedDueDate: this.formatDueDate(dueDate),
      daysSinceCreated: this.getDaysSinceCreated(createdAt),
    };
  }

  toApi(uiData: TodoUiData): TodoApiData {
    return {
      id: uiData.id,
      title: uiData.title,
      done: uiData.done,
      createdAt: uiData.createdAt.toISOString(),
      dueDate: uiData.dueDate?.toISOString() || null,
    };
  }

  toApiUpdate(uiData: Partial<TodoUiData>): Partial<TodoApiData> {
    const apiUpdate: Partial<TodoApiData> = {};
    
    if (uiData.title !== undefined) apiUpdate.title = uiData.title;
    if (uiData.done !== undefined) apiUpdate.done = uiData.done;
    if (uiData.dueDate !== undefined) {
      apiUpdate.dueDate = uiData.dueDate?.toISOString() || null;
    }
    
    return apiUpdate;
  }

  // Helper methods for computed properties
  private formatTimeUntilDue(dueDate: Date | null): string {
    if (!dueDate) return 'No due date';
    
    const now = new Date();
    const diffInMs = dueDate.getTime() - now.getTime();
    
    if (diffInMs < 0) return 'Overdue';
    
    const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
    const diffInDays = Math.floor(diffInHours / 24);
    
    if (diffInDays > 0) return `${diffInDays} day${diffInDays === 1 ? '' : 's'}`;
    if (diffInHours > 0) return `${diffInHours} hour${diffInHours === 1 ? '' : 's'}`;
    return 'Due soon';
  }

  private formatDueDate(dueDate: Date | null): string {
    if (!dueDate) return 'No due date';
    
    return dueDate.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  private getDaysSinceCreated(createdAt: Date): number {
    const now = new Date();
    const diffInMs = now.getTime() - createdAt.getTime();
    return Math.floor(diffInMs / (1000 * 60 * 60 * 24));
  }
}

// ---------- Mock API Implementation ----------
// Simulates a real API with in-memory storage and realistic delays
let FAKE_DB: Record<string, TodoApiData> = {
  "1": {
    id: "1",
    title: "Buy groceries",
    done: false,
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days ago
    dueDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString(), // tomorrow
  },
  "2": {
    id: "2",
    title: "Write documentation",
    done: true,
    createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), // 5 days ago
    dueDate: null,
  },
  "3": {
    id: "3",
    title: "Fix bug in production",
    done: false,
    createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), // yesterday
    dueDate: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago (overdue!)
  },
};

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export class TodoAPI implements EntityAPI<TodoApiData, CreateTodoApiData, UpdateTodoApiData> {
  async list(): Promise<TodoApiData[]> {
    await delay(300); // Simulate network delay
    console.log('📡 API: Fetching todos');
    return Object.values(FAKE_DB);
  }

  async create(data: CreateTodoApiData): Promise<TodoApiData> {
    await delay(500);
    console.log('📡 API: Creating todo', data);
    
    // Simulate occasional server error
    if (Math.random() < 0.1) {
      throw new Error('Server temporarily unavailable');
    }

    const id = Math.random().toString(36).slice(2, 9);
    const todo: TodoApiData = {
      id,
      title: data.title,
      done: false,
      createdAt: new Date().toISOString(),
      dueDate: data.dueDate || null,
    };
    
    FAKE_DB[id] = todo;
    return todo;
  }

  async update(id: string, data: UpdateTodoApiData): Promise<TodoApiData> {
    await delay(400);
    console.log('📡 API: Updating todo', id, data);
    
    const existing = FAKE_DB[id];
    if (!existing) throw new Error('Todo not found');

    const updated = { ...existing, ...data };
    FAKE_DB[id] = updated;
    return updated;
  }

  async delete(id: string): Promise<{ id: string }> {
    await delay(300);
    console.log('📡 API: Deleting todo', id);
    
    if (!FAKE_DB[id]) throw new Error('Todo not found');
    delete FAKE_DB[id];
    return { id };
  }
}

// ---------- Enhanced UI Store ----------
export class TodoUiStore extends OptimisticStore<TodoUiData> {
  // Date-based computed values
  get overdueTodos(): TodoUiData[] {
    return this.filter(todo => todo.isOverdue);
  }

  get completedTodos(): TodoUiData[] {
    return this.filter(todo => todo.done);
  }

  get pendingTodos(): TodoUiData[] {
    return this.filter(todo => !todo.done);
  }

  get todosWithDueDates(): TodoUiData[] {
    return this.filter(todo => todo.dueDate !== null);
  }

  // Sort by different criteria
  get byDueDate(): TodoUiData[] {
    return [...this.todosWithDueDates].sort((a, b) => {
      if (!a.dueDate || !b.dueDate) return 0;
      return a.dueDate.getTime() - b.dueDate.getTime();
    });
  }

  get byNewest(): TodoUiData[] {
    return [...this.list].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  // Priority: overdue first, then by due date
  get byPriority(): TodoUiData[] {
    return [...this.pendingTodos].sort((a, b) => {
      // Overdue todos first
      if (a.isOverdue && !b.isOverdue) return -1;
      if (!a.isOverdue && b.isOverdue) return 1;
      
      // Then by due date
      if (a.dueDate && b.dueDate) {
        return a.dueDate.getTime() - b.dueDate.getTime();
      }
      if (a.dueDate && !b.dueDate) return -1;
      if (!a.dueDate && b.dueDate) return 1;
      
      // Finally by creation date
      return b.createdAt.getTime() - a.createdAt.getTime();
    });
  }

  // Stats
  get stats() {
    return {
      total: this.count,
      completed: this.completedTodos.length,
      pending: this.pendingTodos.length,
      overdue: this.overdueTodos.length,
      withDueDates: this.todosWithDueDates.length,
    };
  }
}

// ---------- Controller Setup ----------
const todoStore = new TodoUiStore();
const todoAPI = new TodoAPI();
const todoTransformer = new TodoTransformer();

// Custom hook that properly types the controller with custom actions
export function useTodos() {
  const controller = createEntityController<TodoApiData, TodoUiData, CreateTodoApiData, UpdateTodoApiData, TodoUiStore>({
    queryKey: ['todos'],
    api: todoAPI,
    store: todoStore,
    transformer: todoTransformer,
    staleTime: 10_000,
    customActions: {
      // Toggle completion status
      toggle: {
        mutationFn: async (id: string) => {
          const todo = todoStore.get(id);
          if (!todo) throw new Error('Todo not found');
          return todoAPI.update(id, { done: !todo.done });
        },
        onOptimistic: (id: string, store: TodoUiStore) => {
          const todo = store.get(id);
          if (todo) {
            store.update(id, { done: !todo.done });
          }
        },
        onSuccess: (result: TodoApiData, id: string, store: TodoUiStore) => {
          const uiData = todoTransformer.toUi(result);
          store.upsert(uiData);
        },
      },

      // Set due date
      setDueDate: {
        mutationFn: async ({ id, dueDate }: { id: string; dueDate: Date }) => {
          return todoAPI.update(id, { dueDate: dueDate.toISOString() });
        },
        onOptimistic: ({ id, dueDate }: { id: string; dueDate: Date }, store: TodoUiStore) => {
          store.update(id, { dueDate });
        },
        onSuccess: (result: TodoApiData, params: { id: string; dueDate: Date }, store: TodoUiStore) => {
          const uiData = todoTransformer.toUi(result);
          store.upsert(uiData);
        },
      },

      // Clear due date
      clearDueDate: {
        mutationFn: async (id: string) => {
          return todoAPI.update(id, { dueDate: null });
        },
        onOptimistic: (id: string, store: TodoUiStore) => {
          store.update(id, { dueDate: null });
        },
        onSuccess: (result: TodoApiData, id: string, store: TodoUiStore) => {
          const uiData = todoTransformer.toUi(result);
          store.upsert(uiData);
        },
      },
    },
  });

  const result = controller();
  
  // Return with properly typed custom actions
  return {
    store: result.store as TodoUiStore,
    actions: {
      ...result.actions,
      toggle: (result.actions as any).toggle as (id: string) => void,
      setDueDate: (result.actions as any).setDueDate as (params: { id: string; dueDate: Date }) => void,
      clearDueDate: (result.actions as any).clearDueDate as (id: string) => void,
    },
    status: {
      ...result.status,
      togglePending: (result.status as any).togglePending as boolean,
      setDueDatePending: (result.status as any).setDueDatePending as boolean,
      clearDueDatePending: (result.status as any).clearDueDatePending as boolean,
    },
  };
}

// ---------- Complete React Components ----------

// Individual Todo Item Component
const TodoItem = observer(({ todo }: { todo: TodoUiData }) => {
  const { actions, status } = useTodos();
  const [isEditingDueDate, setIsEditingDueDate] = useState(false);
  const [newDueDate, setNewDueDate] = useState<string>(
    todo.dueDate?.toISOString().slice(0, 16) || ''
  );

  const handleDueDateSave = () => {
    if (newDueDate) {
      actions.setDueDate({ id: todo.id, dueDate: new Date(newDueDate) });
    } else {
      actions.clearDueDate(todo.id);
    }
    setIsEditingDueDate(false);
  };

  return (
    <div style={{
      padding: '12px',
      border: '1px solid #ddd',
      borderRadius: '8px',
      margin: '8px 0',
      backgroundColor: todo.done ? '#f8f9fa' : todo.isOverdue ? '#fff5f5' : '#fff',
      borderColor: todo.isOverdue ? '#ff6b6b' : '#ddd',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        {/* Checkbox */}
        <input
          type="checkbox"
          checked={todo.done}
          onChange={() => actions.toggle(todo.id)}
          style={{ transform: 'scale(1.2)' }}
        />
        
        {/* Title */}
        <span style={{
          flex: 1,
          textDecoration: todo.done ? 'line-through' : 'none',
          opacity: todo.done ? 0.6 : 1,
          fontWeight: '500',
        }}>
          {todo.title}
        </span>

        {/* Status badges */}
        {todo.isOverdue && (
          <span style={{
            padding: '2px 8px',
            backgroundColor: '#ff6b6b',
            color: 'white',
            borderRadius: '12px',
            fontSize: '12px',
            fontWeight: 'bold',
          }}>
            OVERDUE
          </span>
        )}
        
        {/* Delete button */}
        <button 
          onClick={() => actions.remove(todo.id)}
          disabled={status.deletePending}
          style={{
            background: '#ff6b6b',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            padding: '4px 8px',
            cursor: 'pointer',
          }}
        >
          Delete
        </button>
      </div>

      {/* Meta information */}
      <div style={{ 
        marginTop: '8px', 
        fontSize: '14px', 
        color: '#666',
        display: 'flex',
        gap: '16px',
        flexWrap: 'wrap',
      }}>
        <span>Created {todo.daysSinceCreated} days ago</span>
        <span>Due: {todo.formattedDueDate}</span>
        <span>{todo.timeUntilDue}</span>
      </div>

      {/* Due date editing */}
      <div style={{ marginTop: '8px' }}>
        {isEditingDueDate ? (
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <input
              type="datetime-local"
              value={newDueDate}
              onChange={(e) => setNewDueDate(e.target.value)}
              style={{ padding: '4px', borderRadius: '4px', border: '1px solid #ddd' }}
            />
            <button onClick={handleDueDateSave} style={{ padding: '4px 12px' }}>
              Save
            </button>
            <button onClick={() => setIsEditingDueDate(false)} style={{ padding: '4px 12px' }}>
              Cancel
            </button>
          </div>
        ) : (
          <button 
            onClick={() => setIsEditingDueDate(true)}
            style={{
              background: 'none',
              border: '1px solid #ddd',
              borderRadius: '4px',
              padding: '4px 12px',
              cursor: 'pointer',
              fontSize: '12px',
            }}
          >
            {todo.dueDate ? 'Edit Due Date' : 'Set Due Date'}
          </button>
        )}
      </div>
    </div>
  );
});

// Main Todo App Component
export const TodoApp = observer(() => {
  const { store, actions, status } = useTodos();
  const [newTodoTitle, setNewTodoTitle] = useState('');
  const [newTodoDueDate, setNewTodoDueDate] = useState('');
  const [viewMode, setViewMode] = useState<'all' | 'pending' | 'completed' | 'priority'>('priority');

  const handleCreateTodo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTodoTitle.trim()) return;

    actions.create({
      title: newTodoTitle.trim(),
      dueDate: newTodoDueDate ? newTodoDueDate : null,
    });

    setNewTodoTitle('');
    setNewTodoDueDate('');
  };

  const getDisplayedTodos = () => {
    switch (viewMode) {
      case 'pending': return store.pendingTodos;
      case 'completed': return store.completedTodos;
      case 'priority': return store.byPriority;
      default: return store.byNewest;
    }
  };

  if (status.isLoading) {
    return <div style={{ padding: '20px', textAlign: 'center' }}>Loading todos...</div>;
  }

  if (status.isError) {
    return (
      <div style={{ padding: '20px', textAlign: 'center', color: '#ff6b6b' }}>
        Error: {status.error?.message}
        <br />
        <button onClick={() => actions.refetch()} style={{ marginTop: '8px' }}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '20px' }}>
      <h1 style={{ textAlign: 'center', marginBottom: '30px' }}>
        📝 Todo App with Date Transformations
      </h1>

      {/* Loading indicator */}
      {status.isSyncing && (
        <div style={{
          position: 'fixed',
          top: '10px',
          right: '10px',
          background: '#007bff',
          color: 'white',
          padding: '8px 16px',
          borderRadius: '4px',
          fontSize: '14px',
        }}>
          Syncing...
        </div>
      )}

      {/* Stats */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
        gap: '16px',
        marginBottom: '24px',
      }}>
        <div style={{ textAlign: 'center', padding: '16px', border: '1px solid #ddd', borderRadius: '8px' }}>
          <div style={{ fontSize: '24px', fontWeight: 'bold' }}>{store.stats.total}</div>
          <div style={{ fontSize: '14px', color: '#666' }}>Total</div>
        </div>
        <div style={{ textAlign: 'center', padding: '16px', border: '1px solid #ddd', borderRadius: '8px' }}>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#28a745' }}>{store.stats.completed}</div>
          <div style={{ fontSize: '14px', color: '#666' }}>Completed</div>
        </div>
        <div style={{ textAlign: 'center', padding: '16px', border: '1px solid #ddd', borderRadius: '8px' }}>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#007bff' }}>{store.stats.pending}</div>
          <div style={{ fontSize: '14px', color: '#666' }}>Pending</div>
        </div>
        <div style={{ textAlign: 'center', padding: '16px', border: '1px solid #ddd', borderRadius: '8px' }}>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#ff6b6b' }}>{store.stats.overdue}</div>
          <div style={{ fontSize: '14px', color: '#666' }}>Overdue</div>
        </div>
      </div>

      {/* Create new todo */}
      <form onSubmit={handleCreateTodo} style={{
        display: 'flex',
        gap: '12px',
        marginBottom: '24px',
        padding: '16px',
        border: '1px solid #ddd',
        borderRadius: '8px',
        backgroundColor: '#f8f9fa',
      }}>
        <input
          type="text"
          placeholder="What needs to be done?"
          value={newTodoTitle}
          onChange={(e) => setNewTodoTitle(e.target.value)}
          style={{
            flex: 1,
            padding: '8px 12px',
            border: '1px solid #ddd',
            borderRadius: '4px',
            fontSize: '16px',
          }}
        />
        <input
          type="datetime-local"
          value={newTodoDueDate}
          onChange={(e) => setNewTodoDueDate(e.target.value)}
          style={{
            padding: '8px 12px',
            border: '1px solid #ddd',
            borderRadius: '4px',
          }}
        />
        <button 
          type="submit" 
          disabled={status.createPending || !newTodoTitle.trim()}
          style={{
            padding: '8px 16px',
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontWeight: 'bold',
          }}
        >
          {status.createPending ? 'Adding...' : 'Add Todo'}
        </button>
      </form>

      {/* View mode selector */}
      <div style={{ marginBottom: '16px', display: 'flex', gap: '8px' }}>
        {(['all', 'priority', 'pending', 'completed'] as const).map(mode => (
          <button
            key={mode}
            onClick={() => setViewMode(mode)}
            style={{
              padding: '8px 16px',
              border: '1px solid #ddd',
              borderRadius: '4px',
              backgroundColor: viewMode === mode ? '#007bff' : 'white',
              color: viewMode === mode ? 'white' : 'black',
              cursor: 'pointer',
              textTransform: 'capitalize',
            }}
          >
            {mode}
          </button>
        ))}
      </div>

      {/* Todo list */}
      <div>
        {getDisplayedTodos().length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '40px',
            color: '#666',
            fontStyle: 'italic',
          }}>
            {viewMode === 'completed' ? 'No completed todos yet' : 
             viewMode === 'pending' ? 'No pending todos' :
             'No todos yet. Create one above!'}
          </div>
        ) : (
          getDisplayedTodos().map((todo: TodoUiData) => (
            <TodoItem key={todo.id} todo={todo} />
          ))
        )}
      </div>
    </div>
  );
});

// Root App with QueryClient Provider
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
