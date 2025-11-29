/**
 * Merge Strategy
 * Handles conflict detection and command merging for sync
 */

import * as vscode from 'vscode';
import {
  CLICommand,
  SyncConflict,
  SyncConflictType,
  ConflictResolution,
  generateCommandHash,
} from '../models/command';

/**
 * Merge result
 */
export interface MergeResult {
  commands: CLICommand[];
  conflicts: SyncConflict[];
}

/**
 * Merge Strategy Service
 * Handles conflict detection and resolution
 */
export class MergeStrategy {
  /**
   * Detect conflicts between local and remote commands
   */
  detectConflicts(local: CLICommand[], remote: CLICommand[]): SyncConflict[] {
    const conflicts: SyncConflict[] = [];
    const localMap = new Map(local.map((cmd) => [cmd.syncId || cmd.id, cmd]));
    const remoteMap = new Map(remote.map((cmd) => [cmd.syncId || cmd.id, cmd]));

    // Check for modified conflicts (same ID, different content)
    for (const [id, localCmd] of localMap) {
      const remoteCmd = remoteMap.get(id);
      if (remoteCmd) {
        const localHash = generateCommandHash(localCmd);
        const remoteHash = generateCommandHash(remoteCmd);

        // Both modified since last sync
        if (localHash !== remoteHash) {
          const localUpdated = new Date(localCmd.updatedAt).getTime();
          const remoteUpdated = new Date(remoteCmd.updatedAt).getTime();
          const localLastSync = localCmd.lastSyncedAt
            ? new Date(localCmd.lastSyncedAt).getTime()
            : 0;

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
  mergeCommands(local: CLICommand[], remote: CLICommand[]): CLICommand[] {
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
    return Array.from(merged.values()).filter((cmd) => !cmd.deletedAt);
  }

  /**
   * Apply conflict resolutions to merge result
   */
  applyResolutions(
    conflicts: SyncConflict[],
    resolutions: Map<string, ConflictResolution>,
    localCommands: CLICommand[],
    remoteCommands: CLICommand[]
  ): CLICommand[] {
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
      const resolution = resolutions.get(conflict.commandId);
      if (!resolution) {
        continue;
      }

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
    return Array.from(merged.values()).filter((cmd) => !cmd.deletedAt);
  }

  /**
   * Show conflict resolution dialog
   */
  async showConflictDialog(conflict: SyncConflict): Promise<ConflictResolution | undefined> {
    // Check if user has a default resolution preference
    const config = vscode.workspace.getConfiguration('cmdify.sync');
    const defaultResolution = config.get<string>('conflictResolution', 'ask');

    if (defaultResolution !== 'ask') {
      return defaultResolution as ConflictResolution;
    }

    const typeLabel = {
      modified: 'Modified on both sides',
      deleted_local: 'Deleted locally, modified remotely',
      deleted_remote: 'Deleted remotely, modified locally',
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
   * Resolve all conflicts interactively
   */
  async resolveConflicts(
    conflicts: SyncConflict[]
  ): Promise<Map<string, ConflictResolution> | undefined> {
    const resolutions = new Map<string, ConflictResolution>();

    for (const conflict of conflicts) {
      const resolution = await this.showConflictDialog(conflict);
      if (!resolution) {
        return undefined; // User cancelled
      }
      resolutions.set(conflict.commandId, resolution);
    }

    return resolutions;
  }

  /**
   * Format command for display in conflict dialog
   */
  private formatCommandForDisplay(cmd: CLICommand): string {
    const updated = new Date(cmd.updatedAt).toLocaleDateString();
    return `Updated: ${updated} | Uses: ${cmd.usageCount}`;
  }
}
