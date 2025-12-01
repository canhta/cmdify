/**
 * Settings Command Handlers
 * Handles settings, AI configuration, and utility commands
 */

import * as vscode from 'vscode';
import { AIProvider } from '../../services/ai';
import { ActivityPanelProvider } from '../../views/activityPanel';
import { AchievementPanelProvider } from '../../views/achievementPanel';
import { OnboardingService } from '../../services/onboarding';
import { OnboardingPanelProvider } from '../../views/onboardingPanel';
import { CommandGroup, defineCommand, defineCommandGroup } from '../registry';

/**
 * Quick pick item with value
 */
interface QuickPickItemWithValue extends vscode.QuickPickItem {
  value: string;
}

/**
 * Dependencies for settings commands
 */
export interface SettingsCommandDependencies {
  context: vscode.ExtensionContext;
  activityPanelProvider: ActivityPanelProvider;
  achievementPanelProvider: AchievementPanelProvider;
  onboardingService: OnboardingService;
  onboardingPanelProvider: OnboardingPanelProvider;
  setAIProvider: (provider: AIProvider | undefined) => void;
  updateAIConfiguredContext: () => Promise<void>;
}

/**
 * Create settings command handlers
 */
export function createSettingsCommands(deps: SettingsCommandDependencies): CommandGroup {
  const {
    context,
    activityPanelProvider,
    achievementPanelProvider,
    onboardingService,
    onboardingPanelProvider,
    setAIProvider,
    updateAIConfiguredContext,
  } = deps;

  return defineCommandGroup('Settings Commands', [
    defineCommand('cmdify.settings', () =>
      vscode.commands.executeCommand('workbench.action.openSettings', 'cmdify')
    ),

    defineCommand('cmdify.configureAI', () =>
      configureAIProvider(context, setAIProvider, updateAIConfiguredContext)
    ),

    defineCommand('cmdify.sponsor', () =>
      vscode.env.openExternal(vscode.Uri.parse('https://ko-fi.com/canhta'))
    ),

    defineCommand('cmdify.about', () => handleAbout()),

    defineCommand('cmdify.activity.showDashboard', () => activityPanelProvider.show()),

    defineCommand('cmdify.showAchievements', () => achievementPanelProvider.show()),

    defineCommand('cmdify.showOnboarding', () => onboardingPanelProvider.show()),

    defineCommand('cmdify.resetOnboarding', async () => {
      await onboardingService.resetOnboarding();
      vscode.window.showInformationMessage('Onboarding reset. Reload to see the welcome screen.');
    }),
  ]);
}

/**
 * Handle about command
 */
async function handleAbout(): Promise<void> {
  const extension = vscode.extensions.getExtension('canhta.cmdify');
  const version = extension?.packageJSON?.version || 'unknown';

  const action = await vscode.window.showInformationMessage(
    `Cmdify v${version} - Developer productivity toolkit\n\nAI commands, focus timer, TODO scanner & achievements.`,
    'GitHub',
    'Sponsor',
    'Settings'
  );

  const actions: Record<string, () => void> = {
    GitHub: () => vscode.env.openExternal(vscode.Uri.parse('https://github.com/canhta/cmdify')),
    Sponsor: () => vscode.env.openExternal(vscode.Uri.parse('https://ko-fi.com/canhta')),
    Settings: () => vscode.commands.executeCommand('workbench.action.openSettings', 'cmdify'),
  };

  if (action) {
    actions[action]?.();
  }
}

/**
 * Configure AI provider
 */
