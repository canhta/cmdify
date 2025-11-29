/**
 * Extension Event Setup
 * Centralized event listener setup for the extension
 * Uses modular event handlers to reduce duplication
 */

import * as vscode from 'vscode';
import { StorageService } from '../services/storage';
import { FocusService } from '../services/focus';
import { CompanionService } from '../services/companion';
import { TodoScannerService } from '../services/todoScanner';
import { ActivityService } from '../services/activity';
import { AchievementService } from '../services/achievement';
import { OnboardingService } from '../services/onboarding';
import { OnboardingPanelProvider } from '../views/onboardingPanel';
import { AIProvider } from '../services/ai';
import { registerFocusEventHandlers } from './handlers/focusEventHandlers';
import { registerCompanionEventHandlers } from './handlers/companionEventHandlers';
import { registerTodoEventHandlers } from './handlers/todoEventHandlers';
import { registerStorageEventHandlers } from './handlers/storageEventHandlers';

/**
 * Services required for event setup
 */
export interface EventServices {
  storage: StorageService;
  focusService: FocusService;
  companionService: CompanionService;
  todoScannerService: TodoScannerService;
  activityService: ActivityService;
  achievementService: AchievementService;
  onboardingService: OnboardingService;
  onboardingPanelProvider: OnboardingPanelProvider;
}

/**
 * Callbacks for status bar updates
 */
export interface StatusBarCallbacks {
  updateFocusStatusBar: () => void;
  updateTodoStatusBar: () => void;
  updateActivityStatusBar: () => void;
}

/**
 * Callbacks for context updates
 */
export interface ContextCallbacks {
  updateNoCommandsContext: () => Promise<void>;
  updateAIConfiguredContext: () => Promise<void>;
  initializeAIProvider: () => Promise<AIProvider | undefined>;
  setAIProvider: (provider: AIProvider | undefined) => void;
}

/**
 * Setup all extension event listeners
 * Delegates to modular event handlers to reduce duplication
 */
export function setupExtensionEvents(
  context: vscode.ExtensionContext,
  services: EventServices,
  statusBarCallbacks: StatusBarCallbacks,
  contextCallbacks: ContextCallbacks
): void {
  const {
    storage,
    focusService,
    companionService,
    todoScannerService,
    activityService,
    achievementService,
    onboardingService,
    onboardingPanelProvider,
  } = services;

  // Register modular event handlers
  registerStorageEventHandlers(context, {
    storage,
    achievementService,
    updateNoCommandsContext: contextCallbacks.updateNoCommandsContext,
  });

  registerFocusEventHandlers(context, {
    focusService,
    companionService,
    activityService,
    achievementService,
    updateFocusStatusBar: statusBarCallbacks.updateFocusStatusBar,
  });

  registerCompanionEventHandlers(context, {
    companionService,
    updateFocusStatusBar: statusBarCallbacks.updateFocusStatusBar,
  });

  registerTodoEventHandlers(context, {
    todoScannerService,
    companionService,
    updateTodoStatusBar: statusBarCallbacks.updateTodoStatusBar,
  });

  // Achievement unlocks trigger companion message
  context.subscriptions.push(
    achievementService.onAchievementUnlocked((achievement) => {
      companionService.showMessage('achievementUnlock', { achievement: achievement.name });
    })
  );

  // Activity updates
  context.subscriptions.push(
    activityService.onActivityUpdate(() => statusBarCallbacks.updateActivityStatusBar())
  );

  // Configuration changes
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration(async (e) => {
      if (e.affectsConfiguration('cmdify.ai')) {
        const newProvider = await contextCallbacks.initializeAIProvider();
        contextCallbacks.setAIProvider(newProvider);
        await contextCallbacks.updateAIConfiguredContext();
      }
    })
  );

  // Initial workspace scan (delayed)
  setTimeout(() => {
    todoScannerService.scanWorkspace();
  }, 2000);

  // Check and show onboarding for new users (delayed)
  setTimeout(async () => {
    if (onboardingService.shouldShowOnboarding()) {
      await onboardingPanelProvider.show();
    }
  }, 1000);
}
