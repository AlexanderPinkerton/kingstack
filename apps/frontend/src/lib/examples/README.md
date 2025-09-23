# Optimistic Store Pattern

A powerful React pattern that combines **MobX** for reactive state management with **TanStack Query** for server state synchronization, featuring automatic optimistic updates and seamless data transformation.

## 🚀 Features

### Core Capabilities
- **⚡ Optimistic Updates**: UI updates immediately while server processes requests
- **🔄 Automatic Rollback**: Failed operations automatically revert to previous state
- **🔄 Smart Data Transformation**: Convert between API and UI data formats seamlessly
- **📊 Reactive State**: MobX-powered reactive updates across your entire app
- **🎯 Type Safety**: Full TypeScript support with intelligent type inference
- **🛠️ Zero Boilerplate**: Minimal setup with sensible defaults

### Advanced Features
- **🧠 Custom Store Classes**: Extend with computed properties, filtering, and business logic
- **🔀 Flexible Transformers**: Smart default transformer or custom data conversion logic
- **📈 Rich Analytics**: Built-in support for computed metrics and derived state
- **🏷️ Auto-tagging**: Extract and manage tags from content automatically
- **🔍 Advanced Filtering**: Search, sort, and filter with reactive computed properties
- **⚙️ Context-Aware**: Pass user context and app state for intelligent optimistic updates

## 📋 Table of Contents

- [Quick Start](#quick-start)
- [Basic Usage](#basic-usage)
- [Advanced Usage](#advanced-usage)
- [API Reference](#api-reference)
- [Examples](#examples)
- [Best Practices](#best-practices)
- [Troubleshooting](#troubleshooting)

## 🏃 Quick Start

### Installation

```bash
yarn install mobx mobx-react-lite @tanstack/react-query
```

### Basic Setup

```tsx
import { createOptimisticStore } from '@/lib/optimistic-store-pattern';

// 1. Define your data types
interface TodoApiData {
  id: string;
  title: string;
  done: boolean;
  created_at: string;
}

interface TodoUiData {
  id: string;
  title: string;
  done: boolean;
  created_at: Date; // Converted to Date object
}

// 2. Create your store hook
function useTodos() {
  return createOptimisticStore<TodoApiData, TodoUiData>({
    name: "todos",
    queryFn: () => fetch('/api/todos').then(res => res.json()),
    mutations: {
      create: (data) => fetch('/api/todos', {
        method: 'POST',
        body: JSON.stringify(data)
      }).then(res => res.json()),
      update: ({ id, data }) => fetch(`/api/todos/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data)
      }).then(res => res.json()),
      remove: (id) => fetch(`/api/todos/${id}`, {
        method: 'DELETE'
      }).then(() => ({ id }))
    }
  })();
}

// 3. Use in your component
function TodoList() {
  const { store, actions, status } = useTodos();
  
  return (
    <div>
      {store.list.map(todo => (
        <div key={todo.id}>
          <input 
            type="checkbox" 
            checked={todo.done}
            onChange={() => actions.update({
              id: todo.id, 
              data: { done: !todo.done }
            })}
          />
          {todo.title}
        </div>
      ))}
    </div>
  );
}
```

## 📖 Basic Usage

### Simple CRUD with Default Transformer

The pattern works out of the box with minimal configuration. The default transformer automatically handles common data conversions:

```tsx
// API data (what comes from server)
interface UserApiData {
  id: string;
  name: string;
  email: string;
  created_at: string; // ISO string
  is_active: boolean;
}

// UI data (what you work with in components)
interface UserUiData {
  id: string;
  name: string;
  email: string;
  created_at: Date; // Automatically converted
  is_active: boolean;
}

