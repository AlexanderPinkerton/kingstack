// Example showing the enhanced createDefaultTransformer with smart type conversions
import { createOptimisticStore, createDefaultTransformer } from '../optimistic-store-pattern';

// Example API data that would come from a typical REST API
const mockApiData = {
  id: "123",
  user_id: "456", 
  task_name: "Complete project",
  is_completed: "true",
  priority_level: "high",
  created_at: "2024-01-15T10:30:00Z",
  updated_at: "2024-01-16T14:45:00Z",
  due_date: "2024-01-20T23:59:59Z",
  tags: "urgent,work,frontend",
  estimated_hours: "8.5",
  is_archived: "false",
  metadata: '{"version": "1.0", "category": "development"}'
};

// Example showing smart type conversions
const useSmartTodos = createOptimisticStore({
  name: 'smart-todos',
  queryFn: () => Promise.resolve([mockApiData]), // Mock API response
  mutations: {
    create: (data) => Promise.resolve(data),
    update: ({ id, data }) => Promise.resolve({ ...data, id }),
    remove: (id) => Promise.resolve({ id }),
  },
  // transformer: undefined (default) - automatically uses createDefaultTransformer()
});

// Example with full custom transformer for complex transformations
const useCustomSmartTodos = createOptimisticStore({
  name: 'custom-smart-todos',
  queryFn: () => Promise.resolve([mockApiData]),
  mutations: {
    create: (data) => Promise.resolve(data),
    update: ({ id, data }) => Promise.resolve({ ...data, id }),
    remove: (id) => Promise.resolve({ id }),
  },
  transformer: {
    toUi: (apiData) => ({
      // Start with smart defaults
      id: apiData.id,
      user_id: apiData.user_id,
      task_name: apiData.task_name,
      is_completed: apiData.is_completed === 'true',
      priority_level: apiData.priority_level,
      created_at: new Date(apiData.created_at),
      updated_at: new Date(apiData.updated_at),
      due_date: new Date(apiData.due_date),
      tags: apiData.tags.split(',').map(item => item.trim()),
      estimated_hours: Number(apiData.estimated_hours),
      is_archived: apiData.is_archived === 'false',
      // Add custom transformations
      metadata: JSON.parse(apiData.metadata),
      isUrgent: apiData.tags.includes('urgent'),
      formattedDueDate: new Date(apiData.due_date).toLocaleDateString(),
    }),
    toApi: (uiData) => ({
      id: uiData.id,
      user_id: uiData.user_id,
      task_name: uiData.task_name,
      is_completed: uiData.is_completed.toString(),
      priority_level: uiData.priority_level,
      created_at: uiData.created_at.toISOString(),
      updated_at: uiData.updated_at.toISOString(),
      due_date: uiData.due_date.toISOString(),
      tags: uiData.tags.join(','),
      estimated_hours: uiData.estimated_hours.toString(),
      is_archived: uiData.is_archived.toString(),
      metadata: JSON.stringify(uiData.metadata),
    }),
  },
});

// Example showing what the transformed data looks like
console.log('Original API data:', mockApiData);

// This would be the transformed UI data:
const transformedData = {
  id: "123",                    // ✅ ID mapping
  user_id: "456",               // ✅ Kept original field name
  task_name: "Complete project", // ✅ Kept original field name
  is_completed: true,           // ✅ "true" string → boolean
  priority_level: "high",       // ✅ Kept original field name
  created_at: new Date("2024-01-15T10:30:00Z"), // ✅ ISO string → Date
  updated_at: new Date("2024-01-16T14:45:00Z"), // ✅ ISO string → Date
  due_date: new Date("2024-01-20T23:59:59Z"),   // ✅ ISO string → Date
  tags: ["urgent", "work", "frontend"],         // ✅ CSV string → array
  estimated_hours: 8.5,         // ✅ "8.5" string → number
  is_archived: false,           // ✅ "false" string → boolean
  metadata: '{"version": "1.0", "category": "development"}' // ✅ Kept as string (no conversion)
};

export { useSmartTodos, useCustomSmartTodos, transformedData };
