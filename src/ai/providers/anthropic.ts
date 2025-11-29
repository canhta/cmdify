import * as vscode from 'vscode';
import {
  AIProvider,
  AIContext,
  AIResponse,
  getSystemPrompt,
  parseAIResponse,
} from '../../services/ai';
import { getAIConfig, getApiKey, makeAPIRequest } from './base';

/**
 * Anthropic response format
 */
interface AnthropicResponse {
  content: Array<{ type: string; text: string }>;
}

/**
 * Anthropic (Claude) provider for command generation
 */
export class AnthropicProvider implements AIProvider {
  id = 'anthropic';
  name = 'Anthropic (Claude)';

  private endpoint = 'https://api.anthropic.com/v1/messages';

  constructor(private secretStorage: vscode.SecretStorage) {}

  async generate(prompt: string, context: AIContext): Promise<AIResponse> {
    const apiKey = await getApiKey(this.secretStorage, 'anthropic');
    const config = getAIConfig('claude-sonnet-4-20250514');

    const data = await makeAPIRequest<AnthropicResponse>(
      config.customEndpoint || this.endpoint,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: config.model,
          system: getSystemPrompt(context),
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 500,
        }),
      },
      'Anthropic'
    );

    const content = data.content?.[0]?.text;

    if (!content) {
      throw new Error('No response from Anthropic');
    }

    return parseAIResponse(content);
  }
}
