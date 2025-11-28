import * as vscode from 'vscode';
import { AIProvider, AIContext, AIResponse, getSystemPrompt, parseAIResponse } from '../../services/ai';

/**
 * Anthropic (Claude) provider for command generation
 */
export class AnthropicProvider implements AIProvider {
  id = 'anthropic';
  name = 'Anthropic (Claude)';

  private endpoint = 'https://api.anthropic.com/v1/messages';

  constructor(private secretStorage: vscode.SecretStorage) {}

  async generate(prompt: string, context: AIContext): Promise<AIResponse> {
    const apiKey = await this.secretStorage.get('cmdify.anthropic');
    if (!apiKey) {
      throw new Error('Anthropic API key not configured. Use "Cmdify: Configure AI Provider" to set it up.');
    }

    const config = vscode.workspace.getConfiguration('cmdify.ai');
    const model = config.get<string>('model') || 'claude-sonnet-4-20250514';
    const customEndpoint = config.get<string>('customEndpoint');

    const response = await fetch(customEndpoint || this.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        system: getSystemPrompt(context),
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Anthropic API error: ${response.status} - ${error}`);
    }

    const data = await response.json() as {
      content: Array<{ type: string; text: string }>;
    };
    const content = data.content?.[0]?.text;

    if (!content) {
      throw new Error('No response from Anthropic');
    }

    return parseAIResponse(content);
  }
}
