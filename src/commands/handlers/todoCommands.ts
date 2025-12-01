/**
 * TODO Command Handlers
 * Handles TODO scanning and management commands
 */

import * as vscode from 'vscode';
import { TodoScannerService } from '../../services/todoScanner';
import { TodoSyncService } from '../../services/todoSync';
import { ReminderService } from '../../services/reminder';
import { CompanionService } from '../../services/companion';
import { AchievementService } from '../../services/achievement';
import { TodoTreeItem } from '../../views/todoTreeProvider';
import { DetectedTodo } from '../../models/todo';
import { CommandGroup, defineCommand, defineCommandGroup } from '../registry';

/**
 * Dependencies for TODO commands
 */
export interface TodoCommandDependencies {
  todoScannerService: TodoScannerService;
  todoSyncService: TodoSyncService;
  reminderService: ReminderService;
  companionService: CompanionService;
  achievementService: AchievementService;
  getTodoTreeProvider: () => ReturnType<
    typeof import('../../views/todoTreeProvider').createTodoTreeView
  >['provider'];
}

/**
 * Create TODO command handlers
 */
export function createTodoCommands(deps: TodoCommandDependencies): CommandGroup {
  const {
    todoScannerService,
    todoSyncService,
    reminderService,
    companionService,
    achievementService,
    getTodoTreeProvider,
  } = deps;

  return defineCommandGroup('TODO Commands', [
    defineCommand('cmdify.todos.scan', async () => {
      const todos = await todoScannerService.scanWorkspace();
      vscode.window.showInformationMessage(`📋 Found ${todos.length} TODO items`);
    }),

    defineCommand('cmdify.todos.refresh', () => getTodoTreeProvider().refresh()),

    defineCommand('cmdify.todo.goToCode', async (item: TodoTreeItem | DetectedTodo) => {
      const todo = (item as TodoTreeItem).todo ?? (item as DetectedTodo);
      if (todo && 'filePath' in todo) {
        await todoSyncService.goToTodo(todo);
      }
    }),

    defineCommand('cmdify.todo.setReminder', async (item: TodoTreeItem | DetectedTodo) => {
      const todo = (item as TodoTreeItem).todo ?? (item as DetectedTodo);
      if (todo && 'filePath' in todo) {
        await reminderService.setTodoReminderInteractive(todo);
      }
    }),

    defineCommand('cmdify.todo.setDueDate', async (item: TodoTreeItem | DetectedTodo) => {
      const todo = (item as TodoTreeItem).todo ?? (item as DetectedTodo);
      if (todo && 'filePath' in todo) {
        await reminderService.setDueDateInteractive(todo);
      }
    }),

    defineCommand('cmdify.todo.assign', async (item: TodoTreeItem | DetectedTodo) => {
      const todo = (item as TodoTreeItem).todo ?? (item as DetectedTodo);
      if (todo && 'filePath' in todo) {
        await reminderService.assignTodoInteractive(todo);
      }
    }),

    defineCommand('cmdify.todo.complete', async (item: TodoTreeItem | DetectedTodo) => {
      const todo = (item as TodoTreeItem).todo ?? (item as DetectedTodo);
      if (todo && 'id' in todo && todo.id) {
        await todoScannerService.markComplete(todo.id);
        companionService.showMessage('todoComplete');
        vscode.window.showInformationMessage('✅ TODO marked as complete');

        const completedCount = todoScannerService.getCompletedTodos().length;
        await achievementService.checkTodoAchievements(completedCount);
        await companionService.awardXP(50, 'todoComplete');
      }
    }),

    defineCommand('cmdify.todo.markDone', async (item: TodoTreeItem | DetectedTodo) => {
      const todo = (item as TodoTreeItem).todo ?? (item as DetectedTodo);
      if (todo && 'filePath' in todo) {
        await todoSyncService.markDoneInCode(todo);
      }
    }),

    defineCommand('cmdify.todo.delete', async (item: TodoTreeItem | DetectedTodo) => {
      const todo = (item as TodoTreeItem).todo ?? (item as DetectedTodo);
      if (todo && 'filePath' in todo) {
        await todoSyncService.deleteTodoLine(todo);
      }
    }),

    defineCommand('cmdify.todos.completeAll', async () => {
      const todos = todoScannerService.getTodos();
      if (todos.length === 0) {
        vscode.window.showInformationMessage('No open TODOs to complete');
        return;
      }

      const confirm = await vscode.window.showWarningMessage(
        `Mark all ${todos.length} TODOs as complete?`,
        { modal: true },
        'Complete All'
      );

      if (confirm === 'Complete All') {
        const count = await todoScannerService.markAllComplete();
        companionService.showMessage('todoComplete');
        vscode.window.showInformationMessage(`✅ Marked ${count} TODOs as complete`);

        const completedCount = todoScannerService.getCompletedTodos().length;
        await achievementService.checkTodoAchievements(completedCount);
        await companionService.awardXP(50 * count, 'todoComplete');
      }
    }),

    defineCommand('cmdify.todos.completeForFile', async (item?: TodoTreeItem) => {
      let filePath: string | undefined;

      // If called from tree view with a file item or todo item
      if (item?.todo?.filePath) {
        filePath = item.todo.filePath;
      } else {
        // Show picker to select file
        const todos = todoScannerService.getTodos();
        const filesWithTodos = [...new Set(todos.map((t) => t.filePath))];

        if (filesWithTodos.length === 0) {
          vscode.window.showInformationMessage('No open TODOs found');
          return;
        }

        const selected = await vscode.window.showQuickPick(
          filesWithTodos.map((f) => {
            const count = todos.filter((t) => t.filePath === f).length;
            const shortPath = f.split('/').slice(-2).join('/');
            return {
              label: shortPath,
              description: `${count} TODOs`,
              filePath: f,
            };
          }),
          { placeHolder: 'Select a file to complete all TODOs' }
        );

        if (selected) {
          filePath = selected.filePath;
        }
      }

      if (filePath) {
        const fileTodos = todoScannerService.getTodos().filter((t) => t.filePath === filePath);
        const shortPath = filePath.split('/').slice(-2).join('/');

        const confirm = await vscode.window.showWarningMessage(
          `Complete ${fileTodos.length} TODOs in ${shortPath}?`,
          { modal: true },
          'Complete'
        );

        if (confirm === 'Complete') {
          const count = await todoScannerService.markFileComplete(filePath);
          companionService.showMessage('todoComplete');
          vscode.window.showInformationMessage(`✅ Completed ${count} TODOs in file`);

          const completedCount = todoScannerService.getCompletedTodos().length;
          await achievementService.checkTodoAchievements(completedCount);
          await companionService.awardXP(50 * count, 'todoComplete');
        }
      }
    }),
  ]);
}
