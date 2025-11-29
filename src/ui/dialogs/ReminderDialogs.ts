/**
 * Reminder Dialog Utilities
 * Handles interactive dialogs for reminder and TODO metadata management
 */

import * as vscode from 'vscode';
import { DetectedTodo, GlobalReminder } from '../../models/todo';
import { parseCustomDate, getCommonDateOptions } from '../../utils/dateParser';
import { getGitContributorService } from '../../services/gitContributor';
import { TodoScannerService } from '../../services/todoScanner';
import { TodoSyncService } from '../../services/todoSync';

/**
 * Create a global reminder interactively
 */
export async function createGlobalReminderDialog(): Promise<
  | {
      title: string;
      dueAt: Date;
      description?: string;
    }
  | undefined
> {
  // Get title
  const title = await vscode.window.showInputBox({
    prompt: 'What would you like to be reminded about?',
    placeHolder: 'e.g., Review PR #123, Update documentation',
    validateInput: (value) => (value?.trim() ? undefined : 'Title is required'),
  });

  if (!title) {
    return undefined;
  }

  // Get due date using common date options
  const dateOptions = getCommonDateOptions();
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

      dueAt = parseCustomDate(dateStr);
      break;
    default:
      return undefined;
  }

  // Get optional description
  const description = await vscode.window.showInputBox({
    prompt: 'Add a description (optional)',
    placeHolder: 'Additional details...',
  });

  return { title, dueAt, description };
}

/**
 * Edit TODO metadata (due date and assignee) in a single quick pick
 */
export async function editTodoDialog(
  todo: DetectedTodo,
  scanner: TodoScannerService,
  syncService: TodoSyncService
): Promise<boolean> {
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
    { label: '$(calendar) Today', description: formatDate(0) },
    { label: '$(arrow-right) Tomorrow', description: formatDate(1) },
    { label: '$(calendar) Next week', description: formatDate(7) },
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
      const success = await handleQuickPickSelection(todo, selected.label, scanner, syncService);
      resolve(success);
    });

    quickPick.onDidHide(() => {
      quickPick.dispose();
    });

    quickPick.show();
  });
}

/**
 * Set due date only - shows quick pick with just date options
 */
export async function setDueDateDialog(
  todo: DetectedTodo,

  syncService: TodoSyncService
): Promise<boolean> {
  const currentDue = todo.dueDate ? todo.dueDate.toLocaleDateString() : 'Not set';

  const quickPick = vscode.window.createQuickPick();
  quickPick.title = 'Set Due Date';
  quickPick.placeholder = `Current: ${currentDue}`;

  const items: vscode.QuickPickItem[] = [
    { label: '$(calendar) Today', description: formatDate(0) },
    { label: '$(arrow-right) Tomorrow', description: formatDate(1) },
    { label: '$(calendar) Next week', description: formatDate(7) },
    { label: '$(edit) Custom date...', description: 'Pick a date' },
    { label: '$(close) Clear due date', description: 'Remove due date' },
  ];

  quickPick.items = items;

  return new Promise<boolean>((resolve) => {
    quickPick.onDidAccept(async () => {
      const selected = quickPick.selectedItems[0];
      quickPick.hide();
      if (selected) {
        const result = await handleQuickPickSelection(
          todo,
          selected.label,
          undefined as any,
          syncService
        );
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
export async function assignTodoDialog(
  todo: DetectedTodo,
  scanner: TodoScannerService,
  syncService: TodoSyncService
): Promise<boolean> {
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
        const result = await handleQuickPickSelection(todo, selected.label, scanner, syncService);
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
 * Format a date offset for display
 */
function formatDate(daysFromNow: number): string {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  return date.toLocaleDateString();
}

/**
 * Handle quick pick selection
 */
async function handleQuickPickSelection(
  todo: DetectedTodo,
  label: string,
  scanner: TodoScannerService | undefined,
  syncService: TodoSyncService
): Promise<boolean> {
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
    success = await syncService.updateMetadata(todo, dueAt, todo.assignee);
    if (success) {
      vscode.window.showInformationMessage(`📅 Due date set to ${dueAt.toLocaleDateString()}`);
    }
  } else if (clearDue) {
    success = await syncService.removeReminder(todo);
    if (success) {
      vscode.window.showInformationMessage('📅 Due date cleared');
    }
  } else if (assignee && scanner) {
    await scanner.setAssignee(todo.id, assignee);
    success = await syncService.updateMetadata(todo, todo.dueDate, assignee);
    if (success) {
      vscode.window.showInformationMessage(`👤 Assigned to ${assignee}`);
    }
  } else if (clearAssignee && scanner) {
    await scanner.setAssignee(todo.id, undefined);
    success = await syncService.removeAssignee(todo);
    if (success) {
      vscode.window.showInformationMessage('👤 Assignee cleared');
    }
  }

  return success;
}
