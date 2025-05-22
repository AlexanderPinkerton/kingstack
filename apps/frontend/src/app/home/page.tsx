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

import { ThemedButton } from "@/components/ui/themed-button";

// ThemeEditor: A simple live CSS variable editor
import React, { useState } from "react";

const COLOR_VARIABLES = [
  { name: "--primary", label: "Primary" },
  { name: "--background", label: "Background" },
  { name: "--accent", label: "Accent" },
  { name: "--foreground", label: "Foreground" },
  { name: "--gradient-from", label: "Gradient From" },
  { name: "--gradient-to", label: "Gradient To" },
  { name: "--accent-1-m", label: "Accent 1" },
  
];

function getCssVar(varName: string) {
  return getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
}

export const ThemeEditor: React.FC = () => {
  // Get initial values from CSS variables
  const [colors, setColors] = useState(() => {
    const initial: Record<string, string> = {};
    COLOR_VARIABLES.forEach(({ name }) => {
      let val = getCssVar(name);
      // Try to convert oklch to hex for color input, fallback to white
      try {
        if (val.startsWith('oklch')) {
          // Optionally: parse oklch to hex (not natively supported by input[type=color])
          // For now, fallback to #ffffff
          val = "#ffffff";
        }
      } catch {}
      initial[name] = val || "#ffffff";
    });
    return initial;
  });

  const handleChange = (varName: string, value: string) => {
    setColors((prev) => ({ ...prev, [varName]: value }));
    document.documentElement.style.setProperty(varName, value);
  };

  return (
    <div style={{ background: "#222", color: "#eee", padding: 16, borderRadius: 8, margin: 16, maxWidth: 400 }}>
      <h2 style={{ fontWeight: 700, marginBottom: 8 }}>Live Theme Editor</h2>
      {COLOR_VARIABLES.map(({ name, label }) => (
        <div key={name} style={{ marginBottom: 12, display: "flex", alignItems: "center" }}>
          <label style={{ minWidth: 100 }}>{label}</label>
          <input
            type="color"
            value={colors[name]}
            onChange={(e) => handleChange(name, e.target.value)}
            style={{ marginLeft: 12, width: 40, height: 32, border: "none", background: "none" }}
          />
          <span style={{ marginLeft: 12, fontSize: 12 }}>{name}</span>
        </div>
      ))}
      <div style={{ fontSize: 12, color: "#aaa" }}>
        Changes are live and only affect your session.
      </div>
    </div>
  );
};

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
            
              <ThemeEditor />
            
            </NeonCard>
          </AnimatedBorderContainer>
        </div>
      </main>
    </div>
  );
});   
