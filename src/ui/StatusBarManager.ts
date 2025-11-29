/**
 * Status Bar Manager
 * Centralizes all status bar item management from extension.ts
 */

import * as vscode from 'vscode';
import { FocusService } from '../services/focus';
import { ActivityService } from '../services/activity';
import { TodoScannerService } from '../services/todoScanner';
import { formatTime } from '../utils/dateUtils';

/**
 * Manages all status bar items for the extension
 */
export class StatusBarManager implements vscode.Disposable {
  private focusStatusBar: vscode.StatusBarItem;
  private activityStatusBar?: vscode.StatusBarItem;
  private todoStatusBar: vscode.StatusBarItem;
  private sponsorStatusBar: vscode.StatusBarItem;

  constructor(
    private readonly focusService: FocusService,
    private readonly activityService: ActivityService,
    private readonly todoScanner: TodoScannerService
  ) {
    // Initialize status bars
    this.focusStatusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    this.focusStatusBar.command = 'cmdify.focus.showPanel';
    this.focusStatusBar.show();

    // Activity status bar (conditional)
    const activityConfig = this.activityService.getConfig();
    if (activityConfig.showInStatusBar) {
      this.activityStatusBar = vscode.window.createStatusBarItem(
        vscode.StatusBarAlignment.Right,
        99.5
      );
      this.activityStatusBar.command = 'cmdify.activity.showDashboard';
      this.activityStatusBar.show();
    }

    // TODO status bar
    this.todoStatusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 99);
    this.todoStatusBar.command = 'cmdify.todos.scan';
    this.todoStatusBar.show();

    // Sponsor status bar
    this.sponsorStatusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 50);
    this.sponsorStatusBar.text = '$(heart)';
    this.sponsorStatusBar.tooltip = 'Support Cmdify on Ko-fi';
    this.sponsorStatusBar.command = 'cmdify.sponsor';
    this.sponsorStatusBar.show();

    // Initial updates
    this.updateAll();
  }

  /**
   * Update all status bars
   */
  updateAll(): void {
    this.updateFocusStatusBar();
    this.updateActivityStatusBar();
    this.updateTodoStatusBar();
  }

  /**
   * Update focus timer status bar
   */
  updateFocusStatusBar(): void {
    const state = this.focusService.getState();
    const todayStats = this.activityService.getToday();
    const todaySessions = todayStats?.focusSessions || 0;

    let text = '';
    let color: string | undefined;

    switch (state.status) {
      case 'idle':
        text = `$(flame) ${todaySessions} sessions`;
        break;
      case 'focusing':
        text = `$(flame) ${formatTime(state.timeRemaining)}`;
        color = '#FF6B6B';
        break;
      case 'break':
        text = `$(coffee) ${formatTime(state.timeRemaining)}`;
        color = '#4ECDC4';
        break;
      case 'paused':
        text = `$(debug-pause) ${formatTime(state.timeRemaining)}`;
        color = '#FFA500';
        break;
    }

    this.focusStatusBar.text = text;
    this.focusStatusBar.color = color;
    this.focusStatusBar.tooltip = this.getFocusTooltip(state.status, todaySessions);
  }

  /**
   * Update activity status bar
   */
  updateActivityStatusBar(): void {
    if (!this.activityStatusBar) {
      return;
    }

    const stats = this.activityService.getStats();
    const goalProgress = Math.min(stats.todayGoalProgress, 100);

    this.activityStatusBar.text = `$(graph) ${goalProgress}%`;
    this.activityStatusBar.tooltip = `Daily Goal: ${goalProgress}%`;
  }

  /**
   * Update TODO status bar
   */
  updateTodoStatusBar(): void {
    const allTodos = this.todoScanner.getAllTodos();
    const overdueTodos = this.todoScanner.getOverdueTodos();

    let text = `$(checklist) ${allTodos.length}`;
    let color: string | undefined;

    if (overdueTodos.length > 0) {
      text = `$(alert) ${overdueTodos.length} overdue`;
      color = '#FF6B6B';
    }

    this.todoStatusBar.text = text;
    this.todoStatusBar.color = color;
    this.todoStatusBar.tooltip = `${allTodos.length} TODOs${overdueTodos.length > 0 ? `, ${overdueTodos.length} overdue` : ''}`;
  }

  /**
   * Get focus status bar tooltip
   */
  private getFocusTooltip(status: string, todaySessions: number): string {
    switch (status) {
      case 'idle':
        return `Focus Timer\n${todaySessions} sessions today\nClick to start`;
      case 'focusing':
        return 'Focus session in progress\nClick to view';
      case 'break':
        return 'Break time\nClick to view';
      case 'paused':
        return 'Timer paused\nClick to view';
      default:
        return 'Focus Timer';
    }
  }

  /**
   * Dispose all status bars
   */
  dispose(): void {
    this.focusStatusBar.dispose();
    this.activityStatusBar?.dispose();
    this.todoStatusBar.dispose();
    this.sponsorStatusBar.dispose();
  }
}
