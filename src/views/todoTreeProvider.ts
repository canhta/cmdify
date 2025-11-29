/**
 * TODO Tree View Provider
 * Provides a tree view for TODO items in the sidebar
 * Groups by assignee, sorted by due date (with date on top)
 */

import * as vscode from 'vscode';
import { DetectedTodo, GlobalReminder } from '../models/todo';
import { TodoScannerService } from '../services/todoScanner';
import { ReminderService } from '../services/reminder';
import { getTodoThemeIcon, TODO_CATEGORY_THEME_ICONS } from '../utils/icons';
import * as path from 'path';

/**
 * Assignee group type for tree view
 */
type AssigneeGroup = string; // assignee name or 'Unassigned'

/**
 * Tree item for the TODO tree view
 */
export class TodoTreeItem extends vscode.TreeItem {
  public displayLabel: string;

  constructor(
    label: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly itemType: 'assignee' | 'todo' | 'reminder' | 'reminderCategory',
    public readonly todo?: DetectedTodo,
    public readonly reminder?: GlobalReminder,
    public readonly assigneeGroup?: AssigneeGroup
  ) {
    super(label, collapsibleState);
    this.displayLabel = label;

    if (todo) {
      this.setupTodoItem(todo);
    } else if (reminder) {
      this.setupReminderItem(reminder);
    } else if (assigneeGroup !== undefined) {
      this.setupAssigneeItem(assigneeGroup);
    }
  }

  private setupTodoItem(todo: DetectedTodo): void {
    this.displayLabel = todo.description;
    this.label = todo.description;

    // Description shows file name and due date if present
    let descParts: string[] = [path.basename(todo.filePath)];
    if (todo.dueDate) {
      const isOverdue = todo.dueDate < new Date(new Date().setHours(0, 0, 0, 0));
      const dateStr = todo.dueDate.toLocaleDateString();
      descParts.push(isOverdue ? `⚠️ ${dateStr}` : `📅 ${dateStr}`);
    }
    this.description = descParts.join(' • ');

    // Tooltip with full info
    let tooltip = `${todo.type}: ${todo.description}\n`;
    tooltip += `File: ${todo.filePath}\n`;
    tooltip += `Line: ${todo.lineNumber + 1}`;
    if (todo.dueDate) {
      tooltip += `\nDue: ${todo.dueDate.toLocaleDateString()}`;
    }
    if (todo.assignee) {
      tooltip += `\nAssigned to: ${todo.assignee}`;
    }
    this.tooltip = tooltip;

    this.contextValue = 'todo';

    this.command = {
      command: 'cmdify.todo.goToCode',
      title: 'Go to Code',
      arguments: [todo],
    };

    this.iconPath = getTodoThemeIcon(todo.type);
  }

  private setupReminderItem(reminder: GlobalReminder): void {
    this.displayLabel = reminder.title;
    this.label = reminder.title;
    this.description = reminder.dueAt.toLocaleDateString();

    let tooltip = `Reminder: ${reminder.title}\n`;
    tooltip += `Due: ${reminder.dueAt.toLocaleString()}`;
    if (reminder.description) {
      tooltip += `\n${reminder.description}`;
    }
    this.tooltip = tooltip;

    this.contextValue = 'reminder';
    this.iconPath = new vscode.ThemeIcon(TODO_CATEGORY_THEME_ICONS['reminder']);
  }

  private setupAssigneeItem(assignee: AssigneeGroup): void {
    if (assignee === 'Unassigned') {
      this.iconPath = new vscode.ThemeIcon('circle-outline');
    } else {
      this.iconPath = new vscode.ThemeIcon('person');
    }
  }
}

/**
 * TODO Tree Data Provider
 * Groups TODOs by assignee, sorted by due date (with date on top)
 */
export class TodoTreeProvider implements vscode.TreeDataProvider<TodoTreeItem>, vscode.Disposable {
  private _onDidChangeTreeData = new vscode.EventEmitter<TodoTreeItem | undefined | null | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private disposables: vscode.Disposable[] = [];

