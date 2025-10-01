// Playground mode configuration and mock data
// This allows KingStack to run as a UI playground without Supabase

export interface PlaygroundConfig {
  enabled: boolean;
  mockData: {
    todos: any[];
    posts: any[];
    checkboxes: any[];
    users: any[];
  };
}

export const PLAYGROUND_CONFIG: PlaygroundConfig = {
  enabled: typeof window !== 'undefined' && 
    (process.env.NEXT_PUBLIC_PLAYGROUND_MODE === 'true' || 
     !process.env.NEXT_PUBLIC_SUPABASE_URL),
  
  mockData: {
    todos: [
      {
        id: '1',
        title: 'Welcome to KingStack Playground!',
        done: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        user_id: 'playground-user'
      },
      {
        id: '2',
        title: 'Explore the UI components',
        done: true,
        created_at: new Date(Date.now() - 86400000).toISOString(),
        updated_at: new Date().toISOString(),
        user_id: 'playground-user'
      },
      {
        id: '3',
        title: 'Test optimistic updates',
        done: false,
        created_at: new Date(Date.now() - 172800000).toISOString(),
        updated_at: new Date().toISOString(),
        user_id: 'playground-user'
      }
    ],
    posts: [
      {
        id: '1',
        title: 'KingStack Playground Mode',
        content: 'This is a demo post showing how KingStack works in playground mode. No database required!',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        user_id: 'playground-user',
        published: true
      },
      {
        id: '2',
        title: 'UI Components Demo',
        content: 'All the ShadCN components are available for testing and development.',
        created_at: new Date(Date.now() - 3600000).toISOString(),
        updated_at: new Date().toISOString(),
        user_id: 'playground-user',
        published: true
      }
    ],
    checkboxes: [
      {
        id: '1',
        label: 'Enable realtime updates',
        checked: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        user_id: 'playground-user'
      },
      {
        id: '2',
        label: 'Show playground mode indicator',
        checked: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        user_id: 'playground-user'
      }
    ],
    users: [
      {
        id: 'playground-user',
        email: 'playground@kingstack.dev',
        name: 'Playground User',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    ]
  }
};

export function isPlaygroundMode(): boolean {
  return PLAYGROUND_CONFIG.enabled;
}

export function getMockData<T>(type: keyof PlaygroundConfig['mockData']): T[] {
  return PLAYGROUND_CONFIG.mockData[type] as T[];
}
