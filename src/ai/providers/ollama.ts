import {
  AIProvider,
  AIContext,
  AIResponse,
  getSystemPrompt,
  parseAIResponse,
} from '../../services/ai';
import { getAIConfig, makeAPIRequest } from './base';

/**
 * Model info from Ollama API
 */
interface OllamaModel {
  name: string;
  modified_at: string;
  size: number;
}

interface OllamaModelsResponse {
  models: OllamaModel[];
}

interface OllamaGenerateResponse {
  response: string;
}

const DEFAULT_MODELS = ['llama3.2', 'llama3.1:8b', 'mistral', 'codellama', 'qwen2.5-coder'];

/**
 * Ollama provider for local command generation
 */
export class OllamaProvider implements AIProvider {
  id = 'ollama';
  name = 'Ollama (Local)';

  private baseUrl = 'http://localhost:11434';
  private endpoint = 'http://localhost:11434/api/generate';

  /**
   * Get the base URL for Ollama API
   */
  private getBaseUrl(): string {
    const config = getAIConfig('llama3.2');
    return config.customEndpoint ? config.customEndpoint.replace(/\/api\/.*$/, '') : this.baseUrl;
  }

  /**
   * Fetch available models from Ollama
   */
  async getAvailableModels(): Promise<string[]> {
    try {
      const response = await fetch(`${this.getBaseUrl()}/api/tags`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        console.warn('Failed to fetch Ollama models:', response.status);
        return DEFAULT_MODELS;
      }

      const data = (await response.json()) as OllamaModelsResponse;
      return data.models?.length > 0 ? data.models.map((m) => m.name) : DEFAULT_MODELS;
    } catch (error) {
      console.warn('Ollama not available, using default models:', error);
      return DEFAULT_MODELS;
    }
  }

  async generate(prompt: string, context: AIContext): Promise<AIResponse> {
    const config = getAIConfig('llama3.2');
    const fullPrompt = `${getSystemPrompt(context)}\n\nUser request: ${prompt}`;

    const data = await makeAPIRequest<OllamaGenerateResponse>(
      config.customEndpoint || this.endpoint,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: config.model,
          prompt: fullPrompt,
          stream: false,
          options: { temperature: 0.3 },
        }),
      },
      'Ollama'
    );

    if (!data.response) {
      throw new Error('No response from Ollama');
    }

    return parseAIResponse(data.response);
  }
}
