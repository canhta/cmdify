/**
 * Reminder Service
 * Handles notifications and reminders for TODOs and global reminders
 */

import * as vscode from 'vscode';
import { DetectedTodo, GlobalReminder } from '../models/todo';
import { TodoScannerService } from './todoScanner';
import { TodoSyncService } from './todoSync';
import { formatRelativeTime } from '../utils/dateUtils';
import { getGitContributorService } from './gitContributor';

const REMINDERS_KEY = 'cmdify.reminders.global';
const CHECK_INTERVAL = 60000; // Check every minute

/**
 * Reminder Service
 */
export class ReminderService implements vscode.Disposable {
  private globalReminders: Map<string, GlobalReminder> = new Map();
  private checkInterval: ReturnType<typeof setInterval> | null = null;
  private disposables: vscode.Disposable[] = [];
  private notifiedTodos: Set<string> = new Set();

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly scanner: TodoScannerService,
    private readonly syncService: TodoSyncService
  ) {
    this.loadGlobalReminders();
    this.startChecking();

    // Check TODOs when scan completes
    this.disposables.push(
      this.scanner.onScanCompleted(() => {
        this.checkDueTodos();
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
      this.checkDueTodos();
      this.checkGlobalReminders();
    }, CHECK_INTERVAL);

    // Also check immediately
    this.checkDueTodos();
    this.checkGlobalReminders();
  }

  /**
   * Check for due TODOs and show notifications
   */
  private async checkDueTodos(): Promise<void> {
    const overdue = this.scanner.getOverdueTodos();
    const today = this.scanner.getTodayTodos();

    // Show notification for overdue TODOs (only once per session per TODO)
    for (const todo of overdue) {
      if (!this.notifiedTodos.has(todo.id)) {
        this.notifiedTodos.add(todo.id);
        this.showTodoNotification(todo, true);
      }
    }

    // Show notification for TODOs due today at start of day
    for (const todo of today) {
      if (!this.notifiedTodos.has(todo.id)) {
        this.notifiedTodos.add(todo.id);
        this.showTodoNotification(todo, false);
      }
    }
  }

  /**
   * Show notification for a TODO
   */
  private async showTodoNotification(todo: DetectedTodo, isOverdue: boolean): Promise<void> {
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
   * Check global reminders and show notifications
   */
  private async checkGlobalReminders(): Promise<void> {
    const now = new Date();

    for (const [id, reminder] of this.globalReminders) {
      if (reminder.status !== 'pending') {
        continue;
      }

      // Check if snoozed
      if (reminder.snoozedUntil && reminder.snoozedUntil > now) {
        continue;
      }

      // Check if due
      if (reminder.dueAt <= now) {
        this.showGlobalReminderNotification(reminder);
      }
    }
  }

  /**
   * Show notification for a global reminder
   */
  private async showGlobalReminderNotification(reminder: GlobalReminder): Promise<void> {
    const message = `🔔 Reminder: ${reminder.title}`;

    const action = await vscode.window.showInformationMessage(
      message,
      'Snooze 1h',
      'Snooze 1d',
      'Complete'
    );

    switch (action) {
      case 'Snooze 1h':
        const snooze1h = new Date();
        snooze1h.setHours(snooze1h.getHours() + 1);
        reminder.snoozedUntil = snooze1h;
        await this.saveGlobalReminders();
        break;
      case 'Snooze 1d':
        const snooze1d = new Date();
        snooze1d.setDate(snooze1d.getDate() + 1);
        reminder.snoozedUntil = snooze1d;
        await this.saveGlobalReminders();
        break;
      case 'Complete':
        await this.completeGlobalReminder(reminder.id);
        break;
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
    // Get title
    const title = await vscode.window.showInputBox({
      prompt: 'What would you like to be reminded about?',
      placeHolder: 'e.g., Review PR #123, Update documentation',
      validateInput: (value) => (value?.trim() ? undefined : 'Title is required'),
    });

    if (!title) {
      return undefined;
    }

    // Get due date
    const dateOptions: vscode.QuickPickItem[] = [
      { label: '$(clock) In 1 hour', description: 'Remind me in 1 hour' },
      { label: '$(calendar) Later today', description: 'Remind me at 5 PM' },
      { label: '$(arrow-right) Tomorrow', description: 'Remind me tomorrow at 9 AM' },
      { label: '$(calendar) Next week', description: 'Remind me next Monday' },
      { label: '$(edit) Custom date', description: 'Pick a specific date' },
    ];

    const dateChoice = await vscode.window.showQuickPick(dateOptions, {
      placeHolder: 'When should I remind you?',
    });

    if (!dateChoice) {
      return undefined;
    }

    let dueAt: Date;
    const now = new Date();

    switch (dateChoice.label) {
      case '$(clock) In 1 hour':
        dueAt = new Date(now.getTime() + 60 * 60 * 1000);
        break;
      case '$(calendar) Later today':
        dueAt = new Date(now);
        dueAt.setHours(17, 0, 0, 0);
        if (dueAt <= now) {
          dueAt.setDate(dueAt.getDate() + 1);
        }
        break;
      case '$(arrow-right) Tomorrow':
        dueAt = new Date(now);
        dueAt.setDate(dueAt.getDate() + 1);
        dueAt.setHours(9, 0, 0, 0);
        break;
      case '$(calendar) Next week':
        dueAt = new Date(now);
        const daysUntilMonday = (8 - dueAt.getDay()) % 7 || 7;
        dueAt.setDate(dueAt.getDate() + daysUntilMonday);
        dueAt.setHours(9, 0, 0, 0);
        break;
      case '$(edit) Custom date':
        const dateStr = await vscode.window.showInputBox({
          prompt: 'Enter date (YYYY-MM-DD) or relative (e.g., "3 days", "2 weeks")',
          placeHolder: 'YYYY-MM-DD or "3 days"',
          validateInput: (value) => {
            if (!value) {
              return 'Date is required';
            }
            // Try parsing
            if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
              return undefined;
            }
            if (/^\d+\s*(day|week|month|hour)s?$/i.test(value)) {
              return undefined;
            }
            return 'Invalid format. Use YYYY-MM-DD or "3 days"';
          },
        });

        if (!dateStr) {
          return undefined;
        }

        dueAt = this.parseCustomDate(dateStr);
        break;
      default:
        return undefined;
    }

    // Get optional description
    const description = await vscode.window.showInputBox({
      prompt: 'Add a description (optional)',
      placeHolder: 'Additional details...',
    });

    return this.addGlobalReminder(title, dueAt, description);
  }

  /**
   * Parse custom date string
   */
  private parseCustomDate(dateStr: string): Date {
    // Try YYYY-MM-DD format
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      const [year, month, day] = dateStr.split('-').map(Number);
      return new Date(year, month - 1, day, 9, 0, 0);
    }

    // Try relative format
    const match = dateStr.match(/^(\d+)\s*(day|week|month|hour)s?$/i);
    if (match) {
      const amount = parseInt(match[1], 10);
      const unit = match[2].toLowerCase();
      const date = new Date();

      switch (unit) {
        case 'hour':
          date.setHours(date.getHours() + amount);
          break;
        case 'day':
          date.setDate(date.getDate() + amount);
          break;
        case 'week':
          date.setDate(date.getDate() + amount * 7);
          break;
        case 'month':
          date.setMonth(date.getMonth() + amount);
          break;
      }

      return date;
    }

    // Fallback to tomorrow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(9, 0, 0, 0);
    return tomorrow;
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
    const gitService = getGitContributorService();

    // Fetch contributors in background
    const contributors = await gitService.getContributors();

    // Build current status display
    const currentDue = todo.dueDate ? todo.dueDate.toLocaleDateString() : 'Not set';
    const currentAssignee = todo.assignee || 'Unassigned';

    // Create quick pick with all options
    const quickPick = vscode.window.createQuickPick();
    quickPick.title = 'Edit TODO';
    quickPick.placeholder = `Current: Due ${currentDue} | ${currentAssignee}`;

    // Build items
    const items: vscode.QuickPickItem[] = [
      // Due date section
      { label: 'Due Date', kind: vscode.QuickPickItemKind.Separator },
      { label: '$(calendar) Today', description: this.formatDate(0) },
      { label: '$(arrow-right) Tomorrow', description: this.formatDate(1) },
      { label: '$(calendar) Next week', description: this.formatDate(7) },
      { label: '$(edit) Custom date...', description: 'Pick a date' },
      { label: '$(close) Clear due date', description: 'Remove due date' },

      // Assignee section
      { label: 'Assign To', kind: vscode.QuickPickItemKind.Separator },
      { label: '$(edit) Enter name...', description: 'Type a custom name' },
      { label: '$(close) Unassign', description: 'Remove assignee' },
    ];

    // Add contributors
    if (contributors.length > 0) {
      items.push({ label: 'Contributors', kind: vscode.QuickPickItemKind.Separator });
      for (const c of contributors.slice(0, 10)) {
        // Limit to top 10
        items.push({
          label: `$(person) ${c.name}`,
          description: c.email,
          detail: `${c.commits} commits`,
        });
      }
    }

    quickPick.items = items;
    quickPick.matchOnDescription = true;

    return new Promise((resolve) => {
      quickPick.onDidAccept(async () => {
        const selected = quickPick.selectedItems[0];
        if (!selected) {
          quickPick.hide();
          resolve(false);
          return;
        }

        quickPick.hide();
        const success = await this.handleQuickPickSelection(todo, selected.label);
        resolve(success);
      });

      quickPick.onDidHide(() => {
        quickPick.dispose();
      });

      quickPick.show();
    });
  }

  /**
   * Format a date offset for display
   */
  private formatDate(daysFromNow: number): string {
    const date = new Date();
    date.setDate(date.getDate() + daysFromNow);
    return date.toLocaleDateString();
  }

  /**
   * Handle quick pick selection
   */
  private async handleQuickPickSelection(todo: DetectedTodo, label: string): Promise<boolean> {
    const now = new Date();
    let dueAt: Date | undefined;
    let assignee: string | undefined;
    let clearDue = false;
    let clearAssignee = false;

    // Handle due date options
    if (label === '$(calendar) Today') {
      dueAt = new Date(now);
    } else if (label === '$(arrow-right) Tomorrow') {
      dueAt = new Date(now);
      dueAt.setDate(dueAt.getDate() + 1);
    } else if (label === '$(calendar) Next week') {
      dueAt = new Date(now);
      dueAt.setDate(dueAt.getDate() + 7);
    } else if (label === '$(edit) Custom date...') {
      const dateStr = await vscode.window.showInputBox({
        prompt: 'Enter date (YYYY-MM-DD)',
        placeHolder: 'YYYY-MM-DD',
        validateInput: (value) => {
          if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
            return 'Please use YYYY-MM-DD format';
          }
          return undefined;
        },
      });
      if (!dateStr) {
        return false;
      }
      const [year, month, day] = dateStr.split('-').map(Number);
      dueAt = new Date(year, month - 1, day);
    } else if (label === '$(close) Clear due date') {
      clearDue = true;
    } else if (label === '$(edit) Enter name...') {
      assignee = await vscode.window.showInputBox({
        prompt: 'Enter assignee name',
        placeHolder: 'e.g., John Doe',
      });
      if (!assignee) {
        return false;
      }
    } else if (label === '$(close) Unassign') {
      clearAssignee = true;
    } else if (label.startsWith('$(person)')) {
      // Selected a contributor
      assignee = label.replace(/^\$\([^)]+\)\s*/, '');
    } else {
      return false;
    }

    // Apply changes
    let success = true;

    if (dueAt) {
      success = await this.syncService.updateMetadata(todo, dueAt, todo.assignee);
      if (success) {
        vscode.window.showInformationMessage(`📅 Due date set to ${dueAt.toLocaleDateString()}`);
      }
    } else if (clearDue) {
      success = await this.syncService.removeReminder(todo);
      if (success) {
        vscode.window.showInformationMessage('📅 Due date cleared');
      }
    } else if (assignee) {
      await this.scanner.setAssignee(todo.id, assignee);
      success = await this.syncService.updateMetadata(todo, todo.dueDate, assignee);
      if (success) {
        vscode.window.showInformationMessage(`👤 Assigned to ${assignee}`);
      }
    } else if (clearAssignee) {
      await this.scanner.setAssignee(todo.id, undefined);
      success = await this.syncService.removeAssignee(todo);
      if (success) {
        vscode.window.showInformationMessage('👤 Assignee cleared');
      }
    }

    return success;
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
    const currentDue = todo.dueDate ? todo.dueDate.toLocaleDateString() : 'Not set';

    const quickPick = vscode.window.createQuickPick();
    quickPick.title = 'Set Due Date';
    quickPick.placeholder = `Current: ${currentDue}`;

    const items: vscode.QuickPickItem[] = [
      { label: '$(calendar) Today', description: this.formatDate(0) },
      { label: '$(arrow-right) Tomorrow', description: this.formatDate(1) },
      { label: '$(calendar) Next week', description: this.formatDate(7) },
      { label: '$(edit) Custom date...', description: 'Pick a date' },
      { label: '$(close) Clear due date', description: 'Remove due date' },
    ];

    quickPick.items = items;

    return new Promise<boolean>((resolve) => {
      quickPick.onDidAccept(async () => {
        const selected = quickPick.selectedItems[0];
        quickPick.hide();
        if (selected) {
          const result = await this.handleQuickPickSelection(todo, selected.label);
          resolve(result);
        } else {
          resolve(false);
        }
      });
      quickPick.onDidHide(() => resolve(false));
      quickPick.show();
    });
  }

  /**
   * Assign TODO only - shows quick pick with just assignee options
   */
  async assignTodoInteractive(todo: DetectedTodo): Promise<boolean> {
    const gitService = getGitContributorService();
    const contributors = await gitService.getContributors();
    const currentAssignee = todo.assignee || 'Unassigned';

    const quickPick = vscode.window.createQuickPick();
    quickPick.title = 'Assign To';
    quickPick.placeholder = `Current: ${currentAssignee}`;

    const items: vscode.QuickPickItem[] = [
      { label: '$(edit) Enter name...', description: 'Type a custom name' },
      { label: '$(close) Unassign', description: 'Remove assignee' },
    ];

    // Add contributors
    if (contributors.length > 0) {
      items.push({ label: 'Contributors', kind: vscode.QuickPickItemKind.Separator });
      for (const c of contributors.slice(0, 10)) {
        items.push({
          label: `$(person) ${c.name}`,
          description: c.email,
          detail: `${c.commits} commits`,
        });
      }
    }

    quickPick.items = items;
    quickPick.matchOnDescription = true;

    return new Promise<boolean>((resolve) => {
      quickPick.onDidAccept(async () => {
        const selected = quickPick.selectedItems[0];
        quickPick.hide();
        if (selected) {
          const result = await this.handleQuickPickSelection(todo, selected.label);
          resolve(result);
        } else {
          resolve(false);
        }
      });
      quickPick.onDidHide(() => resolve(false));
      quickPick.show();
    });
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
