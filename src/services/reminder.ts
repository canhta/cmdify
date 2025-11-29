/**
 * Reminder Service
 * Handles notifications and reminders for TODOs and global reminders
 */

import * as vscode from 'vscode';
import { DetectedTodo, GlobalReminder } from '../models/todo';
import { TodoScannerService } from './todoScanner';
import { TodoSyncService } from './todoSync';
import { GlobalReminderNotifier } from './notifications/GlobalReminderNotifier';
import { TodoNotifier } from './notifications/TodoNotifier';
import {
  createGlobalReminderDialog,
  editTodoDialog,
  setDueDateDialog,
  assignTodoDialog,
} from '../ui/dialogs/ReminderDialogs';
import { parseCustomDate } from '../utils/dateParser';

const REMINDERS_KEY = 'cmdify.reminders.global';
const CHECK_INTERVAL = 60000; // Check every minute

/**
 * Reminder Service
 */
export class ReminderService implements vscode.Disposable {
  private globalReminders: Map<string, GlobalReminder> = new Map();
  private checkInterval: ReturnType<typeof setInterval> | null = null;
  private disposables: vscode.Disposable[] = [];
  private globalReminderNotifier: GlobalReminderNotifier;
  private todoNotifier: TodoNotifier;

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly scanner: TodoScannerService,
    private readonly syncService: TodoSyncService
  ) {
    this.globalReminderNotifier = new GlobalReminderNotifier();
    this.todoNotifier = new TodoNotifier(scanner, syncService);

    this.loadGlobalReminders();
    this.startChecking();

    // Check TODOs when scan completes
    this.disposables.push(
      this.scanner.onScanCompleted(() => {
        this.todoNotifier.checkDueTodos();
      })
    );
  }

  /**
   * Load global reminders from storage
   */
  private loadGlobalReminders(): void {
    const stored = this.context.globalState.get<GlobalReminder[]>(REMINDERS_KEY, []);
    this.globalReminders.clear();
    for (const reminder of stored) {
      // Convert date strings back to Date objects
      reminder.dueAt = new Date(reminder.dueAt);
      reminder.createdAt = new Date(reminder.createdAt);
      if (reminder.completedAt) {
        reminder.completedAt = new Date(reminder.completedAt);
      }
      if (reminder.snoozedUntil) {
        reminder.snoozedUntil = new Date(reminder.snoozedUntil);
      }
      this.globalReminders.set(reminder.id, reminder);
    }
  }

  /**
   * Save global reminders to storage
   */
  private async saveGlobalReminders(): Promise<void> {
    const reminders = Array.from(this.globalReminders.values());
    await this.context.globalState.update(REMINDERS_KEY, reminders);
  }

  /**
   * Start periodic checking
   */
  private startChecking(): void {
    if (this.checkInterval) {
      return;
    }

    this.checkInterval = setInterval(() => {
      this.todoNotifier.checkDueTodos();
      this.checkGlobalReminders();
    }, CHECK_INTERVAL);

    // Also check immediately
    this.todoNotifier.checkDueTodos();
    this.checkGlobalReminders();
  }

  /**
   * Check global reminders and show notifications
   */
  private async checkGlobalReminders(): Promise<void> {
    const now = new Date();

    for (const [, reminder] of this.globalReminders) {
      if (this.globalReminderNotifier.shouldShowReminder(reminder, now)) {
        await this.globalReminderNotifier.showReminderNotification(
          reminder,
          async (id) => this.completeGlobalReminder(id),
          async (id, until) => {
            const r = this.globalReminders.get(id);
            if (r) {
              r.snoozedUntil = until;
              await this.saveGlobalReminders();
            }
          }
        );
      }
    }
  }

  /**
   * Add a global reminder
   */
  async addGlobalReminder(
    title: string,
    dueAt: Date,
    description?: string
  ): Promise<GlobalReminder> {
    const id = `gr_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    const reminder: GlobalReminder = {
      id,
      title,
      description,
      dueAt,
      status: 'pending',
      createdAt: new Date(),
      workspace: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath,
    };

    this.globalReminders.set(id, reminder);
    await this.saveGlobalReminders();

    return reminder;
  }

  /**
   * Create a global reminder interactively
   */
  async createGlobalReminderInteractive(): Promise<GlobalReminder | undefined> {
    const result = await createGlobalReminderDialog();
    if (!result) {
      return undefined;
    }
    return this.addGlobalReminder(result.title, result.dueAt, result.description);
  }

  /**
   * Complete a global reminder
   */
  async completeGlobalReminder(id: string): Promise<void> {
    const reminder = this.globalReminders.get(id);
    if (reminder) {
      reminder.status = 'completed';
      reminder.completedAt = new Date();
      await this.saveGlobalReminders();
    }
  }

  /**
   * Delete a global reminder
   */
  async deleteGlobalReminder(id: string): Promise<void> {
    this.globalReminders.delete(id);
    await this.saveGlobalReminders();
  }

  /**
   * Get all global reminders
   */
  getGlobalReminders(): GlobalReminder[] {
    return Array.from(this.globalReminders.values());
  }

  /**
   * Get pending global reminders
   */
  getPendingReminders(): GlobalReminder[] {
    return this.getGlobalReminders().filter((r) => r.status === 'pending');
  }

  /**
   * Edit TODO metadata (due date and assignee) in a single quick pick
   */
  async editTodoInteractive(todo: DetectedTodo): Promise<boolean> {
    return editTodoDialog(todo, this.scanner, this.syncService);
  }

  /**
   * Set reminder for a TODO - simplified, just calls editTodoInteractive
   */
  async setTodoReminderInteractive(todo: DetectedTodo): Promise<boolean> {
    return this.editTodoInteractive(todo);
  }

  /**
   * Set due date only - shows quick pick with just date options
   */
  async setDueDateInteractive(todo: DetectedTodo): Promise<boolean> {
    return setDueDateDialog(todo, this.syncService);
  }

  /**
   * Assign TODO only - shows quick pick with just assignee options
   */
  async assignTodoInteractive(todo: DetectedTodo): Promise<boolean> {
    return assignTodoDialog(todo, this.scanner, this.syncService);
  }

  dispose(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }
    for (const d of this.disposables) {
      d.dispose();
    }
  }
}
