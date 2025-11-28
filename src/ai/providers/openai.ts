import * as vscode from 'vscode';
import { AIProvider, AIContext, AIResponse, getSystemPrompt, parseAIResponse } from '../../services/ai';

/**
 * OpenAI provider for command generation
 */
export class OpenAIProvider implements AIProvider {
  id = 'openai';
  name = 'OpenAI';

  private endpoint = 'https://api.openai.com/v1/chat/completions';

  constructor(private secretStorage: vscode.SecretStorage) {}

  async generate(prompt: string, context: AIContext): Promise<AIResponse> {
    const apiKey = await this.secretStorage.get('cmdify.openai');
    if (!apiKey) {
      throw new Error('OpenAI API key not configured. Use "Cmdify: Configure AI Provider" to set it up.');
    }

    const config = vscode.workspace.getConfiguration('cmdify.ai');
    const model = config.get<string>('model') || 'gpt-4o-mini';
    const customEndpoint = config.get<string>('customEndpoint');

    const response = await fetch(customEndpoint || this.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: getSystemPrompt(context) },
          { role: 'user', content: prompt },
        ],
        temperature: 0.3,
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${response.status} - ${error}`);
    }

    const data = await response.json() as {
      choices: Array<{ message: { content: string } }>;
    };
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('No response from OpenAI');
    }

    return parseAIResponse(content);
  }
}
