/**
 * Event Bus - Centralized Event Handling System
 * Provides type-safe event emission and subscription
 */

import * as vscode from 'vscode';

/**
 * Event handler function type
 */
export type EventHandler<T = any> = (data: T) => void | Promise<void>;

/**
 * Event subscription
 */
export interface EventSubscription {
  unsubscribe(): void;
}

/**
 * Event bus for decoupled communication between components
 */
export class EventBus implements vscode.Disposable {
  private static instance: EventBus | null = null;
  private listeners = new Map<string, Set<EventHandler>>();
  private eventEmitters = new Map<string, vscode.EventEmitter<any>>();

  private constructor() {}

  /**
   * Get the singleton instance
   */
  static getInstance(): EventBus {
    if (!EventBus.instance) {
      EventBus.instance = new EventBus();
    }
    return EventBus.instance;
  }

  /**
   * Reset the instance (for testing)
   */
  static reset(): void {
    if (EventBus.instance) {
      EventBus.instance.dispose();
      EventBus.instance = null;
    }
  }

  /**
   * Subscribe to an event
   */
  on<T = any>(event: string, handler: EventHandler<T>): EventSubscription {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }

    const handlers = this.listeners.get(event)!;
    handlers.add(handler);

    return {
      unsubscribe: () => {
        handlers.delete(handler);
        if (handlers.size === 0) {
          this.listeners.delete(event);
        }
      },
    };
  }

  /**
   * Subscribe to an event once (auto-unsubscribe after first emission)
   */
  once<T = any>(event: string, handler: EventHandler<T>): EventSubscription {
    const subscription = this.on(event, async (data: T) => {
      subscription.unsubscribe();
      await handler(data);
    });
    return subscription;
  }

  /**
   * Emit an event
   */
  async emit<T = any>(event: string, data?: T): Promise<void> {
    const handlers = this.listeners.get(event);
    if (!handlers || handlers.size === 0) {
      return;
    }

    // Call all handlers
    const promises: Array<void | Promise<void>> = [];
    for (const handler of handlers) {
      try {
        promises.push(handler(data));
      } catch (error) {
        console.error(`Error in event handler for "${event}":`, error);
      }
    }

    // Wait for all async handlers
    await Promise.all(promises);
  }

  /**
   * Emit an event synchronously (fire-and-forget, don't wait for handlers)
   */
  emitSync<T = any>(event: string, data?: T): void {
    const handlers = this.listeners.get(event);
    if (!handlers || handlers.size === 0) {
      return;
    }

    for (const handler of handlers) {
      try {
        void handler(data);
      } catch (error) {
        console.error(`Error in event handler for "${event}":`, error);
      }
    }
  }

  /**
   * Get a VS Code EventEmitter for an event
   * Useful for integrating with VS Code's event system
   */
  getVSCodeEmitter<T = any>(event: string): vscode.Event<T> {
    if (!this.eventEmitters.has(event)) {
      const emitter = new vscode.EventEmitter<T>();
      this.eventEmitters.set(event, emitter);

      // Bridge our event bus to VS Code's emitter
      this.on(event, (data: T) => emitter.fire(data));
    }

    return this.eventEmitters.get(event)!.event;
  }

  /**
   * Remove all listeners for an event
   */
  off(event: string): void {
    this.listeners.delete(event);
    const emitter = this.eventEmitters.get(event);
    if (emitter) {
      emitter.dispose();
      this.eventEmitters.delete(event);
    }
  }

  /**
   * Get the number of listeners for an event
   */
  listenerCount(event: string): number {
    return this.listeners.get(event)?.size || 0;
  }

  /**
   * Check if an event has any listeners
   */
  hasListeners(event: string): boolean {
    return this.listenerCount(event) > 0;
  }

  /**
   * Get all registered event names
   */
  getEventNames(): string[] {
    return Array.from(this.listeners.keys());
  }

  /**
   * Dispose all listeners and emitters
   */
  dispose(): void {
    this.listeners.clear();
    for (const emitter of this.eventEmitters.values()) {
      emitter.dispose();
    }
    this.eventEmitters.clear();
  }
}

/**
 * Event names - centralized definition
 */
export const EventNames = {
  // Storage events
  STORAGE_CHANGED: 'storage:changed',
  COMMAND_ADDED: 'command:added',
  COMMAND_UPDATED: 'command:updated',
  COMMAND_DELETED: 'command:deleted',

  // Focus events
  FOCUS_TICK: 'focus:tick',
  FOCUS_STATE_CHANGED: 'focus:stateChanged',
  FOCUS_STARTED: 'focus:started',
  FOCUS_PAUSED: 'focus:paused',
  FOCUS_RESUMED: 'focus:resumed',
  FOCUS_STOPPED: 'focus:stopped',
  FOCUS_SESSION_COMPLETE: 'focus:sessionComplete',
  FOCUS_BREAK_START: 'focus:breakStart',

  // Companion events
  COMPANION_STATE_CHANGED: 'companion:stateChanged',
  COMPANION_LEVEL_UP: 'companion:levelUp',
  COMPANION_UNLOCK: 'companion:unlock',
  COMPANION_MESSAGE: 'companion:message',

  // TODO events
  TODOS_CHANGED: 'todos:changed',
  TODO_COMPLETED: 'todo:completed',
  TODO_ADDED: 'todo:added',
  TODO_UPDATED: 'todo:updated',
  TODO_DELETED: 'todo:deleted',
  TODOS_SCAN_STARTED: 'todos:scanStarted',
  TODOS_SCAN_COMPLETED: 'todos:scanCompleted',

  // Activity events
  ACTIVITY_UPDATED: 'activity:updated',
  ACTIVITY_SESSION_RECORDED: 'activity:sessionRecorded',

  // Achievement events
  ACHIEVEMENT_UNLOCKED: 'achievement:unlocked',
  ACHIEVEMENT_PROGRESS: 'achievement:progress',

  // Notes events
  NOTE_ADDED: 'note:added',
  NOTE_UPDATED: 'note:updated',
  NOTE_DELETED: 'note:deleted',

  // Configuration events
  CONFIG_CHANGED: 'config:changed',
  AI_CONFIG_CHANGED: 'config:ai:changed',
} as const;

/**
 * Helper to create a typed event subscriber
 */
export function createTypedEvent<T = void>(eventName: string) {
  const bus = EventBus.getInstance();

  return {
    /**
     * Emit the event
     */
    emit: (data: T) => bus.emit(eventName, data),

    /**
     * Emit the event synchronously
     */
    emitSync: (data: T) => bus.emitSync(eventName, data),

    /**
     * Subscribe to the event
     */
    on: (handler: EventHandler<T>) => bus.on(eventName, handler),

    /**
     * Subscribe to the event once
     */
    once: (handler: EventHandler<T>) => bus.once(eventName, handler),

    /**
     * Get VS Code event
     */
    asVSCodeEvent: () => bus.getVSCodeEmitter<T>(eventName),
  };
}
