import { makeAutoObservable, runInAction } from "mobx";
import { type RootStore } from "./rootStore";

import type { PostDSS } from "../../../../packages/shapes/post/PostDSS";

import { fetchInternal } from "../lib/utils";

export class PostStore {
  rootStore: RootStore;

  private posts: PostDSS[] = [];

  constructor(rootStore: RootStore) {
    this.rootStore = rootStore;

    makeAutoObservable(this);
  }

  getPosts(): PostDSS[] {
    return this.posts;
  }

  fetchPosts = async () => {
    try {
      // Fetch the posts from the backend
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

      //   {
      //     "id": "cmaywxtmi00058ot6dygzewtr",
      //     "title": "Sample Post",
      //     "content": "This is a sample post content.",
      //     "published": true,
      //     "author_id": "211154bd-0bfb-40eb-884b-df5ae1d3e2a2",
      //     "created_at": "2025-05-22T05:10:09.210Z"
      // }

      // Convert the data to PostDSS[]
      const posts = data.map((post: any) => ({
        title: post.title,
        content: post.content,
        published: post.published,
        author: post.author_id,
        timestamp: post.created_at,
      }));

      runInAction(() => {
        this.posts = posts;
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

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_NEST_BACKEND_URL}/posts`,
        {
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
        },
      );

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

// TODO: Do something similar for the posts example
// setupRealtime(token: string) {
//     console.log("[MatchStore] setupRealtime called");
//     if (this.socket) {
//       this.socket.disconnect();
//       this.socket = null;
//     }
//     const REALTIME_SERVER_URL =
//       process.env.NEXT_PUBLIC_NEST_BACKEND_URL || "http://localhost:3000";
//     this.socket = io(REALTIME_SERVER_URL, {
//       transports: ["websocket"],
//       autoConnect: true,
//     });
//     this.socket.on("connect", () => {
//       console.log("[MatchStore] Realtime socket connected");
//       this.socket?.emit("register", {
//         token,
//         browserId: this.browserId,
//       });
//     });
//     this.socket.on("db_update", (data: any) => {
//       // Handle only match_user_data table updates for now
//       if (data.table === "match_user_data") {
//         if (data.eventType === "UPDATE") {
//           // Find the matchUserData for this user
//           const personalMud = Array.isArray(data.matchUserData)
//             ? data.matchUserData.find(
//                 (mud: any) =>
//                   mud.user_id === this.rootStore.userStore.userData?.id,
//               )
//             : data.matchUserData;
//           this.realtimeUpdateMatch(
//             personalMud,
//             data.matchData,
//             data.opponentUser,
//           );
//         }
//         if (data.eventType === "INSERT") {
//           const personalMud = Array.isArray(data.matchUserData)
//             ? data.matchUserData.find(
//                 (mud: any) =>
//                   mud.user_id === this.rootStore.userStore.userData?.id,
//               )
//             : data.matchUserData;
//           this.realtimeInsertMatch(
//             personalMud,
//             data.matchData,
//             data.opponentUser,
//           );
//         }
//       }
//     });
//     this.socket.on("disconnect", () => {
//       // Optional: handle reconnect or cleanup
//     });
//   }

//   teardownRealtime() {
//     if (this.socket) {
//       this.socket.disconnect();
//       this.socket = null;
//     }
//   }
