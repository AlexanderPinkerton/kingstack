"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useState, useMemo } from "react";
import type { ChatUIMessage } from "../api/ai/openai/route";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

type ChatMode = "text" | "image";

interface ImageMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  image?: string;
  timestamp: number;
}

// Helper to get provider endpoint for a model
function getProviderEndpoint(modelId: string): string {
  if (modelId.startsWith("gpt-")) return "/api/ai/openai";
  if (modelId.startsWith("claude-")) return "/api/ai/anthropic";
  if (modelId.startsWith("gemini-")) return "/api/ai/google";
  return "/api/ai/openai"; // fallback
}

export default function ChatPage() {
  const [mode, setMode] = useState<ChatMode>("text");
  const [modelId, setModelId] = useState("gpt-5-nano");
  const [imageMessages, setImageMessages] = useState<ImageMessage[]>([]);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);

  // Get the correct provider endpoint based on selected model
  const apiEndpoint = useMemo(() => getProviderEndpoint(modelId), [modelId]);

  const { messages, sendMessage, status, stop, error } = useChat<ChatUIMessage>(
    {
      transport: new DefaultChatTransport({
        api: apiEndpoint,
        body: {
          modelId,
        },
      }),
    },
  );

  const [input, setInput] = useState("");

  const handleTextSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && status === "ready") {
      sendMessage({ text: input });
      setInput("");
    }
  };

  const handleImageSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isGeneratingImage) return;

    const userMessage: ImageMessage = {
      id: Date.now().toString(),
      role: "user",
      content: input,
      timestamp: Date.now(),
    };

    setImageMessages((prev) => [...prev, userMessage]);
    const prompt = input;
    setInput("");
    setIsGeneratingImage(true);

    try {
      const response = await fetch("/api/ai/openai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, type: "image" }),
      });

      if (!response.ok) {
        throw new Error("Failed to generate image");
      }

      const data = await response.json();

      const assistantMessage: ImageMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: `Generated image for: "${prompt}"`,
        image: data.image,
        timestamp: Date.now(),
      };

      setImageMessages((prev) => [...prev, assistantMessage]);
    } catch (err) {
      const errorMessage: ImageMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "Failed to generate image. Please try again.",
        timestamp: Date.now(),
      };
      setImageMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const currentMessages = mode === "text" ? messages : imageMessages;
  const isLoading = mode === "text" ? status !== "ready" : isGeneratingImage;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 to-slate-900 flex flex-col">
      {/* Header */}
      <div className="border-b border-slate-800 bg-slate-950/50 backdrop-blur">
        <div className="max-w-4xl mx-auto p-4 flex items-center justify-between gap-4">
          <h1 className="text-2xl font-bold text-white">AI Chat</h1>

          <div className="flex items-center gap-4">
            {/* Mode Toggle */}
            <ToggleGroup
              type="single"
              value={mode}
              onValueChange={(value) => value && setMode(value as ChatMode)}
              className="bg-slate-900 border border-slate-700"
            >
              <ToggleGroupItem
                value="text"
                className="px-6 text-slate-300 data-[state=on]:bg-blue-600 data-[state=on]:text-white"
              >
                Text Chat
              </ToggleGroupItem>
              <ToggleGroupItem
                value="image"
                className="px-6 text-slate-300 data-[state=on]:bg-purple-600 data-[state=on]:text-white"
              >
                Image Generation
              </ToggleGroupItem>
            </ToggleGroup>

            {/* Model Selector - Only for text mode */}
            {mode === "text" && (
              <Select value={modelId} onValueChange={setModelId}>
                <SelectTrigger className="w-64 bg-slate-900 border-slate-700 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-700 text-white">
                  <SelectItem
                    value="gpt-5-nano"
                    className="text-slate-100 focus:bg-slate-800 focus:text-white"
                  >
                    GPT-5 Nano
                  </SelectItem>
                  <SelectItem
                    value="gpt-5"
                    className="text-slate-100 focus:bg-slate-800 focus:text-white"
                  >
                    GPT-5
                  </SelectItem>
                  <SelectItem
                    value="gpt-4o"
                    className="text-slate-100 focus:bg-slate-800 focus:text-white"
                  >
                    GPT-4o
                  </SelectItem>
                  <SelectItem
                    value="gpt-4o-mini"
                    className="text-slate-100 focus:bg-slate-800 focus:text-white"
                  >
                    GPT-4o Mini
                  </SelectItem>
                  <SelectItem
                    value="claude-sonnet-4"
                    className="text-slate-100 focus:bg-slate-800 focus:text-white"
                  >
                    Claude Sonnet 4
                  </SelectItem>
                  <SelectItem
                    value="claude-opus-4"
                    className="text-slate-100 focus:bg-slate-800 focus:text-white"
                  >
                    Claude Opus 4
                  </SelectItem>
                  <SelectItem
                    value="claude-haiku-4"
                    className="text-slate-100 focus:bg-slate-800 focus:text-white"
                  >
                    Claude Haiku 4
                  </SelectItem>
                  <SelectItem
                    value="gemini-2.0-flash"
                    className="text-slate-100 focus:bg-slate-800 focus:text-white"
                  >
                    Gemini 2.0 Flash
                  </SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto p-4 space-y-4">
          {currentMessages.length === 0 && (
            <Card className="p-8 bg-slate-900/50 border-slate-800 text-center">
              <p className="text-slate-400 text-lg">
                {mode === "text"
                  ? "Start a conversation with the AI"
                  : "Generate amazing images with AI"}
              </p>
              <p className="text-slate-500 text-sm mt-2">
                {mode === "text"
                  ? "Type a message below to get started"
                  : "Describe the image you want to create"}
              </p>
            </Card>
          )}

          {/* Text Messages */}
          {mode === "text" &&
            messages.map((message) => (
              <div
                key={message.id}
                className={`flex gap-3 ${message.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <Card
                  className={`p-4 max-w-[80%] ${
                    message.role === "user"
                      ? "bg-blue-600 border-blue-600 text-white"
                      : "bg-slate-900/50 border-slate-800 text-slate-100"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-1 space-y-2">
                      {message.parts.map((part, index) => {
                        if (part.type === "text") {
                          return (
                            <p key={index} className="whitespace-pre-wrap">
                              {part.text}
                            </p>
                          );
                        }
                        return null;
                      })}

                      {/* Show metadata */}
                      {message.metadata && (
                        <div className="flex items-center gap-4 text-xs opacity-60 mt-2 pt-2 border-t border-slate-700/50">
                          {message.metadata.createdAt && (
                            <span>
                              {new Date(
                                message.metadata.createdAt,
                              ).toLocaleTimeString()}
                            </span>
                          )}
                          {message.metadata.model && (
                            <span>{message.metadata.model}</span>
                          )}
                          {message.metadata.totalUsage && (
                            <span>
                              {message.metadata.totalUsage.totalTokens} tokens
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              </div>
            ))}

          {/* Image Messages */}
          {mode === "image" &&
            imageMessages.map((message) => (
              <div
                key={message.id}
                className={`flex gap-3 ${message.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <Card
                  className={`p-4 max-w-[80%] ${
                    message.role === "user"
                      ? "bg-purple-600 border-purple-600 text-white"
                      : "bg-slate-900/50 border-slate-800 text-slate-100"
                  }`}
                >
                  <div className="flex flex-col gap-3">
                    <p className="whitespace-pre-wrap">{message.content}</p>
                    {message.image && (
                      <img
                        src={`data:image/png;base64,${message.image}`}
                        alt="Generated"
                        className="rounded-lg max-w-full h-auto"
                      />
                    )}
                    <div className="flex items-center gap-2 text-xs opacity-60">
                      <span>
                        {new Date(message.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                  </div>
                </Card>
              </div>
            ))}

          {/* Text Chat Loading/Status Indicator */}
          {mode === "text" &&
            (status === "submitted" || status === "streaming") && (
              <div className="flex items-center gap-3">
                <Card className="p-4 bg-slate-900/50 border-slate-800">
                  <div className="flex items-center gap-3">
                    <div className="flex gap-1">
                      <span className="w-2 h-2 bg-slate-500 rounded-full animate-bounce" />
                      <span
                        className="w-2 h-2 bg-slate-500 rounded-full animate-bounce"
                        style={{ animationDelay: "0.1s" }}
                      />
                      <span
                        className="w-2 h-2 bg-slate-500 rounded-full animate-bounce"
                        style={{ animationDelay: "0.2s" }}
                      />
                    </div>
                    <span className="text-sm text-slate-400">
                      {status === "submitted" ? "Thinking..." : "Responding..."}
                    </span>
                    <Button
                      onClick={stop}
                      variant="ghost"
                      size="sm"
                      className="text-red-400 hover:text-red-300 hover:bg-red-950/20"
                    >
                      Stop
                    </Button>
                  </div>
                </Card>
              </div>
            )}

          {/* Image Generation Loading Indicator */}
          {mode === "image" && isGeneratingImage && (
            <div className="flex items-center gap-3">
              <Card className="p-4 bg-slate-900/50 border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" />
                    <span
                      className="w-2 h-2 bg-purple-500 rounded-full animate-bounce"
                      style={{ animationDelay: "0.1s" }}
                    />
                    <span
                      className="w-2 h-2 bg-purple-500 rounded-full animate-bounce"
                      style={{ animationDelay: "0.2s" }}
                    />
                  </div>
                  <span className="text-sm text-slate-400">
                    Generating image...
                  </span>
                </div>
              </Card>
            </div>
          )}

          {/* Text Chat Error State */}
          {mode === "text" && error && (
            <Card className="p-4 bg-red-950/20 border-red-900/50">
              <div className="flex items-start gap-3">
                <div className="flex-1">
                  <p className="text-red-400 font-medium">An error occurred</p>
                  <p className="text-red-300 text-sm mt-1">
                    Please try sending your message again.
                  </p>
                </div>
              </div>
            </Card>
          )}
        </div>
      </div>

      {/* Input Area */}
      <div className="border-t border-slate-800 bg-slate-950/50 backdrop-blur">
        <div className="max-w-4xl mx-auto p-4">
          <form
            onSubmit={mode === "text" ? handleTextSubmit : handleImageSubmit}
            className="flex gap-2"
          >
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={
                mode === "text"
                  ? "Type your message..."
                  : "Describe the image you want to generate..."
              }
              disabled={isLoading}
              className="flex-1 bg-slate-900 border-slate-700 text-white placeholder:text-slate-500 focus:border-blue-600"
            />
            <Button
              type="submit"
              disabled={isLoading || !input.trim()}
              className={
                mode === "text"
                  ? "bg-blue-600 hover:bg-blue-700 text-white"
                  : "bg-purple-600 hover:bg-purple-700 text-white"
              }
            >
              {mode === "text" ? "Send" : "Generate"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
