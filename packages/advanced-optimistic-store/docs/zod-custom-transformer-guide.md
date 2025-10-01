# Using Zod with Custom Transformers

This guide shows how to create custom transformers using Zod for type-safe data validation and transformation in the `@kingstack/advanced-optimistic-store`.

## Why Use Zod?

While the built-in `createDefaultTransformer` provides smart heuristics for common data conversions, Zod offers:

- **Type Safety**: Compile-time type checking for both API and UI data
- **Validation**: Catch malformed data early with detailed error messages
- **Explicit Schemas**: Clear, declarative data contracts
- **Rich Ecosystem**: Extensive validation rules and transformations

## Installation

First, install Zod in your project:

```bash
yarn add zod
# or
npm install zod
```

## Basic Zod Transformer

Here's a simple example of creating a Zod-based transformer:

```typescript
import { z } from 'zod';
import type { DataTransformer } from '@kingstack/advanced-optimistic-store';

// Define your API and UI schemas
const TodoApiSchema = z.object({
  id: z.string(),
  title: z.string(),
  done: z.string(), // API sends boolean as string
  created_at: z.string(), // ISO date string
  updated_at: z.string(),
  user_id: z.string(),
});

const TodoUiSchema = z.object({
  id: z.string(),
  title: z.string(),
  done: z.boolean(), // UI uses actual boolean
  created_at: z.date(), // JavaScript Date object
  updated_at: z.date(),
  user_id: z.string(),
  isNew: z.boolean(), // Computed property
  daysOld: z.number(), // Computed property
});

// Create codecs for bidirectional transformations
const todoCodecs = {
  done: z.codec(z.string(), z.boolean(), {
    decode: (str) => str === 'true',
    encode: (bool) => bool.toString(),
  }),
  created_at: z.codec(z.string(), z.date(), {
    decode: (str) => new Date(str),
    encode: (date) => date.toISOString(),
  }),
  updated_at: z.codec(z.string(), z.date(), {
    decode: (str) => new Date(str),
    encode: (date) => date.toISOString(),
  }),
};

// Helper function to apply codecs
function transformWithCodecs<T>(
  data: any,
  codecs: Record<string, z.ZodCodec<any, any>>,
  direction: 'decode' | 'encode'
): T {
  const result = { ...data };
  
  for (const [field, codec] of Object.entries(codecs)) {
    if (field in result) {
      try {
        if (direction === 'decode') {
          result[field] = codec.decode(result[field]);
        } else {
          result[field] = codec.encode(result[field]);
        }
      } catch (error) {
        console.warn(`Failed to transform field ${field}:`, error);
        // Keep original value on transformation error
      }
    }
  }
  
  return result;
}

// Create the Zod transformer
export function createZodTransformer<TApiData, TUiData>(
  apiSchema: z.ZodType<TApiData>,
  uiSchema: z.ZodType<TUiData>,
  codecs: Record<string, z.ZodCodec<any, any>>,
  computedFields?: {
    toUi: (data: TApiData) => Partial<TUiData>;
    toApi: (data: TUiData) => Partial<TApiData>;
  }
): DataTransformer<TApiData, TUiData> {
  return {
    toUi: (apiData) => {
      // Validate API data
      const validatedApiData = apiSchema.parse(apiData);
      
      // Apply codec transformations
      const transformed = transformWithCodecs(validatedApiData, codecs, 'decode');
      
      // Add computed fields
      const computed = computedFields?.toUi(validatedApiData) || {};
      
      return { ...transformed, ...computed } as TUiData;
    },
    
    toApi: (uiData) => {
      // Validate UI data
      const validatedUiData = uiSchema.parse(uiData);
      
      // Apply codec transformations (reverse direction)
      const transformed = transformWithCodecs(validatedUiData, codecs, 'encode');
      
      // Remove computed fields for API
      const { isNew, daysOld, ...apiData } = transformed as any;
      
      return apiData as TApiData;
    },
  };
}
```

