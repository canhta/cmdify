/**
 * Sync Command Handlers
 * Handles sync, export, import, and login commands
 */

import * as vscode from 'vscode';
import { StorageService } from '../../services/storage';
import { GitHubSyncService, handleSync, handleExport, handleImport, handleLogin } from '../index';
import { AchievementService } from '../../services/achievement';
import { CommandGroup, defineCommand, defineCommandGroup } from '../registry';

/**
 * Dependencies for sync commands
 */
export interface SyncCommandDependencies {
  storage: StorageService;
  syncService: GitHubSyncService;
  achievementService: AchievementService;
}

/**
 * Create sync command handlers
 */
export function createSyncCommands(deps: SyncCommandDependencies): CommandGroup {
  const { storage, syncService, achievementService } = deps;

  return defineCommandGroup('Sync Commands', [
    defineCommand('cmdify.sync', async () => {
      await handleSync(syncService);
      await achievementService.trackSync();
    }),

    defineCommand('cmdify.export', () => handleExport(storage)),

    defineCommand('cmdify.import', () => handleImport(storage)),

    defineCommand('cmdify.login', () => handleLogin(syncService)),
  ]);
}