  constructor(
    private readonly scanner: TodoScannerService,
    private readonly reminderService: ReminderService
  ) {
    // Refresh when TODOs change
    this.disposables.push(this.scanner.onTodosChanged(() => this.refresh()));
  }

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: TodoTreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: TodoTreeItem): Promise<TodoTreeItem[]> {
    if (!element) {
      // Root level - show assignee groups
      return this.getRootItems();
    }

    // Children of an assignee group
    if (element.assigneeGroup !== undefined) {
      return this.getAssigneeChildren(element.assigneeGroup);
    }

    // Children of reminder category
    if (element.itemType === 'reminderCategory') {
      return this.reminderService
        .getPendingReminders()
        .map(
          (reminder) =>
            new TodoTreeItem(
              reminder.title,
              vscode.TreeItemCollapsibleState.None,
              'reminder',
              undefined,
              reminder
            )
        );
    }

    return [];
  }

  private getRootItems(): TodoTreeItem[] {
    const items: TodoTreeItem[] = [];
    const todos = this.scanner.getTodos().filter((t) => t.status === 'open');

    // Group by assignee
    const assigneeGroups = new Map<string, DetectedTodo[]>();

    for (const todo of todos) {
      const assignee = todo.assignee || 'Unassigned';
      if (!assigneeGroups.has(assignee)) {
        assigneeGroups.set(assignee, []);
      }
      assigneeGroups.get(assignee)!.push(todo);
    }

    // Sort assignees: assigned people first (alphabetically), then Unassigned
    const sortedAssignees = Array.from(assigneeGroups.keys()).sort((a, b) => {
      if (a === 'Unassigned') return 1;
      if (b === 'Unassigned') return -1;
      return a.localeCompare(b);
    });

    // Create assignee group items
    for (const assignee of sortedAssignees) {
      const count = assigneeGroups.get(assignee)!.length;
      const item = new TodoTreeItem(
        `${assignee} (${count})`,
        vscode.TreeItemCollapsibleState.Expanded,
        'assignee',
        undefined,
        undefined,
        assignee
      );
      items.push(item);
    }

    // Add global reminders
    const reminders = this.reminderService.getPendingReminders();
    if (reminders.length > 0) {
      const reminderCategory = new TodoTreeItem(
        `🔔 Reminders (${reminders.length})`,
        vscode.TreeItemCollapsibleState.Expanded,
        'reminderCategory'
      );
      reminderCategory.contextValue = 'reminderCategory';
      items.push(reminderCategory);
    }

    // Show message if no items
    if (items.length === 0) {
      const emptyItem = new TodoTreeItem(
        'No TODOs found',
        vscode.TreeItemCollapsibleState.None,
        'assignee',
        undefined,
        undefined,
        'empty'
      );
      emptyItem.description = 'Click ↻ to scan workspace';
      items.push(emptyItem);
    }

    return items;
  }

  private getAssigneeChildren(assignee: AssigneeGroup): TodoTreeItem[] {
    const todos = this.scanner.getTodos().filter((t) => {
      if (t.status !== 'open') return false;
      const todoAssignee = t.assignee || 'Unassigned';
      return todoAssignee === assignee;
    });

    // Sort: TODOs with due date first (by date ascending), then without date
    todos.sort((a, b) => {
      // Both have dates - sort by date
      if (a.dueDate && b.dueDate) {
        return a.dueDate.getTime() - b.dueDate.getTime();
      }
      // Only a has date - a comes first
      if (a.dueDate && !b.dueDate) return -1;
      // Only b has date - b comes first
      if (!a.dueDate && b.dueDate) return 1;
      // Neither has date - sort by file path
      return a.filePath.localeCompare(b.filePath);
    });

    return todos.map(
      (todo) =>
        new TodoTreeItem(todo.description, vscode.TreeItemCollapsibleState.None, 'todo', todo)
    );
  }

  dispose(): void {
    this._onDidChangeTreeData.dispose();
    for (const d of this.disposables) {
      d.dispose();
    }
  }
}

/**
 * Create and register the TODO tree view
 */
export function createTodoTreeView(
  scanner: TodoScannerService,
  reminderService: ReminderService
): { treeView: vscode.TreeView<TodoTreeItem>; provider: TodoTreeProvider } {
  const provider = new TodoTreeProvider(scanner, reminderService);

  const treeView = vscode.window.createTreeView('cmdify.todos', {
    treeDataProvider: provider,
    showCollapseAll: true,
  });

  return { treeView, provider };
}
