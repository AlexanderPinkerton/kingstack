# 🎮 KingStack Playground Mode

Playground mode allows you to run KingStack as a UI playground without requiring Supabase authentication or database setup. This is perfect for:

- **UI Development**: Test components and layouts without backend dependencies
- **Design System Work**: Explore ShadCN components and Tailwind styling
- **Demo Purposes**: Show off the UI without complex setup
- **New Developer Onboarding**: Get started quickly without environment setup

## 🚀 Quick Start

### Option 1: Use the Setup Script (Recommended)

```bash
# Set up playground mode
yarn env:playground

# Start the development servers
yarn dev
```

### Option 2: Manual Setup

1. **Set environment variables**:
   ```bash
   # Frontend
   echo "NEXT_PUBLIC_PLAYGROUND_MODE=true" >> apps/frontend/.env
   echo "NEXT_PUBLIC_SUPABASE_URL=" >> apps/frontend/.env
   echo "NEXT_PUBLIC_SUPABASE_ANON_KEY=" >> apps/frontend/.env
   ```

2. **Start the development servers**:
   ```bash
   yarn dev
   ```

## 🎯 What Works in Playground Mode

### ✅ Fully Functional
- **All UI Components**: ShadCN components work perfectly
- **Optimistic Updates**: Create, update, delete operations with instant feedback
- **Mock Data**: Pre-populated with sample todos, posts, and checkboxes
- **Responsive Design**: All layouts and breakpoints work
- **State Management**: MobX stores work with mock data
- **Loading States**: Realistic loading animations and states

### ⚠️ Limited Functionality
- **No Real-time Updates**: WebSocket connections are disabled
- **No Authentication**: Login/signup flows are bypassed
- **No Persistence**: Data changes are not saved to a database
- **No Backend API**: All API calls use mock responses

## 🔧 How It Works

### Environment Detection
Playground mode is automatically detected when:
- `NEXT_PUBLIC_PLAYGROUND_MODE=true` is set, OR
- `NEXT_PUBLIC_SUPABASE_URL` is empty/undefined

### Mock Data System
The playground uses a sophisticated mock data system:

```typescript
// Mock data is defined in packages/shapes/playground.ts
export const PLAYGROUND_CONFIG = {
  enabled: isPlaygroundMode(),
  mockData: {
    todos: [/* sample todos */],
    posts: [/* sample posts */],
    checkboxes: [/* sample checkboxes */],
    users: [/* sample users */]
  }
};
```

### Store Integration
All stores automatically switch between real API calls and mock data:

```typescript
// Stores use utility functions to choose the right implementation
queryFn: createQueryFn(apiQueryFn, mockQueryFn),
mutations: {
  create: createMutationFn(apiCreateFn, mockCreateFn),
  update: createUpdateMutationFn(apiUpdateFn, mockUpdateFn),
  remove: createDeleteMutationFn(apiDeleteFn, mockDeleteFn),
}
```

## 🎨 UI Indicators

When in playground mode, you'll see:
- **Playground Badge**: A yellow badge in the top-right corner
- **Console Logs**: Clear indicators in the browser console
- **Mock Data**: Pre-populated content instead of empty states

## 🔄 Switching Between Modes

### To Development Mode
```bash
yarn env:development
yarn dev
```

### To Production Mode
```bash
yarn env:production
yarn dev
```

### To Playground Mode
```bash
yarn env:playground
yarn dev
```

### Check Current Mode
```bash
yarn env:current
```

## 🛠️ Customizing Mock Data

To add your own mock data, edit `packages/shapes/playground.ts`:

```typescript
export const PLAYGROUND_CONFIG: PlaygroundConfig = {
  enabled: isPlaygroundMode(),
  mockData: {
    todos: [
      {
        id: 'custom-1',
        title: 'Your Custom Todo',
        done: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        user_id: 'playground-user'
      }
      // ... more todos
    ],
    // ... other data types
  }
};
```

## 🐛 Troubleshooting

### Playground Mode Not Activating
1. Check that `NEXT_PUBLIC_PLAYGROUND_MODE=true` is set
2. Ensure `NEXT_PUBLIC_SUPABASE_URL` is empty
3. Restart the development server

### Mock Data Not Loading
1. Check browser console for errors
2. Verify the playground configuration is correct
3. Ensure the shapes package is built: `yarn build`

### UI Components Not Working
1. Check that Tailwind CSS is properly configured
2. Verify ShadCN components are installed
3. Check for TypeScript errors in the console

## 🎯 Best Practices

### For UI Development
- Use playground mode for component development
- Test responsive designs across different screen sizes
- Verify accessibility features work correctly

### For Demo Purposes
- Customize mock data to show realistic content
- Test all major user flows
- Ensure the UI looks polished and professional

### For New Developers
- Start with playground mode to understand the UI
- Gradually move to development mode as you learn the backend
- Use playground mode to test frontend changes before backend integration

## 🔮 Future Enhancements

Potential improvements to playground mode:
- **More Mock Data**: Additional data types and scenarios
- **Interactive Demos**: Guided tours and examples
- **Theme Switching**: Test different color schemes
- **Performance Testing**: Load testing with large datasets
- **Accessibility Testing**: Built-in accessibility checks

---

**Happy coding!** 🎮✨
