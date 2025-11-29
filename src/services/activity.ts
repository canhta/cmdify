/**
 * Activity Tracking Service
 * Tracks VS Code usage time and language breakdown
 * Privacy-focused: only tracks aggregated data, no file names or content
 */

import * as vscode from 'vscode';
import {
  DailyActivity,
  ActivityStats,
  ActivityConfig,
  DEFAULT_ACTIVITY_CONFIG,
  DEFAULT_DAILY_ACTIVITY,
  ACTIVITY_STORAGE_KEYS,
  ACTIVITY_TRACKING_INTERVAL,
  ACTIVITY_HISTORY_DAYS,
} from '../models/activity';
import { getTodayString, formatDateString } from '../utils/dateUtils';

/**
 * Activity Tracking Service
 * Monitors VS Code usage and provides productivity insights
 */
export class ActivityService implements vscode.Disposable {
  private currentDay: DailyActivity;
  private history: DailyActivity[] = [];
  private lastActiveTime: number | null = null;
  private trackingInterval: ReturnType<typeof setInterval> | null = null;
  private config: ActivityConfig;
  private editedFilesSet: Set<string> = new Set();
  private disposables: vscode.Disposable[] = [];

  // Event emitters
  private readonly _onActivityUpdate = new vscode.EventEmitter<DailyActivity>();
  readonly onActivityUpdate = this._onActivityUpdate.event;

  constructor(private readonly context: vscode.ExtensionContext) {
    this.config = this.loadConfig();
    this.currentDay = this.loadCurrentDay();
    this.history = this.loadHistory();

    // Check if we need to roll over to a new day
    this.checkNewDay();

    // Start tracking if enabled
    if (this.config.enabled) {
      this.startTracking();
    }

    // Listen for config changes
    this.disposables.push(
      vscode.workspace.onDidChangeConfiguration((e) => {
        if (e.affectsConfiguration('cmdify.activity')) {
          const wasEnabled = this.config.enabled;
          this.config = this.loadConfig();

          if (this.config.enabled && !wasEnabled) {
            this.startTracking();
          } else if (!this.config.enabled && wasEnabled) {
            this.stopTracking();
          }
        }
      })
    );

    // Listen for file save events
    this.disposables.push(
      vscode.workspace.onDidSaveTextDocument((doc) => {
        if (this.config.enabled) {
          this.onFileSave(doc);
        }
      })
    );

    // Listen for active editor changes
    this.disposables.push(
      vscode.window.onDidChangeActiveTextEditor((editor) => {
        if (this.config.enabled && editor) {
          this.onEditorChange(editor);
        }
      })
    );

    // Listen for window focus changes
    this.disposables.push(
      vscode.window.onDidChangeWindowState((e) => {
        if (this.config.enabled) {
          this.onFocusChange(e.focused);
        }
      })
    );
  }

  /**
   * Load configuration from VS Code settings
   */
  private loadConfig(): ActivityConfig {
    const config = vscode.workspace.getConfiguration('cmdify.activity');
    return {
      enabled: config.get<boolean>('enabled', DEFAULT_ACTIVITY_CONFIG.enabled),
      dailyGoalMinutes: config.get<number>(
        'dailyGoalMinutes',
        DEFAULT_ACTIVITY_CONFIG.dailyGoalMinutes
      ),
      trackLanguages: config.get<boolean>('trackLanguages', DEFAULT_ACTIVITY_CONFIG.trackLanguages),
      showInStatusBar: config.get<boolean>(
        'showInStatusBar',
        DEFAULT_ACTIVITY_CONFIG.showInStatusBar
      ),
    };
  }

  /**
   * Load current day's activity from storage
   */
  private loadCurrentDay(): DailyActivity {
    const saved = this.context.globalState.get<DailyActivity>(ACTIVITY_STORAGE_KEYS.DAILY);
    if (saved && saved.date === getTodayString()) {
      return saved;
    }
    return { ...DEFAULT_DAILY_ACTIVITY, date: getTodayString() };
  }

  /**
   * Load activity history from storage
   */
  private loadHistory(): DailyActivity[] {
    return this.context.globalState.get<DailyActivity[]>(ACTIVITY_STORAGE_KEYS.HISTORY) || [];
  }

  /**
   * Save current day's activity to storage
   */
  private async saveCurrentDay(): Promise<void> {
    await this.context.globalState.update(ACTIVITY_STORAGE_KEYS.DAILY, this.currentDay);
    this._onActivityUpdate.fire(this.currentDay);
  }

  /**
   * Save activity history to storage
   */
  private async saveHistory(): Promise<void> {
    await this.context.globalState.update(ACTIVITY_STORAGE_KEYS.HISTORY, this.history);
  }

