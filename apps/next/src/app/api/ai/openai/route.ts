import { type NextRequest, NextResponse } from "next/server";

import {
  generateText,
  experimental_generateImage as generateImage,
  streamText,
  convertToModelMessages,
  type UIMessage,
  type LanguageModelUsage,
} from "ai";
import { openai } from "@ai-sdk/openai";

import { getModel, getDefaultModelForProvider } from "../models";

// Allow up to 2 minutes for image generation
export const maxDuration = 120;

// Metadata type for chat messages
type ChatMetadata = {
  createdAt: number;
  model: string;
  totalUsage?: LanguageModelUsage;
};

export type ChatUIMessage = UIMessage<ChatMetadata>;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { prompt, modelId, type = "text", size, quality, messages } = body;

    // Handle chat streaming (messages array)
    if (messages && Array.isArray(messages)) {
      const modelConfig = modelId
        ? getModel(modelId)
        : getDefaultModelForProvider("openai");

      if (!modelConfig) {
        return NextResponse.json(
          { error: `Model ${modelId} not found or disabled` },
          { status: 400 },
        );
      }

      if (modelConfig.provider !== "openai") {
        return NextResponse.json(
          { error: "Invalid model for OpenAI endpoint" },
          { status: 400 },
        );
      }

      const result = streamText({
        model: modelConfig.model,
        system: "You are a helpful assistant.",
        messages: convertToModelMessages(messages),
      });

      return result.toUIMessageStreamResponse({
        originalMessages: messages,
        messageMetadata: ({ part }) => {
          const metadata: ChatMetadata = {
            createdAt: Date.now(),
            model: modelConfig.id,
          };

          if (part.type === "finish") {
            metadata.totalUsage = part.totalUsage;
          }

          return metadata;
        },
        onError: (error) => {
          if (error == null) return "An unknown error occurred.";
          if (typeof error === "string") return error;
          if (error instanceof Error) return error.message;
          return "An error occurred while processing your request.";
        },
      });
    }

    // Handle image generation
    if (type === "image") {
      if (!prompt) {
        return NextResponse.json(
          { error: "Prompt is required" },
          { status: 400 },
        );
      }

      const { image } = await generateImage({
        model: openai.image("gpt-image-1"),
        prompt,
        size: (size as "1024x1024" | "1536x1024" | "1024x1536") || "1024x1024",
        providerOptions: {
          openai: {
            quality: (quality as "low" | "medium" | "high" | "auto") || "auto",
          },
        },
      });

      return NextResponse.json(
        {
          image: image.base64,
          prompt,
          type: "image",
        },
        { status: 200 },
      );
    }

    // Handle single text generation
    if (!prompt) {
      return NextResponse.json(
        { error: "Prompt is required" },
        { status: 400 },
      );
    }

    const modelConfig = modelId
      ? getModel(modelId)
      : getDefaultModelForProvider("openai");

    if (!modelConfig) {
      return NextResponse.json(
        { error: `Model ${modelId} not found or disabled` },
        { status: 400 },
      );
    }

    if (modelConfig.provider !== "openai") {
      return NextResponse.json(
        { error: "Invalid model for OpenAI endpoint" },
        { status: 400 },
      );
    }

    const { text } = await generateText({
      model: modelConfig.model,
      prompt,
    });

    return Response.json(
      { text, model: modelConfig.id, provider: modelConfig.provider },
      { status: 200 },
    );
  } catch (error) {
    console.log("Error calling OpenAI:", error);

    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
