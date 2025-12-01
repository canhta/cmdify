/**
 * File Sync
 * Handles file-based import/export operations
 */

import * as vscode from 'vscode';
import { CLICommand } from '../models/command';
import { StorageService } from '../services/storage';

/**
 * Sync payload structure for file export
 */
export interface FileSyncPayload {
  version: string;
  commands: CLICommand[];
  exportedAt: string;
}

/**
 * File Sync Service
 * Handles import/export of commands to/from files
 */
export class FileSync {
  constructor(private readonly storage: StorageService) {}

  /**
   * Export commands to a file
   */
  async exportToFile(): Promise<boolean> {
    const commands = this.storage.exportCommands();

    if (commands.length === 0) {
      vscode.window.showInformationMessage('No commands to export.');
      return false;
    }

    const payload: FileSyncPayload = {
      version: '1.0',
      commands,
      exportedAt: new Date().toISOString(),
    };

    const uri = await vscode.window.showSaveDialog({
      defaultUri: vscode.Uri.file('cmdify-commands.json'),
      filters: {
        'JSON Files': ['json'],
        'All Files': ['*'],
      },
      saveLabel: 'Export Commands',
      title: 'Export Cmdify Commands',
    });

    if (!uri) {
      return false;
    }

    try {
      const content = JSON.stringify(payload, null, 2);
      await vscode.workspace.fs.writeFile(uri, Buffer.from(content, 'utf-8'));
      vscode.window.showInformationMessage(`Exported ${commands.length} commands to ${uri.fsPath}`);
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      vscode.window.showErrorMessage(`Failed to export: ${message}`);
      return false;
    }
  }

  /**
   * Import commands from a file
   */
  async importFromFile(): Promise<boolean> {
    const uris = await vscode.window.showOpenDialog({
      canSelectFiles: true,
      canSelectFolders: false,
      canSelectMany: false,
      filters: {
        'JSON Files': ['json'],
        'All Files': ['*'],
      },
      openLabel: 'Import Commands',
      title: 'Import Cmdify Commands',
    });

    if (!uris || uris.length === 0) {
      return false;
    }

    try {
      const content = await vscode.workspace.fs.readFile(uris[0]);
      const payload = JSON.parse(content.toString()) as FileSyncPayload;

      if (!payload.commands || !Array.isArray(payload.commands)) {
        throw new Error('Invalid command file format');
      }

      // Ask user how to handle import
      const mergeOption = await this.showImportOptions();
      if (mergeOption === undefined) {
        return false;
      }

      await this.storage.importCommands(payload.commands, mergeOption);
      vscode.window.showInformationMessage(
        `Imported ${payload.commands.length} commands ${mergeOption ? '(merged)' : '(replaced)'}`
      );
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      vscode.window.showErrorMessage(`Failed to import: ${message}`);
      return false;
    }
  }

  /**
   * Show import options dialog
   */
  private async showImportOptions(): Promise<boolean | undefined> {
    const choice = await vscode.window.showQuickPick(
      [
        {
          label: '$(git-merge) Merge',
          description: 'Merge with existing commands (keeps both)',
          value: true,
        },
        {
          label: '$(replace-all) Replace',
          description: 'Replace all existing commands',
          value: false,
        },
      ],
      {
        placeHolder: 'How would you like to import?',
        title: 'Import Commands',
        ignoreFocusOut: true,
      }
    );

    return choice?.value;
  }

  /**
   * Validate payload structure
   */
  validatePayload(payload: unknown): payload is FileSyncPayload {
    if (typeof payload !== 'object' || payload === null) {
      return false;
    }

    const p = payload as Record<string, unknown>;
    return (
      typeof p.version === 'string' && Array.isArray(p.commands) && typeof p.exportedAt === 'string'
    );
  }
}
