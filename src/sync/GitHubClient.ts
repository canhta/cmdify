/**
 * GitHub Client
 * Handles GitHub API interactions for Gist-based sync
 */

import * as vscode from 'vscode';
import { CLICommand } from '../models/command';

const GIST_FILENAME = 'cmdify-commands.json';

/**
 * Sync payload structure stored in Gist
 */
export interface SyncPayload {
  version: string;
  commands: CLICommand[];
  exportedAt: string;
  syncVersion?: number;
}

/**
 * GitHub Gist response type
 */
interface GistResponse {
  id: string;
  files: Record<string, { content: string }>;
}

/**
 * GitHub Client for Gist operations
 */
export class GitHubClient {
  private gistId?: string;

  constructor(private readonly context: vscode.ExtensionContext) {
    this.gistId = context.globalState.get('cmdify.gistId');
  }

  /**
   * Authenticate with GitHub
   */
  async authenticate(): Promise<vscode.AuthenticationSession | undefined> {
    try {
      const session = await vscode.authentication.getSession('github', ['gist'], {
        createIfNone: true,
      });
      return session;
    } catch (error) {
      vscode.window.showErrorMessage('Failed to authenticate with GitHub.');
      return undefined;
    }
  }

  /**
   * Get current Gist ID
   */
  getGistId(): string | undefined {
    return this.gistId;
  }

  /**
   * Check if we have a configured Gist
   */
  hasGist(): boolean {
    return !!this.gistId;
  }

  /**
   * Create a new gist
   */
  async createGist(token: string, payload: SyncPayload): Promise<void> {
    const response = await fetch('https://api.github.com/gists', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/vnd.github+json',
      },
      body: JSON.stringify({
        description: 'Cmdify - Synced Commands',
        public: false,
        files: {
          [GIST_FILENAME]: {
            content: JSON.stringify(payload, null, 2),
          },
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status}`);
    }

    const data = (await response.json()) as GistResponse;
    this.gistId = data.id;
    await this.context.globalState.update('cmdify.gistId', this.gistId);
  }

  /**
   * Update existing gist
   */
  async updateGist(token: string, payload: SyncPayload): Promise<void> {
    if (!this.gistId) {
      return this.createGist(token, payload);
    }

    const response = await fetch(`https://api.github.com/gists/${this.gistId}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/vnd.github+json',
      },
      body: JSON.stringify({
        files: {
          [GIST_FILENAME]: {
            content: JSON.stringify(payload, null, 2),
          },
        },
      }),
    });

    if (!response.ok) {
      // Gist might have been deleted, try creating new one
      if (response.status === 404) {
        this.gistId = undefined;
        await this.context.globalState.update('cmdify.gistId', undefined);
        return this.createGist(token, payload);
      }
      throw new Error(`GitHub API error: ${response.status}`);
    }
  }

  /**
   * Fetch gist content
   */
  async fetchGist(token: string): Promise<SyncPayload | undefined> {
    if (!this.gistId) {
      return undefined;
    }

    const response = await fetch(`https://api.github.com/gists/${this.gistId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        this.gistId = undefined;
        await this.context.globalState.update('cmdify.gistId', undefined);
        return undefined;
      }
      throw new Error(`GitHub API error: ${response.status}`);
    }

    const data = (await response.json()) as GistResponse;
    const content = data.files?.[GIST_FILENAME]?.content;

    if (!content) {
      return undefined;
    }

    return JSON.parse(content) as SyncPayload;
  }

  /**
   * Find existing Cmdify gist
   */
  async findExistingGist(token: string): Promise<boolean> {
    const response = await fetch('https://api.github.com/gists', {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
      },
    });

    if (!response.ok) {
      return false;
    }

    const gists = (await response.json()) as Array<{
      id: string;
      files: Record<string, unknown>;
    }>;
    const existing = gists.find((g) => GIST_FILENAME in g.files);

    if (existing) {
      this.gistId = existing.id;
      await this.context.globalState.update('cmdify.gistId', this.gistId);
      return true;
    }

    return false;
  }

  /**
   * Clear stored Gist ID
   */
  async clearGistId(): Promise<void> {
    this.gistId = undefined;
    await this.context.globalState.update('cmdify.gistId', undefined);
  }
}
