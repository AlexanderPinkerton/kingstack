// Example showing the simplified transformer API
import { createOptimisticStore, createDefaultTransformer } from '../optimistic-store-pattern';

// Example 1: No transformation needed (API data matches UI data)
const useSimpleTodos = createOptimisticStore({
  name: 'simple-todos',
  queryFn: () => fetch('/api/todos').then(res => res.json()),
  mutations: {
    create: (data) => fetch('/api/todos', { method: 'POST', body: JSON.stringify(data) }).then(res => res.json()),
    update: ({ id, data }) => fetch(`/api/todos/${id}`, { method: 'PUT', body: JSON.stringify(data) }).then(res => res.json()),
    remove: (id) => fetch(`/api/todos/${id}`, { method: 'DELETE' }).then(() => ({ id })),
  },
  transformer: false, // No transformation needed
});

// Example 2: Default transformer (handles snake_case to camelCase automatically)
const useApiTodos = createOptimisticStore({
  name: 'api-todos',
  queryFn: () => fetch('/api/todos').then(res => res.json()),
  mutations: {
    create: (data) => fetch('/api/todos', { method: 'POST', body: JSON.stringify(data) }).then(res => res.json()),
    update: ({ id, data }) => fetch(`/api/todos/${id}`, { method: 'PUT', body: JSON.stringify(data) }).then(res => res.json()),
    remove: (id) => fetch(`/api/todos/${id}`, { method: 'DELETE' }).then(() => ({ id })),
  },
  // transformer: undefined (default) - automatically uses createDefaultTransformer()
});

// Example 3: Custom transformer for complex transformations
const useCustomTodos = createOptimisticStore({
  name: 'custom-todos',
  queryFn: () => fetch('/api/todos').then(res => res.json()),
  mutations: {
    create: (data) => fetch('/api/todos', { method: 'POST', body: JSON.stringify(data) }).then(res => res.json()),
    update: ({ id, data }) => fetch(`/api/todos/${id}`, { method: 'PUT', body: JSON.stringify(data) }).then(res => res.json()),
    remove: (id) => fetch(`/api/todos/${id}`, { method: 'DELETE' }).then(() => ({ id })),
  },
  transformer: {
    toUi: (apiData) => ({
      id: apiData.id,
      title: apiData.task_name,
      done: apiData.completed === 'yes',
      createdAt: new Date(apiData.created_at),
      priority: apiData.priority_level || 'medium',
    }),
    toApi: (uiData) => ({
      id: uiData.id,
      task_name: uiData.title,
      completed: uiData.done ? 'yes' : 'no',
      created_at: uiData.createdAt.toISOString(),
      priority_level: uiData.priority,
    }),
    toApiUpdate: (data) => ({
      task_name: data.title,
      completed: data.done ? 'yes' : 'no',
      priority_level: data.priority,
    }),
  },
});

// Example 4: Full custom transformer for complex transformations
const useComplexTodos = createOptimisticStore({
  name: 'complex-todos',
  queryFn: () => fetch('/api/todos').then(res => res.json()),
  mutations: {
    create: (data) => fetch('/api/todos', { method: 'POST', body: JSON.stringify(data) }).then(res => res.json()),
    update: ({ id, data }) => fetch(`/api/todos/${id}`, { method: 'PUT', body: JSON.stringify(data) }).then(res => res.json()),
    remove: (id) => fetch(`/api/todos/${id}`, { method: 'DELETE' }).then(() => ({ id })),
  },
  transformer: {
    toUi: (apiData) => ({
      id: apiData.id,
      title: apiData.task_name,
      done: apiData.completed === 'yes',
      createdAt: new Date(apiData.created_at),
      priority: apiData.priority_level || 'medium',
    }),
    toApi: (uiData) => ({
      id: uiData.id,
      task_name: uiData.title,
      completed: uiData.done ? 'yes' : 'no',
      created_at: uiData.createdAt.toISOString(),
      priority_level: uiData.priority,
    }),
    toApiUpdate: (data) => ({
      task_name: data.title,
      completed: data.done ? 'yes' : 'no',
      priority_level: data.priority,
    }),
  },
});

export { useSimpleTodos, useApiTodos, useCustomTodos, useComplexTodos };
