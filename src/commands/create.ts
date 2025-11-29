import * as vscode from 'vscode';
import { CLICommand, createCommand } from '../models/command';
import { StorageService } from '../services/storage';
import { AIProvider, AIResponse, createAIContext, detectInputType } from '../services/ai';
import { extractVariables, mergeVariables } from '../utils/variables';

/**
 * Handle command creation (AI + manual)
 */
export async function handleCreate(
  storage: StorageService,
  aiProvider: AIProvider | undefined
): Promise<CLICommand | undefined> {
  // Step 1: Get user input
  const input = await vscode.window.showInputBox({
    prompt: 'What do you want to do?',
    placeHolder: 'Describe a command or type the actual command...',
    title: 'Create Command',
  });

  if (!input) {
    return undefined;
  }

  const inputType = detectInputType(input);

  if (inputType === 'command') {
    // Direct command entry
    return handleManualCreate(input, storage);
  }

  // AI generation
  if (!aiProvider) {
    const configure = await vscode.window.showWarningMessage(
      'AI provider not configured. Would you like to configure it now?',
      'Configure',
      'Enter Manually'
    );

    if (configure === 'Configure') {
      await vscode.commands.executeCommand('cmdify.configureAI');
      return undefined;
    } else if (configure === 'Enter Manually') {
      return handleManualCreate(input, storage);
    }
    return undefined;
  }

  return handleAICreate(input, storage, aiProvider);
}

/**
 * Handle manual command creation
 */
async function handleManualCreate(
  command: string,
  storage: StorageService
): Promise<CLICommand | undefined> {
  // Check for duplicates
  const duplicate = storage.findDuplicate(command);
  if (duplicate) {
    const action = await vscode.window.showWarningMessage(
      `A similar command already exists:\n\n"${duplicate.prompt || duplicate.command}"`,
      { modal: true },
      'Save Anyway',
      'Edit Existing',
      'Cancel'
    );

    if (action === 'Cancel' || !action) {
      return undefined;
    }

    if (action === 'Edit Existing') {
      await vscode.commands.executeCommand('cmdify.edit', { commandData: duplicate });
      return undefined;
    }
    // Continue with 'Save Anyway'
  }

  // Ask for optional prompt/description
  const prompt = await vscode.window.showInputBox({
    prompt: 'Add a description (optional)',
    placeHolder: 'e.g., "Delete merged branches"',
    title: 'Command Description',
  });

  // Ask for tags
  const existingTags = storage.getAllTags();
  const tagsInput = await vscode.window.showInputBox({
    prompt: 'Add tags (comma-separated, optional)',
    placeHolder: existingTags.length > 0 
      ? `e.g., ${existingTags.slice(0, 3).join(', ')}`
      : 'e.g., git, cleanup',
    title: 'Tags',
  });

  const tags = tagsInput 
    ? tagsInput.split(',').map(t => t.trim()).filter(t => t.length > 0)
    : [];

  // Extract variables
  const variables = extractVariables(command);

  const newCommand = createCommand(prompt || command, command, 'manual', {
    tags,
    variables,
  });

  await storage.add(newCommand);
  vscode.window.showInformationMessage('Command saved!');

  return newCommand;
}

/**
 * Handle AI-powered command creation
 */
async function handleAICreate(
  prompt: string,
  storage: StorageService,
  aiProvider: AIProvider
): Promise<CLICommand | undefined> {
  let shouldRegenerate = true;

  while (shouldRegenerate) {
    shouldRegenerate = false;

    // Show progress
    const result = await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: 'Generating command...',
        cancellable: true,
      },
      async (progress, token) => {
        try {
          const context = createAIContext(storage.getAllTags());
          const response = await aiProvider.generate(prompt, context);

          if (token.isCancellationRequested) {
            return { action: 'cancelled' as const };
          }

          return { action: 'success' as const, response };
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Unknown error';
          vscode.window.showErrorMessage(`Failed to generate command: ${message}`);
          return { action: 'error' as const };
        }
      }
    );

    if (result.action !== 'success') {
      return undefined;
    }

    const previewResult = await showAIPreview(prompt, result.response, storage, aiProvider);
    
    if (previewResult.action === 'regenerate') {
      shouldRegenerate = true;
      continue;
    }

    if (previewResult.action === 'saved') {
      return previewResult.command;
    }

    return undefined;
  }

  return undefined;
}

