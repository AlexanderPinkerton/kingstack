import { makeAutoObservable, runInAction } from "mobx";
import { type RootStore } from "./rootStore";

import type { PostDSS } from "../../../../packages/shapes/post/PostDSS";

import { fetchInternal } from "../lib/utils";

export class PostStore {
  rootStore: RootStore;

  private posts = [];

  constructor(rootStore: RootStore) {
    this.rootStore = rootStore;

    makeAutoObservable(this);
  }

  getPosts(): PostDSS[] {
    return this.posts;
  }

  fetchPosts = async () => {
    try {
      // Fetch the posts from :3000
      // Assuming the backend is running on the same origin

      console.log(
        "Fetching posts from NEST backend...",
        this.rootStore.session,
      );

      const response = await fetchInternal(
        this.rootStore?.session?.access_token,
        `${process.env.NEXT_PUBLIC_NEST_BACKEND_URL}/posts`,
        "GET",
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();

      console.log("Fetched posts:", data);

      runInAction(() => {
        this.posts = data;
        console.log("Posts fetched successfully:", this.posts);
      });
    } catch (error) {
      console.error("Failed to fetch posts:", error);
    }
  };

  fetchPosts2 = async () => {
    try {
      // Fetch the posts from :3000
      // Assuming the backend is running on the same origin

      console.log(
        "Fetching posts from NEXT backend...",
        this.rootStore.session,
      );

      const response = await fetchInternal(
        this.rootStore?.session?.access_token,
        "/api/post",
        "GET",
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();

      console.log("Fetched posts 2:", data);

      runInAction(() => {
        this.posts = data;
        console.log("Posts fetched successfully:", this.posts);
      });
    } catch (error) {
      console.error("Failed to fetch posts:", error);
    }
  };

  createPost = async () => {
    try {
      console.log("Creating post...");

      const response = await fetch("http://localhost:3000/posts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          // Add the supabase bearer token if needed
          Authorization: `Bearer ${this.rootStore?.session?.access_token || "xxx"}`,
        },
        body: JSON.stringify({
          title: "Sample Post",
          content: "This is a sample post content.",
          published: true,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log("Post created successfully:", data);
    } catch (error) {
      console.error("Failed to create post:", error);
    }
  };
}
