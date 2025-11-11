import { type NextRequest, NextResponse } from "next/server";

import {
  convertToModelMessages,
  streamText,
  type UIMessage,
  type LanguageModelUsage,
} from "ai";

import { getModel } from "../ai/models";

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

// Create a new metadata type for usage tracking
type ChatMetadata = {
  createdAt: number;
  model?: string;
  totalUsage?: LanguageModelUsage;
};

// Create a custom message type with metadata
export type ChatUIMessage = UIMessage<ChatMetadata>;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      messages,
      modelId = "claude-sonnet-4",
    }: { messages: ChatUIMessage[]; modelId?: string } = body;

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: "Messages array is required" },
        { status: 400 },
      );
    }

    // Get model from registry
    const modelConfig = getModel(modelId);

    if (!modelConfig) {
      return NextResponse.json(
        { error: `Model ${modelId} not found or disabled` },
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
        if (part.type === "start") {
          return {
            createdAt: Date.now(),
            model: modelConfig.id,
          };
        }

        if (part.type === "finish") {
          return {
            totalUsage: part.totalUsage,
          };
        }
      },
      onError: (error) => {
        if (error == null) {
          return "An unknown error occurred.";
        }

        if (typeof error === "string") {
          return error;
        }

        if (error instanceof Error) {
          return error.message;
        }

        return "An error occurred while processing your request.";
      },
    });
  } catch (error) {
    console.log("Error in chat endpoint:", error);

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
