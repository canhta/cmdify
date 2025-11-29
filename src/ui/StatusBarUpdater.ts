/**
 * Status Bar Updater
 * Centralized status bar update logic
 */

import * as vscode from 'vscode';
import { FocusService } from '../services/focus';
import { CompanionService } from '../services/companion';
import { TodoScannerService } from '../services/todoScanner';
import { ActivityService } from '../services/activity';
import { COMPANION_ICONS } from '../models/companion';
import { formatTime } from '../utils/dateUtils';

/**
 * Status bar items managed by this updater
 */
export interface StatusBarItems {
  focus: vscode.StatusBarItem;
  todo: vscode.StatusBarItem;
  activity?: vscode.StatusBarItem;
  sponsor: vscode.StatusBarItem;
}

/**
 * Services required for status bar updates
 */
export interface StatusBarServices {
  focusService: FocusService;
  companionService: CompanionService;
  todoScannerService: TodoScannerService;
  activityService: ActivityService;
}

/**
 * Create all status bar items
 */
export function createStatusBarItems(activityService: ActivityService): StatusBarItems {
  // Focus Timer Status Bar
  const focus = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  focus.command = 'cmdify.focus.showPanel';
  focus.show();

  // Activity Status Bar (conditional)
  let activity: vscode.StatusBarItem | undefined;
  const activityConfig = activityService.getConfig();
  if (activityConfig.showInStatusBar) {
    activity = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 99.5);
    activity.command = 'cmdify.activity.showDashboard';
    activity.show();
  }

  // TODO Status Bar
  const todo = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 99);
  todo.command = 'cmdify.todos.scan';
  todo.show();

  // Sponsor Status Bar
  const sponsor = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 50);
  sponsor.text = '$(heart)';
  sponsor.tooltip = 'Support Cmdify on Ko-fi';
  sponsor.command = 'cmdify.sponsor';
  sponsor.show();

  return { focus, todo, activity, sponsor };
}

/**
 * Update focus status bar
 */
export function updateFocusStatusBar(
  item: vscode.StatusBarItem,
  focusService: FocusService,
  companionService: CompanionService
): void {
  const focusState = focusService.getState();
  const companionState = companionService.getState();
  const stats = focusService.getStats();

  const icons = COMPANION_ICONS[companionState.type];
  const icon = icons[focusState.status] || icons.idle;

  let text = '';

  if (focusState.status === 'focusing') {
    text = `${icon} ${formatTime(focusState.timeRemaining)}`;
    item.command = 'cmdify.focus.pause';
  } else if (focusState.status === 'break') {
    text = `${icon} Break ${formatTime(focusState.timeRemaining)}`;
    item.command = 'cmdify.focus.skip';
  } else if (focusState.status === 'paused') {
    text = `${icon} Paused ${formatTime(focusState.timeRemaining)}`;
    item.command = 'cmdify.focus.resume';
  } else {
    text = `$(play) Start`;
    item.command = 'cmdify.focus.start';
  }

  if (stats.currentStreak > 0) {
    text += ` $(zap)${stats.currentStreak}`;
  }

  item.text = text;
  item.tooltip = getFocusTooltip(focusState.status, focusState.todaySessions);
}

/**
 * Update TODO status bar
 */
export function updateTodoStatusBar(
  item: vscode.StatusBarItem,
  todoScannerService: TodoScannerService
): void {
  const openCount = todoScannerService.getOpenCount();
  const dueCount = todoScannerService.getDueCount();

  if (openCount === 0) {
    item.text = '$(checklist) 0';
    item.tooltip = 'No TODOs found - Click to scan workspace';
  } else if (dueCount > 0) {
    item.text = `$(checklist) ${openCount} $(warning) ${dueCount}`;
    item.tooltip = `${openCount} TODOs (${dueCount} due/overdue) - Click to scan`;
  } else {
    item.text = `$(checklist) ${openCount}`;
    item.tooltip = `${openCount} TODOs - Click to scan workspace`;
  }
}

/**
 * Update activity status bar
 */
export function updateActivityStatusBar(
  item: vscode.StatusBarItem | undefined,
  activityService: ActivityService
): void {
  if (!item) {
    return;
  }

  item.text = `$(clock) ${activityService.getStatusBarText()}`;
  item.tooltip = activityService.getStatusBarTooltip();
}

/**
 * Get focus tooltip text
 */
function getFocusTooltip(status: string, todaySessions: number): string {
  const statusMessages: Record<string, string> = {
    focusing: 'Click to pause',
    break: 'Click to skip break',
    paused: 'Click to resume',
    idle: 'Click to start focus',
  };

  return [
    `Focus Timer - ${statusMessages[status] || statusMessages.idle}`,
    `${todaySessions} sessions today`,
  ].join('\n');
}
