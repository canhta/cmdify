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
   * Delete all commands
   */
  async deleteAll(): Promise<number> {
    const count = this.commands.size;
    this.commands.clear();
    await this.save();
    return count;
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
   * Get favorite commands
   */
  getFavorites(): CLICommand[] {
    return this.getAll()
      .filter((cmd) => cmd.isFavorite)
      .sort((a, b) => a.prompt.localeCompare(b.prompt));
  }

  /**
   * Toggle favorite status of a command
   */
  async toggleFavorite(id: string): Promise<boolean> {
    const command = this.commands.get(id);
    if (command) {
      command.isFavorite = !command.isFavorite;
      command.updatedAt = new Date().toISOString();
      await this.save();
      return command.isFavorite;
    }
    return false;
  }

  /**
   * Check for duplicate or similar commands
   * Returns the most similar command if found
   */
  findDuplicate(commandText: string, excludeId?: string): CLICommand | undefined {
    const normalizedNew = this.normalizeCommand(commandText);

    for (const cmd of this.commands.values()) {
      if (excludeId && cmd.id === excludeId) {
        continue;
      }

      const normalizedExisting = this.normalizeCommand(cmd.command);

      // Exact match
      if (normalizedNew === normalizedExisting) {
        return cmd;
      }

      // Similar match (Levenshtein distance based similarity)
      const similarity = this.calculateSimilarity(normalizedNew, normalizedExisting);
      if (similarity > 0.85) {
        return cmd;
      }
    }

    return undefined;
  }

  /**
   * Normalize command for comparison (remove extra whitespace, lowercase)
   */
  private normalizeCommand(command: string): string {
    return command.toLowerCase().replace(/\s+/g, ' ').trim();
  }

  /**
   * Calculate similarity between two strings (0-1)
   */
  private calculateSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;

    if (longer.length === 0) {
      return 1.0;
    }

    const distance = this.levenshteinDistance(longer, shorter);
    return (longer.length - distance) / longer.length;
  }

  /**
   * Calculate Levenshtein distance between two strings
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = [];

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  }

  /**
   * Fuzzy search commands with scoring
   */
  fuzzySearch(query: string): Array<{ command: CLICommand; score: number }> {
    if (!query.trim()) {
      return this.getAll().map((cmd) => ({ command: cmd, score: 1 }));
    }

    const lowerQuery = query.toLowerCase();
    const queryTerms = lowerQuery.split(/\s+/).filter((t) => t.length > 0);
    const results: Array<{ command: CLICommand; score: number }> = [];

    for (const cmd of this.commands.values()) {
      let score = 0;
      const searchText = `${cmd.prompt} ${cmd.command} ${cmd.tags.join(' ')}`.toLowerCase();

      // Exact match bonus
      if (searchText.includes(lowerQuery)) {
        score += 100;
      }

      // Term matching
      for (const term of queryTerms) {
        if (cmd.prompt.toLowerCase().includes(term)) {
          score += 50; // Prompt matches are most valuable
        }
        if (cmd.command.toLowerCase().includes(term)) {
          score += 30; // Command matches
        }
        if (cmd.tags.some((tag) => tag.toLowerCase().includes(term))) {
          score += 20; // Tag matches
        }
      }

      // Favorite bonus
      if (cmd.isFavorite) {
        score += 10;
      }

      // Usage bonus (max 20 points)
      score += Math.min(cmd.usageCount * 2, 20);

      if (score > 0) {
        results.push({ command: cmd, score });
      }
    }

    return results.sort((a, b) => b.score - a.score);
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
   * Get commands grouped by source
   */
  getGroupedBySource(): Map<string, CLICommand[]> {
    const groups = new Map<string, CLICommand[]>();

    for (const cmd of this.commands.values()) {
      const source = cmd.source || 'manual';
      const group = groups.get(source) || [];
      group.push(cmd);
      groups.set(source, group);
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