async function configureAIProvider(
  context: vscode.ExtensionContext,
  setAIProvider: (provider: AIProvider | undefined) => void,
  updateAIConfiguredContext: () => Promise<void>
): Promise<void> {
  const config = vscode.workspace.getConfiguration('cmdify.ai');

  // Step 1: Select provider
  const providers: QuickPickItemWithValue[] = [
    {
      label: 'OpenAI',
      value: 'openai',
      description: 'GPT-4.1-nano (cheapest), GPT-4o-mini, GPT-4.1',
    },
    {
      label: 'Anthropic',
      value: 'anthropic',
      description: 'Claude Sonnet, Claude Haiku',
    },
    {
      label: 'Azure OpenAI',
      value: 'azure',
      description: 'Azure-hosted OpenAI models',
    },
    {
      label: 'Custom',
      value: 'custom',
      description: 'Any API endpoint (local or remote)',
    },
  ];

  const selectedProvider = await vscode.window.showQuickPick(providers, {
    placeHolder: 'Select AI provider',
    title: 'Step 1: Select AI Provider',
    ignoreFocusOut: true,
  });

  if (!selectedProvider) {
    return;
  }

  if (selectedProvider.value === 'custom') {
    await configureCustomProvider(context, config, setAIProvider, updateAIConfiguredContext);
    return;
  }

  // Step 2: Select model
  const models = await getModelsForProvider(selectedProvider.value);
  if (models.length === 0) {
    vscode.window.showErrorMessage('No models available for this provider.');
    return;
  }

  const selectedModel = await vscode.window.showQuickPick(models, {
    placeHolder: 'Select model',
    title: 'Step 2: Select AI Model',
    ignoreFocusOut: true,
  });

  if (!selectedModel) {
    return;
  }

  // Step 3: Enter API key
  const existingKey = await context.secrets.get(`cmdify.${selectedProvider.value}`);
  const apiKey = await vscode.window.showInputBox({
    prompt: `Enter your ${selectedProvider.label} API key`,
    password: true,
    placeHolder: selectedProvider.value === 'azure' ? 'Your Azure API key' : 'sk-...',
    title: `Step 3: ${selectedProvider.label} API Key`,
    value: existingKey ? '' : undefined,
    ignoreFocusOut: true,
    validateInput: (value) => (!value && !existingKey ? 'API key is required' : undefined),
  });

  if (apiKey === undefined) {
    return;
  }
  if (apiKey) {
    await context.secrets.store(`cmdify.${selectedProvider.value}`, apiKey);
  }

  // Step 4: Azure-specific configuration
  if (selectedProvider.value === 'azure') {
    const endpoint = await vscode.window.showInputBox({
      prompt: 'Enter your Azure OpenAI endpoint',
      placeHolder: 'https://your-resource.openai.azure.com',
      title: 'Step 4: Azure OpenAI Endpoint',
      ignoreFocusOut: true,
      validateInput: (value) => {
        if (!value) {
          return 'Endpoint is required for Azure';
        }
        if (!value.startsWith('https://')) {
          return 'Endpoint must start with https://';
        }
        return undefined;
      },
    });

    if (!endpoint) {
      return;
    }
    await config.update('customEndpoint', endpoint, vscode.ConfigurationTarget.Global);
  }

  // Save configuration
  await config.update('provider', selectedProvider.value, vscode.ConfigurationTarget.Global);
  await config.update('model', selectedModel.value, vscode.ConfigurationTarget.Global);

  if (selectedProvider.value !== 'azure') {
    await config.update('customEndpoint', '', vscode.ConfigurationTarget.Global);
  }

  const aiProvider = await initializeAIProvider(context);
  setAIProvider(aiProvider);
  await updateAIConfiguredContext();
  vscode.window.showInformationMessage(
    `AI configured: ${selectedProvider.label} with ${selectedModel.label}`
  );
}

/**
 * Configure custom AI provider
 */
async function configureCustomProvider(
  context: vscode.ExtensionContext,
  config: vscode.WorkspaceConfiguration,
  setAIProvider: (provider: AIProvider | undefined) => void,
  updateAIConfiguredContext: () => Promise<void>
): Promise<void> {
  // Step 2: Select API format
  const apiFormats: QuickPickItemWithValue[] = [
    {
      label: 'OpenAI Compatible',
      value: 'openai',
      description: 'Standard chat/completions API',
    },
    {
      label: 'Google Style',
      value: 'google',
      description: 'Google generateContent API format',
    },
    {
      label: 'Generic',
      value: 'generic',
      description: 'Simple prompt/response format',
    },
  ];

  const selectedFormat = await vscode.window.showQuickPick(apiFormats, {
    placeHolder: 'Select API format',
    title: 'Step 2: Select API Format',
    ignoreFocusOut: true,
  });

  if (!selectedFormat) {
    return;
  }

  // Step 3: Enter endpoint
  const endpointPlaceholder =
    selectedFormat.value === 'google'
      ? 'https://api.example.com/v1/models/model-name:generateContent'
      : 'https://api.example.com/v1/chat/completions';

  const endpoint = await vscode.window.showInputBox({
    prompt: 'Enter your custom API endpoint',
    placeHolder: endpointPlaceholder,
    title: 'Step 3: Custom API Endpoint',
    ignoreFocusOut: true,
    validateInput: (value) => {
      if (!value) {
        return 'Endpoint is required';
      }
      if (!value.startsWith('http://') && !value.startsWith('https://')) {
        return 'Endpoint must start with http:// or https://';
      }
      return undefined;
    },
  });

  if (!endpoint) {
    return;
  }

  // Step 4: Model name
  let modelName = 'custom-model';
  // For Google-style APIs, try to extract model from URL
  if (selectedFormat.value === 'google') {
    const modelMatch = endpoint.match(/models\/([^:]+)/);
    if (modelMatch) {
      modelName = modelMatch[1];
    }
  }

  const inputModel = await vscode.window.showInputBox({
    prompt: 'Enter the model name to use',
    placeHolder: 'model-name, gpt-4o-mini, llama-3.1-70b, etc.',
    title: 'Step 4: Model Name',
    value: modelName !== 'custom-model' ? modelName : undefined,
    ignoreFocusOut: true,
    validateInput: (value) => (!value ? 'Model name is required' : undefined),
  });

  if (!inputModel) {
    return;
  }
  modelName = inputModel;

  // Step 5: API Key header type
  const apiKeyHeaders: QuickPickItemWithValue[] = [
    {
      label: 'Bearer Token',
      value: 'Authorization',
      description: 'Authorization: Bearer <key>',
    },
    {
      label: 'API Key Header',
      value: 'X-goog-api-key',
      description: 'X-goog-api-key: <key>',
    },
    {
      label: 'X-API-Key',
      value: 'X-API-Key',
      description: 'X-API-Key: <key>',
    },
  ];

  // Default to API Key header for Google-style format
  const defaultHeaderIndex = selectedFormat.value === 'google' ? 1 : 0;
  const reorderedHeaders = [
    apiKeyHeaders[defaultHeaderIndex],
    ...apiKeyHeaders.filter((_, i) => i !== defaultHeaderIndex),
  ];

  const selectedHeader = await vscode.window.showQuickPick(reorderedHeaders, {
    placeHolder: 'Select API key header type',
    title: 'Step 5: API Key Header',
    ignoreFocusOut: true,
  });

  if (!selectedHeader) {
    return;
  }

  // Step 6: API Key
  const apiKey = await vscode.window.showInputBox({
    prompt: 'Enter API key (leave empty if not required)',
    password: true,
    placeHolder: 'API key',
    title: 'Step 6: API Key',
    ignoreFocusOut: true,
  });

  if (apiKey === undefined) {
    return;
  }

  // Save all configuration
  await config.update('provider', 'custom', vscode.ConfigurationTarget.Global);
  await config.update('customEndpoint', endpoint, vscode.ConfigurationTarget.Global);
  await config.update('model', modelName, vscode.ConfigurationTarget.Global);
  await config.update('customApiFormat', selectedFormat.value, vscode.ConfigurationTarget.Global);
  await config.update(
    'customApiKeyHeader',
    selectedHeader.value,
    vscode.ConfigurationTarget.Global
  );

  if (apiKey) {
    await context.secrets.store('cmdify.custom', apiKey);
  }

  const aiProvider = await initializeAIProvider(context);
  setAIProvider(aiProvider);
  await updateAIConfiguredContext();
  vscode.window.showInformationMessage(
    `AI configured: Custom provider (${selectedFormat.label}) with ${modelName}`
  );
}

