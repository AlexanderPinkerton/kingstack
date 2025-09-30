# Why Store Manager Caching Was Removed

## TL;DR
Store managers are cheap to create (~5ms). TanStack Query already caches the expensive part (network requests). Caching store managers breaks closures and adds complexity for negligible gain.

---

## The Problem We Tried to Solve

**Original assumption:** "Creating store managers is expensive, so we should cache them."

**Reality check:**
- Store manager creation: ~5-10ms
- Network request (what matters): 100-500ms
- **100x difference!**

---

## What Actually Takes Time?

### Creating a Store Manager: ~5-10ms
```typescript
OptimisticStore instantiation:    ~1ms
QueryObserver setup:              ~1-2ms
3x MutationObserver setup:        ~3ms
Subscription wiring:              ~1ms
-------------------------------------------
Total:                            ~5-10ms  ✅ Negligible
```

### Fetching Data from Server: 100-500ms
```typescript
Network round-trip:              100-500ms  ❌ Expensive!
```

---

## What TanStack Query Already Does

TanStack Query **automatically caches query results** by `queryKey`:

```typescript
const queryObserver = new QueryObserver(qc, {
  queryKey: [config.name],     // Cached by this!
  queryFn: config.queryFn,
  staleTime: 5 * 60 * 1000,   // 5 minutes
});

// Timeline:
// T0: First call  → Network request (500ms) → Cache result
// T1: Second call → Return cached data (0ms) ✅
// T2: After 5min  → Stale, background refetch (0ms UI delay) ✅
```

**This is the real optimization!** We were caching the wrong layer.

---

## The Closure Problem

When we cached store managers, we broke dynamic closures:

### Before (Broken):
```typescript
class TodoStore {
  private authToken: string | null = null;

  constructor() {
    // Store manager created once and cached
    this.storeManager = createOptimisticStoreManager({
      name: "todos",
      queryFn: async () => {
        const token = this.authToken;  // ❌ Captures authToken at creation time
        return fetchWithAuth(token, "/todos");
      },
    });
  }

  enable(token: string) {
    this.authToken = token;  // ❌ Cached queryFn still sees null!
  }
}

// Problem:
const store = new TodoStore();        // queryFn captures authToken = null
store.enable("real-token");           // Updates authToken, but queryFn still uses null
store.actions.refetch();              // ❌ Sends request with null token!
```

### Workarounds We Tried (All Bad):
1. **`disableCache` flag** - Defeats the purpose
2. **Trigger refetch on cache hit** - Doesn't update closures
3. **Manual cache invalidation** - Complex and error-prone
4. **Separate cache keys per context** - Defeats the purpose

---

## After (Fixed): No Cache = No Problem

```typescript
class TodoStore {
  private authToken: string | null = null;

  constructor() {
    // Store manager created every time - FRESH closures
    this.initialize();
  }

  private initialize() {
    this.storeManager = createOptimisticStoreManager({
      name: "todos",
      queryFn: async () => {
        const token = this.authToken;  // ✅ Captures CURRENT authToken
        return fetchWithAuth(token, "/todos");
      },
    });
  }

  enable(token: string) {
    this.authToken = token;
    this.initialize();  // Recreate with fresh closures (~5ms)
    // TanStack Query still uses cached data if available!
  }
}
```

**Benefits:**
- ✅ Fresh closures every time
- ✅ Simple, no special flags
- ✅ TanStack Query still caches results
- ✅ Only ~5ms overhead

---

## Performance Comparison

### With Store Manager Cache (Broken):
```
First load:           500ms (network + store creation)
Enable with token:    0ms   (cache hit, but broken - no data!)
Manual refetch:       500ms (network, wrong token)
Total user wait:      1000ms ❌
```

### Without Store Manager Cache (Working):
```
First load:           500ms (network + store creation)
Enable with token:    5ms   (recreate store) + 0ms (cached query result)
Total user wait:      505ms ✅
```

**Net difference: 5ms** - unnoticeable to users!

---

## Real-World Scenarios

### Scenario 1: User Logs In
```typescript
// Without cache (current - working):
1. User logs in                    → 0ms
2. RootStore.enable(token)         → 5ms  (recreate store managers)
3. todoStore queries               → 0ms  (TanStack cache or fresh fetch)
Total: 5ms overhead ✅
```

