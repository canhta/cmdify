import * as vscode from 'vscode';
import { ShellType } from '../models/command';

/**
 * Detect the current shell type
 */
export function detectShell(): ShellType {
  const config = vscode.workspace.getConfiguration('terminal.integrated');
  const osKey = getOSKey();
  const defaultProfile = config.get<string>(`defaultProfile.${osKey}`);

  if (defaultProfile) {
    const lower = defaultProfile.toLowerCase();
    if (lower.includes('zsh')) {return 'zsh';}
    if (lower.includes('bash')) {return 'bash';}
    if (lower.includes('fish')) {return 'fish';}
    if (lower.includes('powershell') || lower.includes('pwsh')) {return 'powershell';}
    if (lower.includes('cmd')) {return 'cmd';}
  }

  // Fallback based on OS
  switch (process.platform) {
    case 'win32':
      return 'powershell';
    case 'darwin':
      return 'zsh';
    default:
      return 'bash';
  }
}

function getOSKey(): string {
  switch (process.platform) {
    case 'darwin':
      return 'osx';
    case 'win32':
      return 'windows';
    default:
      return 'linux';
  }
}

let commanderTerminal: vscode.Terminal | undefined;

/**
 * Get or create a terminal for command execution
 */
export function getTerminal(reuseTerminal: boolean): vscode.Terminal {
  if (reuseTerminal && commanderTerminal) {
    // Check if terminal is still valid
    const terminals = vscode.window.terminals;
    if (terminals.includes(commanderTerminal)) {
      return commanderTerminal;
    }
  }

  commanderTerminal = vscode.window.createTerminal({
    name: 'Cmdify',
    iconPath: new vscode.ThemeIcon('terminal'),
  });

  return commanderTerminal;
}

/**
 * Execute a command in the terminal
 */
export function executeCommand(command: string, options?: { 
  workingDirectory?: string;
  reuseTerminal?: boolean;
}): void {
  const config = vscode.workspace.getConfiguration('cmdify.execution');
  const reuseTerminal = options?.reuseTerminal ?? config.get<boolean>('reuseTerminal', true);

  const terminal = getTerminal(reuseTerminal);

  // Change to working directory if specified
  if (options?.workingDirectory) {
    terminal.sendText(`cd "${options.workingDirectory}"`);
  }

  terminal.sendText(command);
  terminal.show();
}

/**
 * Get the current workspace folder path
 */
export function getWorkspaceFolder(): string | undefined {
  const folders = vscode.workspace.workspaceFolders;
  if (folders && folders.length > 0) {
    return folders[0].uri.fsPath;
  }
  return undefined;
}

/**
 * Prompt user to select a working directory
 */
export async function promptWorkingDirectory(): Promise<string | undefined> {
  const workspaceFolder = getWorkspaceFolder();

  const options: vscode.QuickPickItem[] = [];

  if (workspaceFolder) {
    options.push({
      label: '$(folder) Workspace Root',
      description: workspaceFolder,
      detail: 'Use the current workspace folder',
    });
  }

  options.push({
    label: '$(folder-opened) Browse...',
    description: 'Select a custom folder',
  });

  const selection = await vscode.window.showQuickPick(options, {
    placeHolder: 'Select working directory',
  });

  if (!selection) {
    return undefined;
  }

  if (selection.label === '$(folder) Workspace Root') {
    return workspaceFolder;
  }

  const uri = await vscode.window.showOpenDialog({
    canSelectFolders: true,
    canSelectFiles: false,
    canSelectMany: false,
    openLabel: 'Select Working Directory',
  });

  return uri?.[0]?.fsPath;
}

/**
 * Dispose of the commander terminal
 */
export function disposeTerminal(): void {
  if (commanderTerminal) {
    commanderTerminal.dispose();
    commanderTerminal = undefined;
  }
}
