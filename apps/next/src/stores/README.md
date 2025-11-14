# Store Architecture

This directory contains the state management architecture for the application. The pattern is designed around **lazy loading**, **separation of concerns**, and **context-specific store management**.

## 📁 Directory Structure

```
stores/
├── rootStore.ts              # Main singleton store - manages session, realtime, and store managers
├── userApp/                  # User-facing stores (loaded on user pages)
│   ├── userStoreManager.ts   # Manages all user stores
│   ├── todoStore.ts
│   ├── postStore.ts
│   ├── checkboxStore.ts
│   ├── currentUserStore.ts
│   └── publicTodoStore.ts
└── adminApp/                 # Admin-facing stores (loaded only on admin pages)
    ├── adminStoreManager.ts  # Manages all admin stores
    └── adminMgmtStore.ts
```

## 🏗️ Architecture Overview

### Three-Layer Pattern

1. **RootStore** (`rootStore.ts`)
   - Singleton instance (one per app lifecycle)
   - Manages authentication session
   - Manages realtime WebSocket connection
   - Delegates to `UserStoreManager` and `AdminStoreManager`
   - Never directly holds individual stores

2. **Store Managers** (`userStoreManager.ts`, `adminStoreManager.ts`)
   - Extend `StoreManager` base class (from `@/lib/store-manager`)
   - Manage a collection of related stores
   - Implement lazy loading - stores are created only when accessed
   - Handle store initialization, session updates, and disposal

3. **Individual Stores** (e.g., `todoStore.ts`, `adminMgmtStore.ts`)
   - Actual data stores following the Advanced Optimistic Store (AOS) pattern
   - Handle their own API calls, transformations, and state
   - Can be enabled/disabled based on authentication

## 🎯 Why This Architecture?

### 1. **Lazy Loading**
- **User stores**: Load automatically when first accessed (e.g., `rootStore.userStore.todoStore`)
- **Admin stores**: Load only when explicitly accessed or initialized (e.g., on admin pages)
- **Benefit**: Reduces initial bundle size and memory footprint. Admin stores never load for regular users.

### 2. **Separation of Concerns**
- **RootStore**: Session & realtime management only
- **Store Managers**: Store lifecycle & coordination
- **Individual Stores**: Business logic & data management
- **Benefit**: Clear responsibilities, easier to test and maintain.

### 3. **Context-Specific Loading**
- User stores load on any authenticated page
- Admin stores load only on admin pages
- **Benefit**: Prevents unnecessary code execution and API calls.

### 4. **Singleton Pattern**
- One `RootStore` instance per app lifecycle
- Managed by `SingletonManager` (prevents memory leaks)
- **Benefit**: Consistent state across the application, proper cleanup on HMR.

## 🔑 Key Concepts

### StoreManager Base Class

Located in `@/lib/store-manager.ts`, this abstract class provides:

- **Lazy initialization**: Stores are created on first access
- **Session management**: Automatically enables/disables stores based on auth state
- **Realtime registration**: Connects stores to WebSocket when needed
- **Disposal**: Proper cleanup of all stores

### UserStoreManager vs AdminStoreManager

**UserStoreManager** (`userApp/userStoreManager.ts`):
- Auto-initializes when session is established
- Stores are accessible via `rootStore.userStore.todoStore`, etc.
- Used for general user-facing features

**AdminStoreManager** (`adminApp/adminStoreManager.ts`):
- Does NOT auto-initialize on session changes
- Requires explicit initialization: `rootStore.adminStore.initializeWithSession(session)`
- Used for admin-only features
- Prevents admin code from loading on regular user pages

### Access Patterns

```typescript
// User stores (auto-loaded)
const rootStore = useContext(RootStoreContext);
const todos = rootStore.userStore.todoStore;

// Admin stores (explicit initialization required)
useEffect(() => {
  if (rootStore.session) {
    rootStore.adminStore.initializeWithSession(rootStore.session);
  }
}, [rootStore.session]);

const admins = rootStore.adminStore.adminMgmtStore;
```

## ➕ How to Add a New Store

### Adding a User Store

1. **Create the store file** in `userApp/`:
   ```typescript
   // userApp/myNewStore.ts
   export class MyNewStore {
     // ... store implementation
   }
   ```

2. **Add to UserStoreManager** (`userApp/userStoreManager.ts`):
   ```typescript
   import { MyNewStore } from "./myNewStore";
   
   export class UserStoreManager extends StoreManager {
     private _myNewStore: MyNewStore | null = null;
     
     get myNewStore(): MyNewStore {
       if (this.isDisposed) {
         throw new Error("UserStoreManager has been disposed");
       }
       if (this._myNewStore) return this._myNewStore;
       
       try {
         this._myNewStore = new MyNewStore();
         this.ensureInitialized();
         return this._myNewStore;
       } catch (error) {
         console.error("Failed to initialize myNewStore:", error);
         this._myNewStore = null;
         throw error;
       }
     }
     
     // Add to getAuthStores() if it requires authentication
     getAuthStores(): AuthEnabledStore[] {
       const stores: AuthEnabledStore[] = [];
       // ... existing stores
       if (this._myNewStore) stores.push(this._myNewStore);
       return stores;
     }
     
     // Add to getRealtimeStores() if it supports realtime
     getRealtimeStores(): RealtimeStore[] {
       const stores: RealtimeStore[] = [];
       // ... existing stores
       if (this._myNewStore) stores.push(this._myNewStore);
       return stores;
     }
     
     // Add to dispose()
     dispose(): void {
       // ... existing cleanup
       this._myNewStore = null;
     }
   }
   ```

