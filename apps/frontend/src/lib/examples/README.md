# Generic Optimistic Store Pattern Examples

This directory demonstrates how to use the generic optimistic store pattern with different entity types and use cases.

## Pattern Overview

The generic pattern provides:
- **Framework-agnostic stores** with MobX reactivity
- **Optimistic updates** with automatic rollback on failure
- **TanStack Query integration** for caching and background sync
- **Type safety** throughout the entire flow
- **Extensible actions** for domain-specific operations

## Core Components

### 1. `OptimisticStore<T>`
Generic store that works with any entity type implementing the `Entity` interface:
```typescript
interface Entity {
  id: string;
}
```

### 2. `EntityAPI<T, TCreate, TUpdate>`
Interface that your API layer should implement for standard CRUD operations.

### 3. `createEntityController(config)`
Factory function that creates a React hook with:
- Store instance
- Standard CRUD actions
- Custom domain-specific actions
- Consolidated loading/error states

## Examples

### Simple Todo App (`todo-controller.ts`)
- Basic CRUD operations
- Custom toggle action
- Bulk operations (clear completed, mark all done)
- Domain-specific computed values (remaining count)

### Advanced Post System (`post-controller.ts`)
- Complex filtering and sorting
- Search functionality
- Like/unlike with optimistic updates
- Tag management with batch operations
- Analytics and metrics

### User Management (`user-controller.ts`)
- Relationship management (follow/unfollow)
- Role-based permissions
- Current user vs. user directory separation
- Read-only controllers for specific queries
- Advanced search and filtering

## Usage Patterns

### Basic Setup
```typescript
// 1. Define your entity type
interface MyEntity extends Entity {
  name: string;
  // ... other fields
}

// 2. Create API implementation
class MyAPI implements EntityAPI<MyEntity> {
  // implement list, create, update, delete
}

// 3. Create controller
const useMyController = createEntityController({
  queryKey: ['my-entities'],
  api: new MyAPI(),
  store: new OptimisticStore<MyEntity>(),
});

// 4. Use in components
const MyComponent = observer(() => {
  const { store, actions, status } = useMyController();
  // ... render logic
});
```

### Extended Store with Domain Logic
```typescript
class MyStore extends OptimisticStore<MyEntity> {
  // Add computed values
  get activeItems() {
    return this.filter(item => item.isActive);
  }

  // Add domain-specific operations
  toggleActiveLocal(id: string) {
    const item = this.get(id);
    if (item) {
      this.update(id, { isActive: !item.isActive });
    }
  }
}
```

### Custom Actions
```typescript
const useMyController = createEntityController({
  // ... basic config
  customActions: {
    toggleActive: {
      mutationFn: (id: string) => api.toggleActive(id),
      onOptimistic: (id, store: MyStore) => {
        store.toggleActiveLocal(id);
      },
      onSuccess: (result, id, store) => {
        store.upsert(result);
      },
    },
  },
});
```

### Read-Only Controllers
For data you only need to display (no mutations):
```typescript
const useReadOnlyData = createReadOnlyController(
  ['readonly-data'],
  () => api.getReadOnlyData()
);
```

## Best Practices

1. **Separate Concerns**: Keep stores framework-agnostic, put React-specific logic in controllers
2. **Type Safety**: Leverage TypeScript generics for full type safety
3. **Domain Logic**: Extend the base store class with domain-specific computed values and operations
4. **Custom Actions**: Use custom actions for complex operations that don't fit standard CRUD
5. **Error Handling**: Let the pattern handle optimistic rollbacks, focus on user-facing error messages
6. **Performance**: Use MobX observers and computed values to minimize re-renders

## Migration from Simple Patterns

If you're currently using simpler patterns, you can migrate incrementally:

1. Start with `createStandardController` for basic CRUD
2. Add custom actions as needed
3. Extend the store class when you need computed values
4. Use read-only controllers for display-only data

The pattern scales from simple to complex use cases while maintaining consistency.
