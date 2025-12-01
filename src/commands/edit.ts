import * as vscode from 'vscode';
import { CLICommand } from '../models/command';
import { CommandTreeItem } from '../models/types';
import { StorageService } from '../services/storage';
import { extractVariables } from '../utils/variables';
import { selectCommand } from '../utils/quickPick';

/**
 * Handle editing a command
 */
export async function handleEdit(
  item: CommandTreeItem | undefined,
  storage: StorageService
): Promise<void> {
  const cmd = await selectCommand(item, storage, {
    placeHolder: 'Select a command to edit',
    emptyMessage: 'No commands to edit.',
  });

  if (cmd) {
    await editCommand(cmd, storage);
  }
}

/**
 * Edit a specific command
 */
async function editCommand(cmd: CLICommand, storage: StorageService): Promise<void> {
  // Show options for what to edit
  const editOptions: vscode.QuickPickItem[] = [
    {
      label: '$(terminal) Command',
      description: cmd.command.length > 50 ? cmd.command.substring(0, 50) + '...' : cmd.command,
      detail: 'Edit the CLI command',
    },
    {
      label: '$(comment) Description',
      description: cmd.prompt || '(no description)',
      detail: 'Edit the command description',
    },
    {
      label: '$(tag) Tags',
      description: cmd.tags.length > 0 ? cmd.tags.join(', ') : '(no tags)',
      detail: 'Edit command tags',
    },
    {
      label: '$(check-all) Edit All',
      description: 'Edit all fields',
      detail: 'Edit command, description, and tags',
    },
  ];

  const selection = await vscode.window.showQuickPick(editOptions, {
    placeHolder: 'What would you like to edit?',
    title: `Edit: ${cmd.prompt || cmd.command}`,
    ignoreFocusOut: true,
  });

  if (!selection) {
    return;
  }

  let newCommand = cmd.command;
  let newPrompt = cmd.prompt;
  let tags = cmd.tags;

  // Edit based on selection
  if (selection.label === '$(terminal) Command' || selection.label === '$(check-all) Edit All') {
    const editedCommand = await vscode.window.showInputBox({
      prompt: 'Edit the command',
      value: cmd.command,
      title: 'Edit Command',
      ignoreFocusOut: true,
    });

    if (editedCommand === undefined) {
      return; // User cancelled
    }
    newCommand = editedCommand;
  }

  if (selection.label === '$(comment) Description' || selection.label === '$(check-all) Edit All') {
    const editedPrompt = await vscode.window.showInputBox({
      prompt: 'Edit the description',
      value: cmd.prompt,
      title: 'Edit Description',
      ignoreFocusOut: true,
    });

    if (editedPrompt === undefined) {
      return; // User cancelled
    }
    newPrompt = editedPrompt;
  }

  if (selection.label === '$(tag) Tags' || selection.label === '$(check-all) Edit All') {
    const existingTags = storage.getAllTags();
    const tagHint =
      existingTags.length > 0
        ? `Existing tags: ${existingTags.slice(0, 5).join(', ')}${existingTags.length > 5 ? '...' : ''}`
        : 'e.g., git, docker, npm';

    const editedTags = await vscode.window.showInputBox({
      prompt: `Edit tags (comma-separated). ${tagHint}`,
      value: cmd.tags.join(', '),
      title: 'Edit Tags',
      ignoreFocusOut: true,
    });

    if (editedTags === undefined) {
      return; // User cancelled
    }

    tags = editedTags
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t.length > 0);
  }

  // Extract new variables if command changed
  const variables = newCommand !== cmd.command ? extractVariables(newCommand) : cmd.variables;

  // Update the command
  const updatedCommand: CLICommand = {
    ...cmd,
    command: newCommand,
    prompt: newPrompt,
    tags,
    variables,
  };

  await storage.update(updatedCommand);
  vscode.window.showInformationMessage('Command updated!');
}

/**
 * Handle deleting a command
 */
export async function handleDelete(
  item: CommandTreeItem | undefined,
  storage: StorageService
): Promise<void> {
  const cmd = await selectCommand(item, storage, {
    placeHolder: 'Select a command to delete',
    emptyMessage: 'No commands to delete.',
  });

  if (cmd) {
    await deleteCommand(cmd, storage);
  }
}

/**
 * Delete a specific command
 */
async function deleteCommand(cmd: CLICommand, storage: StorageService): Promise<void> {
  const confirm = await vscode.window.showWarningMessage(
    `Delete "${cmd.prompt || cmd.command}"?`,
    { modal: true },
    'Delete',
    'Cancel'
  );

  if (confirm !== 'Delete') {
    return;
  }

  await storage.delete(cmd.id);
  vscode.window.showInformationMessage('Command deleted!');
}
