import * as vscode from 'vscode';
import { CLICommand } from '../models/command';
import { CommandTreeItem, CommandQuickPickItem } from '../models/types';
import { StorageService } from '../services/storage';

/**
 * Create quick pick items from commands
 */
export function createCommandQuickPickItems(commands: CLICommand[]): CommandQuickPickItem[] {
  return commands.map((cmd) => ({
    label: `${cmd.isFavorite ? '$(star-full) ' : ''}${cmd.prompt || cmd.command}`,
    description: cmd.tags.join(', '),
    detail: cmd.command,
    command: cmd,
  }));
}

/**
 * Create enhanced quick pick items with sections
 */
export function createEnhancedQuickPickItems(storage: StorageService): vscode.QuickPickItem[] {
  const items: vscode.QuickPickItem[] = [];
  const favorites = storage.getFavorites();
  const recent = storage.getRecent(5);
  const allCommands = storage.getAll();

  // Favorites section
  if (favorites.length > 0) {
    items.push({
      label: '⭐ FAVORITES',
      kind: vscode.QuickPickItemKind.Separator,
    });
    for (const cmd of favorites) {
      items.push({
        label: `$(star-full) ${cmd.prompt || cmd.command}`,
        description: cmd.tags.join(', '),
        detail: cmd.command,
        command: cmd,
      } as CommandQuickPickItem);
    }
  }

  // Recent section
  const recentNotInFavorites = recent.filter((cmd) => !cmd.isFavorite);
  if (recentNotInFavorites.length > 0) {
    items.push({
      label: '🕐 RECENT',
      kind: vscode.QuickPickItemKind.Separator,
    });
    for (const cmd of recentNotInFavorites) {
      items.push({
        label: `$(history) ${cmd.prompt || cmd.command}`,
        description: cmd.tags.join(', '),
        detail: cmd.command,
        command: cmd,
      } as CommandQuickPickItem);
    }
  }

  // All commands section (excluding those already shown)
  const shownIds = new Set([
    ...favorites.map((c) => c.id),
    ...recentNotInFavorites.map((c) => c.id),
  ]);
  const otherCommands = allCommands.filter((cmd) => !shownIds.has(cmd.id));

  if (otherCommands.length > 0) {
    items.push({
      label: '📁 ALL COMMANDS',
      kind: vscode.QuickPickItemKind.Separator,
    });
    for (const cmd of otherCommands) {
      items.push({
        label: cmd.prompt || cmd.command,
        description: cmd.tags.join(', '),
        detail: cmd.command,
        command: cmd,
      } as CommandQuickPickItem);
    }
  }

  return items;
}

/**
 * Show a quick pick to select a command, or use the provided item
 * Returns the selected command or undefined if cancelled/no commands
 */
export async function selectCommand(
  item: CommandTreeItem | undefined,
  storage: StorageService,
  options: {
    placeHolder: string;
    emptyMessage: string;
    showCreateOption?: boolean;
    useEnhancedUI?: boolean;
  }
): Promise<CLICommand | undefined> {
  // If item has command data, return it directly
  if (item?.commandData) {
    return item.commandData;
  }

  const commands = storage.getAll();

  if (commands.length === 0) {
    if (options.showCreateOption) {
      const create = await vscode.window.showInformationMessage(
        'No commands saved yet. Create your first command?',
        'Create'
      );
      if (create === 'Create') {
        await vscode.commands.executeCommand('cmdify.create');
      }
    } else {
      vscode.window.showInformationMessage(options.emptyMessage);
    }
    return undefined;
  }

  // Use enhanced UI if requested and we have multiple commands
  const items =
    options.useEnhancedUI && commands.length > 3
      ? createEnhancedQuickPickItems(storage)
      : createCommandQuickPickItems(commands);

  const selection = await vscode.window.showQuickPick(items, {
    placeHolder: options.placeHolder,
    matchOnDetail: true,
    matchOnDescription: true,
  });

  return (selection as CommandQuickPickItem)?.command;
}

/**
 * Show fuzzy search quick pick
 */
export async function selectCommandWithFuzzySearch(
  storage: StorageService,
  options: {
    placeHolder: string;
    showAIOption?: boolean;
  }
): Promise<{ command?: CLICommand; generateAI?: boolean }> {
  const quickPick = vscode.window.createQuickPick<CommandQuickPickItem | vscode.QuickPickItem>();
  quickPick.placeholder = options.placeHolder;
  quickPick.matchOnDetail = true;
  quickPick.matchOnDescription = true;

  const updateItems = (query: string) => {
    const items: (CommandQuickPickItem | vscode.QuickPickItem)[] = [];

    if (query.trim()) {
      // Use fuzzy search
      const results = storage.fuzzySearch(query);
      for (const { command: cmd } of results) {
        items.push({
          label: `${cmd.isFavorite ? '$(star-full) ' : ''}${cmd.prompt || cmd.command}`,
          description: cmd.tags.join(', '),
          detail: cmd.command,
          command: cmd,
        } as CommandQuickPickItem);
      }
    } else {
      // Show enhanced UI when no query
      items.push(...createEnhancedQuickPickItems(storage));
    }

    // Add AI generation option
    if (options.showAIOption) {
      items.push({
        label: '$(sparkle) Generate with AI...',
        description: 'Describe what you want to do',
        alwaysShow: true,
        isAIOption: true,
      } as CommandQuickPickItem & { isAIOption?: boolean });
    }

    quickPick.items = items;
  };

  // Initial items
  updateItems('');

  // Update on input change
  quickPick.onDidChangeValue(updateItems);

  return new Promise((resolve) => {
    quickPick.onDidAccept(() => {
      const selected = quickPick.selectedItems[0] as CommandQuickPickItem & {
        isAIOption?: boolean;
      };
      quickPick.hide();

      if (selected?.isAIOption) {
        resolve({ generateAI: true });
      } else if (selected?.command) {
        resolve({ command: selected.command });
      } else {
        resolve({});
      }
    });

    quickPick.onDidHide(() => {
      quickPick.dispose();
      resolve({});
    });

    quickPick.show();
  });
}
