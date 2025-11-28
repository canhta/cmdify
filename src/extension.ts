import * as vscode from 'vscode';
import { StorageService } from './services/storage';
import { AIProvider } from './services/ai';
import { OpenAIProvider, AnthropicProvider, OllamaProvider } from './ai/providers';
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
  GitHubSyncService,
} from './commands';
import { disposeTerminal } from './utils/shell';

let storage: StorageService;
let treeProvider: CommandsTreeProvider;
let syncService: GitHubSyncService;
let aiProvider: AIProvider | undefined;

export async function activate(context: vscode.ExtensionContext) {
  console.log('Cmdify is now active!');

  // Initialize storage
  storage = new StorageService(context);
  await storage.initialize();

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
  ];

  // Listen for configuration changes
  const configListener = vscode.workspace.onDidChangeConfiguration(async (e) => {
    if (e.affectsConfiguration('cmdify.ai')) {
      aiProvider = await initializeAIProvider(context);
    }
  });

  context.subscriptions.push(
    treeView,
    storage,
    treeProvider,
    configListener,
    ...commands
  );
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
    default:
      return undefined;
  }
}

/**
 * Configure AI provider (API key setup)
 */
async function configureAIProvider(context: vscode.ExtensionContext): Promise<void> {
  const config = vscode.workspace.getConfiguration('cmdify.ai');
  const currentProvider = config.get<string>('provider', 'openai');

  // Select provider
  const providers = [
    { label: 'OpenAI', value: 'openai', description: 'GPT-4, GPT-4o-mini' },
    { label: 'Anthropic', value: 'anthropic', description: 'Claude Sonnet, Haiku' },
    { label: 'Ollama', value: 'ollama', description: 'Local models (no API key needed)' },
  ];

  const selected = await vscode.window.showQuickPick(providers, {
    placeHolder: 'Select AI provider',
    title: 'Configure AI Provider',
  });

  if (!selected) {
    return;
  }

  await config.update('provider', selected.value, vscode.ConfigurationTarget.Global);

  // Set API key for non-local providers
  if (selected.value !== 'ollama') {
    const apiKey = await vscode.window.showInputBox({
      prompt: `Enter your ${selected.label} API key`,
      password: true,
      placeHolder: 'sk-...',
      title: `${selected.label} API Key`,
    });

    if (apiKey) {
      await context.secrets.store(`cmdify.${selected.value}`, apiKey);
      vscode.window.showInformationMessage(`${selected.label} API key saved securely.`);
    }
  }

  // Set model
  const models = getModelsForProvider(selected.value);
  if (models.length > 0) {
    const modelSelection = await vscode.window.showQuickPick(models, {
      placeHolder: 'Select model',
      title: 'Select AI Model',
    });

    if (modelSelection) {
      await config.update('model', modelSelection.value, vscode.ConfigurationTarget.Global);
    }
  }

  // Reinitialize provider
  aiProvider = await initializeAIProvider(context);
  vscode.window.showInformationMessage(`AI provider configured: ${selected.label}`);
}

function getModelsForProvider(provider: string): Array<{ label: string; value: string }> {
  switch (provider) {
    case 'openai':
      return [
        { label: 'GPT-4o', value: 'gpt-4o' },
        { label: 'GPT-4o Mini (Recommended)', value: 'gpt-4o-mini' },
        { label: 'GPT-4 Turbo', value: 'gpt-4-turbo' },
      ];
    case 'anthropic':
      return [
        { label: 'Claude Sonnet 4', value: 'claude-sonnet-4-20250514' },
        { label: 'Claude Haiku 4.5', value: 'claude-haiku-4-5-20251001' },
      ];
    case 'ollama':
      return [
        { label: 'Llama 3.2', value: 'llama3.2' },
        { label: 'Mistral', value: 'mistral' },
        { label: 'CodeLlama', value: 'codellama' },
      ];
    default:
      return [];
  }
}

export function deactivate() {
  disposeTerminal();
}

