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
  handleToggleFavorite,
  GitHubSyncService,
} from './commands';
import { disposeTerminal } from './utils/shell';
import { FocusService } from './services/focus';
import { CompanionService } from './services/companion';
import { CompanionPanelProvider } from './views/companionPanel';
import { ActivityService } from './services/activity';
import { ActivityPanelProvider } from './views/activityPanel';
import { formatTime } from './utils/dateUtils';
import { COMPANION_ICONS, SESSION_TYPES, getBreakSuggestion } from './models/companion';
import { TodoScannerService } from './services/todoScanner';
import { TodoSyncService } from './services/todoSync';
import { ReminderService } from './services/reminder';
import { AchievementService } from './services/achievement';
import { OnboardingService } from './services/onboarding';
import { createTodoTreeView, TodoTreeItem } from './views/todoTreeProvider';
import { AchievementPanelProvider } from './views/achievementPanel';
import { OnboardingPanelProvider } from './views/onboardingPanel';
import { DetectedTodo } from './models/todo';
import { CodeNote } from './models/note';
import { NotesService } from './services/notes';
import { NotesPanelProvider } from './views/notesPanel';
import { createNotesTreeView, NoteTreeItem } from './views/notesTreeProvider';

// =============================================================================
// Global Service References
// =============================================================================

let storage: StorageService;
let treeProvider: CommandsTreeProvider;
let syncService: GitHubSyncService;
let aiProvider: AIProvider | undefined;
let focusService: FocusService;
let companionService: CompanionService;
let focusStatusBarItem: vscode.StatusBarItem;
let todoScannerService: TodoScannerService;
let todoSyncService: TodoSyncService;
let reminderService: ReminderService;
let todoStatusBarItem: vscode.StatusBarItem;
let activityService: ActivityService;
let activityStatusBarItem: vscode.StatusBarItem;
let sponsorStatusBarItem: vscode.StatusBarItem;
let activityPanelProvider: ActivityPanelProvider;
let achievementService: AchievementService;
let achievementPanelProvider: AchievementPanelProvider;
let onboardingService: OnboardingService;
let onboardingPanelProvider: OnboardingPanelProvider;
let todoTreeProvider: ReturnType<typeof createTodoTreeView>['provider'];
let notesService: NotesService;
let notesPanelProvider: NotesPanelProvider;
let notesTreeProvider: ReturnType<typeof createNotesTreeView>['provider'];

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
    context.extensionUri,
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
  activityPanelProvider = new ActivityPanelProvider(context.extensionUri, activityService);

  // Notes Panel
  notesPanelProvider = new NotesPanelProvider(context.extensionUri, notesService);

  // Update notes context
  updateNoNotesContext();

  // Status Bars
  initializeStatusBars();
}

function initializeStatusBars(): void {
  // Focus Timer Status Bar
  focusStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  focusStatusBarItem.command = 'cmdify.focus.showPanel';
  updateFocusStatusBar();
  focusStatusBarItem.show();

  // Activity Status Bar
  const activityConfig = activityService.getConfig();
  if (activityConfig.showInStatusBar) {
    activityStatusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      99.5
    );
    activityStatusBarItem.command = 'cmdify.activity.showDashboard';
    updateActivityStatusBar();
    activityStatusBarItem.show();
  }

  // TODO Status Bar
  todoStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 99);
  todoStatusBarItem.command = 'cmdify.todos.scan';
  updateTodoStatusBar();
  todoStatusBarItem.show();

  // Sponsor Status Bar (leftmost, low priority)
  sponsorStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 50);
  sponsorStatusBarItem.text = '$(heart)';
  sponsorStatusBarItem.tooltip = 'Support Cmdify on Ko-fi';
  sponsorStatusBarItem.command = 'cmdify.sponsor';
  sponsorStatusBarItem.show();
}

