# Realtime Posts Integration

This document describes the realtime posts system that has been integrated into the KingStack monorepo, following the same pattern as the existing MatchStore.

## Overview

The realtime posts system provides:
- **Real-time updates** for post creation, updates, and deletions
- **Optimistic updates** for better user experience
- **MobX state management** with reactive UI updates
- **WebSocket-based** real-time communication
- **Simple API integration** with Next.js API routes

## Architecture

### Frontend Components

#### PostStore (`apps/frontend/src/stores/postStore.ts`)
The main store for managing post state and real-time updates:

```typescript
// Key features:
- Map-based caching (postId -> PostDSS)
- Real-time WebSocket handling
- Optimistic updates
- Simple API integration with Next.js routes
```

#### RootStore Integration (`apps/frontend/src/stores/rootStore.ts`)
Manages the real-time connection lifecycle:

```typescript
// On SIGNED_IN:
this.postStore.setupRealtime(session.access_token);

// On session loss:
this.postStore.teardownRealtime();
```

#### Types (`packages/shapes/post/PostDSS.ts`)
Updated to match database schema:

```typescript
export interface PostDSS {
  id: string;
  title: string;
  content: string | null;
  published: boolean;
  author_id: string;
  created_at: string;
}
```

### Backend Components

#### RealtimeGateway (`apps/backend/src/realtime/realtime.gateway.ts`)
Handles WebSocket connections and Supabase real-time subscriptions:

```typescript
// Features:
- User authentication via JWT
- Supabase postgres_changes subscription
- Event filtering (only published posts for INSERT/UPDATE)
- Broadcast to all connected clients
```

#### PostsController (`apps/backend/src/posts/posts.controller.ts`)
Simple posts endpoint:

```typescript
// GET /posts
// Returns: PostDSS[]
```

## Usage Examples

### Basic Usage

```typescript
import { useRootStore } from "@/stores/rootStore";

const MyComponent = observer(() => {
  const { postStore } = useRootStore();

  useEffect(() => {
    // Fetch all posts
    postStore.fetchPosts();
  }, []);

  return (
    <div>
      {postStore.publishedPosts.map(post => (
        <div key={post.id}>
          <h3>{post.title}</h3>
          <p>{post.content}</p>
        </div>
      ))}
    </div>
  );
});
```

### Creating Posts

```typescript
// Simple creation
await postStore.createPost({
  title: "My Post",
  content: "Post content",
  published: true
});

// Optimistic creation
await postStore.createPostOptimistic(
  { title: "Draft", content: "Content", published: false, author_id: "user123" },
  () => postStore.createPost({ title: "Draft", content: "Content", published: false })
);
```

### Real-time Updates

The system automatically handles:
- **INSERT**: New published posts appear immediately
- **UPDATE**: Post changes are reflected in real-time
- **DELETE**: Deleted posts are removed from the list

### Loading Initial Posts

```typescript
// Fetch all posts (only needed for initial load)
await postStore.fetchPosts();

// After this, all updates happen automatically via WebSocket
```

## Demo Component

The home page (`/`) demonstrates the realtime posts functionality:
- Creating posts with automatic real-time updates
- Viewing real-time updates via WebSocket
- Initial post loading
- Error handling

## Configuration

### Environment Variables

```bash
# Frontend
NEXT_PUBLIC_NEST_BACKEND_URL=http://localhost:3000

# Backend
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
SUPA_JWT_SECRET=your_jwt_secret
```

### Database Setup

Ensure your Supabase database has the `post` table with the following structure:

```sql
CREATE TABLE post (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT,
  published BOOLEAN DEFAULT false,
  author_id TEXT NOT NULL REFERENCES user(id),
  created_at TIMESTAMP DEFAULT now()
);
```

## Testing

1. Start the backend: `yarn workspace @kingstack/backend dev`
2. Start the frontend: `yarn workspace @kingstack/frontend dev`
3. Navigate to `/realtime-posts`
4. Create posts and observe real-time updates

## Key Features

### Optimistic Updates
- UI updates immediately before API calls
- Automatic rollback on failure
- Better user experience

### Caching
- Map-based storage for O(1) lookups
- Simple refresh mechanism
- Memory-efficient post management

### Real-time Communication
- WebSocket connection managed by RootStore
- Automatic reconnection handling
- Event filtering on the backend

### Type Safety
- Full TypeScript support
- Shared types between frontend and backend
- Prisma-generated types

## Troubleshooting

### Common Issues

1. **Posts not appearing in real-time**
   - Check WebSocket connection in browser dev tools
   - Verify Supabase real-time is enabled
   - Check backend logs for subscription errors

2. **Authentication issues**
   - Ensure JWT token is valid
   - Check SUPABASE_SERVICE_ROLE_KEY is correct
   - Verify user is properly authenticated

3. **Posts not refreshing**
   - Check API response format
   - Verify /api/post endpoint is working
   - Check network requests in browser dev tools

### Debug Logging

Enable debug logging by checking browser console for:
- `[PostStore]` - Frontend store operations
- `[RealtimeGateway]` - Backend WebSocket operations
- `[RootStore]` - Authentication and session management
