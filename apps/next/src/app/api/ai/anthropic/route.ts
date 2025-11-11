import { type NextRequest, NextResponse } from "next/server";

import { generateText } from "ai";

import { getUserAuthDetails } from "@/lib/admin-utils";

import { getModel, getDefaultModelForProvider } from "../models";

export async function POST(request: NextRequest) {
  try {
    const jwt =
      request.headers.get("Authorization")?.replace("Bearer ", "") || null;

    const authDetails = await getUserAuthDetails(jwt);

    if (!authDetails.isAuthenticated) {
      return NextResponse.json(
        { error: authDetails.error || "Unauthorized" },
        { status: 401 },
      );
    }

    const body = await request.json();
    const { prompt, modelId } = body;

    if (!prompt) {
      return NextResponse.json(
        { error: "Prompt is required" },
        { status: 400 },
      );
    }

    // Get model from registry (use specified model or default)
    const modelConfig = modelId
      ? getModel(modelId)
      : getDefaultModelForProvider("anthropic");

    if (!modelConfig) {
      return NextResponse.json(
        { error: `Model ${modelId} not found or disabled` },
        { status: 400 },
      );
    }

    // Ensure the model is from Anthropic provider
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