function initializeGamificationServices(context: vscode.ExtensionContext): void {
  // Achievement System
  achievementService = new AchievementService(context, companionService, activityService);
  achievementPanelProvider = new AchievementPanelProvider(context.extensionUri, achievementService);

  // Onboarding System
  onboardingService = new OnboardingService(context);
  onboardingPanelProvider = new OnboardingPanelProvider(
    context.extensionUri,
    onboardingService,
    companionService,
    context
  );

  // Track night owl usage
  companionService.trackNightOwlUsage();
}

// =============================================================================
// Event Listeners
// =============================================================================

function setupEventListeners(context: vscode.ExtensionContext): void {
  // Storage changes
  context.subscriptions.push(
    storage.onDidChange(async () => {
      await updateNoCommandsContext();
      const commandCount = storage.getAll().length;
      await achievementService.checkCommandAchievements(commandCount);
    })
  );

  // Focus timer events
  context.subscriptions.push(
    focusService.onTick(() => updateFocusStatusBar()),
    focusService.onStateChange(() => {
      updateFocusStatusBar();
    }),
    focusService.onFocusStart(() => {
      companionService.showMessage('focusStart');
    }),
    companionService.onStateChange(() => updateFocusStatusBar())
  );

  // Focus session completion
  context.subscriptions.push(
    focusService.onSessionComplete(async () => {
      companionService.showMessage('focusComplete');
      await handleFocusSessionComplete();
    })
  );

  // Break start
  context.subscriptions.push(
    focusService.onBreakStart(async () => {
      const focusState = focusService.getState();
      const breakDuration = Math.round(focusState.timeRemaining / 60);
      const suggestion = getBreakSuggestion(breakDuration);

      vscode.window.showInformationMessage(
        `☕ Time for a break! (${breakDuration} min)\n${suggestion}`
      );

      await companionService.awardXP(25, 'breakTaken');
    })
  );

  // Companion events
  context.subscriptions.push(
    companionService.onLevelUp((level) => {
      companionService.showMessage('levelUp', { level });
      handleLevelUp(level);
    }),
    companionService.onUnlock(handleUnlock)
  );

  // Achievement unlocks trigger companion message
  context.subscriptions.push(
    achievementService.onAchievementUnlocked((achievement) => {
      companionService.showMessage('achievementUnlock', { achievement: achievement.name });
    })
  );

  // TODO changes
  context.subscriptions.push(
    todoScannerService.onTodosChanged(() => {
      updateTodoStatusBar();
      const completedCount = todoScannerService.getCompletedTodos().length;
      companionService.updateTodoCount(completedCount);
    })
  );

  // Activity updates
  if (activityStatusBarItem) {
    context.subscriptions.push(activityService.onActivityUpdate(() => updateActivityStatusBar()));
  }

  // Configuration changes
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration(async (e) => {
      if (e.affectsConfiguration('cmdify.ai')) {
        aiProvider = await initializeAIProvider(context);
        await updateAIConfiguredContext(context);
      }
    })
  );

  // Initial workspace scan
  setTimeout(() => {
    todoScannerService.scanWorkspace();
  }, 2000);

  // Check and show onboarding for new users
  setTimeout(async () => {
    if (onboardingService.shouldShowOnboarding()) {
      await onboardingPanelProvider.show();
    }
  }, 1000);
}

async function handleFocusSessionComplete(): Promise<void> {
  const focusConfig = focusService.getConfig();
  await activityService.recordFocusSession(focusConfig.focusDuration);
  await companionService.awardXP(100, 'focusSessionComplete');

  const stats = activityService.getStats();
  await achievementService.checkFocusAchievements(stats.totalSessions);

  const today = activityService.getToday();
  if (today) {
    await achievementService.trackDailySessions(today.focusSessions);
  }

  if (stats.todayGoalProgress >= 100 && !activityService.hasDailyGoalBonusAwarded()) {
    await companionService.awardXP(200, 'dailyGoalReached');
    await activityService.markDailyGoalBonusAwarded();
  }

  // Phase 4: Check for near-completion achievements
  await achievementService.checkNearCompletionNotifications();
}

