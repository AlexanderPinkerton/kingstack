"use client";

import useAuthGuard from "@/hooks/useAuthGuard";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppNavbar } from "@/components/navbar/presets/app";
import { AnimatedBorderContainer } from "@/components/ui/animated-border-container";
import { NeonCard } from "@/components/ui/neon-card";
import { GradientText } from "@/components/ui/gradient-text";
import { isPlaygroundMode } from "@kingstack/shared";
import {
  Zap,
  RefreshCw,
  MessageSquare,
  Palette,
  Type,
  Sparkles,
  ArrowRight,
  ExternalLink,
} from "lucide-react";

export default function HomePage() {
  useAuthGuard(); // This ensures user is logged in

  const router = useRouter();

  const features = [
    {
      id: "optimistic",
      title: "Optimistic Store",
      description:
        "Advanced state management with custom transformers, search, filtering, and analytics",
      icon: <Zap className="w-6 h-6" />,
      color: "from-purple-500 to-pink-500",
      status: "available",
    },
    {
      id: "realtime",
      title: "Realtime Sync",
      description:
        "Multi-user real-time synchronization with optimistic updates and auto-rollback",
      icon: <RefreshCw className="w-6 h-6" />,
      color: "from-blue-500 to-cyan-500",
      status: "available",
    },
    {
      id: "ai-chat",
      title: "AI Chat",
      description:
        "Multi-provider AI chat with streaming responses and image generation",
      icon: <MessageSquare className="w-6 h-6" />,
      color: "from-emerald-500 to-teal-500",
      status: "available",
    },
    {
      id: "theme-builder",
      title: "Theme Builder",
      description:
        "Preset themes and full CSS variable editor with live preview and export",
      icon: <Palette className="w-6 h-6" />,
      color: "from-orange-500 to-pink-500",
      status: "available",
    },
    {
      id: "font-chooser",
      title: "Font Chooser",
      description:
        "Typography customization with font pairing suggestions (Coming Soon)",
      icon: <Type className="w-6 h-6" />,
      color: "from-slate-500 to-slate-600",
      status: "coming-soon",
    },
  ];

  const handleFeatureClick = (featureId: string) => {
    if (featureId === "ai-chat") {
      window.open("/chat", "_blank");
      return;
    }
    if (featureId === "font-chooser") {
      return; // Coming soon features don't do anything
    }
    router.push(`/home/${featureId}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-black to-slate-900 text-white flex flex-col">
      <AppNavbar />
      <main className="flex-1 px-4 sm:px-6 lg:px-8 pt-24 pb-16">
        <div className="max-w-7xl mx-auto">
          {/* Hero Section */}
          <div className="text-center mb-12">
            <h1 className="text-5xl md:text-6xl font-extrabold mb-6">
              <GradientText>Welcome to KingStack</GradientText>
            </h1>
            <p className="text-xl text-slate-300 mb-4 max-w-3xl mx-auto">
              A modern full-stack TypeScript monorepo with everything you need
              to build production-ready applications
            </p>
            <p className="text-sm text-slate-400 max-w-2xl mx-auto">
              Explore the features below to see what makes KingStack powerful
            </p>

            {/* Playground Mode Indicator */}
            {typeof window !== "undefined" && isPlaygroundMode() && (
              <div className="mt-6 flex justify-center">
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-yellow-900/30 border border-yellow-500/40 rounded-full text-sm">
                  <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse"></div>
                  <span className="text-yellow-300">Playground Mode</span>
                  <span className="text-yellow-400/70">•</span>
                  <span className="text-yellow-200/80 text-xs">
                    Connect to Supabase for full power
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Features Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
            {features.map((feature) => (
              <button
                key={feature.id}
                onClick={() => handleFeatureClick(feature.id)}
                disabled={feature.status === "coming-soon"}
                className={`group relative text-left transition-all duration-300 ${
                  feature.status === "coming-soon"
                    ? "opacity-60 cursor-not-allowed"
                    : "hover:scale-105 cursor-pointer"
                }`}
              >
                <NeonCard className="p-6 h-full flex flex-col">
                  <div
                    className={`w-12 h-12 rounded-lg bg-gradient-to-br ${feature.color} flex items-center justify-center mb-4 text-white shadow-lg`}
                  >
                    {feature.icon}
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">
                    {feature.title}
                  </h3>
                  <p className="text-slate-400 text-sm mb-4 flex-1">
                    {feature.description}
                  </p>
                  <div className="flex items-center justify-between">
                    {feature.status === "coming-soon" ? (
                      <span className="text-xs text-slate-500 font-medium">
                        Coming Soon
                      </span>
                    ) : feature.id === "ai-chat" ? (
                      <span className="text-xs text-emerald-400 font-medium flex items-center gap-1">
                        Open in new tab
                        <ExternalLink className="w-3 h-3" />
                      </span>
                    ) : (
                      <span className="text-xs text-purple-400 font-medium flex items-center gap-1 group-hover:gap-2 transition-all">
                        Try it now
                        <ArrowRight className="w-3 h-3" />
                      </span>
                    )}
                  </div>
                </NeonCard>
              </button>
            ))}
          </div>

          {/* Quick Links Section */}
          <div className="mt-12">
            <AnimatedBorderContainer>
              <NeonCard className="p-8">
                <h2 className="text-2xl font-bold text-white mb-6 text-center">
                  <GradientText>Quick Links</GradientText>
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Link
                    href="/chat"
                    className="flex items-center justify-center gap-2 px-6 py-4 bg-slate-800/50 border border-slate-600 rounded-lg hover:bg-slate-700/50 transition-colors text-white"
                  >
                    <MessageSquare className="w-5 h-5" />
                    <span>AI Chat</span>
                    <ExternalLink className="w-4 h-4" />
                  </Link>
                  <Link
                    href="/admin/dashboard"
                    className="flex items-center justify-center gap-2 px-6 py-4 bg-slate-800/50 border border-slate-600 rounded-lg hover:bg-slate-700/50 transition-colors text-white"
                  >
                    <Sparkles className="w-5 h-5" />
                    <span>Admin Dashboard</span>
                    <ExternalLink className="w-4 h-4" />
                  </Link>
                  <a
                    href="https://github.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 px-6 py-4 bg-slate-800/50 border border-slate-600 rounded-lg hover:bg-slate-700/50 transition-colors text-white"
                  >
                    <Zap className="w-5 h-5" />
                    <span>Documentation</span>
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              </NeonCard>
            </AnimatedBorderContainer>
          </div>
        </div>
      </main>
    </div>
  );
}
