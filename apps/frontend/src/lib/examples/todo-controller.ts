// Example: Todo Controller using the generic pattern

import { EntityAPI, OptimisticStore, createEntityController } from "../optimistic-store-pattern";

// ---------- Todo Types ----------
export interface Todo {
  id: string;
  title: string;
  done: boolean;
  createdAt: string;
}

export interface CreateTodoData {
  title: string;
}

export interface UpdateTodoData {
  title?: string;
  done?: boolean;
}

// ---------- Todo API ----------
export class TodoAPI implements EntityAPI<Todo, CreateTodoData, UpdateTodoData> {
  async list(): Promise<Todo[]> {
    const response = await fetch('/api/todos');
    if (!response.ok) throw new Error('Failed to fetch todos');
    return response.json();
  }

  async create(data: CreateTodoData): Promise<Todo> {
    const response = await fetch('/api/todos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error('Failed to create todo');
    return response.json();
  }

  async update(id: string, data: UpdateTodoData): Promise<Todo> {
    const response = await fetch(`/api/todos/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error('Failed to update todo');
    return response.json();
  }

  async delete(id: string): Promise<{ id: string }> {
    const response = await fetch(`/api/todos/${id}`, {
      method: 'DELETE',
    });
    if (!response.ok) throw new Error('Failed to delete todo');
    return { id };
  }
}

// ---------- Enhanced Todo Store ----------
export class TodoStore extends OptimisticStore<Todo> {
  // Domain-specific computed values
  get completed(): Todo[] {
    return this.filter(todo => todo.done);
  }

  get pending(): Todo[] {
    return this.filter(todo => !todo.done);
  }

  get remaining(): number {
    return this.pending.length;
  }

  // Domain-specific operations
  toggleLocal(id: string) {
    const todo = this.get(id);
    if (todo) {
      this.update(id, { done: !todo.done });
    }
  }

  markAllCompleted() {
    this.list.forEach(todo => {
      if (!todo.done) {
        this.update(todo.id, { done: true });
      }
    });
  }

  clearCompleted() {
    this.completed.forEach(todo => {
      this.remove(todo.id);
    });
  }
}

// ---------- Controller Setup ----------
const todoStore = new TodoStore();
const todoAPI = new TodoAPI();

export const useTodosController = createEntityController({
  queryKey: ['todos'],
  api: todoAPI,
  store: todoStore,
  staleTime: 10_000,
  customActions: {
    // Custom toggle action (more ergonomic than update)
    toggle: {
      mutationFn: async (id: string) => {
        const todo = todoStore.get(id);
        if (!todo) throw new Error('Todo not found');
        return todoAPI.update(id, { done: !todo.done });
      },
      onOptimistic: (id: string, store: TodoStore) => {
        store.toggleLocal(id);
      },
      onSuccess: (result, _id, store: TodoStore) => {
        store.upsert(result);
      },
    },
    
    // Bulk operations
    clearCompleted: {
      mutationFn: async () => {
        const completedIds = todoStore.completed.map(t => t.id);
        await Promise.all(completedIds.map(id => todoAPI.delete(id)));
        return { deletedIds: completedIds };
      },
      onOptimistic: (_params, store: TodoStore) => {
        store.clearCompleted();
      },
    },

    markAllCompleted: {
      mutationFn: async () => {
        const pendingTodos = todoStore.pending;
        const updates = await Promise.all(
          pendingTodos.map(todo => todoAPI.update(todo.id, { done: true }))
        );
        return { updated: updates };
      },
      onOptimistic: (_params, store: TodoStore) => {
        store.markAllCompleted();
      },
      onSuccess: (result, _params, store: TodoStore) => {
        result.updated.forEach(todo => store.upsert(todo));
      },
    },
  },
});

// ---------- Usage Example ----------
/*
// In a React component:
import { observer } from "mobx-react-lite";

const TodoList = observer(() => {
  const { store, actions, status } = useTodosController();
  
  return (
    <div>
      <div>Remaining: {store.remaining}</div>
      
      {store.list.map(todo => (
        <div key={todo.id}>
          <input 
            type="checkbox" 
            checked={todo.done}
            onChange={() => actions.toggle(todo.id)}
          />
          <span>{todo.title}</span>
          <button onClick={() => actions.remove(todo.id)}>Delete</button>
        </div>
      ))}
      
      <button 
        onClick={() => actions.clearCompleted()}
        disabled={status.clearCompletedPending}
      >
        Clear Completed
      </button>
      
      <button 
        onClick={() => actions.markAllCompleted()}
        disabled={status.markAllCompletedPending}
      >
        Mark All Complete
      </button>
    </div>
  );
});
*/
