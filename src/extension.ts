import * as vscode from 'vscode';
import { StorageService } from './services/storage';
import { AIProvider } from './services/ai';
import {
  OpenAIProvider,
  AnthropicProvider,
  OllamaProvider,
  AzureOpenAIProvider,
  CustomProvider,
} from './ai/providers';
import { CommandsTreeProvider } from './views/treeProvider';
import { GitHubSyncService } from './commands';
import { disposeTerminal } from './utils/shell';
import { FocusService } from './services/focus';
import { CompanionService } from './services/companion';
import { CompanionPanelProvider } from './views/companionPanel';
import { ActivityService } from './services/activity';
import { ActivityPanelProvider } from './views/activityPanel';
import { TodoScannerService } from './services/todoScanner';
import { TodoSyncService } from './services/todoSync';
import { ReminderService } from './services/reminder';
import { AchievementService } from './services/achievement';
import { OnboardingService } from './services/onboarding';
import { createTodoTreeView } from './views/todoTreeProvider';
import { AchievementPanelProvider } from './views/achievementPanel';
import { OnboardingPanelProvider } from './views/onboardingPanel';
import { NotesService } from './services/notes';
import { NotesPanelProvider } from './views/notesPanel';
import { createNotesTreeView } from './views/notesTreeProvider';
import { CommandRegistry } from './commands/registry';
import {
  createCoreCommands,
  createSyncCommands,
  createFocusCommands,
  createTodoCommands,
  createReminderCommands,
  createNoteCommands,
  createCompanionCommands,
  createSettingsCommands,
} from './commands/handlers';
import {
  createStatusBarItems,
  updateFocusStatusBar,
  updateTodoStatusBar,
  updateActivityStatusBar,
  StatusBarItems,
} from './ui/StatusBarUpdater';
import { setupExtensionEvents } from './events/ExtensionEvents';

// =============================================================================
// Global Service References
// =============================================================================

let storage: StorageService;
let treeProvider: CommandsTreeProvider;
let syncService: GitHubSyncService;
let aiProvider: AIProvider | undefined;
let focusService: FocusService;
let companionService: CompanionService;
let todoScannerService: TodoScannerService;
let todoSyncService: TodoSyncService;
let reminderService: ReminderService;
let activityService: ActivityService;
let activityPanelProvider: ActivityPanelProvider;
let achievementService: AchievementService;
let achievementPanelProvider: AchievementPanelProvider;
let onboardingService: OnboardingService;
let onboardingPanelProvider: OnboardingPanelProvider;
let todoTreeProvider: ReturnType<typeof createTodoTreeView>['provider'];
let notesService: NotesService;
let notesPanelProvider: NotesPanelProvider;
let notesTreeProvider: ReturnType<typeof createNotesTreeView>['provider'];
let statusBarItems: StatusBarItems;

// =============================================================================
// Context Management
// =============================================================================

async function updateNoNotesContext(): Promise<void> {
  const hasNotes = notesService.getAllNotes().length > 0;
  await vscode.commands.executeCommand('setContext', 'cmdify.noNotes', !hasNotes);
}

async function updateNoCommandsContext(): Promise<void> {
  const hasCommands = storage.getAll().length > 0;
  await vscode.commands.executeCommand('setContext', 'cmdify.noCommands', !hasCommands);
}

async function checkAIConfigured(context: vscode.ExtensionContext): Promise<boolean> {
  const config = vscode.workspace.getConfiguration('cmdify.ai');
  const providerName = config.get<string>('provider', 'openai');

  if (providerName === 'ollama') {
    return true;
  }

  const apiKey = await context.secrets.get(`cmdify.${providerName}`);
  return !!apiKey;
}

async function updateAIConfiguredContext(context: vscode.ExtensionContext): Promise<void> {
  const isConfigured = await checkAIConfigured(context);
  await vscode.commands.executeCommand('setContext', 'cmdify.aiNotConfigured', !isConfigured);
}