async function handleLevelUp(newLevel: number): Promise<void> {
  const companionState = companionService.getState();
  const action = await vscode.window.showInformationMessage(
    `🎉 Level Up! Your ${companionState.type} is now Level ${newLevel}!`,
    'View Stats'
  );

  if (action === 'View Stats') {
    vscode.commands.executeCommand('cmdify.focus.showPanel');
  }
}

async function handleUnlock({
  type,
  item,
}: {
  type: 'companion' | 'accessory';
  item: string;
}): Promise<void> {
  if (type === 'companion') {
    const action = await vscode.window.showInformationMessage(
      `🐾 New Companion Unlocked: ${item.charAt(0).toUpperCase() + item.slice(1)}!`,
      'Switch Now',
      'Later'
    );

    if (action === 'Switch Now') {
      await companionService.setCompanionType(item as any);
    }
  } else {
    vscode.window.showInformationMessage(`✨ New Accessory Unlocked: ${item}!`);
  }
}

// =============================================================================
// Command Registration
// =============================================================================

function registerCommands(context: vscode.ExtensionContext): void {
  const commands = [
    // Core Commands
    vscode.commands.registerCommand('cmdify.create', async () => {
      const newCommand = await handleCreate(storage, aiProvider);
      if (newCommand?.source === 'ai') {
        await achievementService.trackAICommandGenerated();
      }
    }),
    vscode.commands.registerCommand('cmdify.run', () => handleRun(undefined, storage)),
    vscode.commands.registerCommand('cmdify.runFromTree', (item) => handleRun(item, storage)),
    vscode.commands.registerCommand('cmdify.search', () => handleSearch(storage)),
    vscode.commands.registerCommand('cmdify.copy', () => handleCopy(undefined, storage)),
    vscode.commands.registerCommand('cmdify.copyFromTree', (item) => handleCopy(item, storage)),
    vscode.commands.registerCommand('cmdify.edit', (item) => handleEdit(item, storage)),
    vscode.commands.registerCommand('cmdify.delete', (item) => handleDelete(item, storage)),
    vscode.commands.registerCommand('cmdify.toggleFavorite', (item) =>
      handleToggleFavorite(item, storage)
    ),
    vscode.commands.registerCommand('cmdify.toggleFavoriteFromTree', (item) =>
      handleToggleFavorite(item, storage)
    ),

    // Sync Commands
    vscode.commands.registerCommand('cmdify.sync', async () => {
      await handleSync(syncService);
      await achievementService.trackSync();
    }),
    vscode.commands.registerCommand('cmdify.export', () => handleExport(storage)),
    vscode.commands.registerCommand('cmdify.import', () => handleImport(storage)),
    vscode.commands.registerCommand('cmdify.login', () => handleLogin(syncService)),

    // Settings Commands
    vscode.commands.registerCommand('cmdify.settings', () =>
      vscode.commands.executeCommand('workbench.action.openSettings', 'cmdify')
    ),
    vscode.commands.registerCommand('cmdify.configureAI', () => configureAIProvider(context)),
    vscode.commands.registerCommand('cmdify.refresh', () => treeProvider.refresh()),
    vscode.commands.registerCommand('cmdify.sponsor', () =>
      vscode.env.openExternal(vscode.Uri.parse('https://ko-fi.com/canhta'))
    ),
    vscode.commands.registerCommand('cmdify.about', () => handleAbout()),

    // Focus Timer Commands
    vscode.commands.registerCommand('cmdify.focus.start', async () => {
      const config = vscode.workspace.getConfiguration('cmdify.focus');
      const showSessionPicker = config.get<boolean>('showSessionTypePicker', true);

      if (showSessionPicker) {
        interface SessionPickItem extends vscode.QuickPickItem {
          sessionType: (typeof SESSION_TYPES)[number] | null;
        }

        const items: SessionPickItem[] = SESSION_TYPES.map((type) => ({
          label: `${type.icon} ${type.name}`,
          description: `${type.focusMinutes}/${type.breakMinutes} min`,
          detail: type.description,
          sessionType: type,
        }));

        items.push({
          label: '⚙️ Custom',
          description: `${config.get('focusDuration')}/${config.get('shortBreakDuration')} min`,
          detail: 'Use settings values',
          sessionType: null,
        });

        const selected = await vscode.window.showQuickPick(items, {
          placeHolder: 'Select session type',
          title: 'Start Focus Session',
        });

        if (!selected) {
          return;
        }

        if (selected.sessionType) {
          await focusService.startWithConfig({
            focusDuration: selected.sessionType.focusMinutes,
            shortBreakDuration: selected.sessionType.breakMinutes,
          });
        } else {
          await focusService.start();
        }
      } else {
        await focusService.start();
      }
    }),
    vscode.commands.registerCommand('cmdify.focus.pause', () => focusService.pause()),
    vscode.commands.registerCommand('cmdify.focus.resume', () => focusService.resume()),
    vscode.commands.registerCommand('cmdify.focus.stop', () => focusService.stop()),
    vscode.commands.registerCommand('cmdify.focus.skip', () => focusService.skip()),
    vscode.commands.registerCommand('cmdify.focus.showPanel', () =>
      vscode.commands.executeCommand('cmdify.focus.focus')
    ),

    // TODO Commands
    vscode.commands.registerCommand('cmdify.todos.scan', async () => {
      const todos = await todoScannerService.scanWorkspace();
      vscode.window.showInformationMessage(`📋 Found ${todos.length} TODO items`);
    }),
    vscode.commands.registerCommand('cmdify.todos.refresh', () => todoTreeProvider.refresh()),
    vscode.commands.registerCommand(
      'cmdify.todo.goToCode',
      async (item: TodoTreeItem | DetectedTodo) => {
        const todo = (item as TodoTreeItem).todo ?? (item as DetectedTodo);
        if (todo && 'filePath' in todo) {
          await todoSyncService.goToTodo(todo);
        }
      }
    ),
    vscode.commands.registerCommand(
      'cmdify.todo.setReminder',
      async (item: TodoTreeItem | DetectedTodo) => {
        const todo = (item as TodoTreeItem).todo ?? (item as DetectedTodo);
        if (todo && 'filePath' in todo) {
          await reminderService.setTodoReminderInteractive(todo);
        }
      }
    ),
    vscode.commands.registerCommand(
      'cmdify.todo.setDueDate',
      async (item: TodoTreeItem | DetectedTodo) => {
        const todo = (item as TodoTreeItem).todo ?? (item as DetectedTodo);
        if (todo && 'filePath' in todo) {
          await reminderService.setDueDateInteractive(todo);
        }
      }
    ),
    vscode.commands.registerCommand(
      'cmdify.todo.assign',
      async (item: TodoTreeItem | DetectedTodo) => {
        const todo = (item as TodoTreeItem).todo ?? (item as DetectedTodo);
        if (todo && 'filePath' in todo) {
          await reminderService.assignTodoInteractive(todo);
        }
      }
    ),
    vscode.commands.registerCommand(
      'cmdify.todo.complete',
      async (item: TodoTreeItem | DetectedTodo) => {
        const todo = (item as TodoTreeItem).todo ?? (item as DetectedTodo);
        if (todo && 'id' in todo && todo.id) {
          await todoScannerService.markComplete(todo.id);
          companionService.showMessage('todoComplete');
          vscode.window.showInformationMessage('✅ TODO marked as complete');

          const completedCount = todoScannerService.getCompletedTodos().length;
          await achievementService.checkTodoAchievements(completedCount);
          await companionService.awardXP(50, 'todoComplete');
        }
      }
    ),
    vscode.commands.registerCommand(
      'cmdify.todo.markDone',
      async (item: TodoTreeItem | DetectedTodo) => {
        const todo = (item as TodoTreeItem).todo ?? (item as DetectedTodo);
        if (todo && 'filePath' in todo) {
          await todoSyncService.markDoneInCode(todo);
        }
      }
    ),
    vscode.commands.registerCommand(
      'cmdify.todo.delete',
      async (item: TodoTreeItem | DetectedTodo) => {
        const todo = (item as TodoTreeItem).todo ?? (item as DetectedTodo);
        if (todo && 'filePath' in todo) {
          await todoSyncService.deleteTodoLine(todo);
        }
      }
    ),

    // Reminder Commands
    vscode.commands.registerCommand('cmdify.reminder.add', async () => {
      const reminder = await reminderService.createGlobalReminderInteractive();
      if (reminder) {
        todoTreeProvider.refresh();
        vscode.window.showInformationMessage(
          `🔔 Reminder set for ${reminder.dueAt.toLocaleString()}`
        );
      }
    }),
    vscode.commands.registerCommand('cmdify.reminder.complete', async (item: TodoTreeItem) => {
      if (item.reminder) {
        await reminderService.completeGlobalReminder(item.reminder.id);
        todoTreeProvider.refresh();
        vscode.window.showInformationMessage('✅ Reminder completed');
      }
    }),
    vscode.commands.registerCommand('cmdify.reminder.delete', async (item: TodoTreeItem) => {
      if (item.reminder) {
        const confirm = await vscode.window.showWarningMessage(
          `Delete reminder "${item.reminder.title}"?`,
          { modal: true },
          'Delete'
        );
        if (confirm === 'Delete') {
          await reminderService.deleteGlobalReminder(item.reminder.id);
          todoTreeProvider.refresh();
        }
      }
    }),

    // Activity & Achievement Commands
    vscode.commands.registerCommand('cmdify.activity.showDashboard', () =>
      activityPanelProvider.show()
    ),
    vscode.commands.registerCommand('cmdify.showAchievements', () =>
      achievementPanelProvider.show()
    ),

    // =============================================================================
    // Notes Commands
    // =============================================================================
    vscode.commands.registerCommand('cmdify.notes.add', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showWarningMessage('No active editor');
        return;
      }

      const selection = editor.selection;
      if (selection.isEmpty) {
        vscode.window.showWarningMessage('Please select some code first');
        return;
      }

      const noteText = await vscode.window.showInputBox({
        prompt: 'Add a note for this code',
        placeHolder: 'Enter your note...',
      });

      if (noteText) {
        try {
          await notesService.addNote(editor, selection, noteText);
          await updateNoNotesContext();
          vscode.window.showInformationMessage('📝 Note added!');
        } catch (error) {
          vscode.window.showErrorMessage(`Failed to add note: ${error}`);
        }
      }
    }),
    vscode.commands.registerCommand('cmdify.notes.showPanel', () => notesPanelProvider.show()),
    vscode.commands.registerCommand(
      'cmdify.notes.goToNote',
      async (item: NoteTreeItem | CodeNote | { id: string }) => {
        let note: CodeNote | undefined;

        // Check if it's a NoteTreeItem (from context menu)
        if (item && 'itemType' in item && item.itemType === 'note' && item.note) {
          note = item.note;
        }
        // Check if it's a CodeNote directly (from tree item click)
        else if (item && 'filePath' in item && 'startLine' in item) {
          note = item as CodeNote;
        }
        // Check if it's just an id object
        else if (item && 'id' in item) {
          note = notesService.getNote((item as { id: string }).id);
        }

        if (note) {
          await notesService.goToNote(note);
        } else {
          vscode.window.showWarningMessage('Note not found');
        }
      }
    ),
    vscode.commands.registerCommand('cmdify.notes.edit', async (item: NoteTreeItem) => {
      if (item.note) {
        const newText = await vscode.window.showInputBox({
          prompt: 'Edit note',
          value: item.note.note,
          placeHolder: 'Enter your note...',
        });
        if (newText !== undefined) {
          await notesService.updateNote(item.note.id, { note: newText });
          vscode.window.showInformationMessage('📝 Note updated!');
        }
      }
    }),
    vscode.commands.registerCommand('cmdify.notes.delete', async (item: NoteTreeItem) => {
      if (item.note) {
        const confirm = await vscode.window.showWarningMessage(
          'Delete this note?',
          { modal: true },
          'Delete'
        );
        if (confirm === 'Delete') {
          await notesService.deleteNote(item.note.id);
          await updateNoNotesContext();
          vscode.window.showInformationMessage('Note deleted');
        }
      }
    }),

    // Onboarding Commands
    vscode.commands.registerCommand('cmdify.showOnboarding', () => onboardingPanelProvider.show()),
    vscode.commands.registerCommand('cmdify.resetOnboarding', async () => {
      await onboardingService.resetOnboarding();
      vscode.window.showInformationMessage('Onboarding reset. Reload to see the welcome screen.');
    }),

    // =============================================================================
    // Phase 4: Companion Personalization Commands
    // =============================================================================

    // Companion Rename
    vscode.commands.registerCommand('cmdify.companion.rename', async () => {
      const currentName = companionService.getCompanionName();
      const newName = await vscode.window.showInputBox({
        prompt: 'Name your companion',
        value: currentName,
        placeHolder: 'Enter a name (max 20 characters)',
        validateInput: (value) => {
          if (value.length > 20) {
            return 'Name must be 20 characters or less';
          }
          return null;
        },
      });

      if (newName !== undefined) {
        await companionService.setCompanionName(newName);
        vscode.window.showInformationMessage(
          `Your companion is now named "${companionService.getCompanionName()}"! 🎉`
        );
      }
    }),

    // Export Data
    vscode.commands.registerCommand('cmdify.exportData', async () => {
      const commands = storage.getAll();
      const companionState = companionService.getState();
      const achievements = achievementService.getUnlockedAchievements();
      const stats = activityService.getStats();

      const data = {
        exportVersion: '1.0',
        exportedAt: new Date().toISOString(),
        commands,
        activity: {
          stats,
        },
        companion: companionState,
        achievements,
      };

      const todayStr = new Date().toISOString().split('T')[0];
      const uri = await vscode.window.showSaveDialog({
        defaultUri: vscode.Uri.file(`cmdify-export-${todayStr}.json`),
        filters: { JSON: ['json'] },
      });

      if (uri) {
        await vscode.workspace.fs.writeFile(uri, Buffer.from(JSON.stringify(data, null, 2)));
        vscode.window.showInformationMessage('✅ Data exported successfully!');
      }
    }),

    // Reset Progress
    vscode.commands.registerCommand('cmdify.resetProgress', async () => {
      const confirm = await vscode.window.showWarningMessage(
        'Reset all Cmdify progress? This will clear your companion level, achievements, and activity history. Commands will NOT be deleted.',
        { modal: true },
        'Reset Everything',
        'Cancel'
      );

      if (confirm !== 'Reset Everything') {
        return;
      }

      // Double confirm
      const doubleConfirm = await vscode.window.showWarningMessage(
        'Are you absolutely sure? This cannot be undone.',
        { modal: true },
        'Yes, Reset',
        'Cancel'
      );

      if (doubleConfirm !== 'Yes, Reset') {
        return;
      }

      // Reset companion
      await companionService.reset();

      // Reset achievements
      await achievementService.reset();

      // Reset activity
      await activityService.reset();

      // Reset focus stats
      await focusService.resetStats();

      vscode.window.showInformationMessage('Progress reset. Your companion is starting fresh! 🐣');
    }),
  ];

  context.subscriptions.push(...commands);
}