3. **Access the store** via `rootStore.userStore.myNewStore` (no backward compatibility getters needed)

### Adding an Admin Store

1. **Create the store file** in `adminApp/`:
   ```typescript
   // adminApp/myAdminStore.ts
   export class MyAdminStore {
     // ... store implementation
   }
   ```

2. **Add to AdminStoreManager** (`adminApp/adminStoreManager.ts`):
   ```typescript
   import { MyAdminStore } from "./myAdminStore";
   
   export class AdminStoreManager extends StoreManager {
     private _myAdminStore: MyAdminStore | null = null;
     
     get myAdminStore(): MyAdminStore {
       if (this.isDisposed) {
         throw new Error("AdminStoreManager has been disposed");
       }
       if (this._myAdminStore) return this._myAdminStore;
       
       try {
         this._myAdminStore = new MyAdminStore();
         // Note: Admin stores require explicit initialization
         if (!this.isInitialized) {
           console.warn(
             "⚠️ AdminStoreManager: Store accessed before initialization. " +
             "Call initializeWithSession() explicitly (e.g., from admin page component).",
           );
         }
         return this._myAdminStore;
       } catch (error) {
         console.error("Failed to initialize myAdminStore:", error);
         this._myAdminStore = null;
         throw error;
       }
     }
     
     // Add to initialize() method
     initialize(session: SupabaseSession | null): void {
       // ... existing initialization
       if (!this._myAdminStore) {
         this._myAdminStore = new MyAdminStore();
       }
     }
     
     // Add to getAuthStores(), getRealtimeStores(), and dispose() as needed
   }
   ```

3. **Initialize in admin page component**:
   ```typescript
   useEffect(() => {
     if (rootStore.session) {
       rootStore.adminStore.initializeWithSession(rootStore.session);
     }
   }, [rootStore.session]);
   ```

## 🔄 Store Lifecycle

### User Stores

1. **App starts** → `RootStore` created
2. **User logs in** → `RootStore` calls `userStore.updateSession(session)`
3. **Store accessed** → `rootStore.userStore.todoStore` getter called
4. **Lazy creation** → Store instance created, `ensureInitialized()` called
5. **Initialization** → Store enabled with auth token
6. **Realtime** → Store connected to WebSocket if supported

### Admin Stores

1. **App starts** → `RootStore` created, `adminStore` created but NOT initialized
2. **Admin page loads** → Component calls `rootStore.adminStore.initializeWithSession(session)`
3. **Store accessed** → `rootStore.adminStore.adminMgmtStore` getter called
4. **Lazy creation** → Store instance created (if not already created)
5. **Initialization** → Store enabled with auth token
6. **Realtime** → Store connected to WebSocket if supported

## 🛡️ Safety Features

### Disposal Guards
All store getters check `isDisposed` and throw errors if accessed after disposal:
```typescript
if (this.isDisposed) {
  throw new Error("UserStoreManager has been disposed");
}
```

### Error Handling
Store creation is wrapped in try/catch with cleanup on failure:
```typescript
try {
  this._myStore = new MyStore();
  this.ensureInitialized();
  return this._myStore;
} catch (error) {
  console.error("Failed to initialize myStore:", error);
  this._myStore = null;
  throw error;
}
```

### Race Condition Protection
Initialization flags prevent concurrent initialization attempts.

## 📚 Related Files

- **`@/lib/store-manager.ts`**: Base class for store managers
- **`@/lib/session-manager.ts`**: Handles Supabase authentication
- **`@/lib/realtime-manager.ts`**: Manages WebSocket connections
- **`@/lib/singleton.ts`**: Singleton pattern implementation

## 🎓 Best Practices

1. **Always use lazy getters** - Don't create stores in constructors
2. **Initialize admin stores explicitly** - Use `initializeWithSession()` in admin components
3. **Handle disposal** - Always add stores to `dispose()` method
4. **Update both managers** - If a store needs auth/realtime, update both `getAuthStores()` and `getRealtimeStores()`
5. **Use backward compatibility** - Add getters to `RootStore` for commonly used stores
6. **Follow naming conventions** - Use descriptive names (e.g., `currentUserStore` not `userStore`)

## 🔍 Debugging

### Check if stores are initialized:
```typescript
console.log(rootStore.userStore.isInitialized); // true/false
console.log(rootStore.adminStore.isInitialized); // true/false
```

### Access RootStore instance:
```typescript
const rootStore = RootStore.getInstance();
```

### Check session state:
```typescript
console.log(rootStore.session); // SupabaseSession | null
```

## ❓ FAQ

**Q: Why separate userApp and adminApp folders?**
A: Clear separation of concerns. Admin code should never load for regular users, improving performance and security.

**Q: Why lazy loading?**
A: Reduces initial bundle size and memory usage. Stores are only created when actually needed.

**Q: Can I access stores directly?**
A: Yes, but prefer going through managers for consistency and proper initialization.

**Q: What if I need a store that's neither user nor admin?**
A: Consider if it should be in userApp (if it's user-facing) or create a new manager for a different context.

**Q: How do I know if a store supports realtime?**
A: Check if it implements `RealtimeStore` interface and is listed in `getRealtimeStores()`.