// =============================================================================
// Extension Activation
// =============================================================================

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  console.log('Cmdify is now active!');

  // Initialize core services
  await initializeCoreServices(context);

  // Initialize UI components
  initializeUIComponents(context);

  // Initialize gamification services
  initializeGamificationServices(context);

  // Setup event listeners
  setupEventListeners(context);

  // Register all commands
  registerCommands(context);

  // Add disposables to context
  addDisposables(context);
}

// =============================================================================
// Service Initialization
// =============================================================================

async function initializeCoreServices(context: vscode.ExtensionContext): Promise<void> {
  // Storage
  storage = new StorageService(context);
  await storage.initialize();

  // Set initial context
  await updateNoCommandsContext();
  await updateAIConfiguredContext(context);

  // AI Provider
  aiProvider = await initializeAIProvider(context);

  // Sync Service
  syncService = new GitHubSyncService(storage, context);

  // Focus Timer
  focusService = new FocusService(context);
  companionService = new CompanionService(context, focusService);

  // TODO Scanner
  todoScannerService = new TodoScannerService(context);
  todoSyncService = new TodoSyncService(context, todoScannerService);
  reminderService = new ReminderService(context, todoScannerService, todoSyncService);

  // Activity Tracking
  activityService = new ActivityService(context);

  // Notes Service
  notesService = new NotesService();
  await notesService.initialize();
}

function initializeUIComponents(context: vscode.ExtensionContext): void {
  // Commands Tree View
  treeProvider = new CommandsTreeProvider(storage);
  const treeView = vscode.window.createTreeView('cmdify.commands', {
    treeDataProvider: treeProvider,
    showCollapseAll: true,
  });
  context.subscriptions.push(treeView);

  // Companion Panel
  const companionPanelProvider = new CompanionPanelProvider(
    context,
    focusService,
    companionService
  );
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      CompanionPanelProvider.viewType,
      companionPanelProvider
    )
  );

  // TODO Tree View
  const todoTreeResult = createTodoTreeView(todoScannerService, reminderService);
  todoTreeProvider = todoTreeResult.provider;
  context.subscriptions.push(todoTreeResult.treeView, todoTreeResult.provider);

  // Notes Tree View
  const notesTreeResult = createNotesTreeView(notesService);
  notesTreeProvider = notesTreeResult.provider;
  context.subscriptions.push(notesTreeResult.treeView, notesTreeResult.provider);

  // Activity Panel
  activityPanelProvider = new ActivityPanelProvider(context, activityService);

  // Notes Panel
  notesPanelProvider = new NotesPanelProvider(context, notesService);

  // Update notes context
  updateNoNotesContext();

  // Status Bars
  statusBarItems = createStatusBarItems(activityService);
  doUpdateFocusStatusBar();
  doUpdateTodoStatusBar();
  doUpdateActivityStatusBar();
}

function initializeGamificationServices(context: vscode.ExtensionContext): void {
  // Achievement System
  achievementService = new AchievementService(context, companionService, activityService);
  achievementPanelProvider = new AchievementPanelProvider(context, achievementService);

  // Onboarding System
  onboardingService = new OnboardingService(context);
  onboardingPanelProvider = new OnboardingPanelProvider(
    context,
    onboardingService,
    companionService
  );

  // Track night owl usage
  companionService.trackNightOwlUsage();
}

// =============================================================================
// Status Bar Update Helpers
// =============================================================================

function doUpdateFocusStatusBar(): void {
  updateFocusStatusBar(statusBarItems.focus, focusService, companionService);
}

function doUpdateTodoStatusBar(): void {
  updateTodoStatusBar(statusBarItems.todo, todoScannerService);
}

function doUpdateActivityStatusBar(): void {
  updateActivityStatusBar(statusBarItems.activity, activityService);
}

// =============================================================================
// Event Listeners
// =============================================================================

