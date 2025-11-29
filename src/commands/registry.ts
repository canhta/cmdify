/**
 * Command Registry
 * Centralized command registration and management
 */

import * as vscode from 'vscode';

/**
 * Command definition with handler
 */
export interface CommandDefinition {
  /** Command ID (e.g., 'cmdify.create') */
  id: string;
  /** Command handler function - uses any to match VS Code's command handler type */
  handler: (...args: any[]) => any;
}

/**
 * Command group for organizing related commands
 */
export interface CommandGroup {
  /** Group name for documentation */
  name: string;
  /** Commands in this group */
  commands: CommandDefinition[];
}

/**
 * Command Registry
 * Manages command registration and disposal
 */
export class CommandRegistry implements vscode.Disposable {
  private disposables: vscode.Disposable[] = [];
  private registeredCommands: Set<string> = new Set();

  /**
   * Register a single command
   */
  register(command: CommandDefinition): void {
    if (this.registeredCommands.has(command.id)) {
      console.warn(`Command ${command.id} is already registered`);
      return;
    }

    const disposable = vscode.commands.registerCommand(command.id, command.handler);
    this.disposables.push(disposable);
    this.registeredCommands.add(command.id);
  }

  /**
   * Register multiple commands at once
   */
  registerAll(commands: CommandDefinition[]): void {
    for (const command of commands) {
      this.register(command);
    }
  }

  /**
   * Register a group of commands
   */
  registerGroup(group: CommandGroup): void {
    this.registerAll(group.commands);
  }

  /**
   * Register multiple groups
   */
  registerGroups(groups: CommandGroup[]): void {
    for (const group of groups) {
      this.registerGroup(group);
    }
  }

  /**
   * Get all registered command IDs
   */
  getRegisteredCommands(): string[] {
    return Array.from(this.registeredCommands);
  }

  /**
   * Check if a command is registered
   */
  isRegistered(commandId: string): boolean {
    return this.registeredCommands.has(commandId);
  }

  /**
   * Dispose all registered commands
   */
  dispose(): void {
    for (const disposable of this.disposables) {
      disposable.dispose();
    }
    this.disposables = [];
    this.registeredCommands.clear();
  }
}

/**
 * Create command definition helper
 */
export function defineCommand(id: string, handler: (...args: any[]) => any): CommandDefinition {
  return { id, handler };
}

/**
 * Create command group helper
 */
export function defineCommandGroup(name: string, commands: CommandDefinition[]): CommandGroup {
  return { name, commands };
}