// =============================================================================
// Status Bar Updates
// =============================================================================

function updateFocusStatusBar(): void {
  const focusState = focusService.getState();
  const companionState = companionService.getState();
  const stats = focusService.getStats();

  const icons = COMPANION_ICONS[companionState.type];
  const icon = icons[focusState.status] || icons.idle;

  let text = '';

  if (focusState.status === 'focusing') {
    text = `${icon} ${formatTime(focusState.timeRemaining)}`;
    focusStatusBarItem.command = 'cmdify.focus.pause';
  } else if (focusState.status === 'break') {
    text = `${icon} Break ${formatTime(focusState.timeRemaining)}`;
    focusStatusBarItem.command = 'cmdify.focus.skip';
  } else if (focusState.status === 'paused') {
    text = `${icon} Paused ${formatTime(focusState.timeRemaining)}`;
    focusStatusBarItem.command = 'cmdify.focus.resume';
  } else {
    text = `$(play) Start`;
    focusStatusBarItem.command = 'cmdify.focus.start';
  }

  if (stats.currentStreak > 0) {
    text += ` $(zap)${stats.currentStreak}`;
  }

  focusStatusBarItem.text = text;
  focusStatusBarItem.tooltip = getFocusTooltip(focusState.status, focusState.todaySessions);
}

