// Simple DateTime Example using Transform Helpers
// Shows the easiest way to handle date transformations

import { EntityAPI, OptimisticStore, createEntityController } from "../optimistic-store-pattern";
import { createTransformer, withComputedProperties } from "../transform-helpers";

// ---------- API Types (from server) ----------
interface TodoApiData {
  id: string;
  title: string;
  done: boolean;
  createdAt: string; // ISO string
  updatedAt: string; // ISO string
  dueDate: string | null; // ISO string or null
}

interface CreateTodoApiData {
  title: string;
  dueDate?: string | null;
}

interface UpdateTodoApiData {
  title?: string;
  done?: boolean;
  dueDate?: string | null;
}

// ---------- UI Types (what we want in store) ----------
interface TodoUiData {
  id: string;
  title: string;
  done: boolean;
  createdAt: Date; // Converted to Date
  updatedAt: Date; // Converted to Date
  dueDate: Date | null; // Converted to Date or null
  
  // Computed properties
  isOverdue: boolean;
  timeUntilDue: string;
  formattedDueDate: string;
}

interface CreateTodoUiData {
  title: string;
  dueDate?: Date | null; // UI works with Date objects
}

interface UpdateTodoUiData {
  title?: string;
  done?: boolean;
  dueDate?: Date | null;
}

// ---------- Easy Transformer Setup ----------
const todoTransformer = withComputedProperties(
  createTransformer<TodoApiData, Omit<TodoUiData, 'isOverdue' | 'timeUntilDue' | 'formattedDueDate'>>()
    .dateField('createdAt')
    .dateField('updatedAt')
    .nullableDateField('dueDate')
    .build(),
  (base) => ({
    // Computed properties based on the transformed dates
    isOverdue: base.dueDate ? base.dueDate < new Date() && !base.done : false,
    timeUntilDue: base.dueDate ? formatTimeUntilDue(base.dueDate) : 'No due date',
    formattedDueDate: base.dueDate ? formatDate(base.dueDate) : 'No due date',
  })
);

