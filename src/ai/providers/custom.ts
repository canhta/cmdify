import * as vscode from 'vscode';
import { AIProvider, AIContext, AIResponse } from '../../services/ai';
import { getAIConfig, generateOpenAICompatible } from './base';

/**
 * Custom OpenAI-compatible provider for command generation
 */
export class CustomProvider implements AIProvider {
  id = 'custom';
  name = 'Custom Provider';

  constructor(private secretStorage: vscode.SecretStorage) {}

  async generate(prompt: string, context: AIContext): Promise<AIResponse> {
    const config = getAIConfig('gpt-4o-mini');

    if (!config.customEndpoint) {
      throw new Error(
        'Custom endpoint not configured. Use "Cmdify: Configure AI Provider" to set it up.'
      );
    }

    const apiKey = await this.secretStorage.get('cmdify.custom');
    const headers: Record<string, string> = {};

    // Add authorization header if API key is provided
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    return generateOpenAICompatible(
      config.customEndpoint,
      headers,
      config.model,
      prompt,
      context,
      'Custom'
    );
  }
}
