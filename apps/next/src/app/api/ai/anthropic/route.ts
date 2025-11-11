import { type NextRequest, NextResponse } from "next/server";

import {
  generateText,
  streamText,
  convertToModelMessages,
  type UIMessage,
  type LanguageModelUsage,
} from "ai";

import { getModel, getDefaultModelForProvider } from "../models";

export const maxDuration = 30;

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
    const { prompt, modelId, messages } = body;

    // Handle chat streaming (messages array)
    if (messages && Array.isArray(messages)) {
      const modelConfig = modelId
        ? getModel(modelId)
        : getDefaultModelForProvider("anthropic");

      if (!modelConfig) {
        return NextResponse.json(
          { error: `Model ${modelId} not found or disabled` },
          { status: 400 },
        );
      }

      if (modelConfig.provider !== "anthropic") {
        return NextResponse.json(
          { error: "Invalid model for Anthropic endpoint" },
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

    // Handle single text generation
    if (!prompt) {
      return NextResponse.json(
        { error: "Prompt is required" },
        { status: 400 },
      );
    }

    const modelConfig = modelId
      ? getModel(modelId)
      : getDefaultModelForProvider("anthropic");

    if (!modelConfig) {
      return NextResponse.json(
        { error: `Model ${modelId} not found or disabled` },
        { status: 400 },
      );
    }

    if (modelConfig.provider !== "anthropic") {
      return NextResponse.json(
        { error: "Invalid model for Anthropic endpoint" },
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
    console.log("Error calling Anthropic:", error);

    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
