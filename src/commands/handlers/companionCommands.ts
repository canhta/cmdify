/**
 * Companion Personalization Command Handlers
 * Handles companion customization and data export commands
 */

import * as vscode from 'vscode';
import { StorageService } from '../../services/storage';
import { CompanionService } from '../../services/companion';
import { AchievementService } from '../../services/achievement';
import { ActivityService } from '../../services/activity';
import { FocusService } from '../../services/focus';
import { CommandGroup, defineCommand, defineCommandGroup } from '../registry';

/**
 * Dependencies for companion commands
 */
export interface CompanionCommandDependencies {
  storage: StorageService;
  companionService: CompanionService;
  achievementService: AchievementService;
  activityService: ActivityService;
  focusService: FocusService;
}

/**
 * Create companion command handlers
 */
export function createCompanionCommands(deps: CompanionCommandDependencies): CommandGroup {
  const { storage, companionService, achievementService, activityService, focusService } = deps;

  return defineCommandGroup('Companion Commands', [
    // Companion Rename
    defineCommand('cmdify.companion.rename', async () => {
      const currentName = companionService.getCompanionName();
      const newName = await vscode.window.showInputBox({
        prompt: 'Name your companion',
        value: currentName,
        placeHolder: 'Enter a name (max 20 characters)',
        ignoreFocusOut: true,
        validateInput: (value) => {
          if (value.length > 20) {
            return 'Name must be 20 characters or less';
          }
          return null;
        },
      });

      if (newName !== undefined) {
        await companionService.setCompanionName(newName);
        vscode.window.showInformationMessage(
          `Your companion is now named "${companionService.getCompanionName()}"! 🎉`
        );
      }
    }),

    // Export Data
    defineCommand('cmdify.exportData', async () => {
      const commands = storage.getAll();
      const companionState = companionService.getState();
      const achievements = achievementService.getUnlockedAchievements();
      const stats = activityService.getStats();

      const data = {
        exportVersion: '1.0',
        exportedAt: new Date().toISOString(),
        commands,
        activity: {
          stats,
        },
        companion: companionState,
        achievements,
      };

      const todayStr = new Date().toISOString().split('T')[0];
      const uri = await vscode.window.showSaveDialog({
        defaultUri: vscode.Uri.file(`cmdify-export-${todayStr}.json`),
        filters: { JSON: ['json'] },
      });

      if (uri) {
        await vscode.workspace.fs.writeFile(uri, Buffer.from(JSON.stringify(data, null, 2)));
        vscode.window.showInformationMessage('✅ Data exported successfully!');
      }
    }),

    // Reset Progress
    defineCommand('cmdify.resetProgress', async () => {
      const confirm = await vscode.window.showWarningMessage(
        'Reset all Cmdify progress? This will clear your companion level, achievements, and activity history. Commands will NOT be deleted.',
        { modal: true },
        'Reset Everything',
        'Cancel'
      );

      if (confirm !== 'Reset Everything') {
        return;
      }

      // Double confirm
      const doubleConfirm = await vscode.window.showWarningMessage(
        'Are you absolutely sure? This cannot be undone.',
        { modal: true },
        'Yes, Reset',
        'Cancel'
      );

      if (doubleConfirm !== 'Yes, Reset') {
        return;
      }

      // Reset companion
      await companionService.reset();

      // Reset achievements
      await achievementService.reset();

      // Reset activity
      await activityService.reset();

      // Reset focus stats
      await focusService.resetStats();

      vscode.window.showInformationMessage('Progress reset. Your companion is starting fresh! 🐣');
    }),
  ]);
}
