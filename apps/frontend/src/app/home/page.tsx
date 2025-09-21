"use client";

import useAuthGuard from "@/hooks/useAuthGuard";
import { observer } from "mobx-react-lite";

import { useContext } from "react";

import { AnimatedBorderContainer } from "@/components/ui/animated-border-container";
import { NeonCard } from "@/components/ui/neon-card";
import { GradientText } from "@/components/ui/gradient-text";
import { PostCard } from "@/components/core/PostCard";

import { RootStoreContext } from "@/context/rootStoreContext";

import { ThemedButton } from "@/components/ui/themed-button";
import { ThemeSelector } from "@/components/ui/ThemeSelector";

import { DefaultNavbar } from "@/components/navbar/presets/default";

// ThemeEditor: A simple live CSS variable editor
import React from "react";

import { ThemeEditor } from "@/components/theme-editor";

export default observer(function HomePage() {
  useAuthGuard();

  const rootStore = useContext(RootStoreContext);

  return (
    <>
      <div className="min-h-screen bg-gradient-to-b from-black to-slate-900 text-white flex flex-col">
        <DefaultNavbar
          navLinks={[
            { title: "For Gamers", href: "/" },
            { title: "For Developers", href: "/developers" },
          ]}
        />
        <main className="flex-1 flex items-center justify-center px-4 sm:px-6 lg:px-8 pt-24">
          <div className="w-full max-w-xl mx-auto">
            <AnimatedBorderContainer>
              <NeonCard className="p-12 flex flex-col">
                <h1 className="text-4xl font-extrabold text-center mb-4">
                  <GradientText>Welcome to Kingstack</GradientText>
                </h1>
                <p className="text-lg text-slate-300 text-center mb-6">
                  You are logged in! Enjoy the futuristic experience.
                </p>
                {/* Button which will fetch posts */}
                <ThemedButton
                  onClick={async () => {
                    await rootStore.postStore.fetchPosts();
                  }}
                >
                  Fetch Posts
                </ThemedButton>
                <ThemedButton
                  onClick={async () => {
                    await rootStore.postStore.fetchPosts2();
                  }}
                >
                  Fetch Posts 2
                </ThemedButton>
                {/* Button which will create posts */}
                <ThemedButton
                  onClick={async () => {
                    await rootStore.postStore.createPost();
                  }}
                >
                  Create Posts
                </ThemedButton>
                {/* // Display posts */}
                <div>
                  <div className="mt-4 flex flex-col gap-4 w-full">
                    {rootStore.postStore.getPosts().map((post, index) => (
                      <PostCard
                        key={index}
                        title={post.title}
                        content={post.content}
                        published={post.published}
                        author={post.author}
                        timestamp={post.timestamp}
                      />
                    ))}
                  </div>
                </div>
                <span className="text-xs text-slate-500">
                  (This page matches the neon/glassmorphism theme of the core
                  components.)
                </span>

                <ThemeEditor />

                <ThemeSelector />
              </NeonCard>
            </AnimatedBorderContainer>
          </div>
        </main>
      </div>
    </>
  );
});