  /**
   * Check if it's a new day and roll over data
   */
  private async checkNewDay(): Promise<void> {
    const today = getTodayString();

    if (this.currentDay.date && this.currentDay.date !== today) {
      // Archive the old day
      if (this.currentDay.totalMinutes > 0 || this.currentDay.filesEdited > 0) {
        this.history.unshift(this.currentDay);

        // Trim history to max days
        if (this.history.length > ACTIVITY_HISTORY_DAYS) {
          this.history = this.history.slice(0, ACTIVITY_HISTORY_DAYS);
        }

        await this.saveHistory();
      }

      // Reset for new day
      this.currentDay = { ...DEFAULT_DAILY_ACTIVITY, date: today };
      this.editedFilesSet.clear();
      await this.saveCurrentDay();
    }
  }

  /**
   * Start activity tracking
   */
  private startTracking(): void {
    if (this.trackingInterval) {
      return;
    }

    // Record initial active time if window is focused
    if (vscode.window.state.focused) {
      this.lastActiveTime = Date.now();
    }

    // Track activity every 30 seconds
    this.trackingInterval = setInterval(() => {
      this.recordActivity();
    }, ACTIVITY_TRACKING_INTERVAL);
  }

  /**
   * Stop activity tracking
   */
  private stopTracking(): void {
    if (this.trackingInterval) {
      clearInterval(this.trackingInterval);
      this.trackingInterval = null;
    }
    this.lastActiveTime = null;
  }

  /**
   * Record current activity (called every 30 seconds)
   */
  private async recordActivity(): Promise<void> {
    // Check for new day first
    await this.checkNewDay();

    // Only record if window is focused
    if (!vscode.window.state.focused) {
      this.lastActiveTime = null;
      return;
    }

    const now = Date.now();

    // If we have a last active time, add the elapsed time
    if (this.lastActiveTime) {
      const elapsedMs = now - this.lastActiveTime;
      const elapsedMinutes = elapsedMs / (1000 * 60);

      // Only add if within reasonable bounds (max 1 minute to handle missed intervals)
      if (elapsedMinutes > 0 && elapsedMinutes <= 1) {
        this.currentDay.totalMinutes += elapsedMinutes;

        // Track language if enabled and there's an active editor
        if (this.config.trackLanguages) {
          const editor = vscode.window.activeTextEditor;
          if (editor) {
            const language = editor.document.languageId;
            this.currentDay.languageBreakdown[language] =
              (this.currentDay.languageBreakdown[language] || 0) + elapsedMinutes;
          }
        }

        await this.saveCurrentDay();
      }
    }

    this.lastActiveTime = now;
  }

  /**
   * Handle file save event
   */
  private async onFileSave(doc: vscode.TextDocument): Promise<void> {
    // Use a hash of the file path for privacy (we don't store actual paths)
    const fileKey = this.hashString(doc.uri.fsPath);

    if (!this.editedFilesSet.has(fileKey)) {
      this.editedFilesSet.add(fileKey);
      this.currentDay.filesEdited++;
      await this.saveCurrentDay();
    }
  }

  /**
   * Handle active editor change
   */
  private onEditorChange(_editor: vscode.TextEditor): void {
    // Update last active time when switching editors
    if (vscode.window.state.focused) {
      this.lastActiveTime = Date.now();
    }
  }

  /**
   * Handle window focus change
   */
  private async onFocusChange(focused: boolean): Promise<void> {
    if (focused) {
      this.lastActiveTime = Date.now();
    } else {
      // Record any remaining activity before losing focus
      if (this.lastActiveTime) {
        await this.recordActivity();
      }
      this.lastActiveTime = null;
    }
  }

