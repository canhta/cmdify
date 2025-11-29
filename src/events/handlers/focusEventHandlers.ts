/**
 * Focus Timer Event Handlers
 * Handles all focus timer related events
 */

import * as vscode from 'vscode';
import { FocusService } from '../../services/focus';
import { CompanionService } from '../../services/companion';
import { ActivityService } from '../../services/activity';
import { AchievementService } from '../../services/achievement';
import { getBreakSuggestion } from '../../models/companion';

export interface FocusEventHandlerDeps {
  focusService: FocusService;
  companionService: CompanionService;
  activityService: ActivityService;
  achievementService: AchievementService;
  updateFocusStatusBar: () => void;
}

/**
 * Register all focus timer event handlers
 */
export function registerFocusEventHandlers(
  context: vscode.ExtensionContext,
  deps: FocusEventHandlerDeps
): void {
  const {
    focusService,
    companionService,
    activityService,
    achievementService,
    updateFocusStatusBar,
  } = deps;

  // Focus timer tick
  context.subscriptions.push(focusService.onTick(() => updateFocusStatusBar()));

  // Focus state changes
  context.subscriptions.push(
    focusService.onStateChange(() => {
      updateFocusStatusBar();
    })
  );

  // Focus start
  context.subscriptions.push(
    focusService.onFocusStart(() => {
      companionService.showMessage('focusStart');
    })
  );

  // Focus session completion
  context.subscriptions.push(
    focusService.onSessionComplete(async () => {
      companionService.showMessage('focusComplete');
      await handleFocusSessionComplete(
        focusService,
        activityService,
        companionService,
        achievementService
      );
    })
  );

  // Break start
  context.subscriptions.push(
    focusService.onBreakStart(async () => {
      const focusState = focusService.getState();
      const breakDuration = Math.round(focusState.timeRemaining / 60);
      const suggestion = getBreakSuggestion(breakDuration);

      vscode.window.showInformationMessage(
        `☕ Time for a break! (${breakDuration} min)\n${suggestion}`
      );

      await companionService.awardXP(25, 'breakTaken');
    })
  );
}

/**
 * Handle focus session completion
 */
async function handleFocusSessionComplete(
  focusService: FocusService,
  activityService: ActivityService,
  companionService: CompanionService,
  achievementService: AchievementService
): Promise<void> {
  const focusConfig = focusService.getConfig();
  await activityService.recordFocusSession(focusConfig.focusDuration);
  await companionService.awardXP(100, 'focusSessionComplete');

  const stats = activityService.getStats();
  await achievementService.checkFocusAchievements(stats.totalSessions);

  const today = activityService.getToday();
  if (today) {
    await achievementService.trackDailySessions(today.focusSessions);
  }

  if (stats.todayGoalProgress >= 100 && !activityService.hasDailyGoalBonusAwarded()) {
    await companionService.awardXP(200, 'dailyGoalReached');
    await activityService.markDailyGoalBonusAwarded();
  }

  // Check for near-completion achievements
  await achievementService.checkNearCompletionNotifications();
}