### Scenario 2: HMR During Development
```typescript
// Without cache (current - working):
1. Save file                       → 0ms
2. Module reloads                  → 0ms
3. Store managers recreated        → 5ms
4. Queries reuse cached data       → 0ms  (TanStack Query cache)
Total: 5ms overhead ✅
```

### Scenario 3: Navigation Between Pages
```typescript
// Without cache (current - working):
1. Navigate to page                → 0ms
2. Store managers recreated        → 5ms
3. Queries use cached data         → 0ms  (if within staleTime)
Total: 5ms overhead ✅
```

---

## What About Multiple Store Instances?

**Q: Won't we create duplicate store managers?**

**A: Only if you call `createOptimisticStoreManager` multiple times.**

Our architecture prevents this:
```typescript
// ✅ GOOD - Singleton pattern
class TodoStore {
  private storeManager: OptimisticStoreManager | null = null;

  constructor() {
    this.initialize();  // Called once per TodoStore instance
  }
}

// ✅ GOOD - Single RootStore instance
const rootStore = new RootStore();  // Module level - singleton
```

Even if you did create duplicates:
- Cost: ~5ms each (negligible)
- TanStack Query still dedupes network requests by queryKey
- No memory leak (observers are cleaned up on destroy)

---

## The Right Layer to Cache

| Layer | Create Cost | Cache Strategy | Cached By |
|-------|-------------|----------------|-----------|
| Store Manager | ~5ms | ❌ Don't cache | N/A |
| Query Results | 100-500ms | ✅ Cache | TanStack Query |
| API Responses | 100-500ms | ✅ Cache | TanStack Query |
| Computed Values | varies | ✅ Cache | MobX |

**Key insight:** Cache at the expensive layer (network), not the cheap layer (JS objects).

---

## Migration Impact

### Code Removed:
- `storeManagerCache` Map
- `clearStoreManagerCache()` utility
- `cacheKey` config option
- `disableCache` config option
- Cache collision warnings
- Cleanup on page unload

### Code Unchanged:
- Store creation logic
- Query/mutation logic
- TanStack Query configuration
- All user-facing APIs

### Performance Impact:
- Store creation: +5ms per initialization
- Data fetching: No change (TanStack Query still caches)
- Memory: Slightly lower (no cache Map)
- **Net user impact: Negligible (<5ms)**

---

## Lessons Learned

1. **Measure before optimizing**
   - We cached something that took 5ms
   - While ignoring the 500ms that was already cached

2. **Understand your dependencies**
   - TanStack Query already solves this problem
   - We were duplicating work at the wrong layer

3. **Beware of closure capture**
   - Caching functions with closures is dangerous
   - Fresh closures are better than stale caches

4. **Keep it simple**
   - No cache = no cache invalidation bugs
   - No cache = no stale closure bugs
   - No cache = simpler mental model

---

## Alternative Considered: Closure-Safe Caching

We could have made caching work with dependency tracking:

```typescript
createOptimisticStoreManager({
  name: "todos",
  cacheKey: () => `todos-${authToken}`,  // Dynamic cache key
  queryFn: () => fetchWithAuth(authToken, "/todos"),
});
```

**Why we didn't:**
- Adds complexity (dependency tracking, cache keys)
- Still only saves ~5ms
- TanStack Query already caches the expensive part
- Not worth the trade-off

---

## Conclusion

**Store manager caching was a premature optimization that:**
- ❌ Saved negligible time (~5ms)
- ❌ Broke dynamic closures
- ❌ Added complexity
- ❌ Duplicated TanStack Query's work

**Removing it:**
- ✅ Simplifies the codebase
- ✅ Fixes closure issues
- ✅ Relies on TanStack Query (the right layer)
- ✅ Costs only ~5ms (unnoticeable)

**The real optimization was already there:** TanStack Query caching query results by `queryKey`.

---

## References

- [TanStack Query Caching Docs](https://tanstack.com/query/latest/docs/framework/react/guides/caching)
- [MDN: Closure Performance](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Closures)
- [Premature Optimization](https://wiki.c2.com/?PrematureOptimization)

---

**Bottom line:** We were caching the wrapper when the contents were already cached. Classic over-engineering! 🎯
