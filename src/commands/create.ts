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
  // Show progress
  return vscode.window.withProgress(
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
          return undefined;
        }

        return showAIPreview(prompt, response, storage);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        vscode.window.showErrorMessage(`Failed to generate command: ${message}`);
        return undefined;
      }
    }
  );
}

/**
 * Show AI generation preview
 */
async function showAIPreview(
  prompt: string,
  response: AIResponse,
  storage: StorageService
): Promise<CLICommand | undefined> {
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
      label: '$(close) Cancel',
      description: 'Discard this command',
    },
  ];

  const previewText = [
    `Command: ${response.command}`,
    response.explanation ? `\nExplanation: ${response.explanation}` : '',
    response.suggestedTags?.length ? `\nTags: ${response.suggestedTags.join(', ')}` : '',
  ].filter(Boolean).join('');

  const selection = await vscode.window.showQuickPick(items, {
    title: '✨ AI Generated Command',
    placeHolder: previewText,
  });

  if (!selection || selection.label === '$(close) Cancel') {
    return undefined;
  }

  let command = response.command;

  if (selection.label === '$(edit) Edit') {
    const edited = await vscode.window.showInputBox({
      prompt: 'Edit the command',
      value: response.command,
      title: 'Edit Command',
    });

    if (!edited) {
      return undefined;
    }

    command = edited;
  }

  // Extract and merge variables
  const extractedVars = extractVariables(command);
  const variables = mergeVariables(extractedVars, response.variables);

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

  return newCommand;
}
