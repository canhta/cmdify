import * as vscode from 'vscode';
import { CLICommand } from '../models/command';
import { CommandTreeItem } from '../models/types';
import { StorageService } from '../services/storage';
import { analyzeCommand, getWarningMessage } from '../services/security';
import { executeCommand, getWorkspaceFolder, promptWorkingDirectory } from '../utils/shell';
import { hasVariables, extractVariables, promptForVariablesWithPreview } from '../utils/variables';
import { selectCommand, selectCommandWithFuzzySearch } from '../utils/quickPick';

/**
 * Handle running a command
 */
export async function handleRun(
  item: CommandTreeItem | undefined,
  storage: StorageService
): Promise<void> {
  const cmd = await selectCommand(item, storage, {
    placeHolder: 'Select a command to run',
    emptyMessage: 'No commands saved yet.',
    showCreateOption: true,
    useEnhancedUI: true,
  });

  if (cmd) {
    await runCommand(cmd, storage);
  }
}

/**
 * Run a specific command
 */
async function runCommand(cmd: CLICommand, storage: StorageService): Promise<void> {
  let commandToRun = cmd.command;

  // Handle variables
  if (hasVariables(commandToRun)) {
    const variables = cmd.variables || extractVariables(commandToRun);
    const processed = await promptForVariablesWithPreview(variables, commandToRun);

    if (!processed) {
      return; // User cancelled
    }

    commandToRun = processed;
  }

  // Security check
  const config = vscode.workspace.getConfiguration('cmdify.execution');
  const confirmDestructive = config.get<boolean>('confirmDestructive', true);

  if (confirmDestructive && !cmd.skipDestructiveWarning) {
    const analysis = analyzeCommand(commandToRun);

    if (analysis.blocked) {
      vscode.window.showErrorMessage('This command is blocked for safety reasons.', {
        modal: true,
      });
      return;
    }

    if (analysis.warnings.length > 0) {
      const warningMessage = getWarningMessage(analysis);

      const result = await vscode.window.showWarningMessage(
        `⚠️ Heads up - this looks destructive\n\n${commandToRun}\n\n${warningMessage}`,
        { modal: true },
        'Run Anyway',
        "Don't Warn for This Command",
        'Cancel'
      );

      if (result === "Don't Warn for This Command") {
        // Update command to skip future warnings
        const updatedCmd: CLICommand = {
          ...cmd,
          skipDestructiveWarning: true,
        };
        await storage.update(updatedCmd);
        // Continue to run the command
      } else if (result !== 'Run Anyway') {
        return;
      }
    }
  }

  // Handle working directory
  let workingDirectory: string | undefined;

  if (cmd.workingDirectory) {
    switch (cmd.workingDirectory.type) {
      case 'workspace':
        workingDirectory = getWorkspaceFolder();
        break;
      case 'custom':
        workingDirectory = cmd.workingDirectory.path;
        break;
      case 'ask':
        workingDirectory = await promptWorkingDirectory();
        if (!workingDirectory) {
          return; // User cancelled
        }
        break;
    }
  }

  // Execute the command
  executeCommand(commandToRun, { workingDirectory });

  // Record usage
  await storage.recordUsage(cmd.id);
}

/**
 * Handle copying a command to clipboard
 */
export async function handleCopy(
  item: CommandTreeItem | undefined,
  storage: StorageService
): Promise<void> {
  const cmd = await selectCommand(item, storage, {
    placeHolder: 'Select a command to copy',
    emptyMessage: 'No commands to copy.',
  });

  if (cmd) {
    await vscode.env.clipboard.writeText(cmd.command);
    vscode.window.showInformationMessage('Command copied to clipboard!');
  }
}

/**
 * Search and optionally generate commands with fuzzy search
 */
export async function handleSearch(storage: StorageService): Promise<void> {
  const result = await selectCommandWithFuzzySearch(storage, {
    placeHolder: 'Search or describe a command...',
    showAIOption: true,
  });

  if (result.generateAI) {
    await vscode.commands.executeCommand('cmdify.create');
    return;
  }

  if (result.command) {
    await runCommand(result.command, storage);
  }
}

/**
 * Handle toggling favorite status
 */
export async function handleToggleFavorite(
  item: CommandTreeItem | undefined,
  storage: StorageService
): Promise<void> {
  const cmd = await selectCommand(item, storage, {
    placeHolder: 'Select a command to toggle favorite',
    emptyMessage: 'No commands available.',
    useEnhancedUI: true,
  });

  if (cmd) {
    const isFavorite = await storage.toggleFavorite(cmd.id);
    const message = isFavorite
      ? `⭐ "${cmd.prompt || cmd.command}" added to favorites`
      : `"${cmd.prompt || cmd.command}" removed from favorites`;
    vscode.window.showInformationMessage(message);
  }
}
