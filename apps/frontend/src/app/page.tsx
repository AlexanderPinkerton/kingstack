"use client";
import { useContext, useEffect } from "react";

import { Button } from "@/components/ui/button";

import { RootStoreContext } from "@/context/rootStoreContext";

import { observer } from "mobx-react-lite";
import { SupabaseClientContext } from "@/context/supabaseClientContext";

export default observer(function Page() {
  const rootStore = useContext(RootStoreContext);
  const supabase = useContext(SupabaseClientContext);

  useEffect(() => {
    supabase.auth.onAuthStateChange((event, session) => {
      console.log("Auth state changed:", event, session);
    });
  }, []);

  return (
    <main>
      {/* sign in button */}
      <Button
        onClick={async () => {
          const { error } = await supabase.auth.signInWithOAuth({
            provider: "google",
            // options: {
            //   redirectTo: window.location.origin + '/api/auth/loginComplete',
            //   // scopes: 'email profile',
            //   queryParams: {
            //     access_type: 'offline',
            //     prompt: 'consent',
            //   },
            // },
          });
          if (error) {
            console.error("Error signing in:", error);
          } else {
            console.log("Sign in initiated successfully");
          }
        }}
      >
        Sign In with Google
      </Button>

      {/* sign out button */}
      <Button
        onClick={async () => {
          const { error } = await supabase.auth.signOut();
          if (error) {
            console.error("Error signing out:", error);
          } else {
            console.log("Signed out successfully");
          }
        }}
      >
        Sign Out
      </Button>

      {/* Button which will fetch posts */}
      <Button
        onClick={async () => {
          await rootStore.postStore.fetchPosts();
        }}
      >
        Fetch Posts
      </Button>

      <Button
        onClick={async () => {
          await rootStore.postStore.fetchPosts2();
        }}
      >
        Fetch Posts 2
      </Button>

      {/* Button which will fetch posts */}
      <Button
        onClick={async () => {
          await rootStore.postStore.createPost();
        }}
      >
        Create Posts
      </Button>

      {/* // Display posts */}
      <div>
        <h2>Posts:</h2>
        <ul>
          {rootStore.postStore.getPosts().map((post, index) => (
            <li key={index}>
              <h3>{post.title}</h3>
              <p>{post.content}</p>
              <p>Published: {post.published ? "Yes" : "No"}</p>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
});