function updateTodoStatusBar(): void {
  const openCount = todoScannerService.getOpenCount();
  const dueCount = todoScannerService.getDueCount();

  if (openCount === 0) {
    todoStatusBarItem.text = '$(checklist) 0';
    todoStatusBarItem.tooltip = 'No TODOs found - Click to scan workspace';
  } else if (dueCount > 0) {
    todoStatusBarItem.text = `$(checklist) ${openCount} $(warning) ${dueCount}`;
    todoStatusBarItem.tooltip = `${openCount} TODOs (${dueCount} due/overdue) - Click to scan`;
  } else {
    todoStatusBarItem.text = `$(checklist) ${openCount}`;
    todoStatusBarItem.tooltip = `${openCount} TODOs - Click to scan workspace`;
  }
}

function updateActivityStatusBar(): void {
  if (!activityStatusBarItem) {
    return;
  }

  activityStatusBarItem.text = `$(clock) ${activityService.getStatusBarText()}`;
  activityStatusBarItem.tooltip = activityService.getStatusBarTooltip();
}

function getFocusTooltip(status: string, todaySessions: number): string {
  const statusMessages: Record<string, string> = {
    focusing: 'Click to pause',
    break: 'Click to skip break',
    paused: 'Click to resume',
    idle: 'Click to start focus',
  };

  return [
    `Focus Timer - ${statusMessages[status] || statusMessages.idle}`,
    `${todaySessions} sessions today`,
  ].join('\n');
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

interface QuickPickItemWithValue extends vscode.QuickPickItem {
  value: string;
}

async function configureAIProvider(context: vscode.ExtensionContext): Promise<void> {
  const config = vscode.workspace.getConfiguration('cmdify.ai');

  // Step 1: Select provider
  const providers: QuickPickItemWithValue[] = [
    {
      label: 'OpenAI',
      value: 'openai',
      description: 'GPT-4o, GPT-4o-mini, GPT-4 Turbo',
    },
    {
      label: 'Anthropic',
      value: 'anthropic',
      description: 'Claude Sonnet, Claude Haiku',
    },
    {
      label: 'Ollama',
      value: 'ollama',
      description: 'Local models (no API key needed)',
    },
    {
      label: 'Azure OpenAI',
      value: 'azure',
      description: 'Azure-hosted OpenAI models',
    },
    {
      label: 'Custom',
      value: 'custom',
      description: 'Custom OpenAI-compatible endpoint',
    },
  ];

  const selectedProvider = await vscode.window.showQuickPick(providers, {
    placeHolder: 'Select AI provider',
    title: 'Step 1: Select AI Provider',
  });

  if (!selectedProvider) {
    return;
  }

  if (selectedProvider.value === 'custom') {
    await configureCustomProvider(context, config);
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
      validateInput: (value) => (!value && !existingKey ? 'API key is required' : undefined),
    });

    if (apiKey === undefined) {
      return;
    }
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

  // Save configuration
  await config.update('provider', selectedProvider.value, vscode.ConfigurationTarget.Global);
  await config.update('model', selectedModel.value, vscode.ConfigurationTarget.Global);

  if (selectedProvider.value !== 'azure') {
    await config.update('customEndpoint', '', vscode.ConfigurationTarget.Global);
  }

  aiProvider = await initializeAIProvider(context);
  await updateAIConfiguredContext(context);
  vscode.window.showInformationMessage(
    `AI configured: ${selectedProvider.label} with ${selectedModel.label}`
  );
}

