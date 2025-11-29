/**
 * Core Command Handlers
 * Handles command management (create, run, edit, delete, search)
 */

import * as vscode from 'vscode';
import { StorageService } from '../../services/storage';
import { AIProvider } from '../../services/ai';
import { AchievementService } from '../../services/achievement';
import { CommandsTreeProvider } from '../../views/treeProvider';
import {
  handleCreate,
  handleRun,
  handleCopy,
  handleSearch,
  handleEdit,
  handleDelete,
  handleToggleFavorite,
} from '../index';
import { CommandGroup, defineCommand, defineCommandGroup } from '../registry';

/**
 * Dependencies for core commands
 */
export interface CoreCommandDependencies {
  storage: StorageService;
  treeProvider: CommandsTreeProvider;
  achievementService: AchievementService;
  getAIProvider: () => AIProvider | undefined;
}

/**
 * Create core command handlers
 */
export function createCoreCommands(deps: CoreCommandDependencies): CommandGroup {
  const { storage, treeProvider, achievementService, getAIProvider } = deps;

  return defineCommandGroup('Core Commands', [
    defineCommand('cmdify.create', async () => {
      const newCommand = await handleCreate(storage, getAIProvider());
      if (newCommand?.source === 'ai') {
        await achievementService.trackAICommandGenerated();
      }
    }),

    defineCommand('cmdify.run', () => handleRun(undefined, storage)),

    defineCommand('cmdify.runFromTree', (item) => handleRun(item, storage)),

    defineCommand('cmdify.search', () => handleSearch(storage)),

    defineCommand('cmdify.copy', () => handleCopy(undefined, storage)),

    defineCommand('cmdify.copyFromTree', (item) => handleCopy(item, storage)),

    defineCommand('cmdify.edit', (item) => handleEdit(item, storage)),

    defineCommand('cmdify.delete', (item) => handleDelete(item, storage)),

    defineCommand('cmdify.toggleFavorite', (item) => handleToggleFavorite(item, storage)),

    defineCommand('cmdify.toggleFavoriteFromTree', (item) => handleToggleFavorite(item, storage)),

    defineCommand('cmdify.refresh', () => treeProvider.refresh()),
  ]);
}
