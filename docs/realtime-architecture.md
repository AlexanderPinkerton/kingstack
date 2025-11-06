# Realtime Architecture

This document describes the clean, organized realtime architecture implemented in the KingStack monorepo.

## 🏗️ Architecture Overview

The realtime system follows a centralized pattern where:
- **RootStore** owns and manages the WebSocket connection
- **Domain Stores** receive the socket and handle their specific events
- **Clean Interface** ensures consistent implementation across stores

## 📁 File Structure

```
apps/next/src/stores/
├── interfaces/
│   └── RealtimeStore.ts          # Interface for realtime stores
├── rootStore.ts                  # Owns WebSocket connection
└── postStore.ts                  # Domain store for posts
```

## 🔧 Components

### RootStore (`rootStore.ts`)

**Responsibilities:**
- WebSocket connection lifecycle management
- Authentication and registration
- Delegating events to domain stores

**Key Methods:**
```typescript
setupRealtime(token: string)      // Establish WebSocket connection
teardownRealtime()                // Clean up connection
setupDomainEventHandlers()        // Register domain store handlers
```

### RealtimeStore Interface (`interfaces/RealtimeStore.ts`)

**Purpose:**
- Defines contract for domain stores that need realtime functionality
- Ensures consistent implementation across stores

**Interface:**
```typescript
interface RealtimeStore {
  setupRealtimeHandlers(socket: Socket): void;
}
```

### Domain Stores (e.g., `postStore.ts`)

**Responsibilities:**
- Handle domain-specific realtime events
- Update local state based on realtime data
- Implement `RealtimeStore` interface

**Key Methods:**
```typescript
setupRealtimeHandlers(socket: Socket)  // Register event listeners
handleRealtimePostUpdate(data: any)    // Process post updates
```

## 🔄 Event Flow

### 1. Connection Setup
```
User Signs In
    ↓
RootStore.setupRealtime(token)
    ↓
WebSocket Connection Established
    ↓
RootStore.setupDomainEventHandlers()
    ↓
Domain Stores Register Event Handlers
```

### 2. Realtime Updates
```
Database Change
    ↓
Supabase Realtime Event
    ↓
Backend RealtimeGateway
    ↓
WebSocket Broadcast
    ↓
RootStore (passes to domain stores)
    ↓
Domain Store Event Handler
    ↓
Local State Update
    ↓
UI Reactivity (MobX)
```

## 🚀 Adding New Domain Stores

### Step 1: Create the Store
```typescript
// stores/exampleStore.ts
import { RealtimeStore } from "./interfaces/RealtimeStore";

export class ExampleStore implements RealtimeStore {
  setupRealtimeHandlers(socket: Socket) {
    socket.on("example_update", (data) => {
      // Handle example updates
    });
  }
}
```

### Step 2: Register in RootStore
```typescript
// stores/rootStore.ts
export class RootStore {
  exampleStore: ExampleStore;
  
  constructor() {
    this.exampleStore = new ExampleStore(this);
  }
  
  private setupDomainEventHandlers() {
    const realtimeStores: RealtimeStore[] = [
      this.postStore,
      this.exampleStore,  // Add here
    ];
    
    realtimeStores.forEach(store => {
      store.setupRealtimeHandlers(this.socket!);
    });
  }
}
```

## 🎯 Benefits

### ✅ **Centralized Management**
- Single WebSocket connection managed by RootStore
- Consistent connection lifecycle across the app
- No duplicate connections or resource leaks

### ✅ **Clean Separation**
- Domain stores focus on their specific events
- RootStore handles infrastructure concerns
- Clear interface contract for consistency

### ✅ **Scalable Pattern**
- Easy to add new domain stores
- Consistent implementation across stores
- Type-safe interface ensures proper implementation

### ✅ **Maintainable**
- Clear responsibilities for each component
- Easy to debug and test
- Follows single responsibility principle

## 🔍 Debugging

### Console Logs
- `[RootStore]` - Connection management
- `[PostStore]` - Post-specific events
- `[RealtimeGateway]` - Backend WebSocket handling

### Common Issues
1. **No realtime updates**: Check WebSocket connection in browser dev tools
2. **Events not received**: Verify domain store is registered in `setupDomainEventHandlers()`
3. **Connection drops**: Check authentication and network connectivity

## 📋 Testing

### Manual Testing
1. Sign in to establish WebSocket connection
2. Create/update/delete data in your domain
3. Verify realtime updates appear automatically
4. Check console logs for event flow

### Unit Testing
- Test domain store event handlers in isolation
- Mock WebSocket for testing
- Verify state updates after events

## 🔮 Future Enhancements

- **Reconnection Logic**: Automatic reconnection on connection loss
- **Event Queuing**: Queue events during disconnection
- **Performance Monitoring**: Track realtime event performance
- **Error Handling**: Graceful degradation on realtime failures
