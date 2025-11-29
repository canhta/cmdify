/**
 * CLI Command data model
 */

export type ShellType = 'bash' | 'zsh' | 'powershell' | 'pwsh' | 'cmd' | 'fish' | 'auto';

export type CommandSource = 'ai' | 'manual' | 'imported' | 'shared';

export interface CommandVariable {
  name: string;
  defaultValue?: string;
  description?: string;
}

export interface WorkingDirectory {
  type: 'workspace' | 'custom' | 'ask';
  path?: string;
}

export interface CLICommand {
  id: string;

  // Core - Only TWO required concepts
  prompt: string;           // What user asked for (natural language)
  command: string;          // The actual CLI command

  // Organization
  tags: string[];           // Simple tagging

  // Execution context
  shell?: ShellType;        // Default: auto-detect
  workingDirectory?: WorkingDirectory;
  variables?: CommandVariable[];  // Auto-extracted from {{var}} syntax

  // Metadata (auto-managed)
  createdAt: string;
  updatedAt: string;
  source: CommandSource;
  usageCount: number;
  lastUsedAt?: string;

  // Security
  skipDestructiveWarning?: boolean;  // Don't warn for this command

  // Organization
  isFavorite?: boolean;  // Mark as favorite for quick access

  // Sync metadata
  syncId?: string;              // Unique ID for sync tracking
  syncHash?: string;            // Hash of command content for conflict detection
  lastSyncedAt?: string;        // Last time this command was synced
  deletedAt?: string;           // Soft delete timestamp for sync purposes
}

/**
 * Sync conflict types
 */
export type SyncConflictType = 'modified' | 'deleted_local' | 'deleted_remote';

export interface SyncConflict {
  commandId: string;
  local: CLICommand;
  remote: CLICommand;
  type: SyncConflictType;
}

export type ConflictResolution = 'keep_local' | 'keep_remote' | 'keep_both';

/**
 * Generate a hash for command content (for conflict detection)
 */
export function generateCommandHash(cmd: CLICommand): string {
  const content = `${cmd.prompt}|${cmd.command}|${cmd.tags.join(',')}|${cmd.shell || ''}|${cmd.isFavorite || false}`;
  // Simple hash function
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash.toString(36);
}

/**
 * Get display name for a command (for sidebar)
 */
export function getDisplayName(cmd: CLICommand): string {
  if (cmd.prompt && cmd.prompt.length <= 40) {
    return cmd.prompt;
  }
  return truncate(cmd.command, 40);
}

/**
 * Get tooltip for a command
 */
export function getTooltip(cmd: CLICommand): string {
  return `${cmd.prompt}\n\n${cmd.command}`;
}

/**
 * Truncate a string with ellipsis
 */
function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) {
    return str;
  }
  return str.substring(0, maxLength - 3) + '...';
}

/**
 * Create a new command with defaults
 */
export function createCommand(
  prompt: string,
  command: string,
  source: CommandSource = 'manual',
  options?: Partial<CLICommand>
): CLICommand {
  const now = new Date().toISOString();
  return {
    id: generateId(),
    prompt,
    command,
    tags: [],
    source,
    usageCount: 0,
    isFavorite: false,
    createdAt: now,
    updatedAt: now,
    ...options,
  };
}

/**
 * Generate a unique ID
 */
function generateId(): string {
  return `cmd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
