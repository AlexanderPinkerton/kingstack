import type { Metadata } from "next";
import { createMetadata } from "@/lib/metadata";

export const metadata: Metadata = createMetadata({
  title: "AI Chat",
  description:
    "Chat with AI using multiple providers including OpenAI, Anthropic, and Google. Generate text responses and images with advanced AI models.",
  keywords: ["AI chat", "OpenAI", "Claude", "Gemini", "image generation"],
  canonical: "/chat",
});

export default function ChatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
