import { makeAutoObservable, runInAction } from "mobx";
import { type RootStore } from "./rootStore";
import { Socket } from "socket.io-client";

import type { PostDSS, FullPostData } from "../../../../packages/shapes/post/PostDSS";
import { fetchWithAuth } from "../lib/utils";
import { RealtimeStore } from "./interfaces/RealtimeStore";

export class PostStore implements RealtimeStore {
  rootStore: RootStore;

  // Map of postId to PostDSS (cache)
  posts = new Map<string, PostDSS>();
  loading = false;
  error: string | null = null;

  constructor(rootStore: RootStore) {
    this.rootStore = rootStore;
    makeAutoObservable(this);
  }

  setupRealtimeHandlers(socket: Socket) {
    console.log("[PostStore] Setting up realtime handlers");
    
    // Listen for post updates
    socket.on("post_update", (data: any) => {
      console.log("[PostStore] Received post_update:", data);
      this.handleRealtimePostUpdate(data);
    });
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
  async fetchPosts(options: { nestjs: boolean } = { nestjs: false }) {
    this.loading = true;
    this.error = null;
    
    try {

      let url = "/api/post";
      if (options.nestjs) {
        url = process.env.NEXT_PUBLIC_NEST_BACKEND_URL + "/posts";
      }

      const response = await fetchWithAuth(
        this.rootStore.session?.access_token,
        url
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