  /**
   * Simple string hash for privacy-safe file tracking
   */
  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return hash.toString(16);
  }

  /**
   * Record focus session completion (called from FocusService)
   */
  async recordFocusSession(minutes: number): Promise<void> {
    await this.checkNewDay();
    this.currentDay.focusSessions++;
    this.currentDay.focusMinutes += minutes;
    await this.saveCurrentDay();
  }

  /**
   * Get current day's activity
   */
  getToday(): DailyActivity {
    return { ...this.currentDay };
  }

  /**
   * Get last 7 days of activity
   */
  getWeekly(): DailyActivity[] {
    const today = this.getToday();
    const result: DailyActivity[] = [today];

    // Add historical data
    for (let i = 0; i < 6 && i < this.history.length; i++) {
      result.push({ ...this.history[i] });
    }

    // Fill in missing days with empty data
    const targetDays = 7;
    while (result.length < targetDays) {
      const lastDate = result[result.length - 1]?.date || getTodayString();
      const prevDate = this.getPreviousDay(lastDate);
      result.push({
        ...DEFAULT_DAILY_ACTIVITY,
        date: prevDate,
      });
    }

    return result;
  }

  /**
   * Get previous day's date string
   */
  private getPreviousDay(dateStr: string): string {
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    date.setDate(date.getDate() - 1);
    return formatDateString(date);
  }

  /**
   * Get aggregated activity statistics
   */
  getStats(): ActivityStats {
    const today = this.getToday();
    const weekly = this.getWeekly();

    // Calculate streak
    let currentStreak = 0;
    let checkDate = getTodayString();

    // Check today
    if (today.totalMinutes > 0 || today.filesEdited > 0 || today.focusSessions > 0) {
      currentStreak = 1;
      checkDate = this.getPreviousDay(checkDate);
    }

    // Check history
    for (const day of this.history) {
      if (day.date === checkDate) {
        if (day.totalMinutes > 0 || day.filesEdited > 0 || day.focusSessions > 0) {
          currentStreak++;
          checkDate = this.getPreviousDay(checkDate);
        } else {
          break;
        }
      } else if (day.date < checkDate) {
        // Gap in data means streak is broken
        break;
      }
    }

    // Calculate longest streak
    let longestStreak = currentStreak;
    let tempStreak = 0;
    let prevDate = '';

    for (const day of this.history) {
      if (day.totalMinutes > 0 || day.filesEdited > 0 || day.focusSessions > 0) {
        if (!prevDate || day.date === this.getPreviousDay(prevDate)) {
          tempStreak++;
          longestStreak = Math.max(longestStreak, tempStreak);
        } else {
          tempStreak = 1;
        }
        prevDate = day.date;
      } else {
        tempStreak = 0;
        prevDate = day.date;
      }
    }

    // Calculate totals
    let totalFocusMinutes = today.focusMinutes;
    let totalSessions = today.focusSessions;

    for (const day of this.history) {
      totalFocusMinutes += day.focusMinutes;
      totalSessions += day.focusSessions;
    }

    // Calculate today's goal progress
    const todayGoalProgress = Math.min(
      100,
      Math.round((today.totalMinutes / this.config.dailyGoalMinutes) * 100)
    );

    return {
      currentStreak,
      longestStreak,
      totalFocusMinutes,
      totalSessions,
      todayGoalProgress,
      weeklyData: weekly,
    };
  }

  /**
   * Get current configuration
   */
  getConfig(): ActivityConfig {
    return { ...this.config };
  }

  /**
   * Format today's time for status bar display
   */
  getStatusBarText(): string {
    const minutes = Math.round(this.currentDay.totalMinutes);
    if (minutes < 60) {
      return `${minutes}m`;
    }
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (mins === 0) {
      return `${hours}h`;
    }
    return `${hours}h${mins}m`;
  }

  /**
   * Get tooltip text for status bar
   */
  getStatusBarTooltip(): string {
    const stats = this.getStats();
    const today = this.getToday();
    const minutes = Math.round(today.totalMinutes);
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;

    let tooltip = `Today: ${hours}h ${mins}m`;
    tooltip += ` (${stats.todayGoalProgress}% of goal)`;

    if (today.filesEdited > 0) {
      tooltip += `\nFiles edited: ${today.filesEdited}`;
    }

    if (today.focusSessions > 0) {
      tooltip += `\nFocus sessions: ${today.focusSessions}`;
    }

    if (stats.currentStreak > 0) {
      tooltip += `\n🔥 ${stats.currentStreak} day streak`;
    }

    tooltip += '\n\nClick to view Activity Dashboard';

    return tooltip;
  }

  /**
   * Get top languages by time
   */
  getTopLanguages(limit: number = 5): Array<{ language: string; minutes: number }> {
    const breakdown = this.currentDay.languageBreakdown;
    const entries = Object.entries(breakdown)
      .map(([language, minutes]) => ({ language, minutes }))
      .sort((a, b) => b.minutes - a.minutes);

    return entries.slice(0, limit);
  }

  /**
   * Check if daily goal bonus XP has already been awarded today
   */
  hasDailyGoalBonusAwarded(): boolean {
    const key = `${ACTIVITY_STORAGE_KEYS.DAILY}.bonusAwarded`;
    const awardedDate = this.context.globalState.get<string>(key);
    return awardedDate === getTodayString();
  }

  /**
   * Mark daily goal bonus as awarded for today
   */
  async markDailyGoalBonusAwarded(): Promise<void> {
    const key = `${ACTIVITY_STORAGE_KEYS.DAILY}.bonusAwarded`;
    await this.context.globalState.update(key, getTodayString());
  }

  // =============================================================================
  // Reset (Phase 4)
  // =============================================================================

  /**
   * Reset all activity tracking data
   */
  async reset(): Promise<void> {
    this.currentDay = { ...DEFAULT_DAILY_ACTIVITY, date: getTodayString() };
    this.history = [];
    this.editedFilesSet.clear();
    await this.saveCurrentDay();
    await this.saveHistory();
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    this.stopTracking();
    this._onActivityUpdate.dispose();
    this.disposables.forEach((d) => d.dispose());
  }
}
