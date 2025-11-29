import * as vscode from 'vscode';
import { AIProvider, AIContext, AIResponse } from '../../services/ai';
import { getAIConfig, getApiKey, generateOpenAICompatible } from './base';

/**
 * OpenAI provider for command generation
 */
export class OpenAIProvider implements AIProvider {
  id = 'openai';
  name = 'OpenAI';

  private endpoint = 'https://api.openai.com/v1/chat/completions';

  constructor(private secretStorage: vscode.SecretStorage) {}

  async generate(prompt: string, context: AIContext): Promise<AIResponse> {
    const apiKey = await getApiKey(this.secretStorage, 'openai');
    const config = getAIConfig('gpt-4o-mini');

    return generateOpenAICompatible(
      config.customEndpoint || this.endpoint,
      { Authorization: `Bearer ${apiKey}` },
      config.model,
      prompt,
      context,
      'OpenAI'
    );
  }
}
