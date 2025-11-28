import * as vscode from 'vscode';
import { AIProvider, AIContext, AIResponse, getSystemPrompt, parseAIResponse } from '../../services/ai';

/**
 * Ollama provider for local command generation
 */
export class OllamaProvider implements AIProvider {
  id = 'ollama';
  name = 'Ollama (Local)';

  private endpoint = 'http://localhost:11434/api/generate';

  async generate(prompt: string, context: AIContext): Promise<AIResponse> {
    const config = vscode.workspace.getConfiguration('cmdify.ai');
    const model = config.get<string>('model') || 'llama3.2';
    const customEndpoint = config.get<string>('customEndpoint');

    const systemPrompt = getSystemPrompt(context);
    const fullPrompt = `${systemPrompt}\n\nUser request: ${prompt}`;

    const response = await fetch(customEndpoint || this.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        prompt: fullPrompt,
        stream: false,
        options: {
          temperature: 0.3,
        },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Ollama API error: ${response.status} - ${error}`);
    }

    const data = await response.json() as { response: string };
    const content = data.response;

    if (!content) {
      throw new Error('No response from Ollama');
    }

    return parseAIResponse(content);
  }
}
