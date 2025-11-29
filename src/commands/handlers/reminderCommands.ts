/**
 * Reminder Command Handlers
 * Handles global reminder management commands
 */

import * as vscode from 'vscode';
import { ReminderService } from '../../services/reminder';
import { TodoTreeItem } from '../../views/todoTreeProvider';
import { CommandGroup, defineCommand, defineCommandGroup } from '../registry';

/**
 * Dependencies for reminder commands
 */
export interface ReminderCommandDependencies {
  reminderService: ReminderService;
  getTodoTreeProvider: () => ReturnType<
    typeof import('../../views/todoTreeProvider').createTodoTreeView
  >['provider'];
}

/**
 * Create reminder command handlers
 */
export function createReminderCommands(deps: ReminderCommandDependencies): CommandGroup {
  const { reminderService, getTodoTreeProvider } = deps;

  return defineCommandGroup('Reminder Commands', [
    defineCommand('cmdify.reminder.add', async () => {
      const reminder = await reminderService.createGlobalReminderInteractive();
      if (reminder) {
        getTodoTreeProvider().refresh();
        vscode.window.showInformationMessage(
          `🔔 Reminder set for ${reminder.dueAt.toLocaleString()}`
        );
      }
    }),

    defineCommand('cmdify.reminder.complete', async (item: TodoTreeItem) => {
      if (item.reminder) {
        await reminderService.completeGlobalReminder(item.reminder.id);
        getTodoTreeProvider().refresh();
        vscode.window.showInformationMessage('✅ Reminder completed');
      }
    }),

    defineCommand('cmdify.reminder.delete', async (item: TodoTreeItem) => {
      if (item.reminder) {
        const confirm = await vscode.window.showWarningMessage(
          `Delete reminder "${item.reminder.title}"?`,
          { modal: true },
          'Delete'
        );
        if (confirm === 'Delete') {
          await reminderService.deleteGlobalReminder(item.reminder.id);
          getTodoTreeProvider().refresh();
        }
      }
    }),
  ]);
}
