// Example: DateTime Transformation Pattern
// Shows how to handle API data with ISO strings vs UI data with Date objects

import { EntityAPI, OptimisticStore, createEntityController, DataTransformer } from "../optimistic-store-pattern";

// ---------- API Types (what comes from server) ----------
export interface PostApiData {
  id: string;
  title: string;
  content: string;
  authorId: string;
  createdAt: string; // ISO string from API
  updatedAt: string; // ISO string from API
  publishedAt: string | null; // ISO string or null
  likes: number;
  viewCount: number;
  tags: string[];
  metadata: {
    lastEditedAt: string; // ISO string
    scheduledFor: string | null; // ISO string or null
  };
}

export interface CreatePostApiData {
  title: string;
  content: string;
  tags?: string[];
  publishedAt?: string | null; // Client sends ISO string
  scheduledFor?: string | null;
}

export interface UpdatePostApiData {
  title?: string;
  content?: string;
  tags?: string[];
  publishedAt?: string | null;
  scheduledFor?: string | null;
}

// ---------- UI Types (what we want in the store) ----------
export interface PostUiData {
  id: string;
  title: string;
  content: string;
  authorId: string;
  createdAt: Date; // Transformed to Date object
  updatedAt: Date; // Transformed to Date object
  publishedAt: Date | null; // Transformed to Date object or null
  likes: number;
  viewCount: number;
  tags: string[];
  metadata: {
    lastEditedAt: Date; // Transformed to Date object
    scheduledFor: Date | null; // Transformed to Date object or null
  };
  
  // Computed UI properties (not from API)
  isPublished: boolean;
  isScheduled: boolean;
  timeAgo: string;
  formattedCreatedAt: string;
  formattedUpdatedAt: string;
}

export interface CreatePostUiData {
  title: string;
  content: string;
  tags?: string[];
  publishedAt?: Date | null; // UI uses Date objects
  scheduledFor?: Date | null;
}

export interface UpdatePostUiData {
  title?: string;
  content?: string;
  tags?: string[];
  publishedAt?: Date | null;
  scheduledFor?: Date | null;
}

// ---------- Data Transformer ----------
export class PostDataTransformer implements DataTransformer<PostApiData, PostUiData> {
  toUi(apiData: PostApiData): PostUiData {
    const createdAt = new Date(apiData.createdAt);
    const updatedAt = new Date(apiData.updatedAt);
    const publishedAt = apiData.publishedAt ? new Date(apiData.publishedAt) : null;
    const lastEditedAt = new Date(apiData.metadata.lastEditedAt);
    const scheduledFor = apiData.metadata.scheduledFor ? new Date(apiData.metadata.scheduledFor) : null;

    return {
      id: apiData.id,
      title: apiData.title,
      content: apiData.content,
      authorId: apiData.authorId,
      createdAt,
      updatedAt,
      publishedAt,
      likes: apiData.likes,
      viewCount: apiData.viewCount,
      tags: apiData.tags,
      metadata: {
        lastEditedAt,
        scheduledFor,
      },
      
      // Computed properties
      isPublished: !!publishedAt && publishedAt <= new Date(),
      isScheduled: !!scheduledFor && scheduledFor > new Date(),
      timeAgo: this.formatTimeAgo(createdAt),
      formattedCreatedAt: this.formatDate(createdAt),
      formattedUpdatedAt: this.formatDate(updatedAt),
    };
  }

  toApi(uiData: PostUiData): PostApiData {
    return {
      id: uiData.id,
      title: uiData.title,
      content: uiData.content,
      authorId: uiData.authorId,
      createdAt: uiData.createdAt.toISOString(),
      updatedAt: uiData.updatedAt.toISOString(),
      publishedAt: uiData.publishedAt?.toISOString() || null,
      likes: uiData.likes,
      viewCount: uiData.viewCount,
      tags: uiData.tags,
      metadata: {
        lastEditedAt: uiData.metadata.lastEditedAt.toISOString(),
        scheduledFor: uiData.metadata.scheduledFor?.toISOString() || null,
      },
    };
  }

  toApiUpdate(uiData: Partial<PostUiData>): Partial<PostApiData> {
    const apiUpdate: Partial<PostApiData> = {};
    
    if (uiData.title !== undefined) apiUpdate.title = uiData.title;
    if (uiData.content !== undefined) apiUpdate.content = uiData.content;
    if (uiData.tags !== undefined) apiUpdate.tags = uiData.tags;
    if (uiData.publishedAt !== undefined) {
      apiUpdate.publishedAt = uiData.publishedAt?.toISOString() || null;
    }
    
    // Handle nested metadata updates
    if (uiData.metadata) {
      apiUpdate.metadata = {};
      if (uiData.metadata.scheduledFor !== undefined) {
        apiUpdate.metadata.scheduledFor = uiData.metadata.scheduledFor?.toISOString() || null;
      }
    }
    
    return apiUpdate;
  }

