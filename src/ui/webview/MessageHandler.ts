/**
 * Message handler for webview-to-extension communication.
 * Provides a registry pattern for handling different message commands.
 *
 * @example
 * ```typescript
 * const handler = new MessageHandler();
 * handler.register('saveData', async (data) => {
 *   await saveToStorage(data);
 * });
 *
 * // In webview message listener:
 * handler.handle(message); // Routes to appropriate handler
 * ```
 */
export class MessageHandler {
  private handlers: Map<string, (data: any) => void | Promise<void>> = new Map();

  /**
   * Register a handler for a specific command.
   *
   * @param command - Command name from webview message
   * @param handler - Handler function to execute
   */
  public register(command: string, handler: (data: any) => void | Promise<void>): void {
    this.handlers.set(command, handler);
  }

  /**
   * Unregister a handler for a command.
   *
   * @param command - Command name to unregister
   */
  public unregister(command: string): void {
    this.handlers.delete(command);
  }

  /**
   * Handle a message from the webview.
   * Routes to the appropriate registered handler.
   *
   * @param message - Message object with 'command' property
   * @returns True if a handler was found and executed, false otherwise
   */
  public handle(message: any): boolean {
    if (!message || !message.command) {
      return false;
    }

    const handler = this.handlers.get(message.command);
    if (!handler) {
      return false;
    }

    try {
      const result = handler(message);
      // Handle async handlers
      if (result instanceof Promise) {
        result.catch((error) => {
          console.error(`Error handling message '${message.command}':`, error);
        });
      }
      return true;
    } catch (error) {
      console.error(`Error handling message '${message.command}':`, error);
      return false;
    }
  }

  /**
   * Check if a handler is registered for a command.
   *
   * @param command - Command name to check
   */
  public has(command: string): boolean {
    return this.handlers.has(command);
  }

  /**
   * Clear all registered handlers.
   */
  public clear(): void {
    this.handlers.clear();
  }

  /**
   * Get all registered command names.
   */
  public getCommands(): string[] {
    return Array.from(this.handlers.keys());
  }
}
