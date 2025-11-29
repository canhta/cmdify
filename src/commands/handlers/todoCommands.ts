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
  ]);
}