  // Helper methods for computed properties
  private formatTimeAgo(date: Date): string {
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diffInSeconds < 60) return `${diffInSeconds}s ago`;
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    return `${Math.floor(diffInSeconds / 86400)}d ago`;
  }

  private formatDate(date: Date): string {
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
}

// ---------- API Implementation ----------
export class PostAPI implements EntityAPI<PostApiData, CreatePostApiData, UpdatePostApiData> {
  async list(): Promise<PostApiData[]> {
    const response = await fetch('/api/posts');
    if (!response.ok) throw new Error('Failed to fetch posts');
    return response.json();
  }

  async create(data: CreatePostApiData): Promise<PostApiData> {
    const response = await fetch('/api/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error('Failed to create post');
    return response.json();
  }

  async update(id: string, data: UpdatePostApiData): Promise<PostApiData> {
    const response = await fetch(`/api/posts/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error('Failed to update post');
    return response.json();
  }

  async delete(id: string): Promise<{ id: string }> {
    const response = await fetch(`/api/posts/${id}`, {
      method: 'DELETE',
    });
    if (!response.ok) throw new Error('Failed to delete post');
    return { id };
  }
}

// ---------- Enhanced UI Store ----------
export class PostUiStore extends OptimisticStore<PostUiData> {
  // Date-based computed values
  get publishedPosts(): PostUiData[] {
    return this.filter(post => post.isPublished);
  }

  get draftPosts(): PostUiData[] {
    return this.filter(post => !post.isPublished && !post.isScheduled);
  }

  get scheduledPosts(): PostUiData[] {
    return this.filter(post => post.isScheduled);
  }

  get recentPosts(): PostUiData[] {
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    return this.filter(post => post.createdAt > oneWeekAgo);
  }

  // Sort by date
  get byNewest(): PostUiData[] {
    return [...this.list].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  get byOldest(): PostUiData[] {
    return [...this.list].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }

  // Date range filtering
  getPostsInDateRange(startDate: Date, endDate: Date): PostUiData[] {
    return this.filter(post => 
      post.createdAt >= startDate && post.createdAt <= endDate
    );
  }

  getPostsCreatedAfter(date: Date): PostUiData[] {
    return this.filter(post => post.createdAt > date);
  }

  // UI-specific operations
  publishNow(id: string) {
    this.update(id, { 
      publishedAt: new Date(),
      isPublished: true,
      isScheduled: false,
    });
  }

  scheduleFor(id: string, date: Date) {
    this.update(id, {
      metadata: { scheduledFor: date },
      isScheduled: date > new Date(),
    });
  }

  // Update computed properties when data changes
  refreshComputedProperties() {
    const transformer = new PostDataTransformer();
    this.list.forEach(post => {
      const apiData = transformer.toApi(post);
      const refreshedUiData = transformer.toUi(apiData);
      this.upsert(refreshedUiData);
    });
  }
}

// ---------- Controller Setup ----------
const postUiStore = new PostUiStore();
const postAPI = new PostAPI();
const postTransformer = new PostDataTransformer();

export const usePostsWithDateTransform = createEntityController({
  queryKey: ['posts-with-dates'],
  api: postAPI,
  store: postUiStore,
  transformer: postTransformer,
  staleTime: 30_000,
  customActions: {
    // Publish immediately
    publishNow: {
      mutationFn: async (id: string) => {
        const now = new Date().toISOString();
        return postAPI.update(id, { publishedAt: now });
      },
      onOptimistic: (id: string, store: PostUiStore) => {
        store.publishNow(id);
      },
      onSuccess: (result, id, store: PostUiStore) => {
        const uiData = postTransformer.toUi(result);
        store.upsert(uiData);
      },
    },

    // Schedule for later
    schedulePost: {
      mutationFn: async ({ id, date }: { id: string; date: Date }) => {
        return postAPI.update(id, { 
          scheduledFor: date.toISOString(),
        });
      },
      onOptimistic: ({ id, date }, store: PostUiStore) => {
        store.scheduleFor(id, date);
      },
      onSuccess: (result, params, store: PostUiStore) => {
        const uiData = postTransformer.toUi(result);
        store.upsert(uiData);
      },
    },

    // Create with scheduling
    createScheduled: {
      mutationFn: async (data: CreatePostUiData & { scheduledFor: Date }) => {
        const apiData: CreatePostApiData = {
          title: data.title,
          content: data.content,
          tags: data.tags,
          scheduledFor: data.scheduledFor.toISOString(),
        };
        return postAPI.create(apiData);
      },
      onOptimistic: (data, store: PostUiStore) => {
        const tempId = `temp_${Math.random().toString(36).slice(2, 7)}`;
        const now = new Date();
        const optimisticPost: PostUiData = {
          id: tempId,
          title: data.title,
          content: data.content,
          authorId: 'current-user', // Would come from auth context
          createdAt: now,
          updatedAt: now,
          publishedAt: null,
          likes: 0,
          viewCount: 0,
          tags: data.tags || [],
          metadata: {
            lastEditedAt: now,
            scheduledFor: data.scheduledFor,
          },
          isPublished: false,
          isScheduled: data.scheduledFor > now,
          timeAgo: '0s ago',
          formattedCreatedAt: postTransformer['formatDate'](now),
          formattedUpdatedAt: postTransformer['formatDate'](now),
        };
        store.upsert(optimisticPost);
      },
      onSuccess: (result, data, store: PostUiStore) => {
        // Remove temp post and add real one
        const tempId = `temp_${Math.random().toString(36).slice(2, 7)}`;
        store.remove(tempId);
        const uiData = postTransformer.toUi(result);
        store.upsert(uiData);
      },
    },
  },
});

// ---------- Usage Example ----------
/*
import { observer } from "mobx-react-lite";
import { useState } from "react";

const PostsWithDates = observer(() => {
  const { store, actions, status } = usePostsWithDateTransform();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  return (
    <div>
      <h2>Posts with Date Transformations</h2>
      
      {/* Date-based filtering */}
      <div>
        <h3>Published Posts ({store.publishedPosts.length})</h3>
        <h3>Drafts ({store.draftPosts.length})</h3>
        <h3>Scheduled ({store.scheduledPosts.length})</h3>
        <h3>Recent Posts ({store.recentPosts.length})</h3>
      </div>

      {/* Posts list */}
      {store.byNewest.map(post => (
        <article key={post.id} className="post-card">
          <h3>{post.title}</h3>
          <p>{post.content}</p>
          
          {/* Date displays */}
          <div className="post-meta">
            <span>Created: {post.formattedCreatedAt}</span>
            <span>Updated: {post.formattedUpdatedAt}</span>
            <span>{post.timeAgo}</span>
            
            {post.publishedAt && (
              <span>Published: {post.publishedAt.toLocaleDateString()}</span>
            )}
            
            {post.isScheduled && (
              <span>Scheduled for: {post.metadata.scheduledFor?.toLocaleDateString()}</span>
            )}
          </div>

          {/* Actions */}
          <div className="post-actions">
            {!post.isPublished && (
              <button 
                onClick={() => actions.publishNow(post.id)}
                disabled={status.publishNowPending}
              >
                Publish Now
              </button>
            )}
            
            <input 
              type="datetime-local"
              value={selectedDate.toISOString().slice(0, 16)}
              onChange={(e) => setSelectedDate(new Date(e.target.value))}
            />
            <button 
              onClick={() => actions.schedulePost({ id: post.id, date: selectedDate })}
              disabled={status.schedulePostPending}
            >
              Schedule
            </button>
          </div>
        </article>
      ))}
    </div>
  );
});

// Date range picker component
const DateRangeFilter = observer(() => {
  const { store } = usePostsWithDateTransform();
  const [startDate, setStartDate] = useState<Date>(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
  const [endDate, setEndDate] = useState<Date>(new Date());

  const filteredPosts = store.getPostsInDateRange(startDate, endDate);

  return (
    <div>
      <h3>Posts in Date Range</h3>
      <input 
        type="date"
        value={startDate.toISOString().slice(0, 10)}
        onChange={(e) => setStartDate(new Date(e.target.value))}
      />
      <input 
        type="date"
        value={endDate.toISOString().slice(0, 10)}
        onChange={(e) => setEndDate(new Date(e.target.value))}
      />
      
      <div>Found {filteredPosts.length} posts in range</div>
      {filteredPosts.map(post => (
        <div key={post.id}>
          {post.title} - {post.formattedCreatedAt}
        </div>
      ))}
    </div>
  );
});
*/
