/**
 * TODO Notification Handler
 * Handles notifications for TODO items (due, overdue)
 */

import * as vscode from 'vscode';
import { DetectedTodo } from '../../models/todo';
import { TodoScannerService } from '../todoScanner';
import { TodoSyncService } from '../todoSync';

export class TodoNotifier {
  private notifiedTodos: Set<string> = new Set();

  constructor(
    private readonly scanner: TodoScannerService,
    private readonly syncService: TodoSyncService
  ) {}

  /**
   * Check for due TODOs and show notifications
   */
  async checkDueTodos(): Promise<void> {
    const overdue = this.scanner.getOverdueTodos();
    const today = this.scanner.getTodayTodos();

    // Show notification for overdue TODOs (only once per session per TODO)
    for (const todo of overdue) {
      if (!this.notifiedTodos.has(todo.id)) {
        this.notifiedTodos.add(todo.id);
        await this.showTodoNotification(todo, true);
      }
    }

    // Show notification for TODOs due today at start of day
    for (const todo of today) {
      if (!this.notifiedTodos.has(todo.id)) {
        this.notifiedTodos.add(todo.id);
        await this.showTodoNotification(todo, false);
      }
    }
  }

  /**
   * Show notification for a TODO
   */
  async showTodoNotification(todo: DetectedTodo, isOverdue: boolean): Promise<void> {
    const prefix = isOverdue ? '⚠️ Overdue' : '📅 Due Today';
    const message = `${prefix}: ${todo.description}`;

    const action = await vscode.window.showInformationMessage(
      message,
      'Go to Code',
      'Snooze 1h',
      'Complete'
    );

    switch (action) {
      case 'Go to Code':
        await this.syncService.goToTodo(todo);
        break;
      case 'Snooze 1h':
        const snoozeUntil = new Date();
        snoozeUntil.setHours(snoozeUntil.getHours() + 1);
        await this.scanner.snoozeTodo(todo.id, snoozeUntil);
        this.notifiedTodos.delete(todo.id);
        break;
      case 'Complete':
        await this.scanner.markComplete(todo.id);
        break;
    }
  }

  /**
   * Reset notification tracking (e.g., for testing or new session)
   */
  resetNotifications(): void {
    this.notifiedTodos.clear();
  }
}
