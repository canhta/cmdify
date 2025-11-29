import * as vscode from 'vscode';
import { AIContext, AIResponse, getSystemPrompt, parseAIResponse } from '../../services/ai';

/**
 * Common configuration for AI providers
 */
export interface AIProviderConfig {
  model: string;
  customEndpoint?: string;
}

/**
 * OpenAI-compatible chat completion request body
 */
export interface ChatCompletionRequest {
  model: string;
  messages: Array<{ role: string; content: string }>;
  temperature?: number;
  max_tokens?: number;
}

/**
 * OpenAI-compatible chat completion response
 */
export interface ChatCompletionResponse {
  choices: Array<{ message: { content: string } }>;
}

/**
 * Get AI configuration from VS Code settings
 */
export function getAIConfig(defaultModel: string): AIProviderConfig {
  const config = vscode.workspace.getConfiguration('cmdify.ai');
  return {
    model: config.get<string>('model') || defaultModel,
    customEndpoint: config.get<string>('customEndpoint') || undefined,
  };
}

/**
 * Get API key from secret storage
 */
export async function getApiKey(
  secretStorage: vscode.SecretStorage,
  provider: string
): Promise<string> {
  const apiKey = await secretStorage.get(`cmdify.${provider}`);
  if (!apiKey) {
    throw new Error(
      `${provider.charAt(0).toUpperCase() + provider.slice(1)} API key not configured. Use "Cmdify: Configure AI Provider" to set it up.`
    );
  }
  return apiKey;
}

/**
 * Build OpenAI-compatible request body
 */
export function buildChatCompletionRequest(
  model: string,
  prompt: string,
  context: AIContext
): ChatCompletionRequest {
  return {
    model,
    messages: [
      { role: 'system', content: getSystemPrompt(context) },
      { role: 'user', content: prompt },
    ],
    temperature: 0.3,
    max_tokens: 500,
  };
}

/**
 * Make an API request and handle common error cases
 */
export async function makeAPIRequest<T>(
  url: string,
  options: RequestInit,
  providerName: string
): Promise<T> {
  const response = await fetch(url, options);

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`${providerName} API error: ${response.status} - ${error}`);
  }

  return response.json() as Promise<T>;
}

/**
 * Extract content from OpenAI-compatible response
 */
export function extractOpenAIContent(
  data: ChatCompletionResponse,
  providerName: string
): AIResponse {
  const content = data.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error(`No response from ${providerName}`);
  }

  return parseAIResponse(content);
}

/**
 * Complete OpenAI-compatible generation flow
 */
export async function generateOpenAICompatible(
  endpoint: string,
  headers: Record<string, string>,
  model: string,
  prompt: string,
  context: AIContext,
  providerName: string
): Promise<AIResponse> {
  const body = buildChatCompletionRequest(model, prompt, context);

  const data = await makeAPIRequest<ChatCompletionResponse>(
    endpoint,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      body: JSON.stringify(body),
    },
    providerName
  );

  return extractOpenAIContent(data, providerName);
}
