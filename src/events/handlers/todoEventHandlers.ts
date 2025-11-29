/**
 * TODO Event Handlers
 * Handles all TODO scanner related events
 */

import * as vscode from 'vscode';
import { TodoScannerService } from '../../services/todoScanner';
import { CompanionService } from '../../services/companion';

export interface TodoEventHandlerDeps {
  todoScannerService: TodoScannerService;
  companionService: CompanionService;
  updateTodoStatusBar: () => void;
}

/**
 * Register all TODO event handlers
 */
export function registerTodoEventHandlers(
  context: vscode.ExtensionContext,
  deps: TodoEventHandlerDeps
): void {
  const { todoScannerService, companionService, updateTodoStatusBar } = deps;

  // TODO changes
  context.subscriptions.push(
    todoScannerService.onTodosChanged(() => {
      updateTodoStatusBar();
      const completedCount = todoScannerService.getCompletedTodos().length;
      companionService.updateTodoCount(completedCount);
    })
  );
}