/**
 * Get available models for a provider
 */
async function getModelsForProvider(provider: string): Promise<QuickPickItemWithValue[]> {
  const modelConfigs: Record<string, QuickPickItemWithValue[]> = {
    openai: [
      {
        label: 'GPT-5 Nano',
        value: 'gpt-5-nano',
        description: '⭐ Best value - Cheapest ($0.05/1M input, $0.40 output)',
      },
      {
        label: 'GPT-4.1 Nano',
        value: 'gpt-4.1-nano',
        description: 'Recommended - Very cheap ($0.10/1M input, $0.40 output)',
      },
      {
        label: 'GPT-4o Mini',
        value: 'gpt-4o-mini',
        description: 'Proven quality ($0.15/1M input, $0.60 output)',
      },
      {
        label: 'GPT-5 Mini',
        value: 'gpt-5-mini',
        description: 'Latest mini ($0.25/1M input, $2 output)',
      },
      {
        label: 'GPT-4.1 Mini',
        value: 'gpt-4.1-mini',
        description: 'Balanced ($0.40/1M input, $1.60 output)',
      },
      { label: 'GPT-4.1', value: 'gpt-4.1', description: 'Flagship ($2/1M input, $8 output)' },
      { label: 'GPT-4o', value: 'gpt-4o', description: 'Capable ($2.50/1M input, $10 output)' },
      {
        label: 'GPT-5',
        value: 'gpt-5',
        description: 'Latest flagship ($1.25/1M input, $10 output)',
      },
    ],
    anthropic: [
      {
        label: 'Claude Sonnet 4',
        value: 'claude-sonnet-4-20250514',
        description: 'Recommended - Best balance',
      },
      {
        label: 'Claude Haiku 3.5',
        value: 'claude-3-5-haiku-20241022',
        description: 'Fast and affordable',
      },
      {
        label: 'Claude Opus 4',
        value: 'claude-opus-4-20250514',
        description: 'Most capable',
      },
    ],
    azure: [
      { label: 'GPT-4o', value: 'gpt-4o', description: 'Azure-hosted GPT-4o' },
      {
        label: 'GPT-4o Mini',
        value: 'gpt-4o-mini',
        description: 'Azure-hosted GPT-4o Mini',
      },
      { label: 'GPT-4', value: 'gpt-4', description: 'Azure-hosted GPT-4' },
    ],
  };

  return modelConfigs[provider] || [];
}

/**
 * Initialize AI provider based on configuration
 */
async function initializeAIProvider(
  context: vscode.ExtensionContext
): Promise<AIProvider | undefined> {
  const { OpenAIProvider, AnthropicProvider, AzureOpenAIProvider, CustomProvider } =
    await import('../../ai/providers/index.js');

  const config = vscode.workspace.getConfiguration('cmdify.ai');
  const providerName = config.get<string>('provider', 'openai');

  const providers: Record<string, () => AIProvider> = {
    openai: () => new OpenAIProvider(context.secrets),
    anthropic: () => new AnthropicProvider(context.secrets),
    azure: () => new AzureOpenAIProvider(context.secrets),
    custom: () => new CustomProvider(context.secrets),
  };

  return providers[providerName]?.();
}