## Usage in Your Store

Now you can use the Zod transformer in your optimistic store:

```typescript
import { createOptimisticStore } from '@kingstack/advanced-optimistic-store';
import { createZodTransformer, TodoApiSchema, TodoUiSchema, todoCodecs } from './todo-transformer';

const todoStore = createOptimisticStore({
  name: "todos",
  queryFn: () => fetch("/api/todos").then(r => r.json()),
  mutations: {
    create: (data) => fetch("/api/todos", { 
      method: "POST", 
      body: JSON.stringify(data) 
    }).then(r => r.json()),
    update: (params) => fetch(`/api/todos/${params.id}`, { 
      method: "PUT", 
      body: JSON.stringify(params.data) 
    }).then(r => r.json()),
    remove: (id) => fetch(`/api/todos/${id}`, { 
      method: "DELETE" 
    }).then(() => ({ id })),
  },
  transformer: createZodTransformer(
    TodoApiSchema,
    TodoUiSchema,
    todoCodecs,
    {
      toUi: (apiData) => ({
        isNew: (Date.now() - new Date(apiData.created_at).getTime()) < 7 * 24 * 60 * 60 * 1000,
        daysOld: Math.floor((Date.now() - new Date(apiData.created_at).getTime()) / (1000 * 60 * 60 * 24)),
      }),
      toApi: (uiData) => ({
        // No computed fields needed for API
      }),
    }
  ),
});
```

## Advanced Examples

### Complex Nested Data

```typescript
const UserApiSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email(),
  profile: z.object({
    avatar: z.string().url().optional(),
    bio: z.string().optional(),
    settings: z.object({
      theme: z.enum(['light', 'dark']),
      notifications: z.boolean(),
    }),
  }),
  created_at: z.string(),
  last_login: z.string().optional(),
});

const UserUiSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email(),
  profile: z.object({
    avatar: z.string().url().optional(),
    bio: z.string().optional(),
    settings: z.object({
      theme: z.enum(['light', 'dark']),
      notifications: z.boolean(),
    }),
  }),
  created_at: z.date(),
  last_login: z.date().optional(),
  displayName: z.string(), // Computed
  isOnline: z.boolean(), // Computed
});

const userCodecs = {
  created_at: z.codec(z.string(), z.date(), {
    decode: (str) => new Date(str),
    encode: (date) => date.toISOString(),
  }),
  last_login: z.codec(z.string(), z.date(), {
    decode: (str) => new Date(str),
    encode: (date) => date.toISOString(),
  }),
  'profile.settings.notifications': z.codec(z.string(), z.boolean(), {
    decode: (str) => str === 'true',
    encode: (bool) => bool.toString(),
  }),
};

// Custom transformation for nested fields
function transformNestedWithCodecs<T>(
  data: any,
  codecs: Record<string, z.ZodCodec<any, any>>,
  direction: 'decode' | 'encode'
): T {
  const result = { ...data };
  
  for (const [fieldPath, codec] of Object.entries(codecs)) {
    const value = getNestedValue(result, fieldPath);
    if (value !== undefined) {
      try {
        const transformed = direction === 'decode' 
          ? codec.decode(value) 
          : codec.encode(value);
        setNestedValue(result, fieldPath, transformed);
      } catch (error) {
        console.warn(`Failed to transform nested field ${fieldPath}:`, error);
      }
    }
  }
  
  return result;
}

function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((current, key) => current?.[key], obj);
}

function setNestedValue(obj: any, path: string, value: any): void {
  const keys = path.split('.');
  const lastKey = keys.pop()!;
  const target = keys.reduce((current, key) => {
    if (!(key in current)) current[key] = {};
    return current[key];
  }, obj);
  target[lastKey] = value;
}
```

### Array Transformations

