# Realtime Flow Test

## How the Realtime System Works

### 1. Initial Load
- User clicks "Load Posts" → `postStore.fetchPosts()` → API call to `/api/post` → Posts loaded into store

### 2. Creating a Post
- User clicks "Create Posts" → `postStore.createPost()` → API call to `/api/post` (POST) → Post created in database

### 3. Realtime Update Flow
1. **Database Change**: Post is inserted into the `post` table
2. **Supabase Trigger**: Supabase detects the change and sends a `postgres_changes` event
3. **Backend Gateway**: `RealtimeGateway.handlePostRealtime()` receives the event
4. **Broadcast**: Gateway broadcasts `post_update` event to all connected clients
5. **Frontend Update**: `PostStore.handleRealtimePostUpdate()` receives the event
6. **State Update**: Post is added to the local store via `realtimeInsertPost()`
7. **UI Update**: MobX reactivity automatically updates the UI

### 4. What Happens When You Create a Post

```
User clicks "Create Posts"
    ↓
postStore.createPost() called
    ↓
API POST /api/post
    ↓
Post created in database
    ↓
Supabase detects INSERT
    ↓
RealtimeGateway.handlePostRealtime()
    ↓
Broadcasts to all clients
    ↓
PostStore.handleRealtimePostUpdate()
    ↓
Post appears in UI automatically
```

### 5. Testing the Flow

1. **Open the home page** (`/`)
2. **Click "Load Posts"** to see existing posts
3. **Click "Create Posts"** to create a new post
4. **Watch the UI** - the new post should appear automatically without any manual refresh
5. **Check browser console** for realtime update logs:
   - `[PostStore] Received post_update:`
   - `[PostStore] realtimeInsertPost called`

### 6. Expected Console Logs

When creating a post, you should see:
```
Creating post... {title: "Test Post 1234567890", content: "This is a test post...", published: true}
[PostStore] Received post_update: {type: "post_update", event: "INSERT", post: {...}}
[PostStore] realtimeInsertPost called {id: "...", title: "Test Post 1234567890", ...}
```

### 7. Troubleshooting

If posts don't appear automatically:
1. Check WebSocket connection in browser dev tools
2. Verify Supabase real-time is enabled
3. Check backend logs for broadcast messages
4. Ensure the post is published (`published: true`)
