"use client";

import useAuthGuard from "@/hooks/useAuthGuard";
import Link from "next/link";
import { AppNavbar } from "@/components/navbar/presets/app";
import { AnimatedBorderContainer } from "@/components/ui/animated-border-container";
import { NeonCard } from "@/components/ui/neon-card";
import { GradientText } from "@/components/ui/gradient-text";
import { ThemeEditor } from "@/components/theme-editor";
import { ArrowLeft } from "lucide-react";

export default function ThemeEditorPage() {
  useAuthGuard();

  return (
    <div className="min-h-screen bg-gradient-to-b from-black to-slate-900 text-white flex flex-col">
      <AppNavbar />
      <main className="flex-1 px-4 sm:px-6 lg:px-8 pt-24 pb-16">
        <div className="max-w-4xl mx-auto">
          <Link
            href="/home"
            className="inline-flex items-center gap-2 text-slate-400 hover:text-white mb-6 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Home</span>
          </Link>

          <AnimatedBorderContainer>
            <NeonCard className="p-8">
              <div className="mb-8">
                <h1 className="text-4xl font-extrabold mb-4">
                  <GradientText>Theme Editor</GradientText>
                </h1>
                <p className="text-lg text-slate-300">
                  Live CSS variable editor for custom theme creation. Adjust
                  variables in real-time to customize your theme.
                </p>
              </div>

              <div className="space-y-6">
                <ThemeEditor />
                <div className="mt-8 p-6 bg-slate-800/30 border border-slate-700/50 rounded-lg">
                  <h3 className="text-xl font-semibold text-white mb-4">
                    Live Preview
                  </h3>
                  <p className="text-slate-300 mb-4">
                    Changes you make above are applied instantly. Note that
                    changes are only saved for your current session and will
                    reset on page refresh.
                  </p>
                  <div className="flex flex-wrap gap-4">
                    <div className="px-4 py-2 bg-[var(--primary)] text-white rounded-lg">
                      Primary Color
                    </div>
                    <div className="px-4 py-2 bg-[var(--accent)] text-white rounded-lg">
                      Accent Color
                    </div>
                    <div className="px-4 py-2 border-2 border-[var(--accent-mix)] text-white rounded-lg">
                      Accent Mix Border
                    </div>
                  </div>
                </div>
              </div>
            </NeonCard>
          </AnimatedBorderContainer>
        </div>
      </main>
    </div>
  );
}
