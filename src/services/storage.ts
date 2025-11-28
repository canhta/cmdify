import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { CLICommand } from '../models/command';

const STORAGE_FILE = 'cmdify-commands.json';

interface StorageData {
  version: string;
  commands: CLICommand[];
}

/**
 * Storage service for persisting CLI commands
 */
export class StorageService {
  private storagePath: string;
  private commands: Map<string, CLICommand> = new Map();
  private _onDidChange = new vscode.EventEmitter<void>();

  readonly onDidChange = this._onDidChange.event;

  constructor(context: vscode.ExtensionContext) {
    this.storagePath = path.join(context.globalStorageUri.fsPath, STORAGE_FILE);
  }

  /**
   * Initialize storage and load commands
   */
  async initialize(): Promise<void> {
    await this.ensureStorageDirectory();
    await this.load();
  }

  /**
   * Ensure storage directory exists
   */
  private async ensureStorageDirectory(): Promise<void> {
    const dir = path.dirname(this.storagePath);
    if (!fs.existsSync(dir)) {
      await fs.promises.mkdir(dir, { recursive: true });
    }
  }

  /**
   * Load commands from storage
   */
  private async load(): Promise<void> {
    try {
      if (fs.existsSync(this.storagePath)) {
        const data = await fs.promises.readFile(this.storagePath, 'utf-8');
        const storage: StorageData = JSON.parse(data);
        this.commands.clear();
        for (const cmd of storage.commands) {
          this.commands.set(cmd.id, cmd);
        }
      }
    } catch (error) {
      console.error('Failed to load commands:', error);
      // Start with empty commands if load fails
      this.commands.clear();
    }
  }

  /**
   * Save commands to storage
   */
  private async save(): Promise<void> {
    try {
      const storage: StorageData = {
        version: '1.0',
        commands: Array.from(this.commands.values()),
      };
      await fs.promises.writeFile(this.storagePath, JSON.stringify(storage, null, 2));
      this._onDidChange.fire();
    } catch (error) {
      console.error('Failed to save commands:', error);
      throw error;
    }
  }

  /**
   * Get all commands
   */
  getAll(): CLICommand[] {
    return Array.from(this.commands.values());
  }

  /**
   * Get a command by ID
   */
  get(id: string): CLICommand | undefined {
    return this.commands.get(id);
  }

  /**
   * Add a new command
   */
  async add(command: CLICommand): Promise<void> {
    this.commands.set(command.id, command);
    await this.save();
  }

  /**
   * Update an existing command
   */
  async update(command: CLICommand): Promise<void> {
    if (!this.commands.has(command.id)) {
      throw new Error(`Command not found: ${command.id}`);
    }
    command.updatedAt = new Date().toISOString();
    this.commands.set(command.id, command);
    await this.save();
  }

  /**
   * Delete a command
   */
  async delete(id: string): Promise<void> {
    if (!this.commands.has(id)) {
      throw new Error(`Command not found: ${id}`);
    }
    this.commands.delete(id);
    await this.save();
  }

  /**
   * Record command usage
   */
  async recordUsage(id: string): Promise<void> {
    const command = this.commands.get(id);
    if (command) {
      command.usageCount++;
      command.lastUsedAt = new Date().toISOString();
      await this.save();
    }
  }

  /**
   * Get recent commands sorted by last used
   */
  getRecent(count: number = 5): CLICommand[] {
    return this.getAll()
      .filter((cmd) => cmd.lastUsedAt)
      .sort((a, b) => {
        const aTime = a.lastUsedAt ? new Date(a.lastUsedAt).getTime() : 0;
        const bTime = b.lastUsedAt ? new Date(b.lastUsedAt).getTime() : 0;
        return bTime - aTime;
      })
      .slice(0, count);
  }

  /**
   * Get commands grouped by tag
   */
  getGroupedByTag(): Map<string, CLICommand[]> {
    const groups = new Map<string, CLICommand[]>();
    const untagged: CLICommand[] = [];

    for (const cmd of this.commands.values()) {
      if (cmd.tags.length === 0) {
        untagged.push(cmd);
      } else {
        for (const tag of cmd.tags) {
          const group = groups.get(tag) || [];
          group.push(cmd);
          groups.set(tag, group);
        }
      }
    }

    if (untagged.length > 0) {
      groups.set('untagged', untagged);
    }

    return groups;
  }

  /**
   * Search commands by prompt or command text
   */
  search(query: string): CLICommand[] {
    const lowerQuery = query.toLowerCase();
    return this.getAll().filter(
      (cmd) =>
        cmd.prompt.toLowerCase().includes(lowerQuery) ||
        cmd.command.toLowerCase().includes(lowerQuery) ||
        cmd.tags.some((tag) => tag.toLowerCase().includes(lowerQuery))
    );
  }

  /**
   * Get all unique tags
   */
  getAllTags(): string[] {
    const tags = new Set<string>();
    for (const cmd of this.commands.values()) {
      for (const tag of cmd.tags) {
        tags.add(tag);
      }
    }
    return Array.from(tags).sort();
  }

  /**
   * Import commands (for sync)
   */
  async importCommands(commands: CLICommand[], merge: boolean = true): Promise<void> {
    if (merge) {
      // Merge with existing commands
      for (const cmd of commands) {
        const existing = this.commands.get(cmd.id);
        if (existing) {
          // Keep newer version
          const existingTime = new Date(existing.updatedAt).getTime();
          const importTime = new Date(cmd.updatedAt).getTime();
          if (importTime > existingTime) {
            this.commands.set(cmd.id, cmd);
          }
        } else {
          this.commands.set(cmd.id, cmd);
        }
      }
    } else {
      // Replace all commands
      this.commands.clear();
      for (const cmd of commands) {
        this.commands.set(cmd.id, cmd);
      }
    }
    await this.save();
  }

  /**
   * Export all commands (for sync)
   */
  exportCommands(): CLICommand[] {
    return this.getAll();
  }

  dispose(): void {
    this._onDidChange.dispose();
  }
}
