// Example: User Controller with relationship management

import { makeAutoObservable } from "mobx";
import { useQuery, useMutation, useEffect } from "@tanstack/react-query";
import { EntityAPI, OptimisticStore, createEntityController, createReadOnlyController } from "../optimistic-store-pattern";

// ---------- User Types ----------
export interface User {
  id: string;
  username: string;
  email: string;
  displayName: string;
  avatar?: string;
  bio?: string;
  isFollowing: boolean;
  followerCount: number;
  followingCount: number;
  createdAt: string;
  lastActiveAt: string;
  role: 'user' | 'moderator' | 'admin';
}

export interface CreateUserData {
  username: string;
  email: string;
  displayName: string;
  bio?: string;
}

export interface UpdateUserData {
  displayName?: string;
  bio?: string;
  avatar?: string;
}

// ---------- User API ----------
export class UserAPI implements EntityAPI<User, CreateUserData, UpdateUserData> {
  async list(): Promise<User[]> {
    const response = await fetch('/api/users');
    if (!response.ok) throw new Error('Failed to fetch users');
    return response.json();
  }

  async create(data: CreateUserData): Promise<User> {
    const response = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error('Failed to create user');
    return response.json();
  }

  async update(id: string, data: UpdateUserData): Promise<User> {
    const response = await fetch(`/api/users/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error('Failed to update user');
    return response.json();
  }

  async delete(id: string): Promise<{ id: string }> {
    const response = await fetch(`/api/users/${id}`, {
      method: 'DELETE',
    });
    if (!response.ok) throw new Error('Failed to delete user');
    return { id };
  }

  // User-specific endpoints
  async follow(id: string): Promise<User> {
    const response = await fetch(`/api/users/${id}/follow`, {
      method: 'POST',
    });
    if (!response.ok) throw new Error('Failed to follow user');
    return response.json();
  }

  async unfollow(id: string): Promise<User> {
    const response = await fetch(`/api/users/${id}/follow`, {
      method: 'DELETE',
    });
    if (!response.ok) throw new Error('Failed to unfollow user');
    return response.json();
  }

  async block(id: string): Promise<User> {
    const response = await fetch(`/api/users/${id}/block`, {
      method: 'POST',
    });
    if (!response.ok) throw new Error('Failed to block user');
    return response.json();
  }

  async getFollowers(id: string): Promise<User[]> {
    const response = await fetch(`/api/users/${id}/followers`);
    if (!response.ok) throw new Error('Failed to fetch followers');
    return response.json();
  }

  async getFollowing(id: string): Promise<User[]> {
    const response = await fetch(`/api/users/${id}/following`);
    if (!response.ok) throw new Error('Failed to fetch following');
    return response.json();
  }
}

// ---------- Enhanced User Store ----------
export class UserStore extends OptimisticStore<User> {
  // Filtering and sorting
  get activeUsers(): User[] {
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    return this.filter(user => new Date(user.lastActiveAt) > oneWeekAgo);
  }

  get followedUsers(): User[] {
    return this.filter(user => user.isFollowing);
  }

  get moderators(): User[] {
    return this.filter(user => user.role === 'moderator' || user.role === 'admin');
  }

  get byPopularity(): User[] {
    return [...this.list].sort((a, b) => b.followerCount - a.followerCount);
  }

  get byActivity(): User[] {
    return [...this.list].sort((a, b) => 
      new Date(b.lastActiveAt).getTime() - new Date(a.lastActiveAt).getTime()
    );
  }

  // Search functionality
  search(query: string): User[] {
    const lowerQuery = query.toLowerCase();
    return this.filter(user => 
      user.username.toLowerCase().includes(lowerQuery) ||
      user.displayName.toLowerCase().includes(lowerQuery) ||
      user.email.toLowerCase().includes(lowerQuery) ||
      user.bio?.toLowerCase().includes(lowerQuery)
    );
  }

  // Relationship operations
  toggleFollowLocal(id: string) {
    const user = this.get(id);
    if (user) {
      this.update(id, {
        isFollowing: !user.isFollowing,
        followerCount: user.isFollowing ? user.followerCount - 1 : user.followerCount + 1,
      });
    }
  }

  // Analytics
  get totalUsers(): number {
    return this.count;
  }

  get averageFollowerCount(): number {
    if (this.count === 0) return 0;
    return this.list.reduce((sum, user) => sum + user.followerCount, 0) / this.count;
  }

  getRoleDistribution(): Record<User['role'], number> {
    return this.list.reduce((acc, user) => {
      acc[user.role] = (acc[user.role] || 0) + 1;
      return acc;
    }, {} as Record<User['role'], number>);
  }
}

// ---------- Current User Store (singleton pattern) ----------
export class CurrentUserStore {
  user: User | null = null;
  isAuthenticated = false;

  constructor() {
    makeAutoObservable(this, {}, { autoBind: true });
  }

  setUser(user: User | null) {
    this.user = user;
    this.isAuthenticated = !!user;
  }

  updateUser(updates: Partial<User>) {
    if (this.user) {
      this.user = { ...this.user, ...updates };
    }
  }

  get isAdmin(): boolean {
    return this.user?.role === 'admin';
  }

  get isModerator(): boolean {
    return this.user?.role === 'moderator' || this.user?.role === 'admin';
  }
}

// ---------- Controller Setup ----------
const userStore = new UserStore();
const userAPI = new UserAPI();
const currentUserStore = new CurrentUserStore();

export const useUsersController = createEntityController({
  queryKey: ['users'],
  api: userAPI,
  store: userStore,
  staleTime: 60_000, // Users change less frequently
  customActions: {
    // Follow/Unfollow
    toggleFollow: {
      mutationFn: async (id: string) => {
        const user = userStore.get(id);
        if (!user) throw new Error('User not found');
        
        return user.isFollowing 
          ? userAPI.unfollow(id)
          : userAPI.follow(id);
      },
      onOptimistic: (id: string, store: UserStore) => {
        store.toggleFollowLocal(id);
      },
      onSuccess: (result, _id, store: UserStore) => {
        store.upsert(result);
      },
    },

    // Block user
    blockUser: {
      mutationFn: userAPI.block,
      onOptimistic: (id: string, store: UserStore) => {
        // Optimistically remove from following and hide from lists
        const user = store.get(id);
        if (user) {
          store.update(id, { isFollowing: false });
        }
      },
      onSuccess: (result, _id, store: UserStore) => {
        // Actually remove blocked users from the store
        store.remove(result.id);
      },
    },

    // Batch follow multiple users
    followMultiple: {
      mutationFn: async (userIds: string[]) => {
        const results = await Promise.all(
          userIds.map(id => userAPI.follow(id))
        );
        return { followed: results };
      },
      onOptimistic: (userIds: string[], store: UserStore) => {
        userIds.forEach(id => {
          const user = store.get(id);
          if (user && !user.isFollowing) {
            store.update(id, { 
              isFollowing: true, 
              followerCount: user.followerCount + 1 
            });
          }
        });
      },
      onSuccess: (result, _params, store: UserStore) => {
        result.followed.forEach(user => store.upsert(user));
      },
    },
  },
});

// Current user controller (separate concern)
export const useCurrentUserController = () => {
  const query = useQuery({
    queryKey: ['currentUser'],
    queryFn: async () => {
      const response = await fetch('/api/auth/me');
      if (!response.ok) {
        if (response.status === 401) return null;
        throw new Error('Failed to fetch current user');
      }
      return response.json();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  useEffect(() => {
    currentUserStore.setUser(query.data || null);
  }, [query.data]);

  const updateProfile = useMutation({
    mutationFn: async (data: UpdateUserData) => {
      if (!currentUserStore.user) throw new Error('Not authenticated');
      
      const response = await fetch(`/api/users/${currentUserStore.user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to update profile');
      return response.json();
    },
    onMutate: (data) => {
      currentUserStore.updateUser(data);
    },
    onSuccess: (result) => {
      currentUserStore.setUser(result);
      // Also update in the main users store if present
      userStore.upsert(result);
    },
    onError: () => {
      // Rollback optimistic update
      if (query.data) {
        currentUserStore.setUser(query.data);
      }
    },
  });