function useUsers() {
  return createOptimisticStore<UserApiData, UserUiData>({
    name: "users",
    queryFn: () => fetch('/api/users').then(res => res.json()),
    mutations: {
      create: (data) => fetch('/api/users', {
        method: 'POST',
        body: JSON.stringify(data)
      }).then(res => res.json()),
      update: ({ id, data }) => fetch(`/api/users/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data)
      }).then(res => res.json()),
      remove: (id) => fetch(`/api/users/${id}`, {
        method: 'DELETE'
      }).then(() => ({ id }))
    }
    // No transformer needed - uses smart defaults!
  })();
}
```

### Default Transformer Features

The default transformer automatically handles:

- **Date Conversion**: `created_at`, `updated_at`, `*_date`, `*_time` → `Date` objects
- **Boolean Conversion**: `"true"`/`"false"` strings → boolean values
- **Number Conversion**: Numeric strings → numbers
- **Array Conversion**: CSV strings → arrays
- **ID Normalization**: `id`, `_id`, `ID` → consistent `id` field

## 🔧 Advanced Usage

### Custom Store with Business Logic

Extend the base store with computed properties and custom methods:

```tsx
import { OptimisticStore, makeObservable, observable, computed, action } from 'mobx';

class ProductStore extends OptimisticStore<ProductUiData> {
  private _searchQuery = "";
  private _selectedCategory = "all";
  private _sortBy: "name" | "price" | "date" = "name";

  constructor() {
    super();
    makeObservable(this, {
      _searchQuery: observable,
      _selectedCategory: observable,
      _sortBy: observable,
      searchQuery: computed,
      selectedCategory: computed,
      sortBy: computed,
      setSearchQuery: action,
      setSelectedCategory: action,
      setSortBy: action,
      filteredProducts: computed,
      totalValue: computed,
      averagePrice: computed,
    });
  }

  // Search functionality
  get searchQuery() { return this._searchQuery; }
  setSearchQuery(query: string) { this._searchQuery = query; }

  get selectedCategory() { return this._selectedCategory; }
  setSelectedCategory(category: string) { this._selectedCategory = category; }

  get sortBy() { return this._sortBy; }
  setSortBy(sort: "name" | "price" | "date") { this._sortBy = sort; }

  // Advanced computed properties
  get filteredProducts(): ProductUiData[] {
    let products = this.list;

    // Filter by search
    if (this._searchQuery) {
      const query = this._searchQuery.toLowerCase();
      products = products.filter(p => 
        p.name.toLowerCase().includes(query) ||
        p.description.toLowerCase().includes(query)
      );
    }

    // Filter by category
    if (this._selectedCategory !== "all") {
      products = products.filter(p => p.category === this._selectedCategory);
    }

    // Sort products
    products.sort((a, b) => {
      switch (this._sortBy) {
        case "name": return a.name.localeCompare(b.name);
        case "price": return a.price - b.price;
        case "date": return b.created_at.getTime() - a.created_at.getTime();
        default: return 0;
      }
    });

    return products;
  }

  get totalValue(): number {
    return this.list.reduce((total, product) => total + product.price, 0);
  }

  get averagePrice(): number {
    return this.list.length > 0 ? this.totalValue / this.list.length : 0;
  }
}

// Use custom store
function useProducts() {
  return createOptimisticStore<ProductApiData, ProductUiData, ProductStore>({
    name: "products",
    queryFn: () => fetch('/api/products').then(res => res.json()),
    mutations: { /* ... */ },
    storeClass: ProductStore, // Use custom store
  })();
}
```

### Custom Data Transformer

For complex data transformations, create a custom transformer:

```tsx
import { DataTransformer, OptimisticDefaults } from '@/lib/optimistic-store-pattern';

class PostTransformer implements DataTransformer<PostApiData, PostUiData> {
  // Define optimistic defaults for immediate UI updates
  optimisticDefaults: OptimisticDefaults<PostApiData, PostUiData> = {
    createOptimisticUiData: (userInput: any, context?: any) => {
      const currentUser = context?.currentUser;
      const content = userInput.content || '';
      
      // Calculate UI fields immediately
      const wordCount = this.calculateWordCount(content);
      const readingTime = this.calculateReadingTime(wordCount);
      const excerpt = this.generateExcerpt(content);
      const tags = this.extractTags(content);
      
      return {
        id: userInput.id || `temp-${Date.now()}`,
        title: userInput.title || '',
        content,
        published: userInput.published ?? false,
        author_id: userInput.author_id || currentUser?.id || 'unknown',
        created_at: userInput.created_at instanceof Date 
          ? userInput.created_at 
          : new Date(),
        author: {
          id: currentUser?.id || 'unknown',
          username: currentUser?.username || 'You',
          email: currentUser?.email || 'unknown@example.com',
          displayName: currentUser?.displayName || 'You',
        },
        // Computed UI fields
        excerpt,
        readingTime,
        wordCount,
        isNew: this.isPostNew(new Date().toISOString()),
        publishStatus: (userInput.published ?? false) ? 'published' : 'draft',
        tags,
      } as PostUiData;
    },
    pendingFields: [], // Fields that show loading states
  };

  toUi(apiData: PostApiData): PostUiData {
    const content = apiData.content || "";
    const wordCount = this.calculateWordCount(content);
    const readingTime = this.calculateReadingTime(wordCount);
    const excerpt = this.generateExcerpt(content);
    const tags = this.extractTags(content);
    const isNew = this.isPostNew(apiData.created_at);

    return {
      id: apiData.id,
      title: apiData.title,
      content,
      published: apiData.published,
      author_id: apiData.author_id,
      created_at: new Date(apiData.created_at),
      author: {
        ...apiData.author,
        displayName: apiData.author.username || apiData.author.email.split("@")[0],
      },
      // Computed fields
      excerpt,
      readingTime,
      wordCount,
      isNew,
      publishStatus: apiData.published ? "published" : "draft",
      tags,
    };
  }

  toApi(uiData: PostUiData): PostApiData {
    return {
      id: uiData.id,
      title: uiData.title,
      content: uiData.content,
      published: uiData.published,
      author_id: uiData.author_id,
      created_at: uiData.created_at.toISOString(),
      author: {
        id: uiData.author.id,
        username: uiData.author.username,
        email: uiData.author.email,
      },
    };
  }

  private calculateWordCount(content: string): number {
    return content.trim().split(/\s+/).filter(word => word.length > 0).length;
  }

  private calculateReadingTime(wordCount: number): number {
    return Math.max(1, Math.ceil(wordCount / 200)); // 200 words per minute
  }

  private generateExcerpt(content: string, maxLength: number = 150): string {
    if (content.length <= maxLength) return content;
    const truncated = content.substring(0, maxLength);
    const lastSpace = truncated.lastIndexOf(" ");
    return lastSpace > 0 ? truncated.substring(0, lastSpace) + "..." : truncated + "...";
  }

  private extractTags(content: string): string[] {
    const tagRegex = /#(\w+)/g;
    const matches = content.match(tagRegex);
    return matches ? [...new Set(matches.map(tag => tag.substring(1).toLowerCase()))] : [];
  }

  private isPostNew(createdAt: string): boolean {
    const postDate = new Date(createdAt);
    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);
    return postDate > oneDayAgo;
  }
}

// Use custom transformer
function usePosts() {
  return createOptimisticStore<PostApiData, PostUiData, PostStore>({
    name: "posts",
    queryFn: () => fetch('/api/posts').then(res => res.json()),
    mutations: { /* ... */ },
    transformer: new PostTransformer(),
    optimisticContext: { currentUser: getCurrentUser() },
    storeClass: PostStore,
  })();
}
```

## 📚 API Reference

### `createOptimisticStore<TApiData, TUiData, TStore>(config)`

Creates a React hook that manages an optimistic store.

#### Configuration Options

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `name` | `string` | ✅ | Unique identifier for query keys |
| `queryFn` | `() => Promise<TApiData[]>` | ✅ | Function to fetch data from server |
| `mutations` | `Mutations` | ✅ | CRUD mutation functions |
| `transformer` | `DataTransformer \| false` | ❌ | Data transformation logic (default: auto) |
| `optimisticDefaults` | `OptimisticDefaults` | ❌ | Optimistic update configuration |
| `optimisticContext` | `any` | ❌ | Context data for optimistic updates |
| `storeClass` | `new () => OptimisticStore` | ❌ | Custom store class |
| `staleTime` | `number` | ❌ | Cache time in ms (default: 5 minutes) |
| `enabled` | `boolean` | ❌ | Enable/disable query (default: true) |

#### Return Value

```tsx
{
  store: TStore,           // MobX store instance
  actions: {               // Mutation actions
    create: (data) => void,
    update: (params) => void,
    remove: (id) => void,
    refetch: () => void,
  },
  status: {                // Loading and error states
    isLoading: boolean,
    isError: boolean,
    error: Error | null,
    isSyncing: boolean,
    createPending: boolean,
    updatePending: boolean,
    deletePending: boolean,
  }
}
```

### `OptimisticStore<T>`

Base store class with reactive state management.

#### Methods

- `get(id: string): T | undefined` - Get entity by ID
- `upsert(entity: T): void` - Add or update entity
- `update(id: string, updates: Partial<T>): void` - Update entity fields
- `remove(id: string): void` - Remove entity
- `clear(): void` - Clear all entities
- `filter(predicate: (entity: T) => boolean): T[]` - Filter entities
- `find(predicate: (entity: T) => boolean): T | undefined` - Find single entity

#### Properties

- `list: T[]` - All entities as array
- `count: number` - Number of entities

### `DataTransformer<TApiData, TUiData>`

Interface for data transformation between API and UI formats.

```tsx
interface DataTransformer<TApiData, TUiData> {
  toUi(apiData: TApiData): TUiData;
  toApi(uiData: TUiData): TApiData;
  optimisticDefaults?: OptimisticDefaults<TApiData, TUiData>;
}
```

### `OptimisticDefaults<TApiData, TUiData>`

Configuration for optimistic updates.

```tsx
interface OptimisticDefaults<TApiData, TUiData> {
  createOptimisticUiData: (userInput: any, context?: any) => TUiData;
  pendingFields?: (keyof TUiData)[];
}
```

## 💡 Examples

### Simple Todo App

See `simple-todos-example.tsx` for a basic CRUD implementation with:
- Default transformer handling date conversion
- Optimistic updates for all operations
- Loading states and error handling
- Clean, minimal code

### Advanced Posts App

See `advanced-posts-example.tsx` for a complex implementation with:
- Custom store with search, filtering, and sorting
- Custom transformer with computed fields
- Rich analytics and metrics
- Auto-tag extraction from content
- Context-aware optimistic updates

## 🎯 Best Practices

### 1. Use TypeScript Generics

Always specify your data types for full type safety:

```tsx
// ✅ Good
createOptimisticStore<PostApiData, PostUiData, PostStore>({...})

// ❌ Avoid
createOptimisticStore({...}) // Loses type safety
```

### 2. Leverage Computed Properties

Use MobX computed properties for derived state:

```tsx
class ProductStore extends OptimisticStore<ProductUiData> {
  get totalValue() {
    return this.list.reduce((sum, product) => sum + product.price, 0);
  }
  
  get expensiveProducts() {
    return this.list.filter(product => product.price > 100);
  }
}
```

### 3. Handle Loading States Gracefully

Always check loading states in your UI:

```tsx
function ProductList() {
  const { store, actions, status } = useProducts();
  
  if (status.isLoading) return <LoadingSpinner />;
  if (status.isError) return <ErrorMessage error={status.error} />;
  
  return (
    <div>
      {store.list.map(product => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
}
```

### 4. Use Context for Optimistic Updates

Pass relevant context for better optimistic updates:

```tsx
function usePosts() {
  const { user } = useAuth();
  
  return createOptimisticStore<PostApiData, PostUiData, PostStore>({
    // ... config
    optimisticContext: { currentUser: user },
  })();
}
```

### 5. Implement Proper Error Handling

Handle errors gracefully with rollback:

```tsx
const { actions, status } = usePosts();

const handleCreatePost = async (data) => {
  try {
    await actions.create(data);
    toast.success('Post created!');
  } catch (error) {
    toast.error('Failed to create post');
    // Store automatically rolls back on error
  }
};
```

## 🔧 Troubleshooting

### Common Issues

#### 1. MobX Observable Warnings

**Problem**: "MobX observable values should not be accessed outside of an observer component"

**Solution**: Wrap your component with `observer`:

```tsx
import { observer } from 'mobx-react-lite';

const TodoList = observer(() => {
  const { store } = useTodos();
  return <div>{store.list.map(...)}</div>;
});
```

#### 2. TypeScript Errors with Custom Stores

**Problem**: TypeScript errors when extending `OptimisticStore`

**Solution**: Use proper MobX observable syntax:

```tsx
class MyStore extends OptimisticStore<MyData> {
  public _searchQuery = "";
  
  constructor() {
    super();
    makeObservable(this, {
      _searchQuery: observable,
      searchQuery: computed,
      setSearchQuery: action,
    });
  }
}
```

#### 3. Transformer Not Working

**Problem**: Data transformation not applied

**Solution**: Check transformer configuration:

```tsx
// ✅ Correct
transformer: new MyTransformer()

// ❌ Incorrect
transformer: MyTransformer // Missing 'new'
```

#### 4. Optimistic Updates Not Working

**Problem**: UI doesn't update immediately

**Solution**: Ensure you're using the actions from the hook:

```tsx
// ✅ Correct
const { actions } = usePosts();
actions.create(data);

// ❌ Incorrect - calling mutation directly
const mutation = useMutation({...});
mutation.mutate(data);
```

### Performance Tips

1. **Use `useMemo` for expensive computations**:
   ```tsx
   const expensiveValue = useMemo(() => 
     store.list.filter(item => complexFilter(item)), 
     [store.list]
   );
   ```

2. **Debounce search queries**:
   ```tsx
   const [searchQuery, setSearchQuery] = useState("");
   const debouncedQuery = useDebounce(searchQuery, 300);
   
   useEffect(() => {
     store.setSearchQuery(debouncedQuery);
   }, [debouncedQuery]);
   ```

3. **Use `useCallback` for event handlers**:
   ```tsx
   const handleUpdate = useCallback((id, data) => {
     actions.update({ id, data });
   }, [actions]);
   ```