async function configureCustomProvider(
  context: vscode.ExtensionContext,
  config: vscode.WorkspaceConfiguration
): Promise<void> {
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

  const modelName = await vscode.window.showInputBox({
    prompt: 'Enter the model name to use',
    placeHolder: 'gpt-4o-mini, llama-3.1-70b, etc.',
    title: 'Step 3: Model Name',
    validateInput: (value) => (!value ? 'Model name is required' : undefined),
  });

  if (!modelName) {
    return;
  }

  const apiKey = await vscode.window.showInputBox({
    prompt: 'Enter API key (leave empty if not required)',
    password: true,
    placeHolder: 'API key (optional)',
    title: 'Step 4: API Key (Optional)',
  });

  if (apiKey === undefined) {
    return;
  }

  await config.update('provider', 'custom', vscode.ConfigurationTarget.Global);
  await config.update('customEndpoint', endpoint, vscode.ConfigurationTarget.Global);
  await config.update('model', modelName, vscode.ConfigurationTarget.Global);

  if (apiKey) {
    await context.secrets.store('cmdify.custom', apiKey);
  }

  aiProvider = await initializeAIProvider(context);
  await updateAIConfiguredContext(context);
  vscode.window.showInformationMessage(`AI configured: Custom provider with ${modelName}`);
}