function setupEventListeners(context: vscode.ExtensionContext): void {
  setupExtensionEvents(
    context,
    {
      storage,
      focusService,
      companionService,
      todoScannerService,
      activityService,
      achievementService,
      onboardingService,
      onboardingPanelProvider,
    },
    {
      updateFocusStatusBar: doUpdateFocusStatusBar,
      updateTodoStatusBar: doUpdateTodoStatusBar,
      updateActivityStatusBar: doUpdateActivityStatusBar,
    },
    {
      updateNoCommandsContext,
      updateAIConfiguredContext: () => updateAIConfiguredContext(context),
      initializeAIProvider: () => initializeAIProvider(context),
      setAIProvider: (provider) => {
        aiProvider = provider;
      },
    }
  );
}

// =============================================================================
// Command Registration
// =============================================================================

let commandRegistry: CommandRegistry;

function registerCommands(context: vscode.ExtensionContext): void {
  commandRegistry = new CommandRegistry();

  // Register core commands
  commandRegistry.registerGroup(
    createCoreCommands({
      storage,
      treeProvider,
      achievementService,
      getAIProvider: () => aiProvider,
    })
  );

  // Register sync commands
  commandRegistry.registerGroup(
    createSyncCommands({
      storage,
      syncService,
      achievementService,
    })
  );

  // Register focus commands
  commandRegistry.registerGroup(
    createFocusCommands({
      focusService,
    })
  );

  // Register TODO commands
  commandRegistry.registerGroup(
    createTodoCommands({
      todoScannerService,
      todoSyncService,
      reminderService,
      companionService,
      achievementService,
      getTodoTreeProvider: () => todoTreeProvider,
    })
  );

  // Register reminder commands
  commandRegistry.registerGroup(
    createReminderCommands({
      reminderService,
      getTodoTreeProvider: () => todoTreeProvider,
    })
  );

  // Register notes commands
  commandRegistry.registerGroup(
    createNoteCommands({
      notesService,
      notesPanelProvider,
      updateNoNotesContext,
    })
  );

  // Register companion commands
  commandRegistry.registerGroup(
    createCompanionCommands({
      storage,
      companionService,
      achievementService,
      activityService,
      focusService,
    })
  );

  // Register settings commands
  commandRegistry.registerGroup(
    createSettingsCommands({
      context,
      activityPanelProvider,
      achievementPanelProvider,
      onboardingService,
      onboardingPanelProvider,
      setAIProvider: (provider) => {
        aiProvider = provider;
      },
      updateAIConfiguredContext: () => updateAIConfiguredContext(context),
    })
  );

  context.subscriptions.push(commandRegistry);
}

// =============================================================================
// AI Provider Configuration
// =============================================================================

async function initializeAIProvider(
  context: vscode.ExtensionContext
): Promise<AIProvider | undefined> {
  const config = vscode.workspace.getConfiguration('cmdify.ai');
  const providerName = config.get<string>('provider', 'openai');

  const providers: Record<string, () => AIProvider> = {
    openai: () => new OpenAIProvider(context.secrets),
    anthropic: () => new AnthropicProvider(context.secrets),
    ollama: () => new OllamaProvider(),
    azure: () => new AzureOpenAIProvider(context.secrets),
    custom: () => new CustomProvider(context.secrets),
  };

  return providers[providerName]?.();
}

// =============================================================================
// Disposables Management
// =============================================================================

function addDisposables(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    storage,
    treeProvider,
    focusService,
    companionService,
    statusBarItems.focus,
    statusBarItems.todo,
    statusBarItems.sponsor,
    todoScannerService,
    todoSyncService,
    reminderService,
    activityService,
    activityPanelProvider,
    achievementService,
    achievementPanelProvider,
    notesService,
    notesPanelProvider
  );

  if (statusBarItems.activity) {
    context.subscriptions.push(statusBarItems.activity);
  }
}

export function deactivate(): void {
  disposeTerminal();

  const services = [
    focusService,
    companionService,
    todoScannerService,
    todoSyncService,
    reminderService,
    activityService,
    activityPanelProvider,
    notesService,
    notesPanelProvider,
  ];

  services.forEach((service) => service?.dispose());
}