// Helper functions for computed properties
function formatTimeUntilDue(dueDate: Date): string {
  const now = new Date();
  const diffInMs = dueDate.getTime() - now.getTime();
  
  if (diffInMs < 0) return 'Overdue';
  
  const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
  const diffInDays = Math.floor(diffInHours / 24);
  
  if (diffInDays > 0) return `${diffInDays} days`;
  if (diffInHours > 0) return `${diffInHours} hours`;
  return 'Due soon';
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

// ---------- API Implementation ----------
class TodoAPI implements EntityAPI<TodoApiData, CreateTodoApiData, UpdateTodoApiData> {
  async list(): Promise<TodoApiData[]> {
    // Simulate API response with ISO strings
    return [
      {
        id: '1',
        title: 'Buy groceries',
        done: false,
        createdAt: '2024-01-15T10:00:00Z',
        updatedAt: '2024-01-15T10:00:00Z',
        dueDate: '2024-01-20T18:00:00Z',
      },
      {
        id: '2',
        title: 'Write documentation',
        done: true,
        createdAt: '2024-01-10T09:00:00Z',
        updatedAt: '2024-01-16T14:30:00Z',
        dueDate: null,
      },
    ];
  }

  async create(data: CreateTodoApiData): Promise<TodoApiData> {
    const now = new Date().toISOString();
    return {
      id: Math.random().toString(36).slice(2),
      title: data.title,
      done: false,
      createdAt: now,
      updatedAt: now,
      dueDate: data.dueDate || null,
    };
  }

  async update(id: string, data: UpdateTodoApiData): Promise<TodoApiData> {
    // Simulate API update
    const existing = await this.list().then(todos => todos.find(t => t.id === id));
    if (!existing) throw new Error('Todo not found');

    return {
      ...existing,
      ...data,
      updatedAt: new Date().toISOString(),
    };
  }

  async delete(id: string): Promise<{ id: string }> {
    return { id };
  }
}

// ---------- Enhanced Store with Date-based Features ----------
class TodoUiStore extends OptimisticStore<TodoUiData> {
  get overdueTodos(): TodoUiData[] {
    return this.filter(todo => todo.isOverdue);
  }

  get todosWithDueDates(): TodoUiData[] {
    return this.filter(todo => todo.dueDate !== null);
  }

  get todosDueToday(): TodoUiData[] {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    return this.filter(todo => 
      todo.dueDate && 
      todo.dueDate >= today && 
      todo.dueDate < tomorrow
    );
  }

  get todosDueThisWeek(): TodoUiData[] {
    const now = new Date();
    const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    return this.filter(todo => 
      todo.dueDate && 
      todo.dueDate >= now && 
      todo.dueDate <= weekFromNow
    );
  }

  // Sort by due date
  get byDueDate(): TodoUiData[] {
    return [...this.todosWithDueDates].sort((a, b) => {
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return a.dueDate.getTime() - b.dueDate.getTime();
    });
  }
}

// ---------- Controller Setup ----------
const todoStore = new TodoUiStore();
const todoAPI = new TodoAPI();

export const useTodosWithDates = createEntityController({
  queryKey: ['todos-with-dates'],
  api: todoAPI,
  store: todoStore,
  transformer: todoTransformer,
  customActions: {
    // Set due date
    setDueDate: {
      mutationFn: async ({ id, dueDate }: { id: string; dueDate: Date }) => {
        return todoAPI.update(id, { dueDate: dueDate.toISOString() });
      },
      onOptimistic: ({ id, dueDate }, store: TodoUiStore) => {
        store.update(id, { dueDate });
      },
      onSuccess: (result, params, store: TodoUiStore) => {
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
      onSuccess: (result, id, store: TodoUiStore) => {
        const uiData = todoTransformer.toUi(result);
        store.upsert(uiData);
      },
    },
  },
});

// ---------- Usage Example ----------
/*
import { observer } from "mobx-react-lite";
import { useState } from "react";

const TodosWithDates = observer(() => {
  const { store, actions, status } = useTodosWithDates();
  const [newTodoTitle, setNewTodoTitle] = useState('');
  const [newTodoDueDate, setNewTodoDueDate] = useState<Date | null>(null);

  const createTodo = () => {
    if (!newTodoTitle.trim()) return;
    
    // The transformer handles converting the Date to ISO string for the API
    actions.create({ 
      title: newTodoTitle.trim(),
      dueDate: newTodoDueDate 
    });
    
    setNewTodoTitle('');
    setNewTodoDueDate(null);
  };

  return (
    <div className="todos-app">
      <h1>Todos with Date Transformations</h1>

      {/* Create new todo */}
      <div className="create-todo">
        <input
          type="text"
          placeholder="Todo title"
          value={newTodoTitle}
          onChange={(e) => setNewTodoTitle(e.target.value)}
        />
        <input
          type="datetime-local"
          value={newTodoDueDate?.toISOString().slice(0, 16) || ''}
          onChange={(e) => setNewTodoDueDate(e.target.value ? new Date(e.target.value) : null)}
        />
        <button onClick={createTodo} disabled={status.createPending}>
          Add Todo
        </button>
      </div>

      {/* Summary stats */}
      <div className="todo-stats">
        <div>Total: {store.count}</div>
        <div>Overdue: {store.overdueTodos.length}</div>
        <div>Due Today: {store.todosDueToday.length}</div>
        <div>Due This Week: {store.todosDueThisWeek.length}</div>
      </div>

      {/* Overdue todos (priority) */}
      {store.overdueTodos.length > 0 && (
        <div className="overdue-section">
          <h2>⚠️ Overdue Todos</h2>
          {store.overdueTodos.map(todo => (
            <TodoItem key={todo.id} todo={todo} actions={actions} />
          ))}
        </div>
      )}

      {/* All todos sorted by due date */}
      <div className="all-todos">
        <h2>All Todos</h2>
        {store.byDueDate.map(todo => (
          <TodoItem key={todo.id} todo={todo} actions={actions} />
        ))}
      </div>
    </div>
  );
});

const TodoItem = observer(({ todo, actions }: { todo: TodoUiData; actions: any }) => {
  const [isEditingDate, setIsEditingDate] = useState(false);
  const [newDueDate, setNewDueDate] = useState<Date | null>(todo.dueDate);

  const saveDueDate = () => {
    if (newDueDate) {
      actions.setDueDate({ id: todo.id, dueDate: newDueDate });
    } else {
      actions.clearDueDate(todo.id);
    }
    setIsEditingDate(false);
  };

  return (
    <div className={`todo-item ${todo.done ? 'completed' : ''} ${todo.isOverdue ? 'overdue' : ''}`}>
      <input
        type="checkbox"
        checked={todo.done}
        onChange={() => actions.update(todo.id, { done: !todo.done })}
      />
      
      <div className="todo-content">
        <h3>{todo.title}</h3>
        <div className="todo-meta">
          <span>Created: {todo.createdAt.toLocaleDateString()}</span>
          {todo.dueDate && (
            <span className={todo.isOverdue ? 'overdue-text' : ''}>
              Due: {todo.formattedDueDate} ({todo.timeUntilDue})
            </span>
          )}
        </div>
      </div>

      <div className="todo-actions">
        {isEditingDate ? (
          <div className="date-editor">
            <input
              type="datetime-local"
              value={newDueDate?.toISOString().slice(0, 16) || ''}
              onChange={(e) => setNewDueDate(e.target.value ? new Date(e.target.value) : null)}
            />
            <button onClick={saveDueDate}>Save</button>
            <button onClick={() => setIsEditingDate(false)}>Cancel</button>
          </div>
        ) : (
          <button onClick={() => setIsEditingDate(true)}>
            {todo.dueDate ? 'Edit Due Date' : 'Set Due Date'}
          </button>
        )}
        
        <button onClick={() => actions.remove(todo.id)}>
          Delete
        </button>
      </div>
    </div>
  );
});
*/

export { TodoUiData, CreateTodoUiData, UpdateTodoUiData };
