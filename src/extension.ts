import * as vscode from 'vscode';
import { StorageService } from './services/storage';
import { AIProvider } from './services/ai';
import { OpenAIProvider, AnthropicProvider, OllamaProvider, AzureOpenAIProvider, CustomProvider } from './ai/providers';
import { CommandsTreeProvider } from './views/treeProvider';
import {
  handleCreate,
  handleRun,
  handleCopy,
  handleSearch,
  handleEdit,
  handleDelete,
  handleSync,
  handleLogin,
  handleExport,
  handleImport,
  GitHubSyncService,
} from './commands';
import { disposeTerminal } from './utils/shell';
import { FocusService } from './services/focus';
import { CompanionService } from './services/companion';
import { CompanionPanelProvider } from './views/companionPanel';
import { formatTime } from './utils/dateUtils';
import { COMPANION_EMOJIS } from './models/companion';

let storage: StorageService;
let treeProvider: CommandsTreeProvider;
let syncService: GitHubSyncService;
let aiProvider: AIProvider | undefined;
let focusService: FocusService;
let companionService: CompanionService;
let focusStatusBarItem: vscode.StatusBarItem;

/**
 * Update the noCommands context for welcome view
 */
async function updateNoCommandsContext(): Promise<void> {
  const hasCommands = storage.getAll().length > 0;
  await vscode.commands.executeCommand('setContext', 'cmdify.noCommands', !hasCommands);
}

/**
 * Check if AI provider is configured (has API key or is Ollama)
 */
async function checkAIConfigured(context: vscode.ExtensionContext): Promise<boolean> {
  const config = vscode.workspace.getConfiguration('cmdify.ai');
  const providerName = config.get<string>('provider', 'openai');

  // Ollama doesn't need an API key
  if (providerName === 'ollama') {
    return true;
  }

  // Check if API key exists for the provider
  const apiKey = await context.secrets.get(`cmdify.${providerName}`);
  return !!apiKey;
}

/**
 * Update the aiNotConfigured context for welcome view
 */
async function updateAIConfiguredContext(context: vscode.ExtensionContext): Promise<void> {
  const isConfigured = await checkAIConfigured(context);
  await vscode.commands.executeCommand('setContext', 'cmdify.aiNotConfigured', !isConfigured);
}

