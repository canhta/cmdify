import * as vscode from 'vscode';
import { CLICommand, SyncConflict, SyncConflictType, ConflictResolution, generateCommandHash } from '../models/command';
import { StorageService } from '../services/storage';

const GIST_FILENAME = 'cmdify-commands.json';

interface SyncPayload {
  version: string;
  commands: CLICommand[];
  exportedAt: string;
  syncVersion?: number;  // Incremented on each sync
}

/**
 * GitHub Sync Service
 */
export class GitHubSyncService {
  private gistId?: string;

  constructor(
    private storage: StorageService,
    private context: vscode.ExtensionContext
  ) {
    // Load stored gist ID
    this.gistId = context.globalState.get('cmdify.gistId');
  }

  /**
   * Authenticate with GitHub
   */
  async authenticate(): Promise<vscode.AuthenticationSession | undefined> {
    try {
      const session = await vscode.authentication.getSession('github', ['gist'], {
        createIfNone: true,
      });
      return session;
    } catch (error) {
      vscode.window.showErrorMessage('Failed to authenticate with GitHub.');
      return undefined;
    }
  }

  /**
   * Push commands to GitHub Gist
   */
  async push(): Promise<boolean> {
    const session = await this.authenticate();
    if (!session) {
      return false;
    }

    const now = new Date().toISOString();
    const commands = this.storage.exportCommands().map(cmd => ({
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
      if (this.gistId) {
        // Update existing gist
        await this.updateGist(session.accessToken, payload);
      } else {
        // Create new gist
        await this.createGist(session.accessToken, payload);
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
    const session = await this.authenticate();
    if (!session) {
      return false;
    }

    if (!this.gistId) {
      // Try to find existing gist
      const found = await this.findExistingGist(session.accessToken);
      if (!found) {
        vscode.window.showInformationMessage('No synced commands found. Push first to create a sync.');
        return false;
      }
    }

    try {
      const payload = await this.fetchGist(session.accessToken);
      if (!payload) {
        vscode.window.showErrorMessage('Failed to fetch synced commands.');
        return false;
      }

      await this.storage.importCommands(payload.commands, true);
      vscode.window.showInformationMessage(`Synced ${payload.commands.length} commands from GitHub!`);
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

    const session = await this.authenticate();
    if (!session) {
      return false;
    }

    // Check if we have an existing gist
    if (!this.gistId) {
      const found = await this.findExistingGist(session.accessToken);
      if (!found) {
        // No remote, just push
        return this.push();
      }
    }

    try {
      // Fetch remote commands
      const remotePayload = await this.fetchGist(session.accessToken);
      if (!remotePayload) {
        // No remote data, just push
        return this.push();
      }

      const localCommands = this.storage.exportCommands();
      const remoteCommands = remotePayload.commands;

      // Detect conflicts
      const conflicts = this.detectConflicts(localCommands, remoteCommands);

      if (conflicts.length > 0) {
        // Show conflict resolution UI
        const resolvedCommands = await this.resolveConflicts(conflicts, localCommands, remoteCommands);
        if (!resolvedCommands) {
          vscode.window.showInformationMessage('Sync cancelled.');
          return false;
        }

        // Import resolved commands
        await this.storage.importCommands(resolvedCommands, false);
      } else {
        // No conflicts, merge commands
        const mergedCommands = this.mergeCommands(localCommands, remoteCommands);
        await this.storage.importCommands(mergedCommands, false);
      }

      // Push merged result
      return this.push();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      vscode.window.showErrorMessage(`Sync failed: ${message}`);
      return false;
    }
  }

  /**
   * Detect conflicts between local and remote commands
   */
  private detectConflicts(local: CLICommand[], remote: CLICommand[]): SyncConflict[] {
    const conflicts: SyncConflict[] = [];
    const localMap = new Map(local.map(cmd => [cmd.syncId || cmd.id, cmd]));
    const remoteMap = new Map(remote.map(cmd => [cmd.syncId || cmd.id, cmd]));

    // Check for modified conflicts (same ID, different content)
    for (const [id, localCmd] of localMap) {
      const remoteCmd = remoteMap.get(id);
      if (remoteCmd) {
        const localHash = generateCommandHash(localCmd);
        const remoteHash = generateCommandHash(remoteCmd);

        // Both modified since last sync
        if (localHash !== remoteHash) {
          // Check if both have been updated after their last sync
          const localUpdated = new Date(localCmd.updatedAt).getTime();
          const remoteUpdated = new Date(remoteCmd.updatedAt).getTime();
          const localLastSync = localCmd.lastSyncedAt ? new Date(localCmd.lastSyncedAt).getTime() : 0;

          // If both sides have changes since last sync, it's a conflict
          if (localUpdated > localLastSync && remoteUpdated > localLastSync) {
            conflicts.push({
              commandId: id,
              local: localCmd,
              remote: remoteCmd,
              type: 'modified' as SyncConflictType,
            });
          }
        }
      }
    }

    // Check for deleted_local (exists in remote, soft-deleted locally)
    for (const [id, localCmd] of localMap) {
      if (localCmd.deletedAt && remoteMap.has(id)) {
        const remoteCmd = remoteMap.get(id)!;
        if (!remoteCmd.deletedAt) {
          conflicts.push({
            commandId: id,
            local: localCmd,
            remote: remoteCmd,
            type: 'deleted_local' as SyncConflictType,
          });
        }
      }
    }

    // Check for deleted_remote (exists locally, soft-deleted in remote)
    for (const [id, remoteCmd] of remoteMap) {
      if (remoteCmd.deletedAt && localMap.has(id)) {
        const localCmd = localMap.get(id)!;
        if (!localCmd.deletedAt) {
          conflicts.push({
            commandId: id,
            local: localCmd,
            remote: remoteCmd,
            type: 'deleted_remote' as SyncConflictType,
          });
        }
      }
    }

    return conflicts;
  }

  /**
   * Merge commands without conflicts
   */
  private mergeCommands(local: CLICommand[], remote: CLICommand[]): CLICommand[] {
    const merged = new Map<string, CLICommand>();
    const now = new Date().toISOString();

    // Add all local commands
    for (const cmd of local) {
      const id = cmd.syncId || cmd.id;
      merged.set(id, { ...cmd, syncId: id, lastSyncedAt: now });
    }

    // Merge remote commands
    for (const cmd of remote) {
      const id = cmd.syncId || cmd.id;
      const existing = merged.get(id);

      if (!existing) {
        // New from remote
        merged.set(id, { ...cmd, syncId: id, lastSyncedAt: now });
      } else {
        // Take the more recently updated one
        const localDate = new Date(existing.updatedAt).getTime();
        const remoteDate = new Date(cmd.updatedAt).getTime();

        if (remoteDate > localDate) {
          merged.set(id, { ...cmd, syncId: id, lastSyncedAt: now });
        } else {
          // Keep local but update sync time
          merged.set(id, { ...existing, lastSyncedAt: now });
        }
      }
    }

    // Filter out soft-deleted commands
    return Array.from(merged.values()).filter(cmd => !cmd.deletedAt);
  }

  /**
   * Show conflict resolution UI and return resolved commands
   */
  private async resolveConflicts(
    conflicts: SyncConflict[],
    localCommands: CLICommand[],
    remoteCommands: CLICommand[]
  ): Promise<CLICommand[] | undefined> {
    const resolutions = new Map<string, ConflictResolution>();

    for (const conflict of conflicts) {
      const resolution = await this.showConflictDialog(conflict);
      if (!resolution) {
        return undefined; // User cancelled
      }
      resolutions.set(conflict.commandId, resolution);
    }

    // Apply resolutions
    const merged = new Map<string, CLICommand>();
    const now = new Date().toISOString();

    // Start with local commands
    for (const cmd of localCommands) {
      const id = cmd.syncId || cmd.id;
      merged.set(id, { ...cmd, syncId: id });
    }

    // Add remote-only commands
    for (const cmd of remoteCommands) {
      const id = cmd.syncId || cmd.id;
      if (!merged.has(id)) {
        merged.set(id, { ...cmd, syncId: id });
      }
    }

    // Apply conflict resolutions
    for (const conflict of conflicts) {
      const resolution = resolutions.get(conflict.commandId)!;

      switch (resolution) {
        case 'keep_local':
          merged.set(conflict.commandId, {
            ...conflict.local,
            syncId: conflict.commandId,
            lastSyncedAt: now,
          });
          break;

        case 'keep_remote':
          merged.set(conflict.commandId, {
            ...conflict.remote,
            syncId: conflict.commandId,
            lastSyncedAt: now,
          });
          break;

        case 'keep_both':
          // Keep local with original ID
          merged.set(conflict.commandId, {
            ...conflict.local,
            syncId: conflict.commandId,
            lastSyncedAt: now,
          });
          // Add remote as new command with new ID
          const newId = `${conflict.commandId}_remote_${Date.now()}`;
          merged.set(newId, {
            ...conflict.remote,
            id: newId,
            syncId: newId,
            prompt: `${conflict.remote.prompt} (from sync)`,
            lastSyncedAt: now,
          });
          break;
      }
    }

    // Filter out soft-deleted commands
    return Array.from(merged.values()).filter(cmd => !cmd.deletedAt);
  }

  /**
   * Show dialog for a single conflict
   */
  private async showConflictDialog(conflict: SyncConflict): Promise<ConflictResolution | undefined> {
    // Check if user has a default resolution preference
    const config = vscode.workspace.getConfiguration('cmdify.sync');
    const defaultResolution = config.get<string>('conflictResolution', 'ask');

    if (defaultResolution !== 'ask') {
      return defaultResolution as ConflictResolution;
    }

    const typeLabel = {
      'modified': 'Modified on both sides',
      'deleted_local': 'Deleted locally, modified remotely',
      'deleted_remote': 'Deleted remotely, modified locally',
    }[conflict.type];

    const localDisplay = this.formatCommandForDisplay(conflict.local);
    const remoteDisplay = this.formatCommandForDisplay(conflict.remote);

    const choice = await vscode.window.showQuickPick(
      [
        {
          label: '$(arrow-left) Keep Local',
          description: localDisplay,
          detail: `Local: ${conflict.local.command}`,
          value: 'keep_local' as ConflictResolution,
        },
        {
          label: '$(arrow-right) Keep Remote',
          description: remoteDisplay,
          detail: `Remote: ${conflict.remote.command}`,
          value: 'keep_remote' as ConflictResolution,
        },
        {
          label: '$(git-merge) Keep Both',
          description: 'Save both versions',
          detail: 'The remote version will be saved as a new command',
          value: 'keep_both' as ConflictResolution,
        },
      ],
      {
        placeHolder: `Conflict: "${conflict.local.prompt}" - ${typeLabel}`,
        title: `⚠️ Sync Conflict (${conflict.type})`,
        ignoreFocusOut: true,
      }
    );

    return choice?.value;
  }

  /**
   * Format command for display in conflict dialog
   */
  private formatCommandForDisplay(cmd: CLICommand): string {
    const updated = new Date(cmd.updatedAt).toLocaleDateString();
    return `Updated: ${updated} | Uses: ${cmd.usageCount}`;
  }

  /**
   * Create a new gist
   */
  private async createGist(token: string, payload: SyncPayload): Promise<void> {
    const response = await fetch('https://api.github.com/gists', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/vnd.github+json',
      },
      body: JSON.stringify({
        description: 'Cmdify - Synced Commands',
        public: false,
        files: {
          [GIST_FILENAME]: {
            content: JSON.stringify(payload, null, 2),
          },
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status}`);
    }

    const data = await response.json() as { id: string };
    this.gistId = data.id;
    await this.context.globalState.update('cmdify.gistId', this.gistId);
  }

  /**
   * Update existing gist
   */
  private async updateGist(token: string, payload: SyncPayload): Promise<void> {
    const response = await fetch(`https://api.github.com/gists/${this.gistId}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/vnd.github+json',
      },
      body: JSON.stringify({
        files: {
          [GIST_FILENAME]: {
            content: JSON.stringify(payload, null, 2),
          },
        },
      }),
    });

    if (!response.ok) {
      // Gist might have been deleted, try creating new one
      if (response.status === 404) {
        this.gistId = undefined;
        await this.context.globalState.update('cmdify.gistId', undefined);
        return this.createGist(token, payload);
      }
      throw new Error(`GitHub API error: ${response.status}`);
    }
  }

  /**
   * Fetch gist content
   */
  private async fetchGist(token: string): Promise<SyncPayload | undefined> {
    const response = await fetch(`https://api.github.com/gists/${this.gistId}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github+json',
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        this.gistId = undefined;
        await this.context.globalState.update('cmdify.gistId', undefined);
        return undefined;
      }
      throw new Error(`GitHub API error: ${response.status}`);
    }

    const data = await response.json() as {
      files: Record<string, { content: string }>;
    };
    const content = data.files?.[GIST_FILENAME]?.content;

    if (!content) {
      return undefined;
    }

    return JSON.parse(content) as SyncPayload;
  }

  /**
   * Find existing Cmdify gist
   */
  private async findExistingGist(token: string): Promise<boolean> {
    const response = await fetch('https://api.github.com/gists', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github+json',
      },
    });

    if (!response.ok) {
      return false;
    }

    const gists = await response.json() as Array<{
      id: string;
      files: Record<string, unknown>;
    }>;
    const existing = gists.find((g) => GIST_FILENAME in g.files);

    if (existing) {
      this.gistId = existing.id;
      await this.context.globalState.update('cmdify.gistId', this.gistId);
      return true;
    }

    return false;
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
  const commands = storage.exportCommands();
  
  if (commands.length === 0) {
    vscode.window.showInformationMessage('No commands to export.');
    return;
  }

  const payload: SyncPayload = {
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
    return;
  }

  try {
    const content = JSON.stringify(payload, null, 2);
    await vscode.workspace.fs.writeFile(uri, Buffer.from(content, 'utf-8'));
    vscode.window.showInformationMessage(`Exported ${commands.length} commands to ${uri.fsPath}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    vscode.window.showErrorMessage(`Failed to export: ${message}`);
  }
}

/**
 * Handle import commands from file
 */
export async function handleImport(storage: StorageService): Promise<void> {
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
    return;
  }

  try {
    const content = await vscode.workspace.fs.readFile(uris[0]);
    const payload = JSON.parse(content.toString()) as SyncPayload;

    if (!payload.commands || !Array.isArray(payload.commands)) {
      throw new Error('Invalid command file format');
    }

    // Ask user how to handle import
    const mergeOption = await vscode.window.showQuickPick([
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
    ], {
      placeHolder: 'How would you like to import?',
      title: 'Import Commands',
    });

    if (!mergeOption) {
      return;
    }

    await storage.importCommands(payload.commands, mergeOption.value);
    vscode.window.showInformationMessage(
      `Imported ${payload.commands.length} commands ${mergeOption.value ? '(merged)' : '(replaced)'}`
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    vscode.window.showErrorMessage(`Failed to import: ${message}`);
  }
}
