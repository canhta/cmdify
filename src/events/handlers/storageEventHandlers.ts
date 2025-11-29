/**
 * Storage Event Handlers
 * Handles all storage (commands) related events
 */

import * as vscode from 'vscode';
import { StorageService } from '../../services/storage';
import { AchievementService } from '../../services/achievement';

export interface StorageEventHandlerDeps {
  storage: StorageService;
  achievementService: AchievementService;
  updateNoCommandsContext: () => Promise<void>;
}

/**
 * Register all storage event handlers
 */
export function registerStorageEventHandlers(
  context: vscode.ExtensionContext,
  deps: StorageEventHandlerDeps
): void {
  const { storage, achievementService, updateNoCommandsContext } = deps;

  // Storage changes (commands added/removed/updated)
  context.subscriptions.push(
    storage.onDidChange(async () => {
      await updateNoCommandsContext();
      const commandCount = storage.getAll().length;
      await achievementService.checkCommandAchievements(commandCount);
    })
  );
}