async function getModelsForProvider(provider: string): Promise<QuickPickItemWithValue[]> {
  const modelConfigs: Record<string, QuickPickItemWithValue[]> = {
    openai: [
      {
        label: 'GPT-4o Mini',
        value: 'gpt-4o-mini',
        description: 'Recommended - Fast and cost-effective',
      },
      { label: 'GPT-4o', value: 'gpt-4o', description: 'Most capable' },
      {
        label: 'GPT-4 Turbo',
        value: 'gpt-4-turbo',
        description: 'Previous generation',
      },
      {
        label: 'GPT-3.5 Turbo',
        value: 'gpt-3.5-turbo',
        description: 'Budget option',
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

  if (provider === 'ollama') {
    const ollamaProvider = new OllamaProvider();
    const models = await ollamaProvider.getAvailableModels();
    return models.map((model) => ({
      label: model,
      value: model,
      description: model.includes('code') ? 'Optimized for code' : undefined,
    }));
  }

  return modelConfigs[provider] || [];
}

// =============================================================================
// Utility Functions
// =============================================================================

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

// =============================================================================
// Disposables Management
// =============================================================================

function addDisposables(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    storage,
    treeProvider,
    focusService,
    companionService,
    focusStatusBarItem,
    todoScannerService,
    todoSyncService,
    reminderService,
    todoStatusBarItem,
    sponsorStatusBarItem,
    activityService,
    activityPanelProvider,
    achievementService,
    achievementPanelProvider,
    notesService,
    notesPanelProvider
  );

  if (activityStatusBarItem) {
    context.subscriptions.push(activityStatusBarItem);
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
