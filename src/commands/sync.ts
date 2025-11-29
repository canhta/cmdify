import * as vscode from 'vscode';
import { CLICommand, generateCommandHash } from '../models/command';
import { StorageService } from '../services/storage';
import { GitHubClient, SyncPayload } from '../sync/GitHubClient';
import { MergeStrategy } from '../sync/MergeStrategy';
import { FileSync } from '../sync/FileSync';

/**
 * GitHub Sync Service
 * Refactored to use modular GitHubClient, MergeStrategy, and FileSync
 */
export class GitHubSyncService {
  private githubClient: GitHubClient;
  private mergeStrategy: MergeStrategy;

  constructor(
    private storage: StorageService,
    private context: vscode.ExtensionContext
  ) {
    this.githubClient = new GitHubClient(context);
    this.mergeStrategy = new MergeStrategy();
  }

  /**
   * Authenticate with GitHub (delegates to GitHubClient)
   */
  async authenticate(): Promise<vscode.AuthenticationSession | undefined> {
    return this.githubClient.authenticate();
  }

  /**
   * Push commands to GitHub Gist
   */
  async push(): Promise<boolean> {
    const session = await this.githubClient.authenticate();
    if (!session) {
      return false;
    }

    const now = new Date().toISOString();
    const commands = this.storage.exportCommands().map((cmd) => ({
      ...cmd,
      syncId: cmd.syncId || cmd.id,
      lastSyncedAt: now,
      syncHash: generateCommandHash(cmd),
    }));

    // Update local storage with sync metadata
    await this.storage.importCommands(commands, false);

    const currentVersion = this.context.globalState.get<number>('cmdify.syncVersion', 0);
    const payload: SyncPayload = {
      version: '1.0',
      commands,
      exportedAt: now,
      syncVersion: currentVersion + 1,
    };

    // Store new sync version
    await this.context.globalState.update('cmdify.syncVersion', currentVersion + 1);

    try {
      if (this.githubClient.hasGist()) {
        await this.githubClient.updateGist(session.accessToken, payload);
      } else {
        await this.githubClient.createGist(session.accessToken, payload);
      }

      vscode.window.showInformationMessage('Commands synced to GitHub!');
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      vscode.window.showErrorMessage(`Failed to sync: ${message}`);
      return false;
    }
  }

  /**
   * Pull commands from GitHub Gist
   */
  async pull(): Promise<boolean> {
    const session = await this.githubClient.authenticate();
    if (!session) {
      return false;
    }

    if (!this.githubClient.hasGist()) {
      const found = await this.githubClient.findExistingGist(session.accessToken);
      if (!found) {
        vscode.window.showInformationMessage(
          'No synced commands found. Push first to create a sync.'
        );
        return false;
      }
    }

    try {
      const payload = await this.githubClient.fetchGist(session.accessToken);
      if (!payload) {
        vscode.window.showErrorMessage('Failed to fetch synced commands.');
        return false;
      }

      await this.storage.importCommands(payload.commands, true);
      vscode.window.showInformationMessage(
        `Synced ${payload.commands.length} commands from GitHub!`
      );
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      vscode.window.showErrorMessage(`Failed to pull: ${message}`);
      return false;
    }
  }

  /**
   * Full sync (push local changes, pull remote changes)
   */
  async sync(): Promise<boolean> {
    const config = vscode.workspace.getConfiguration('cmdify.sync');
    const enabled = config.get<boolean>('enabled', false);

    if (!enabled) {
      const enable = await vscode.window.showInformationMessage(
        'GitHub sync is not enabled. Enable it now?',
        'Enable',
        'Cancel'
      );

      if (enable !== 'Enable') {
        return false;
      }

      await config.update('enabled', true, vscode.ConfigurationTarget.Global);
    }

    const session = await this.githubClient.authenticate();
    if (!session) {
      return false;
    }

    // Check if we have an existing gist
    if (!this.githubClient.hasGist()) {
      const found = await this.githubClient.findExistingGist(session.accessToken);
      if (!found) {
        return this.push();
      }
    }

    try {
      const remotePayload = await this.githubClient.fetchGist(session.accessToken);
      if (!remotePayload) {
        return this.push();
      }

      const localCommands = this.storage.exportCommands();
      const remoteCommands = remotePayload.commands;

      // Detect and handle conflicts using MergeStrategy
      const conflicts = this.mergeStrategy.detectConflicts(localCommands, remoteCommands);

      if (conflicts.length > 0) {
        const resolutions = await this.mergeStrategy.resolveConflicts(conflicts);
        if (!resolutions) {
          vscode.window.showInformationMessage('Sync cancelled.');
          return false;
        }

        const resolvedCommands = this.mergeStrategy.applyResolutions(
          conflicts,
          resolutions,
          localCommands,
          remoteCommands
        );
        await this.storage.importCommands(resolvedCommands, false);
      } else {
        const mergedCommands = this.mergeStrategy.mergeCommands(localCommands, remoteCommands);
        await this.storage.importCommands(mergedCommands, false);
      }

      return this.push();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      vscode.window.showErrorMessage(`Sync failed: ${message}`);
      return false;
    }
  }
}

/**
 * Handle sync command
 */
export async function handleSync(syncService: GitHubSyncService): Promise<void> {
  await syncService.sync();
}

/**
 * Handle GitHub login command
 */
export async function handleLogin(syncService: GitHubSyncService): Promise<void> {
  const session = await syncService.authenticate();
  if (session) {
    vscode.window.showInformationMessage(`Logged in as ${session.account.label}`);
  }
}

/**
 * Handle export commands to file
 */
export async function handleExport(storage: StorageService): Promise<void> {
  const fileSync = new FileSync(storage);
  await fileSync.exportToFile();
}

/**
 * Handle import commands from file
 */
export async function handleImport(storage: StorageService): Promise<void> {
  const fileSync = new FileSync(storage);
  await fileSync.importFromFile();
}