export async function activate(context: vscode.ExtensionContext) {
  console.log('Cmdify is now active!');

  // Initialize storage
  storage = new StorageService(context);
  await storage.initialize();

  // Set initial context for welcome view
  await updateNoCommandsContext();
  await updateAIConfiguredContext(context);

  // Initialize AI provider
  aiProvider = await initializeAIProvider(context);

  // Initialize sync service
  syncService = new GitHubSyncService(storage, context);

  // Initialize tree view
  treeProvider = new CommandsTreeProvider(storage);
  const treeView = vscode.window.createTreeView('cmdify.commands', {
    treeDataProvider: treeProvider,
    showCollapseAll: true,
  });

  // Update context when storage changes
  storage.onDidChange(async () => {
    await updateNoCommandsContext();
  });

  // Initialize Focus Timer services
  focusService = new FocusService(context);
  companionService = new CompanionService(context, focusService);

  // Initialize Focus Timer status bar
  focusStatusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    100
  );
  focusStatusBarItem.command = 'cmdify.focus.showPanel';
  updateFocusStatusBar();
  focusStatusBarItem.show();

  // Listen for focus timer updates
  focusService.onTick(() => updateFocusStatusBar());
  focusService.onStateChange(() => updateFocusStatusBar());
  companionService.onStateChange(() => updateFocusStatusBar());

  // Register Companion Panel webview
  const companionPanelProvider = new CompanionPanelProvider(
    context.extensionUri,
    focusService,
    companionService
  );
  const companionPanelDisposable = vscode.window.registerWebviewViewProvider(
    CompanionPanelProvider.viewType,
    companionPanelProvider
  );

  // Register commands
  const commands = [
    vscode.commands.registerCommand('cmdify.create', () =>
      handleCreate(storage, aiProvider)
    ),
    vscode.commands.registerCommand('cmdify.run', () =>
      handleRun(undefined, storage)
    ),
    vscode.commands.registerCommand('cmdify.runFromTree', (item) =>
      handleRun(item, storage)
    ),
    vscode.commands.registerCommand('cmdify.search', () =>
      handleSearch(storage)
    ),
    vscode.commands.registerCommand('cmdify.copy', () =>
      handleCopy(undefined, storage)
    ),
    vscode.commands.registerCommand('cmdify.copyFromTree', (item) =>
      handleCopy(item, storage)
    ),
    vscode.commands.registerCommand('cmdify.edit', (item) =>
      handleEdit(item, storage)
    ),
    vscode.commands.registerCommand('cmdify.delete', (item) =>
      handleDelete(item, storage)
    ),
    vscode.commands.registerCommand('cmdify.sync', () =>
      handleSync(syncService)
    ),
    vscode.commands.registerCommand('cmdify.export', () =>
      handleExport(storage)
    ),
    vscode.commands.registerCommand('cmdify.import', () =>
      handleImport(storage)
    ),
    vscode.commands.registerCommand('cmdify.login', () =>
      handleLogin(syncService)
    ),
    vscode.commands.registerCommand('cmdify.settings', () =>
      vscode.commands.executeCommand(
        'workbench.action.openSettings',
        'cmdify'
      )
    ),
    vscode.commands.registerCommand('cmdify.configureAI', () =>
      configureAIProvider(context)
    ),
    vscode.commands.registerCommand('cmdify.refresh', () =>
      treeProvider.refresh()
    ),
    vscode.commands.registerCommand('cmdify.sponsor', () =>
      vscode.env.openExternal(vscode.Uri.parse('https://ko-fi.com/canhta'))
    ),
    vscode.commands.registerCommand('cmdify.about', () =>
      handleAbout()
    ),
    // Focus Timer commands
    vscode.commands.registerCommand('cmdify.focus.start', () =>
      focusService.start()
    ),
    vscode.commands.registerCommand('cmdify.focus.pause', () =>
      focusService.pause()
    ),
    vscode.commands.registerCommand('cmdify.focus.resume', () =>
      focusService.resume()
    ),
    vscode.commands.registerCommand('cmdify.focus.stop', () =>
      focusService.stop()
    ),
    vscode.commands.registerCommand('cmdify.focus.skip', () =>
      focusService.skip()
    ),
    vscode.commands.registerCommand('cmdify.focus.showPanel', () =>
      vscode.commands.executeCommand('cmdify.focus.focus')
    ),
  ];

  // Listen for configuration changes
  const configListener = vscode.workspace.onDidChangeConfiguration(async (e) => {
    if (e.affectsConfiguration('cmdify.ai')) {
      aiProvider = await initializeAIProvider(context);
      await updateAIConfiguredContext(context);
    }
  });

  context.subscriptions.push(
    treeView,
    storage,
    treeProvider,
    configListener,
    focusService,
    companionService,
    focusStatusBarItem,
    companionPanelDisposable,
    ...commands
  );
}

/**
 * Update the focus timer status bar
 */
function updateFocusStatusBar(): void {
  const focusState = focusService.getState();
  const companionState = companionService.getState();
  const stats = focusService.getStats();

  const emojis = COMPANION_EMOJIS[companionState.type];
  const emoji = emojis[focusState.status] || emojis.idle;
  
  let text = emoji;
  
  if (focusState.status === 'focusing' || focusState.status === 'break' || focusState.status === 'paused') {
    text += ` ${formatTime(focusState.timeRemaining)}`;
  }
  
  if (stats.currentStreak > 0) {
    text += ` 🔥${stats.currentStreak}`;
  }

  focusStatusBarItem.text = text;
  focusStatusBarItem.tooltip = getFocusTooltip(focusState.status, focusState.todaySessions);
}

/**
 * Get tooltip for focus status bar
 */
function getFocusTooltip(status: string, todaySessions: number): string {
  let tooltip = 'Focus Timer - Click to open panel\n';
  tooltip += `${todaySessions} sessions today\n`;
  
  switch (status) {
    case 'focusing':
      tooltip += 'Currently focusing...';
      break;
    case 'break':
      tooltip += 'Taking a break';
      break;
    case 'paused':
      tooltip += 'Session paused';
      break;
    default:
      tooltip += 'Ready to focus';
  }
  
  return tooltip;
}

/**
 * Initialize the AI provider based on configuration
 */
