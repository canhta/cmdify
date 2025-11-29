/**
 * TODO Scanner types and interfaces
 */

/**
 * Pattern definition for detecting TODOs
 */
export interface TodoPattern {
  regex: RegExp;
  type: string;
}

/**
 * Default patterns to detect TODO-like comments
 */
export const DEFAULT_TODO_PATTERNS: TodoPattern[] = [
  // JavaScript/TypeScript/Java/C-style
  { regex: /\/\/\s*(TODO|FIXME|HACK|XXX|BUG|OPTIMIZE|REVIEW)[:\s]*(.+)/gi, type: '$1' },
  // Python/Ruby/Shell
  { regex: /#\s*(TODO|FIXME|HACK|XXX|BUG|OPTIMIZE|REVIEW)[:\s]*(.+)/gi, type: '$1' },
  // HTML/XML comments
  { regex: /<!--\s*(TODO|FIXME|HACK|XXX|BUG)[:\s]*(.+?)-->/gi, type: '$1' },
  // CSS comments
  { regex: /\/\*\s*(TODO|FIXME|HACK|XXX)[:\s]*(.+?)\*\//gi, type: '$1' },
];

/**
 * Date pattern: @2024-12-01 or @tomorrow or @next-week or @next-month
 */
export const DATE_PATTERN = /@(\d{4}-\d{2}-\d{2}|today|tomorrow|next-week|next-month)/i;

/**
 * Priority levels for TODOs
 */
export type TodoPriority = 'low' | 'medium' | 'high';

/**
 * Status of a TODO item
 */
export type TodoStatus = 'open' | 'completed' | 'snoozed';

/**
 * A detected TODO comment in the codebase
 */
export interface DetectedTodo {
  id: string;                   // hash(filePath + lineNumber)
  filePath: string;
  lineNumber: number;           // 0-based
  type: string;                 // TODO, FIXME, HACK, XXX, BUG, etc.
  text: string;                 // full comment text
  description: string;          // extracted description without the type tag
  dueDate?: Date;               // parsed from @date
  dueDateRaw?: string;          // original date string (@2024-12-01)
  priority: TodoPriority;
  status: TodoStatus;
  createdAt?: Date;             // when first detected
  completedAt?: Date;           // when marked complete
}

/**
 * Global reminder not tied to code
 */
export interface GlobalReminder {
  id: string;
  title: string;
  description?: string;
  dueAt: Date;
  recurring?: 'daily' | 'weekly' | 'monthly';
  workspace?: string;           // optional workspace association
  status: 'pending' | 'completed' | 'snoozed';
  snoozedUntil?: Date;
  createdAt: Date;
  completedAt?: Date;
}

/**
 * TODO scanner configuration
 */
export interface TodoScannerConfig {
  includePatterns: string[];    // glob patterns for files to scan
  excludePatterns: string[];    // glob patterns to exclude
  scanOnSave: boolean;
  customPatterns: string[];     // user-defined regex patterns
}

/**
 * Default scanner configuration
 */
export const DEFAULT_SCANNER_CONFIG: TodoScannerConfig = {
  includePatterns: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx', '**/*.py', '**/*.java', '**/*.go', '**/*.rs', '**/*.c', '**/*.cpp', '**/*.h', '**/*.cs', '**/*.rb', '**/*.php', '**/*.vue', '**/*.svelte'],
  excludePatterns: ['**/node_modules/**', '**/dist/**', '**/build/**', '**/out/**', '**/.git/**', '**/vendor/**', '**/__pycache__/**', '**/target/**'],
  scanOnSave: true,
  customPatterns: [],
};

/**
 * Stored TODO metadata (persisted in globalState)
 */
export interface StoredTodoMeta {
  id: string;
  status: TodoStatus;
  snoozedUntil?: string;        // ISO date string
  completedAt?: string;         // ISO date string
  createdAt: string;            // ISO date string
}

/**
 * TODO tree view category
 */
export type TodoCategory = 'overdue' | 'today' | 'thisWeek' | 'upcoming' | 'noDate' | 'completed';

/**
 * Get category label (plain text, no icons)
 */
export function getCategoryLabel(category: TodoCategory): string {
  switch (category) {
    case 'overdue':
      return 'Overdue';
    case 'today':
      return 'Today';
    case 'thisWeek':
      return 'This Week';
    case 'upcoming':
      return 'Upcoming';
    case 'noDate':
      return 'No Date';
    case 'completed':
      return 'Completed';
  }
}

/**
 * Priority weight for sorting
 */
export function getPriorityWeight(priority: TodoPriority): number {
  switch (priority) {
    case 'high':
      return 3;
    case 'medium':
      return 2;
    case 'low':
      return 1;
  }
}

/**
 * Type weight for priority inference
 */
export function inferPriorityFromType(type: string): TodoPriority {
  const upperType = type.toUpperCase();
  switch (upperType) {
    case 'BUG':
    case 'FIXME':
      return 'high';
    case 'HACK':
    case 'XXX':
      return 'medium';
    default:
      return 'low';
  }
}