  return {
    store: currentUserStore,
    actions: {
      updateProfile: (data: UpdateUserData) => updateProfile.mutate(data),
      refetch: () => query.refetch(),
    },
    status: {
      isLoading: query.isLoading,
      isError: query.isError,
      error: (query.error as Error) ?? null,
      updatePending: updateProfile.isPending,
    },
  };
};

// Read-only controllers for specific user lists
export const useFollowersController = (userId: string) => 
  createReadOnlyController(
    ['users', userId, 'followers'],
    () => userAPI.getFollowers(userId)
  );

export const useFollowingController = (userId: string) => 
  createReadOnlyController(
    ['users', userId, 'following'],
    () => userAPI.getFollowing(userId)
  );

// Export store instances for direct access if needed
export { userStore, currentUserStore };

// ---------- Usage Examples ----------
/*
// Main user directory
const UserDirectory = observer(() => {
  const { store, actions, status } = useUsersController();
  const { store: currentUser } = useCurrentUserController();
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<'all' | 'active' | 'following'>('all');

  const displayedUsers = useMemo(() => {
    let users = store.list;
    
    switch (filter) {
      case 'active':
        users = store.activeUsers;
        break;
      case 'following':
        users = store.followedUsers;
        break;
    }
    
    if (searchQuery) {
      users = users.filter(u => store.search(searchQuery).includes(u));
    }
    
    return users;
  }, [searchQuery, filter, store.list]);

  return (
    <div>
      <input 
        placeholder="Search users..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
      />
      
      <select value={filter} onChange={(e) => setFilter(e.target.value as any)}>
        <option value="all">All Users</option>
        <option value="active">Active Users</option>
        <option value="following">Following</option>
      </select>

      <div>
        Total: {store.totalUsers} | 
        Average followers: {store.averageFollowerCount.toFixed(1)}
      </div>
      
      {displayedUsers.map(user => (
        <div key={user.id} className="user-card">
          <img src={user.avatar} alt={user.displayName} />
          <div>
            <h3>{user.displayName}</h3>
            <p>@{user.username}</p>
            <p>{user.bio}</p>
            <p>{user.followerCount} followers</p>
          </div>
          
          {currentUser.user?.id !== user.id && (
            <button 
              onClick={() => actions.toggleFollow(user.id)}
              disabled={status.toggleFollowPending}
            >
              {user.isFollowing ? 'Unfollow' : 'Follow'}
            </button>
          )}
          
          {currentUser.isModerator && (
            <button 
              onClick={() => actions.blockUser(user.id)}
              disabled={status.blockUserPending}
            >
              Block
            </button>
          )}
        </div>
      ))}
    </div>
  );
});

// Profile page
const ProfilePage = observer(({ userId }: { userId: string }) => {
  const { store: users } = useUsersController();
  const followersController = useFollowersController(userId);
  const followingController = useFollowingController(userId);
  
  const user = users.get(userId);
  
  if (!user) return <div>User not found</div>;
  
  return (
    <div>
      <h1>{user.displayName}</h1>
      <p>@{user.username}</p>
      <p>{user.bio}</p>
      
      <div>
        <h2>Followers ({user.followerCount})</h2>
        {followersController.store.list.map(follower => (
          <div key={follower.id}>{follower.displayName}</div>
        ))}
      </div>
      
      <div>
        <h2>Following ({user.followingCount})</h2>
        {followingController.store.list.map(following => (
          <div key={following.id}>{following.displayName}</div>
        ))}
      </div>
    </div>
  );
});
*/