```typescript
const TodoListApiSchema = z.object({
  todos: z.array(TodoApiSchema),
  pagination: z.object({
    page: z.number(),
    limit: z.number(),
    total: z.number(),
  }),
});

const TodoListUiSchema = z.object({
  todos: z.array(TodoUiSchema),
  pagination: z.object({
    page: z.number(),
    limit: z.number(),
    total: z.number(),
  }),
  completedCount: z.number(), // Computed
  completionRate: z.number(), // Computed
});

const todoListCodecs = {
  'pagination.page': z.codec(z.string(), z.number(), {
    decode: (str) => parseInt(str, 10),
    encode: (num) => num.toString(),
  }),
  'pagination.limit': z.codec(z.string(), z.number(), {
    decode: (str) => parseInt(str, 10),
    encode: (num) => num.toString(),
  }),
  'pagination.total': z.codec(z.string(), z.number(), {
    decode: (str) => parseInt(str, 10),
    encode: (num) => num.toString(),
  }),
};
```

## Error Handling

Zod provides detailed error information that you can use for better debugging:

```typescript
import { ZodError } from 'zod';

export function createZodTransformerWithErrorHandling<TApiData, TUiData>(
  apiSchema: z.ZodType<TApiData>,
  uiSchema: z.ZodType<TUiData>,
  codecs: Record<string, z.ZodCodec<any, any>>
): DataTransformer<TApiData, TUiData> {
  return {
    toUi: (apiData) => {
      try {
        const validatedApiData = apiSchema.parse(apiData);
        return transformWithCodecs(validatedApiData, codecs, 'decode') as TUiData;
      } catch (error) {
        if (error instanceof ZodError) {
          console.error('API data validation failed:', error.issues);
          // You could throw a custom error or return a default value
          throw new Error(`Invalid API data: ${error.issues.map(i => i.message).join(', ')}`);
        }
        throw error;
      }
    },
    
    toApi: (uiData) => {
      try {
        const validatedUiData = uiSchema.parse(uiData);
        return transformWithCodecs(validatedUiData, codecs, 'encode') as TApiData;
      } catch (error) {
        if (error instanceof ZodError) {
          console.error('UI data validation failed:', error.issues);
          throw new Error(`Invalid UI data: ${error.issues.map(i => i.message).join(', ')}`);
        }
        throw error;
      }
    },
  };
}
```

## Performance Considerations

For large datasets, consider these optimizations:

1. **Lazy Validation**: Only validate when data changes
2. **Memoization**: Cache transformed results
3. **Selective Validation**: Only validate fields that actually changed

```typescript
import { memoize } from 'lodash';

const memoizedTransformer = memoize(
  (data: any) => transformWithCodecs(data, codecs, 'decode'),
  (data) => JSON.stringify(data) // Simple cache key
);
```

## Migration from Default Transformer

If you're migrating from `createDefaultTransformer`, you can gradually replace the heuristic-based transformations:

```typescript
// Old way
const oldTransformer = createDefaultTransformer<TodoApiData, TodoUiData>();

// New way - start with basic schema, add validation gradually
const newTransformer = createZodTransformer(
  z.object({
    id: z.string(),
    title: z.string(),
    // Add more fields as you need validation
  }),
  z.object({
    id: z.string(),
    title: z.string(),
    // Add more fields as you need validation
  }),
  {
    // Add codecs for fields that need transformation
  }
);
```

## Best Practices

1. **Start Simple**: Begin with basic schemas and add complexity gradually
2. **Use TypeScript**: Leverage Zod's type inference for better DX
3. **Handle Errors Gracefully**: Don't let validation errors break your app
4. **Test Your Transformers**: Write unit tests for both directions
5. **Document Your Schemas**: Use Zod's built-in documentation features

```typescript
const TodoApiSchema = z.object({
  id: z.string().describe('Unique identifier for the todo'),
  title: z.string().min(1).describe('The todo title'),
  done: z.string().describe('Completion status as string'),
  created_at: z.string().datetime().describe('ISO date string when created'),
});
```

This approach gives you the flexibility to use Zod where you need it while keeping the core library lightweight and focused on its primary purpose.
