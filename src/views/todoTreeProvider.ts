/**
 * TODO Tree View Provider
 * Provides a tree view for TODO items in the sidebar
 */

import * as vscode from 'vscode';
import {
  DetectedTodo,
  TodoCategory,
  getCategoryLabel,
  getPriorityWeight,
  GlobalReminder,
} from '../models/todo';
import { TodoScannerService } from '../services/todoScanner';
import { ReminderService } from '../services/reminder';
import {
  getTodoThemeIcon,
  getTodoCategoryThemeIcon,
  TODO_CATEGORY_THEME_ICONS,
} from '../utils/icons';
import * as path from 'path';

/**
 * Tree item for the TODO tree view
 */
export class TodoTreeItem extends vscode.TreeItem {
  public displayLabel: string;

  constructor(
    label: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly itemType: 'category' | 'todo' | 'reminder',
    public readonly todo?: DetectedTodo,
    public readonly reminder?: GlobalReminder,
    public readonly category?: TodoCategory
  ) {
    super(label, collapsibleState);
    this.displayLabel = label;

    if (todo) {
      this.setupTodoItem(todo);
    } else if (reminder) {
      this.setupReminderItem(reminder);
    } else if (category) {
      this.setupCategoryItem(category);
    }
  }

  private setupTodoItem(todo: DetectedTodo): void {
    // Clean label without emoji - let ThemeIcon handle the visual
    this.displayLabel = todo.description;
    this.label = todo.description;
    this.description = path.basename(todo.filePath);
    
    // Tooltip with full info
    let tooltip = `${todo.type}: ${todo.description}\n`;
    tooltip += `File: ${todo.filePath}\n`;
    tooltip += `Line: ${todo.lineNumber + 1}`;
    if (todo.dueDate) {
      tooltip += `\nDue: ${todo.dueDate.toLocaleDateString()}`;
    }
    this.tooltip = tooltip;

    // Context value for menus
    this.contextValue = 'todo';

    // Command to open file
    this.command = {
      command: 'cmdify.todo.goToCode',
      title: 'Go to Code',
      arguments: [todo],
    };

    // Use centralized icon system
    this.iconPath = getTodoThemeIcon(todo.type);
  }

  private setupReminderItem(reminder: GlobalReminder): void {
    // Clean label without emoji
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

  private setupCategoryItem(category: TodoCategory): void {
    this.iconPath = getTodoCategoryThemeIcon(category);
  }
}

/**
 * TODO Tree Data Provider
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
    this.disposables.push(
      this.scanner.onTodosChanged(() => this.refresh())
    );
  }

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: TodoTreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: TodoTreeItem): Promise<TodoTreeItem[]> {
    if (!element) {
      // Root level - show categories
      return this.getRootItems();
    }

    // Children of a category
    if (element.category) {
      return this.getCategoryChildren(element.category);
    }

    return [];
  }

  private getRootItems(): TodoTreeItem[] {
    const items: TodoTreeItem[] = [];

    // Count items in each category
    const overdue = this.scanner.getOverdueTodos();
    const today = this.scanner.getTodayTodos();
    const thisWeek = this.scanner.getThisWeekTodos();
    const noDate = this.scanner.getNoDateTodos();
    const reminders = this.reminderService.getPendingReminders();

    // Add categories with counts
    if (overdue.length > 0) {
      items.push(this.createCategoryItem('overdue', overdue.length));
    }

    if (today.length > 0) {
      items.push(this.createCategoryItem('today', today.length));
    }

    if (thisWeek.length > 0) {
      items.push(this.createCategoryItem('thisWeek', thisWeek.length));
    }

    if (noDate.length > 0) {
      items.push(this.createCategoryItem('noDate', noDate.length));
    }

    // Add global reminders
    if (reminders.length > 0) {
      const reminderCategory = new TodoTreeItem(
        `🔔 Reminders (${reminders.length})`,
        vscode.TreeItemCollapsibleState.Expanded,
        'category',
        undefined,
        undefined,
        'upcoming' as TodoCategory  // Use 'upcoming' for reminders
      );
      reminderCategory.contextValue = 'reminderCategory';
      items.push(reminderCategory);
    }

    // Show message if no items
    if (items.length === 0) {
      const emptyItem = new TodoTreeItem(
        'No TODOs found',
        vscode.TreeItemCollapsibleState.None,
        'category'
      );
      emptyItem.description = 'Click ↻ to scan workspace';
      items.push(emptyItem);
    }

    return items;
  }

  private createCategoryItem(category: TodoCategory, count: number): TodoTreeItem {
    const label = `${getCategoryLabel(category)} (${count})`;
    const item = new TodoTreeItem(
      label,
      vscode.TreeItemCollapsibleState.Expanded,
      'category',
      undefined,
      undefined,
      category
    );
    return item;
  }

  private getCategoryChildren(category: TodoCategory): TodoTreeItem[] {
    let todos: DetectedTodo[] = [];

    switch (category) {
      case 'overdue':
        todos = this.scanner.getOverdueTodos();
        break;
      case 'today':
        todos = this.scanner.getTodayTodos();
        break;
      case 'thisWeek':
        todos = this.scanner.getThisWeekTodos();
        break;
      case 'noDate':
        todos = this.scanner.getNoDateTodos();
        break;
      case 'completed':
        todos = this.scanner.getCompletedTodos();
        break;
      case 'upcoming':
        // Return reminders instead of todos
        return this.reminderService.getPendingReminders().map(
          reminder => new TodoTreeItem(
            reminder.title,
            vscode.TreeItemCollapsibleState.None,
            'reminder',
            undefined,
            reminder
          )
        );
    }

    // Sort by priority then by file
    todos.sort((a, b) => {
      const priorityDiff = getPriorityWeight(b.priority) - getPriorityWeight(a.priority);
      if (priorityDiff !== 0) {
        return priorityDiff;
      }
      return a.filePath.localeCompare(b.filePath);
    });

    return todos.map(
      todo => new TodoTreeItem(
        todo.description,
        vscode.TreeItemCollapsibleState.None,
        'todo',
        todo
      )
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
