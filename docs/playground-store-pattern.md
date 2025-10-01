# 🎮 Playground Store Pattern

This document shows how to implement the centralized playground configuration pattern in your stores.

## 📋 Pattern Overview

Instead of scattering playground logic throughout your store, centralize it at the bottom of the file with clear separation between API and playground implementations.

## 🏗️ Implementation Steps

### 1. Clean Store Initialization

```typescript
private initialize() {
  this.optimisticStore = createOptimisticStore<ApiData, UiData>({
    name: "your-store",
    queryFn: this.getQueryFn(),           // One-liner to choose implementation
    mutations: {
      create: this.getCreateMutation(),   // One-liner to choose implementation
      update: this.getUpdateMutation(),   // One-liner to choose implementation
      remove: this.getDeleteMutation(),   // One-liner to choose implementation
    },
    transformer: this.getTransformer(),
    staleTime: 5 * 60 * 1000,
    enabled: () => this.isEnabled && (!!this.authToken || this.authToken === 'playground-token'),
  });
}
```

### 2. Centralized Playground Configuration

Add this section at the bottom of your store file:

```typescript
// ============================================================================
// PLAYGROUND CONFIGURATION
// ============================================================================
// All playground logic is centralized here for easy maintenance

private getQueryFn() {
  return isPlaygroundMode() ? this.playgroundQueryFn : this.apiQueryFn;
}

private getCreateMutation() {
  return isPlaygroundMode() ? this.playgroundCreateMutation : this.apiCreateMutation;
}

private getUpdateMutation() {
  return isPlaygroundMode() ? this.playgroundUpdateMutation : this.apiUpdateMutation;
}

private getDeleteMutation() {
  return isPlaygroundMode() ? this.playgroundDeleteMutation : this.apiDeleteMutation;
}

private getTransformer() {
  return {
    toUi: (apiData: ApiData) => ({
      // Your transformation logic
    }),
    toApi: (uiData: UiData) => ({
      // Your transformation logic
    }),
    optimisticDefaults: {
      createOptimisticUiData: (userInput: any) => ({
        // Your optimistic defaults
      }),
    },
  };
}

// API Implementations
private apiQueryFn = async (): Promise<ApiData[]> => {
  // Your API query logic
};

private apiCreateMutation = async (data: any): Promise<ApiData> => {
  // Your API create logic
};

private apiUpdateMutation = async ({ id, data }: { id: string; data: any }): Promise<ApiData> => {
  // Your API update logic
};

private apiDeleteMutation = async (id: string): Promise<{ id: string }> => {
  // Your API delete logic
};

// Playground Implementations
private playgroundQueryFn = async (): Promise<ApiData[]> => {
  await new Promise(resolve => setTimeout(resolve, 300)); // Simulate delay
  return getMockData('your-data-type') as ApiData[];
};

private playgroundCreateMutation = async (data: any): Promise<ApiData> => {
  await new Promise(resolve => setTimeout(resolve, 300));
  return {
    id: `temp-${Date.now()}`,
    ...data,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    user_id: 'playground-user'
  };
};

private playgroundUpdateMutation = async ({ id, data }: { id: string; data: any }): Promise<ApiData> => {
  await new Promise(resolve => setTimeout(resolve, 300));
  return {
    id,
    ...data,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    user_id: 'playground-user'
  };
};

private playgroundDeleteMutation = async (id: string): Promise<{ id: string }> => {
  await new Promise(resolve => setTimeout(resolve, 300));
  return { id };
};
```

## ✅ Benefits

1. **Clean Separation**: API and playground logic are clearly separated
2. **Easy Maintenance**: All playground code is in one place
3. **One-Liner Switching**: Simple `isPlaygroundMode() ? playground : api` pattern
4. **Type Safety**: Full TypeScript support for both implementations
5. **Consistent Pattern**: Same structure across all stores
6. **Easy Testing**: Can easily mock or test individual implementations

## 🔧 Migration Steps

1. **Move existing logic** into separate API methods
2. **Create playground methods** with mock implementations
3. **Add getter methods** that choose between implementations
4. **Update store initialization** to use getter methods
5. **Remove old playground utilities** (createQueryFn, etc.)

## 📝 Example: TodoStore

See `apps/frontend/src/stores/todoStore.ts` for a complete implementation of this pattern.

## 🎯 Next Steps

Apply this pattern to:
- `postStore.ts`
- `userStore.ts` 
- `checkboxStore.ts`
- Any other stores that need playground support
