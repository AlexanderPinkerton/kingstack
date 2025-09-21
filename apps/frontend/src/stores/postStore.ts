import { makeAutoObservable, runInAction } from "mobx";
import { type RootStore } from "./rootStore";
import { io, Socket } from "socket.io-client";

import type { PostDSS, FullPostData } from "../../../../packages/shapes/post/PostDSS";
import { fetchWithAuth } from "../lib/utils";

export class PostStore {
  rootStore: RootStore;

  // Map of postId to PostDSS (cache)
  posts = new Map<string, PostDSS>();
  loading = false;
  error: string | null = null;

  socket: Socket | null = null;
  browserId: string = Math.random().toString(36).substring(7);

  constructor(rootStore: RootStore) {
    this.rootStore = rootStore;
    makeAutoObservable(this);
  }

  setupRealtime(token: string) {
    console.log("[PostStore] setupRealtime called");
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    const REALTIME_SERVER_URL =
      process.env.NEXT_PUBLIC_NEST_BACKEND_URL || "http://localhost:3000";
    this.socket = io(REALTIME_SERVER_URL, {
      transports: ["websocket"],
      autoConnect: true,
    });
    this.socket.on("connect", () => {
      console.log("[PostStore] Realtime socket connected");
      this.socket?.emit("register", {
        token,
        browserId: this.browserId,
      });
    });
    this.socket.on("post_update", (data: any) => {
      console.log("[PostStore] Received post_update:", data);
      this.handleRealtimePostUpdate(data);
    });
    this.socket.on("disconnect", () => {
      console.log("[PostStore] Realtime socket disconnected");
    });
  }

  teardownRealtime() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  // Handle realtime post updates
  private handleRealtimePostUpdate(data: any) {
    console.log("[PostStore] handleRealtimePostUpdate called", data);
    
    if (data.type === "post_update" && data.post) {
      const post = data.post;
      
      // Only process published posts
      if (post.published === true) {
        const postDSS: PostDSS = {
          id: post.id,
          title: post.title,
          content: post.content,
          published: post.published,
          author_id: post.author_id,
          created_at: post.created_at,
        };

        if (data.event === "INSERT") {
          this.realtimeInsertPost(postDSS);
        } else if (data.event === "UPDATE") {
          this.realtimeUpdatePost(postDSS);
        } else if (data.event === "DELETE") {
          this.realtimeDeletePost(post.id);
        }
      }
    }
  }

  // Real-time insert
  realtimeInsertPost(post: PostDSS) {
    console.log("[PostStore] realtimeInsertPost called", post);
    runInAction(() => {
      this.posts.set(post.id, post);
    });
  }

  // Real-time update
  realtimeUpdatePost(post: PostDSS) {
    console.log("[PostStore] realtimeUpdatePost called", post);
    runInAction(() => {
      this.posts.set(post.id, post);
    });
  }

  // Real-time delete
  realtimeDeletePost(postId: string) {
    console.log("[PostStore] realtimeDeletePost called", postId);
    runInAction(() => {
      this.posts.delete(postId);
    });
  }

  // Fetch posts from the API endpoint
  async fetchPosts() {
    this.loading = true;
    this.error = null;
    
    try {
      const response = await fetchWithAuth(
        this.rootStore.session?.access_token,
        "/api/post"
      );

      if (!response.ok)
        throw new Error(`Failed to fetch posts: ${response.status}`);
      
      const data = await response.json();
      
      runInAction(() => {
        // Clear existing posts
        this.posts.clear();
        
        // Add all posts from the response
        for (const post of data) {
          const postDSS: PostDSS = {
            id: post.id,
            title: post.title,
            content: post.content,
            published: post.published,
            author_id: post.author_id,
            created_at: post.created_at,
          };
          this.posts.set(post.id, postDSS);
        }
        this.loading = false;
      });
    } catch (e: any) {
      runInAction(() => {
        this.error = e.message || "Unknown error";
        this.loading = false;
      });
    }
  }

  // Legacy method for backward compatibility
  getPosts(): PostDSS[] {
    return Array.from(this.posts.values());
  }

  // Remove a post from the store
  removePost(postId: string) {
    runInAction(() => {
      this.posts.delete(postId);
    });
  }

  // Update a post in the store
  updatePost(postId: string, updatedPost: Partial<PostDSS>) {
    runInAction(() => {
      const existingPost = this.posts.get(postId);
      if (existingPost) {
        this.posts.set(postId, { ...existingPost, ...updatedPost });
      }
    });
  }

  // Add or update a post in the cache
  upsertPost(post: PostDSS) {
    runInAction(() => {
      this.posts.set(post.id, post);
    });
  }

  // Create post method
  createPost = async (postData: {
    title: string;
    content?: string;
    published?: boolean;
  }) => {
    try {
      console.log("Creating post...", postData);

      const response = await fetchWithAuth(
        this.rootStore.session?.access_token,
        "/api/post",
        {
          method: "POST",
          body: JSON.stringify(postData),
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log("Post created successfully:", data);
      
      // The realtime update will handle adding the post to the store
      return data;
    } catch (error) {
      console.error("Failed to create post:", error);
      throw error;
    }
  };
}
