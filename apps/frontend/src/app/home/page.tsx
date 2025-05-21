"use client";

import useAuthGuard from "@/hooks/useAuthGuard";
import { Navbar } from "@/components/core/navbar";
import { observer } from "mobx-react-lite";

import { useContext } from "react";

import { Button } from "@/components/ui/button";
import { AnimatedBorderContainer } from "@/components/ui/animated-border-container";
import { NeonCard } from "@/components/ui/neon-card";
import { GradientText } from "@/components/ui/gradient-text";

import { SupabaseClientContext } from "@/context/supabaseClientContext";

import { RootStoreContext } from "@/context/rootStoreContext";

export default observer(function HomePage() {
  useAuthGuard();

  const supabase = useContext(SupabaseClientContext);
  const rootStore = useContext(RootStoreContext);

  return (
    <div className="min-h-screen bg-gradient-to-b from-black to-slate-900 text-white flex flex-col">
      <Navbar navLinks={[]} cta={[]}/>
      <main className="flex-1 flex items-center justify-center px-4 sm:px-6 lg:px-8 pt-24">
        <div className="w-full max-w-xl mx-auto">
          <AnimatedBorderContainer>
            <NeonCard className="p-12 flex flex-col items-center">
              <h1 className="text-4xl font-extrabold text-center mb-4">
                <GradientText>Welcome to Kingstack</GradientText>
              </h1>
              <p className="text-lg text-slate-300 text-center mb-6">
                You are logged in! Enjoy the futuristic experience.
              </p>
              {/* sign in button */}
              <Button
                onClick={async () => {
                  const { error } = await supabase.auth.signInWithOAuth({
                    provider: "google",
                    options: {
                      redirectTo: window.location.origin,
                      // redirectTo: window.location.origin + '/api/auth/loginComplete',
                      // scopes: 'email profile',clear
                      // queryParams: {
                      //   access_type: 'offline',
                      //   prompt: 'consent',
                      // },
                    },
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
              {/* Button which will create posts */}
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
              <span className="text-xs text-slate-500">(This page matches the neon/glassmorphism theme of the core components.)</span>
            </NeonCard>
          </AnimatedBorderContainer>
        </div>
      </main>
    </div>
  );
});   
