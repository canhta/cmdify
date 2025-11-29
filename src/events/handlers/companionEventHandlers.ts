/**
 * Companion Event Handlers
 * Handles all companion related events
 */

import * as vscode from 'vscode';
import { CompanionService } from '../../services/companion';

export interface CompanionEventHandlerDeps {
  companionService: CompanionService;
  updateFocusStatusBar: () => void;
}

/**
 * Register all companion event handlers
 */
export function registerCompanionEventHandlers(
  context: vscode.ExtensionContext,
  deps: CompanionEventHandlerDeps
): void {
  const { companionService, updateFocusStatusBar } = deps;

  // Companion state changes (affects status bar display)
  context.subscriptions.push(companionService.onStateChange(() => updateFocusStatusBar()));

  // Companion level up
  context.subscriptions.push(
    companionService.onLevelUp((level) => {
      companionService.showMessage('levelUp', { level });
      handleLevelUp(level, companionService);
    })
  );

  // Companion unlock
  context.subscriptions.push(companionService.onUnlock(handleUnlock));
}

/**
 * Handle companion level up
 */
async function handleLevelUp(newLevel: number, companionService: CompanionService): Promise<void> {
  const companionState = companionService.getState();
  const action = await vscode.window.showInformationMessage(
    `🎉 Level Up! Your ${companionState.type} is now Level ${newLevel}!`,
    'View Stats'
  );

  if (action === 'View Stats') {
    vscode.commands.executeCommand('cmdify.focus.showPanel');
  }
}

/**
 * Handle companion or accessory unlock
 */
async function handleUnlock({
  type,
  item,
}: {
  type: 'companion' | 'accessory';
  item: string;
}): Promise<void> {
  if (type === 'companion') {
    const action = await vscode.window.showInformationMessage(
      `🐾 New Companion Unlocked: ${item.charAt(0).toUpperCase() + item.slice(1)}!`,
      'Switch Now',
      'Later'
    );

    if (action === 'Switch Now') {
      await vscode.commands.executeCommand('cmdify.companion.switchType', item);
    }
  } else {
    vscode.window.showInformationMessage(`✨ New Accessory Unlocked: ${item}!`);
  }
}
