import { openai } from "@ai-sdk/openai";
import { anthropic } from "@ai-sdk/anthropic";
import { google } from "@ai-sdk/google";

export type AIProvider = "openai" | "anthropic" | "google";

export interface ModelConfig {
  id: string;
  name: string;
  provider: AIProvider;
  model: ReturnType<typeof openai | typeof anthropic | typeof google>;
  enabled: boolean;
  description?: string;
}

export const AI_MODELS: Record<string, ModelConfig> = {
  // OpenAI Models
  "gpt-5": {
    id: "gpt-5",
    name: "GPT-5",
    provider: "openai",
    model: openai("gpt-5-2025-08-07"),
    enabled: true,
    description: "Latest GPT-5 model with advanced capabilities",
  },
  "gpt-5-nano": {
    id: "gpt-5-nano",
    name: "GPT-5 Nano",
    provider: "openai",
    model: openai("gpt-5-nano-2025-08-07"),
    enabled: true,
    description: "Fast and cheap GPT-5 variant for quick responses",
  },
  "gpt-4o": {
    id: "gpt-4o",
    name: "GPT-4o",
    provider: "openai",
    model: openai("gpt-4o"),
    enabled: true,
    description: "Most capable GPT-4 model, great for complex tasks",
  },
  "gpt-4o-mini": {
    id: "gpt-4o-mini",
    name: "GPT-4o Mini",
    provider: "openai",
    model: openai("gpt-4o-mini"),
    enabled: true,
    description: "Faster and cheaper GPT-4 variant",
  },
  "gpt-4-turbo": {
    id: "gpt-4-turbo",
    name: "GPT-4 Turbo",
    provider: "openai",
    model: openai("gpt-4-turbo"),
    enabled: true,
    description: "Previous generation GPT-4 Turbo",
  },
  "gpt-3.5-turbo": {
    id: "gpt-3.5-turbo",
    name: "GPT-3.5 Turbo",
    provider: "openai",
    model: openai("gpt-3.5-turbo"),
    enabled: true,
    description: "Fast and economical for simple tasks",
  },

  // Anthropic Models
  "claude-sonnet-4": {
    id: "claude-sonnet-4",
    name: "Claude Sonnet 4",
    provider: "anthropic",
    model: anthropic("claude-sonnet-4-20250514"),
    enabled: true,
    description: "Latest Claude Sonnet with best intelligence",
  },
  "claude-opus-4": {
    id: "claude-opus-4",
    name: "Claude Opus 4",
    provider: "anthropic",
    model: anthropic("claude-opus-4-20250514"),
    enabled: true,
    description: "Most capable Claude model for complex reasoning",
  },
  "claude-haiku-4": {
    id: "claude-haiku-4",
    name: "Claude Haiku 4",
    provider: "anthropic",
    model: anthropic("claude-haiku-4-20250514"),
    enabled: true,
    description: "Fastest Claude model for simple tasks",
  },
  "claude-sonnet-3.5": {
    id: "claude-sonnet-3.5",
    name: "Claude Sonnet 3.5",
    provider: "anthropic",
    model: anthropic("claude-3-5-sonnet-20241022"),
    enabled: true,
    description: "Previous generation Claude Sonnet",
  },

  // Google Models
  "gemini-2.0-flash": {
    id: "gemini-2.0-flash",
    name: "Gemini 2.0 Flash",
    provider: "google",
    model: google("gemini-2.0-flash-exp"),
    enabled: true,
    description: "Latest Gemini model, fast and capable",
  },
  "gemini-1.5-pro": {
    id: "gemini-1.5-pro",
    name: "Gemini 1.5 Pro",
    provider: "google",
    model: google("gemini-1.5-pro"),
    enabled: true,
    description: "Most capable Gemini model with large context",
  },
  "gemini-1.5-flash": {
    id: "gemini-1.5-flash",
    name: "Gemini 1.5 Flash",
    provider: "google",
    model: google("gemini-1.5-flash"),
    enabled: true,
    description: "Fast Gemini model for quick responses",
  },
};

/**
 * Get a specific model by ID
 */
export function getModel(modelId: string): ModelConfig | undefined {
  const model = AI_MODELS[modelId];
  return model?.enabled ? model : undefined;
}

/**
 * Get all enabled models
 */
export function getEnabledModels(): ModelConfig[] {
  return Object.values(AI_MODELS).filter((model) => model.enabled);
}

/**
 * Get all models for a specific provider
 */
export function getModelsByProvider(provider: AIProvider): ModelConfig[] {
  return Object.values(AI_MODELS).filter(
    (model) => model.provider === provider && model.enabled,
  );
}

/**
 * Get default model for a provider
 */
export function getDefaultModelForProvider(provider: AIProvider): ModelConfig {
  const defaults: Record<AIProvider, string> = {
    openai: "gpt-4o",
    anthropic: "claude-sonnet-4",
    google: "gemini-2.0-flash",
  };

  const modelId = defaults[provider];
  const model = getModel(modelId);

  if (!model) {
    throw new Error(`Default model ${modelId} not found for ${provider}`);
  }

  return model;
}
