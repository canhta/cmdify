/**
 * Git Contributor Service
 * Fetches contributors from git repositories in the workspace
 */

import * as vscode from 'vscode';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Contributor information
 */
export interface Contributor {
  name: string;
  email: string;
  commits: number;
}

/**
 * Git Contributor Service
 */
export class GitContributorService {
  private contributorsCache: Map<string, Contributor[]> = new Map();
  private cacheExpiry: Map<string, number> = new Map();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  /**
   * Get contributors for a workspace folder
   */
  async getContributors(workspaceFolder?: string): Promise<Contributor[]> {
    const folder = workspaceFolder || this.getDefaultWorkspaceFolder();
    if (!folder) {
      return [];
    }

    // Check cache
    const cached = this.contributorsCache.get(folder);
    const expiry = this.cacheExpiry.get(folder) || 0;
    if (cached && Date.now() < expiry) {
      return cached;
    }

    try {
      // Use git shortlog to get contributors with commit counts
      const { stdout } = await execAsync('git shortlog -sne HEAD --all', {
        cwd: folder,
        maxBuffer: 1024 * 1024,
      });

      const contributors = this.parseGitShortlog(stdout);

      // Update cache
      this.contributorsCache.set(folder, contributors);
      this.cacheExpiry.set(folder, Date.now() + this.CACHE_TTL);

      return contributors;
    } catch (error) {
      console.warn('Failed to fetch git contributors:', error);
      return [];
    }
  }

  /**
   * Parse git shortlog output
   * Format: "   123\tName <email>"
   */
  private parseGitShortlog(output: string): Contributor[] {
    const lines = output
      .trim()
      .split('\n')
      .filter((l) => l.trim());
    const contributors: Contributor[] = [];

    for (const line of lines) {
      // Match: "   123\tName <email@example.com>"
      const match = line.match(/^\s*(\d+)\s+(.+?)\s*<(.+?)>\s*$/);
      if (match) {
        contributors.push({
          commits: parseInt(match[1], 10),
          name: match[2].trim(),
          email: match[3].trim(),
        });
      }
    }

    // Sort by commit count descending
    contributors.sort((a, b) => b.commits - a.commits);

    return contributors;
  }

  /**
   * Get the default workspace folder
   */
  private getDefaultWorkspaceFolder(): string | undefined {
    const folders = vscode.workspace.workspaceFolders;
    return folders?.[0]?.uri.fsPath;
  }

  /**
   * Get contributor names for quick pick
   */
  async getContributorQuickPickItems(): Promise<vscode.QuickPickItem[]> {
    const contributors = await this.getContributors();

    if (contributors.length === 0) {
      return [
        {
          label: '$(person) No contributors found',
          description: 'This may not be a git repository',
          detail: 'You can still enter a name manually',
        },
      ];
    }

    return contributors.map((c) => ({
      label: `$(person) ${c.name}`,
      description: c.email,
      detail: `${c.commits} commit${c.commits !== 1 ? 's' : ''}`,
    }));
  }

  /**
   * Clear the cache
   */
  clearCache(): void {
    this.contributorsCache.clear();
    this.cacheExpiry.clear();
  }
}

// Singleton instance
let gitContributorService: GitContributorService | undefined;

/**
 * Get the singleton GitContributorService instance
 */
export function getGitContributorService(): GitContributorService {
  if (!gitContributorService) {
    gitContributorService = new GitContributorService();
  }
  return gitContributorService;
}