async function initializeAIProvider(
  context: vscode.ExtensionContext
): Promise<AIProvider | undefined> {
  const config = vscode.workspace.getConfiguration('cmdify.ai');
  const providerName = config.get<string>('provider', 'openai');

  switch (providerName) {
    case 'openai':
      return new OpenAIProvider(context.secrets);
    case 'anthropic':
      return new AnthropicProvider(context.secrets);
    case 'ollama':
      return new OllamaProvider();
    case 'azure':
      return new AzureOpenAIProvider(context.secrets);
    case 'custom':
      return new CustomProvider(context.secrets);
    default:
      return undefined;
  }
}

/**
 * Configure AI provider (API key setup)
 */
async function configureAIProvider(context: vscode.ExtensionContext): Promise<void> {
  const config = vscode.workspace.getConfiguration('cmdify.ai');

  // Step 1: Select provider
  interface ProviderItem extends vscode.QuickPickItem {
    value: string;
  }

  const providers: ProviderItem[] = [
    { label: 'OpenAI', value: 'openai', description: 'GPT-4o, GPT-4o-mini, GPT-4 Turbo' },
    { label: 'Anthropic', value: 'anthropic', description: 'Claude Sonnet, Claude Haiku' },
    { label: 'Ollama', value: 'ollama', description: 'Local models (no API key needed)' },
    { label: 'Azure OpenAI', value: 'azure', description: 'Azure-hosted OpenAI models' },
    { label: 'Custom', value: 'custom', description: 'Custom OpenAI-compatible endpoint' },
  ];

  const selectedProvider = await vscode.window.showQuickPick<ProviderItem>(providers, {
    placeHolder: 'Select AI provider',
    title: 'Step 1: Select AI Provider',
  });

  if (!selectedProvider) {
    return;
  }

  // Handle custom provider separately
  if (selectedProvider.value === 'custom') {
    await configureCustomProvider(context, config);
    return;
  }

  // Step 2: Select model (dropdown)
  const models = await getModelsForProvider(selectedProvider.value, context);
  if (models.length === 0) {
    vscode.window.showErrorMessage('No models available for this provider.');
    return;
  }

  interface ModelItem extends vscode.QuickPickItem {
    value: string;
  }

  const selectedModel = await vscode.window.showQuickPick<ModelItem>(models, {
    placeHolder: 'Select model',
    title: 'Step 2: Select AI Model',
  });

  if (!selectedModel) {
    return;
  }

  // Step 3: Enter API key (if required)
  if (selectedProvider.value !== 'ollama') {
    const existingKey = await context.secrets.get(`cmdify.${selectedProvider.value}`);
    const apiKey = await vscode.window.showInputBox({
      prompt: `Enter your ${selectedProvider.label} API key`,
      password: true,
      placeHolder: selectedProvider.value === 'azure' ? 'Your Azure API key' : 'sk-...',
      title: `Step 3: ${selectedProvider.label} API Key`,
      value: existingKey ? '' : undefined,
      validateInput: (value) => {
        if (!value && !existingKey) {
          return 'API key is required';
        }
        return undefined;
      },
    });

    // User cancelled
    if (apiKey === undefined) {
      return;
    }

    // Only store if a new key was provided
    if (apiKey) {
      await context.secrets.store(`cmdify.${selectedProvider.value}`, apiKey);
    }
  }

  // Step 4: Azure-specific configuration
  if (selectedProvider.value === 'azure') {
    const endpoint = await vscode.window.showInputBox({
      prompt: 'Enter your Azure OpenAI endpoint',
      placeHolder: 'https://your-resource.openai.azure.com',
      title: 'Step 4: Azure OpenAI Endpoint',
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

  // Save provider and model configuration
  await config.update('provider', selectedProvider.value, vscode.ConfigurationTarget.Global);
  await config.update('model', selectedModel.value, vscode.ConfigurationTarget.Global);

  // Clear custom endpoint for non-Azure providers
  if (selectedProvider.value !== 'azure') {
    await config.update('customEndpoint', '', vscode.ConfigurationTarget.Global);
  }

  // Reinitialize provider and update context
  aiProvider = await initializeAIProvider(context);
  await updateAIConfiguredContext(context);
  vscode.window.showInformationMessage(
    `AI configured: ${selectedProvider.label} with ${selectedModel.label}`
  );
}

/**
 * Configure custom OpenAI-compatible provider
 */
async function configureCustomProvider(
  context: vscode.ExtensionContext,
  config: vscode.WorkspaceConfiguration
): Promise<void> {
  // Step 2: Enter custom endpoint
  const endpoint = await vscode.window.showInputBox({
    prompt: 'Enter your custom API endpoint',
    placeHolder: 'https://api.example.com/v1/chat/completions',
    title: 'Step 2: Custom API Endpoint',
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

  // Step 3: Enter model name
  const modelName = await vscode.window.showInputBox({
    prompt: 'Enter the model name to use',
    placeHolder: 'gpt-4o-mini, llama-3.1-70b, etc.',
    title: 'Step 3: Model Name',
    validateInput: (value) => {
      if (!value) {
        return 'Model name is required';
      }
      return undefined;
    },
  });

  if (!modelName) {
    return;
  }

  // Step 4: Enter API key (optional for some custom endpoints)
  const apiKey = await vscode.window.showInputBox({
    prompt: 'Enter API key (leave empty if not required)',
    password: true,
    placeHolder: 'API key (optional)',
    title: 'Step 4: API Key (Optional)',
  });

  // User cancelled
  if (apiKey === undefined) {
    return;
  }

  // Save all configuration
  await config.update('provider', 'custom', vscode.ConfigurationTarget.Global);
  await config.update('customEndpoint', endpoint, vscode.ConfigurationTarget.Global);
  await config.update('model', modelName, vscode.ConfigurationTarget.Global);

  if (apiKey) {
    await context.secrets.store('cmdify.custom', apiKey);
  }

  // Reinitialize provider and update context
  aiProvider = await initializeAIProvider(context);
  await updateAIConfiguredContext(context);
  vscode.window.showInformationMessage(`AI configured: Custom provider with ${modelName}`);
}

interface ModelItem extends vscode.QuickPickItem {
  value: string;
}

async function getModelsForProvider(provider: string, context: vscode.ExtensionContext): Promise<ModelItem[]> {
  switch (provider) {
    case 'openai':
      return [
        { label: 'GPT-4o Mini', value: 'gpt-4o-mini', description: 'Recommended - Fast and cost-effective' },
        { label: 'GPT-4o', value: 'gpt-4o', description: 'Most capable' },
        { label: 'GPT-4 Turbo', value: 'gpt-4-turbo', description: 'Previous generation' },
        { label: 'GPT-3.5 Turbo', value: 'gpt-3.5-turbo', description: 'Budget option' },
      ];
    case 'anthropic':
      return [
        { label: 'Claude Sonnet 4', value: 'claude-sonnet-4-20250514', description: 'Recommended - Best balance' },
        { label: 'Claude Haiku 3.5', value: 'claude-3-5-haiku-20241022', description: 'Fast and affordable' },
        { label: 'Claude Opus 4', value: 'claude-opus-4-20250514', description: 'Most capable' },
      ];
    case 'ollama': {
      // Try to fetch dynamic models from Ollama
      const ollamaProvider = new OllamaProvider();
      const models = await ollamaProvider.getAvailableModels();
      return models.map(model => ({
        label: model,
        value: model,
        description: model.includes('code') ? 'Optimized for code' : undefined,
      }));
    }
    case 'azure':
      return [
        { label: 'GPT-4o', value: 'gpt-4o', description: 'Azure-hosted GPT-4o' },
        { label: 'GPT-4o Mini', value: 'gpt-4o-mini', description: 'Azure-hosted GPT-4o Mini' },
        { label: 'GPT-4', value: 'gpt-4', description: 'Azure-hosted GPT-4' },
      ];
    default:
      return [];
  }
}

/**
 * Show about information
 */
async function handleAbout(): Promise<void> {
  const extension = vscode.extensions.getExtension('canhta.cmdify');
  const version = extension?.packageJSON?.version || 'unknown';

  const message = `Cmdify v${version} - AI-powered CLI command manager\n\nDescribe what you want, get the shell command.`;

  const action = await vscode.window.showInformationMessage(
    message,
    'GitHub',
    'Sponsor',
    'Settings'
  );

  switch (action) {
    case 'GitHub':
      vscode.env.openExternal(vscode.Uri.parse('https://github.com/canhta/cmdify'));
      break;
    case 'Sponsor':
      vscode.env.openExternal(vscode.Uri.parse('https://ko-fi.com/canhta'));
      break;
    case 'Settings':
      vscode.commands.executeCommand('workbench.action.openSettings', 'cmdify');
      break;
  }
}

export function deactivate() {
  disposeTerminal();
  if (focusService) {
    focusService.dispose();
  }
  if (companionService) {
    companionService.dispose();
  }
}

