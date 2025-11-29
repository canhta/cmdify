import * as vscode from 'vscode';
import { CLICommand, getDisplayName } from '../models/command';
import { CommandTreeItem, TreeItemType } from '../models/types';
import { StorageService } from '../services/storage';
import { COMMAND_SOURCE_THEME_ICONS, CATEGORY_THEME_ICONS } from '../utils/icons';

/**
 * Tree data provider for the commands sidebar
 */
export class CommandsTreeProvider implements vscode.TreeDataProvider<CommandTreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<
    CommandTreeItem | undefined | null | void
  >();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  constructor(private storage: StorageService) {
    // Refresh when storage changes
    storage.onDidChange(() => this.refresh());
  }

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: CommandTreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: CommandTreeItem): Thenable<CommandTreeItem[]> {
    if (!element) {
      return Promise.resolve(this.getRootItems());
    }

    if (element.itemType === 'favorites') {
      return Promise.resolve(this.getFavoriteCommands());
    }

    if (element.itemType === 'mostUsed') {
      return Promise.resolve(this.getMostUsedCommandItems());
    }

    if (element.itemType === 'recent') {
      return Promise.resolve(this.getRecentCommands());
    }

    if (element.itemType === 'tag' && element.tagName) {
      return Promise.resolve(this.getCommandsByTag(element.tagName));
    }

    if (element.itemType === 'source' && element.sourceName) {
      return Promise.resolve(this.getCommandsBySource(element.sourceName));
    }

    return Promise.resolve([]);
  }

  private getRootItems(): CommandTreeItem[] {
    const config = vscode.workspace.getConfiguration('cmdify.view');
    const showRecent = config.get<boolean>('showRecent', true);
    const showFavorites = config.get<boolean>('showFavorites', true);
    const showMostUsed = config.get<boolean>('showMostUsed', true);
    const groupBy = config.get<string>('groupBy', 'tags');

    const items: CommandTreeItem[] = [];

    // Favorites section
    if (showFavorites) {
      const favoritesCount = this.storage.getFavorites().length;
      if (favoritesCount > 0) {
        items.push(
          this.createCategoryItem(
            'Favorites',
            'favorites',
            favoritesCount,
            CATEGORY_THEME_ICONS['favorites']
          )
        );
      }
    }

    // Most Used section (Phase 4)
    if (showMostUsed) {
      const mostUsed = this.getMostUsedCommands();
      if (mostUsed.length > 0) {
        items.push(
          this.createCategoryItem(
            'Most Used',
            'mostUsed',
            mostUsed.length,
            CATEGORY_THEME_ICONS['mostUsed']
          )
        );
      }
    }

    // Recent section
    if (showRecent) {
      const recentCount = this.storage.getRecent().length;
      if (recentCount > 0) {
        items.push(
          this.createCategoryItem('Recent', 'recent', recentCount, CATEGORY_THEME_ICONS['recent'])
        );
      }
    }

    // Group by tags, source, or show flat list
    if (groupBy === 'tags') {
      const grouped = this.storage.getGroupedByTag();
      const sortedTags = Array.from(grouped.keys()).sort();

      for (const tag of sortedTags) {
        const count = grouped.get(tag)?.length || 0;
        items.push(this.createCategoryItem(tag, 'tag', count, CATEGORY_THEME_ICONS['tag'], tag));
      }
    } else if (groupBy === 'source') {
      const grouped = this.storage.getGroupedBySource();
      const sourceOrder = ['ai', 'manual', 'imported', 'shared'];
      const sourceLabels: Record<string, string> = {
        ai: 'AI Generated',
        manual: 'Manual',
        imported: 'Imported',
        shared: 'Shared',
      };

      for (const source of sourceOrder) {
        const commands = grouped.get(source);
        if (commands && commands.length > 0) {
          items.push(
            this.createCategoryItem(
              sourceLabels[source] || source,
              'source' as TreeItemType,
              commands.length,
              COMMAND_SOURCE_THEME_ICONS[source] || COMMAND_SOURCE_THEME_ICONS['DEFAULT'],
              undefined,
              source
            )
          );
        }
      }
    } else {
      // Flat list (none)
      const commands = this.storage.getAll();
      for (const cmd of commands) {
        items.push(this.createCommandItem(cmd));
      }
    }

    // Show welcome message if no commands
    if (items.length === 0) {
      const welcomeItem: CommandTreeItem = {
        label: 'Create your first command',
        itemType: 'command',
        iconPath: new vscode.ThemeIcon('add'),
        command: {
          command: 'cmdify.create',
          title: 'Create Command',
        },
        collapsibleState: vscode.TreeItemCollapsibleState.None,
      };
      items.push(welcomeItem);
    }

    return items;
  }

  // Phase 4: Get most used commands (top 5)
  private getMostUsedCommands(): CLICommand[] {
    return this.storage
      .getAll()
      .filter((cmd) => cmd.usageCount > 0)
      .sort((a, b) => b.usageCount - a.usageCount)
      .slice(0, 5);
  }

  // Phase 4: Get commands by most used
  private getMostUsedCommandItems(): CommandTreeItem[] {
    return this.getMostUsedCommands().map((cmd) => this.createCommandItem(cmd));
  }

  private getFavoriteCommands(): CommandTreeItem[] {
    const favorites = this.storage.getFavorites();
    return favorites.map((cmd) => this.createCommandItem(cmd));
  }

  private getRecentCommands(): CommandTreeItem[] {
    const config = vscode.workspace.getConfiguration('cmdify.view');
    const recentCount = config.get<number>('recentCount', 5);
    const recent = this.storage.getRecent(recentCount);
    return recent.map((cmd) => this.createCommandItem(cmd));
  }

  private getCommandsByTag(tag: string): CommandTreeItem[] {
    const grouped = this.storage.getGroupedByTag();
    const commands = grouped.get(tag) || [];
    return commands.map((cmd) => this.createCommandItem(cmd));
  }

  private getCommandsBySource(source: string): CommandTreeItem[] {
    const grouped = this.storage.getGroupedBySource();
    const commands = grouped.get(source) || [];
    return commands.map((cmd) => this.createCommandItem(cmd));
  }

  private createCategoryItem(
    label: string,
    itemType: TreeItemType,
    count: number,
    icon: string,
    tagName?: string,
    sourceName?: string
  ): CommandTreeItem {
    const displayLabel = tagName === 'untagged' ? 'Untagged' : label;
    return {
      label: displayLabel,
      description: `${count}`,
      itemType,
      tagName,
      sourceName,
      collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
      iconPath: new vscode.ThemeIcon(icon),
      contextValue: 'category',
    };
  }

  private createCommandItem(cmd: CLICommand): CommandTreeItem {
    const displayLabel = cmd.isFavorite
      ? `$(star-full) ${getDisplayName(cmd)}`
      : getDisplayName(cmd);

    const item: CommandTreeItem = {
      label: displayLabel,
      tooltip: new vscode.MarkdownString(this.formatTooltip(cmd)),
      description: this.getCommandDescription(cmd),
      itemType: 'command',
      commandData: cmd,
      collapsibleState: vscode.TreeItemCollapsibleState.None,
      iconPath: new vscode.ThemeIcon(this.getCommandIcon(cmd)),
      contextValue: cmd.isFavorite ? 'commandFavorite' : 'command',
    };

    return item;
  }

  private formatTooltip(cmd: CLICommand): string {
    const lines = [`**${cmd.prompt}**`, '', '```', cmd.command, '```'];

    if (cmd.tags.length > 0) {
      lines.push('', `Tags: ${cmd.tags.join(', ')}`);
    }

    if (cmd.usageCount > 0) {
      lines.push(`Used ${cmd.usageCount} times`);
    }

    if (cmd.lastUsedAt) {
      const lastUsed = new Date(cmd.lastUsedAt);
      lines.push(`Last used: ${this.formatRelativeTime(lastUsed)}`);
    }

    return lines.join('\n');
  }

  private getCommandDescription(cmd: CLICommand): string {
    const parts: string[] = [];

    // Show truncated command preview
    const preview = this.truncateCommand(cmd.command, 30);
    parts.push(preview);

    // Add source icon
    switch (cmd.source) {
      case 'ai':
        parts.push('$(sparkle)');
        break;
      case 'shared':
        parts.push('$(cloud)');
        break;
      case 'imported':
        parts.push('$(cloud-download)');
        break;
    }

    return parts.join('  ');
  }

  private truncateCommand(command: string, maxLength: number): string {
    // Get first line only
    const firstLine = command.split('\n')[0].trim();
    if (firstLine.length <= maxLength) {
      return firstLine;
    }
    return firstLine.substring(0, maxLength - 1) + '…';
  }

  private getCommandIcon(cmd: CLICommand): string {
    const command = cmd.command.toLowerCase();

    // Git commands
    if (command.startsWith('git ')) {
      if (command.includes('commit')) {
        return 'git-commit';
      }
      if (command.includes('push') || command.includes('pull')) {
        return 'git-pull-request';
      }
      if (command.includes('branch') || command.includes('checkout')) {
        return 'git-branch';
      }
      if (command.includes('merge')) {
        return 'git-merge';
      }
      if (command.includes('stash')) {
        return 'git-stash';
      }
      return 'git-commit';
    }

    // Package managers
    if (/^(npm|yarn|pnpm|bun)\s/.test(command)) {
      return 'package';
    }

    // Docker/containers
    if (/^(docker|podman|kubectl|k8s)\s/.test(command)) {
      return 'server';
    }

    // File operations
    if (/^(cp|mv|rm|mkdir|touch|chmod|chown)\s/.test(command)) {
      return 'file';
    }

    // Directory/navigation
    if (/^(cd|ls|dir|find|tree)\s/.test(command)) {
      return 'folder';
    }

    // Network/web
    if (/^(curl|wget|ssh|scp|ping|netstat)\s/.test(command)) {
      return 'globe';
    }

    // Python
    if (/^(python|pip|python3|pip3)\s/.test(command)) {
      return 'symbol-misc';
    }

    // Build tools
    if (/^(make|cmake|cargo|go|rustc|gcc|javac)\s/.test(command)) {
      return 'tools';
    }

    // Text processing
    if (/^(cat|grep|awk|sed|head|tail|less|more)\s/.test(command)) {
      return 'output';
    }

    // System
    if (/^(sudo|apt|brew|yum|dnf|pacman)\s/.test(command)) {
      return 'settings-gear';
    }

    return 'terminal';
  }

  private formatRelativeTime(date: Date): string {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) {
      const hours = Math.floor(diff / (1000 * 60 * 60));
      if (hours === 0) {
        const minutes = Math.floor(diff / (1000 * 60));
        if (minutes === 0) {
          return 'just now';
        }
        return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
      }
      return `${hours} hour${hours === 1 ? '' : 's'} ago`;
    }

    if (days === 1) {
      return 'yesterday';
    }

    if (days < 7) {
      return `${days} days ago`;
    }

    if (days < 30) {
      const weeks = Math.floor(days / 7);
      return `${weeks} week${weeks === 1 ? '' : 's'} ago`;
    }

    const months = Math.floor(days / 30);
    return `${months} month${months === 1 ? '' : 's'} ago`;
  }

  dispose(): void {
    this._onDidChangeTreeData.dispose();
  }
}
