import * as vscode from 'vscode';
import { AIProvider, AIContext, AIResponse } from '../../services/ai';
import { getAIConfig, getApiKey, generateOpenAICompatible } from './base';

/**
 * Azure OpenAI provider for command generation
 */
export class AzureOpenAIProvider implements AIProvider {
  id = 'azure';
  name = 'Azure OpenAI';

  constructor(private secretStorage: vscode.SecretStorage) {}

  async generate(prompt: string, context: AIContext): Promise<AIResponse> {
    const apiKey = await getApiKey(this.secretStorage, 'azure');
    const config = getAIConfig('gpt-4o-mini');

    if (!config.customEndpoint) {
      throw new Error(
        'Azure OpenAI endpoint not configured. Use "Cmdify: Configure AI Provider" to set it up.'
      );
    }

    // Azure OpenAI uses deployment names in the URL
    const apiUrl = `${config.customEndpoint}/openai/deployments/${config.model}/chat/completions?api-version=2024-02-15-preview`;

    return generateOpenAICompatible(
      apiUrl,
      { 'api-key': apiKey },
      config.model,
      prompt,
      context,
      'Azure OpenAI'
    );
  }
}