type PreviewResult = 
  | { action: 'regenerate' }
  | { action: 'cancelled' }
  | { action: 'saved'; command: CLICommand }
  | { action: 'none'; command: undefined };

/**
 * Show AI generation preview
 */
async function showAIPreview(
  prompt: string,
  response: AIResponse,
  storage: StorageService,
  aiProvider: AIProvider
): Promise<PreviewResult> {
  // Build a detailed preview message
  const previewLines: string[] = [
    '```',
    response.command,
    '```',
  ];

  if (response.explanation) {
    previewLines.push('', `**Explanation:** ${response.explanation}`);
  }

  if (response.suggestedTags?.length) {
    previewLines.push('', `**Tags:** ${response.suggestedTags.join(', ')}`);
  }

  if (response.variables?.length) {
    const varNames = response.variables.map(v => `{{${v.name}}}`).join(', ');
    previewLines.push('', `**Variables:** ${varNames}`);
  }

  // Create quick pick with command preview
  const items: vscode.QuickPickItem[] = [
    {
      label: '$(check) Save',
      description: 'Save this command to your library',
    },
    {
      label: '$(play) Run & Save',
      description: 'Execute the command and save it',
    },
    {
      label: '$(edit) Edit',
      description: 'Modify the command before saving',
    },
    {
      label: '$(sync) Regenerate',
      description: 'Generate a different command',
    },
    {
      label: '$(close) Cancel',
      description: 'Discard this command',
    },
  ];

  // Show the command in a markdown preview
  const previewMarkdown = new vscode.MarkdownString(previewLines.join('\n'));
  previewMarkdown.isTrusted = true;

  const selection = await vscode.window.showQuickPick(items, {
    title: '$(sparkle) AI Generated Command',
    placeHolder: response.command,
    matchOnDescription: true,
  });

  // Also show the explanation in an information message for better visibility
  if (response.explanation && selection && selection.label !== '$(close) Cancel') {
    // Show as a non-blocking notification
    vscode.window.setStatusBarMessage(`$(lightbulb) ${response.explanation}`, 5000);
  }

  if (!selection || selection.label === '$(close) Cancel') {
    return { action: 'cancelled' };
  }

  // Handle regenerate
  if (selection.label === '$(sync) Regenerate') {
    return { action: 'regenerate' };
  }

  let command = response.command;

  if (selection.label === '$(edit) Edit') {
    const edited = await vscode.window.showInputBox({
      prompt: 'Edit the command',
      value: response.command,
      title: 'Edit Command',
    });

    if (!edited) {
      return { action: 'none', command: undefined };
    }

    command = edited;
  }

  // Extract and merge variables
  const extractedVars = extractVariables(command);
  const variables = mergeVariables(extractedVars, response.variables);

  // Check for duplicates before saving
  const duplicate = storage.findDuplicate(command);
  if (duplicate) {
    const action = await vscode.window.showWarningMessage(
      `A similar command already exists:\n\n"${duplicate.prompt || duplicate.command}"`,
      { modal: true },
      'Save Anyway',
      'Use Existing',
      'Cancel'
    );

    if (action === 'Cancel' || !action) {
      return { action: 'cancelled' };
    }

    if (action === 'Use Existing') {
      if (selection.label === '$(play) Run & Save') {
        await vscode.commands.executeCommand('cmdify.runFromTree', { commandData: duplicate });
      }
      return { action: 'saved', command: duplicate };
    }
    // Continue with 'Save Anyway'
  }

  const newCommand = createCommand(prompt, command, 'ai', {
    tags: response.suggestedTags || [],
    variables,
  });

  await storage.add(newCommand);

  if (selection.label === '$(play) Run & Save') {
    await vscode.commands.executeCommand('cmdify.runFromTree', { commandData: newCommand });
  } else {
    vscode.window.showInformationMessage('Command saved!');
  }

  return { action: 'saved', command: newCommand };
}
