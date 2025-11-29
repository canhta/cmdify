/**
 * Focus Timer Service
 * Handles Pomodoro timer logic with session tracking
 */

import * as vscode from 'vscode';
import {
  FocusConfig,
  FocusState,
  FocusStats,
  FocusStatus,
  DEFAULT_FOCUS_CONFIG,
  DEFAULT_FOCUS_STATE,
  DEFAULT_FOCUS_STATS,
} from '../models/focus';
import { getBreakSuggestion } from '../models/companion';
import { getTodayString, isToday, isYesterday } from '../utils/dateUtils';

const FOCUS_STATE_KEY = 'cmdify.focus.state';
const FOCUS_STATS_KEY = 'cmdify.focus.stats';

/**
 * Focus Timer Service
 */
export class FocusService implements vscode.Disposable {
  private timer: ReturnType<typeof setInterval> | null = null;
  private state: FocusState;
  private stats: FocusStats;
  private config: FocusConfig;
  private sessionStartTime: Date | null = null;

  // Event emitters
  private readonly _onTick = new vscode.EventEmitter<number>();
  private readonly _onStateChange = new vscode.EventEmitter<FocusState>();
  private readonly _onSessionComplete = new vscode.EventEmitter<void>();
  private readonly _onBreakStart = new vscode.EventEmitter<void>();
  private readonly _onBreakComplete = new vscode.EventEmitter<void>();
  private readonly _onFocusStart = new vscode.EventEmitter<void>();

  // Public events
  readonly onTick = this._onTick.event;
  readonly onStateChange = this._onStateChange.event;
  readonly onSessionComplete = this._onSessionComplete.event;
  readonly onBreakStart = this._onBreakStart.event;
  readonly onBreakComplete = this._onBreakComplete.event;
  readonly onFocusStart = this._onFocusStart.event;

  constructor(private readonly context: vscode.ExtensionContext) {
    this.state = this.loadState();
    this.stats = this.loadStats();
    this.config = this.loadConfig();

    // Listen for config changes
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('cmdify.focus')) {
        this.config = this.loadConfig();
      }
    });

    // Reset daily stats if it's a new day
    this.checkNewDay();
  }

  /**
   * Load focus configuration from VS Code settings
   */
  private loadConfig(): FocusConfig {
    const config = vscode.workspace.getConfiguration('cmdify.focus');
    return {
      focusDuration: config.get<number>('focusDuration', DEFAULT_FOCUS_CONFIG.focusDuration),
      shortBreakDuration: config.get<number>(
        'shortBreakDuration',
        DEFAULT_FOCUS_CONFIG.shortBreakDuration
      ),
      longBreakDuration: config.get<number>(
        'longBreakDuration',
        DEFAULT_FOCUS_CONFIG.longBreakDuration
      ),
      sessionsBeforeLongBreak: config.get<number>(
        'sessionsBeforeLongBreak',
        DEFAULT_FOCUS_CONFIG.sessionsBeforeLongBreak
      ),
      soundEnabled: config.get<boolean>('soundEnabled', DEFAULT_FOCUS_CONFIG.soundEnabled),
      autoStartBreak: config.get<boolean>('autoStartBreak', DEFAULT_FOCUS_CONFIG.autoStartBreak),
      minimumFocusForStreak: config.get<number>(
        'minimumFocusForStreak',
        DEFAULT_FOCUS_CONFIG.minimumFocusForStreak
      ),
      minimumSessionPercent: config.get<number>(
        'minimumSessionPercent',
        DEFAULT_FOCUS_CONFIG.minimumSessionPercent
      ),
    };
  }

  /**
   * Load focus state from globalState
   */
  private loadState(): FocusState {
    const saved = this.context.globalState.get<FocusState>(FOCUS_STATE_KEY);
    if (saved) {
      // Reset if the state is stale (e.g., VS Code was closed during a session)
      if (saved.status !== 'idle' && !saved.pausedAt) {
        return { ...DEFAULT_FOCUS_STATE };
      }
      return saved;
    }
    return { ...DEFAULT_FOCUS_STATE };
  }

  /**
   * Load focus stats from globalState
   */
  private loadStats(): FocusStats {
    const saved = this.context.globalState.get<FocusStats>(FOCUS_STATS_KEY);
    if (saved) {
      // Migrate old stats format to new format
      return {
        ...DEFAULT_FOCUS_STATS,
        ...saved,
        totalCompletedSessions: saved.totalCompletedSessions ?? saved.totalSessions ?? 0,
        totalActualFocusMinutes: saved.totalActualFocusMinutes ?? saved.totalFocusMinutes ?? 0,
        lastActivityDate: saved.lastActivityDate ?? saved.lastSessionDate ?? '',
        skippedSessions: saved.skippedSessions ?? 0,
      };
    }
    return { ...DEFAULT_FOCUS_STATS };
  }

  /**
   * Save focus state to globalState
   */
  private async saveState(): Promise<void> {
    await this.context.globalState.update(FOCUS_STATE_KEY, this.state);
    this._onStateChange.fire(this.state);
  }

  /**
   * Save focus stats to globalState
   */
  private async saveStats(): Promise<void> {
    await this.context.globalState.update(FOCUS_STATS_KEY, this.stats);
  }

  /**
   * Check if it's a new day and reset daily stats
   */
  private checkNewDay(): void {
    const today = getTodayString();
    if (this.stats.lastSessionDate && !isToday(this.stats.lastSessionDate)) {
      // Reset today's stats
      this.state.todaySessions = 0;
      this.state.todayFocusMinutes = 0;
      this.state.currentSession = 1;

      // Check streak
      if (!isYesterday(this.stats.lastSessionDate)) {
        // Streak broken
        this.stats.currentStreak = 0;
      }

      this.saveState();
      this.saveStats();
    }
  }

  /**
   * Get current state
   */
  getState(): FocusState {
    return { ...this.state };
  }

  /**
   * Get current stats
   */
  getStats(): FocusStats {
    return { ...this.stats };
  }

  /**
   * Get current config
   */
  getConfig(): FocusConfig {
    return { ...this.config };
  }

  // Session-specific config (for session types)
  private currentSessionConfig: FocusConfig | null = null;

  /**
   * Get effective config for current session
   */
  private getEffectiveConfig(): FocusConfig {
    return this.currentSessionConfig || this.config;
  }

  /**
   * Start a focus session with optional custom config (Phase 4: Session Types)
   */
  async startWithConfig(customConfig: Partial<FocusConfig>): Promise<void> {
    this.currentSessionConfig = { ...this.config, ...customConfig };
    await this.start();
  }

  /**
   * Start a focus session
   */
  async start(): Promise<void> {
    if (this.state.status === 'focusing' || this.state.status === 'break') {
      return; // Already running
    }

    const effectiveConfig = this.getEffectiveConfig();

    // Resume from paused state
    if (this.state.status === 'paused' && this.state.pausedAt) {
      this.state.status = this.state.wasBreak ? 'break' : 'focusing';
      delete this.state.pausedAt;
      delete this.state.wasBreak;
    } else {
      // Start new focus session
      this.state.status = 'focusing';
      this.state.timeRemaining = effectiveConfig.focusDuration * 60;
      this.sessionStartTime = new Date();
      this._onFocusStart.fire();
    }

    await this.saveState();
    this.startTimer();
  }

  /**
   * Pause the current session
   */
  async pause(): Promise<void> {
    if (this.state.status !== 'focusing' && this.state.status !== 'break') {
      return;
    }

    this.stopTimer();
    this.state.wasBreak = this.state.status === 'break';
    this.state.status = 'paused';
    this.state.pausedAt = Date.now();
    await this.saveState();
  }

  /**
   * Resume a paused session
   */
  async resume(): Promise<void> {
    if (this.state.status !== 'paused') {
      return;
    }

    await this.start();
  }

  /**
   * Stop and reset the timer
   */
  async stop(): Promise<void> {
    this.stopTimer();
    this.state.status = 'idle';
    this.state.timeRemaining = 0;
    delete this.state.pausedAt;
    delete this.state.wasBreak;
    this.sessionStartTime = null;
    this.currentSessionConfig = null; // Reset session config
    await this.saveState();
  }

  /**
   * Skip to the next phase (focus -> break or break -> focus)
   * Skipping a focus session does NOT count for streak
   */
  async skip(): Promise<void> {
    this.stopTimer();

    if (this.state.status === 'focusing' || this.state.status === 'paused') {
      // Calculate actual focus time before skipping
      const actualFocusMinutes = this.getActualFocusMinutes();
      const effectiveConfig = this.getEffectiveConfig();
      const today = getTodayString();

      // Check if user focused enough to count (even if skipping to break early)
      const meetsMinimum = actualFocusMinutes >= effectiveConfig.minimumFocusForStreak;
      const meetsPercent =
        actualFocusMinutes >=
        (effectiveConfig.focusDuration * effectiveConfig.minimumSessionPercent) / 100;

      if (meetsMinimum && meetsPercent) {
        // Partial session completion - still counts for streak!
        await this.recordPartialSession(actualFocusMinutes, today);
        vscode.window.showInformationMessage(
          `✅ Good job! ${Math.round(actualFocusMinutes)} minutes of focus recorded.`
        );
      } else {
        // Not enough focus time - track as skipped
        this.stats.skippedSessions++;
        this.stats.lastActivityDate = today;
        this.updateDailyStats(today, 0, actualFocusMinutes, false, true);
        await this.saveStats();

        const minRequired = Math.max(
          effectiveConfig.minimumFocusForStreak,
          Math.ceil((effectiveConfig.focusDuration * effectiveConfig.minimumSessionPercent) / 100)
        );
        vscode.window.showWarningMessage(
          `⚠️ Session skipped. Focus at least ${minRequired} min to count for streak.`
        );
      }

      this.sessionStartTime = null;
      await this.startBreak(true); // Silent - skip notification already shown
    } else if (this.state.status === 'break') {
      // Skip break is allowed without penalty
      this.state.status = 'idle';
      await this.saveState();
      await this.start();
    }
  }

  /**
   * Get actual focus minutes from session start
   */
  private getActualFocusMinutes(): number {
    if (!this.sessionStartTime) {
      return 0;
    }
    const effectiveConfig = this.getEffectiveConfig();
    const elapsedMs = Date.now() - this.sessionStartTime.getTime();
    const elapsedMinutes = elapsedMs / 1000 / 60;
    // Cap at configured duration (in case of pauses/resumes affecting time)
    return Math.min(elapsedMinutes, effectiveConfig.focusDuration);
  }

  /**
   * Record a partial session (skipped early but met minimum requirements)
   */
  private async recordPartialSession(actualMinutes: number, date: string): Promise<void> {
    // Update state
    this.state.todaySessions++;
    this.state.todayFocusMinutes += actualMinutes;

    // Update stats
    this.stats.totalSessions++;
    this.stats.totalCompletedSessions++;
    this.stats.totalFocusMinutes += actualMinutes;
    this.stats.totalActualFocusMinutes += actualMinutes;

    if (actualMinutes > this.stats.longestSessionMinutes) {
      this.stats.longestSessionMinutes = actualMinutes;
    }

    // Update streak (same logic as completeSession)
    this.updateStreak(date);

    this.stats.lastSessionDate = date;
    this.stats.lastActivityDate = date;

    // Update daily stats
    this.updateDailyStats(date, actualMinutes, actualMinutes, true, false);

    await this.saveState();
    await this.saveStats();
  }

  /**
   * Start the internal timer
   */
  private startTimer(): void {
    if (this.timer) {
      return;
    }

    this.timer = setInterval(() => {
      this.tick();
    }, 1000);
  }

  /**
   * Stop the internal timer
   */
  private stopTimer(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /**
   * Timer tick - called every second
   */
  private async tick(): Promise<void> {
    if (this.state.timeRemaining > 0) {
      this.state.timeRemaining--;
      this._onTick.fire(this.state.timeRemaining);
      await this.saveState();
    } else {
      // Timer completed
      this.stopTimer();

      if (this.state.status === 'focusing') {
        await this.completeSession();
      } else if (this.state.status === 'break') {
        await this.completeBreak();
      }
    }
  }

  /**
   * Complete a focus session (timer reached 0)
   */
  private async completeSession(): Promise<void> {
    const today = getTodayString();
    const effectiveConfig = this.getEffectiveConfig();
    const configuredMinutes = effectiveConfig.focusDuration;
    const actualMinutes = this.getActualFocusMinutes() || configuredMinutes;

    // Update state
    this.state.todaySessions++;
    this.state.todayFocusMinutes += actualMinutes;

    // Update stats
    this.stats.totalSessions++;
    this.stats.totalCompletedSessions++;
    this.stats.totalFocusMinutes += configuredMinutes;
    this.stats.totalActualFocusMinutes += actualMinutes;

    if (actualMinutes > this.stats.longestSessionMinutes) {
      this.stats.longestSessionMinutes = actualMinutes;
    }

    // Update streak
    this.updateStreak(today);

    this.stats.lastSessionDate = today;
    this.stats.lastActivityDate = today;

    // Update daily stats
    this.updateDailyStats(today, configuredMinutes, actualMinutes, true, false);

    this.sessionStartTime = null;

    await this.saveState();
    await this.saveStats();

    this._onSessionComplete.fire();

    // Show notification
    const action = await vscode.window.showInformationMessage(
      `$(check) Focus session complete! You've done ${this.state.todaySessions} session${this.state.todaySessions > 1 ? 's' : ''} today.`,
      'Take Break',
      'Skip Break'
    );

    if (action === 'Take Break' || this.getEffectiveConfig().autoStartBreak) {
      await this.startBreak();
    } else {
      this.state.status = 'idle';
      this.currentSessionConfig = null; // Reset session config
      await this.saveState();
    }
  }

  /**
   * Update streak based on date
   */
  private updateStreak(today: string): void {
    if (this.stats.lastSessionDate !== today) {
      if (isYesterday(this.stats.lastSessionDate) || !this.stats.lastSessionDate) {
        this.stats.currentStreak++;
      } else {
        // Streak broken - reset to 1
        this.stats.currentStreak = 1;
      }

      if (this.stats.currentStreak > this.stats.longestStreak) {
        this.stats.longestStreak = this.stats.currentStreak;
      }
    }
  }

  /**
   * Start a break
   * @param silent - If true, don't fire the break start event (no notification)
   */
  private async startBreak(silent: boolean = false): Promise<void> {
    const effectiveConfig = this.getEffectiveConfig();
    const isLongBreak = this.state.currentSession >= effectiveConfig.sessionsBeforeLongBreak;
    const breakDuration = isLongBreak
      ? effectiveConfig.longBreakDuration
      : effectiveConfig.shortBreakDuration;

    this.state.status = 'break';
    this.state.timeRemaining = breakDuration * 60;

    if (isLongBreak) {
      this.state.currentSession = 1;
    } else {
      this.state.currentSession++;
    }

    await this.saveState();
    if (!silent) {
      this._onBreakStart.fire();
    }
    this.startTimer();
  }

  /**
   * Complete a break
   */
  private async completeBreak(): Promise<void> {
    this.state.status = 'idle';
    this.currentSessionConfig = null; // Reset session config
    await this.saveState();
    this._onBreakComplete.fire();

    const action = await vscode.window.showInformationMessage(
      '▶️ Break over! Ready for another focus session?',
      'Start Focus',
      'Not Now'
    );

    if (action === 'Start Focus') {
      await this.start();
    }
  }

  /**
   * Update daily stats array
   */
  private updateDailyStats(
    date: string,
    configuredMinutes: number,
    actualMinutes: number,
    completed: boolean,
    skipped: boolean
  ): void {
    const existingIndex = this.stats.dailyStats.findIndex((d) => d.date === date);

    if (existingIndex >= 0) {
      const existing = this.stats.dailyStats[existingIndex];
      existing.sessions++;
      existing.focusMinutes += configuredMinutes;
      existing.actualFocusMinutes += actualMinutes;
      if (completed) {
        existing.completedSessions++;
      }
      if (skipped) {
        existing.skippedSessions++;
      }
    } else {
      this.stats.dailyStats.unshift({
        date,
        sessions: 1,
        completedSessions: completed ? 1 : 0,
        focusMinutes: configuredMinutes,
        actualFocusMinutes: actualMinutes,
        skippedSessions: skipped ? 1 : 0,
      });
    }

    // Keep only last 30 days
    this.stats.dailyStats = this.stats.dailyStats.slice(0, 30);
  }

  /**
   * Check if currently in a session (focusing or break)
   */
  isActive(): boolean {
    return this.state.status === 'focusing' || this.state.status === 'break';
  }

  /**
   * Get the last session's actual focus minutes (from today's stats)
   */
  getLastSessionMinutes(): number {
    const today = getTodayString();
    const todayStats = this.stats.dailyStats.find((d) => d.date === today);
    if (todayStats && todayStats.completedSessions > 0) {
      return Math.round(todayStats.actualFocusMinutes / todayStats.completedSessions);
    }
    return this.getEffectiveConfig().focusDuration;
  }

  /**
   * Reset all stats (for testing or user request)
   */
  async resetStats(): Promise<void> {
    this.stats = { ...DEFAULT_FOCUS_STATS };
    await this.saveStats();
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    this.stopTimer();
    this._onTick.dispose();
    this._onStateChange.dispose();
    this._onSessionComplete.dispose();
    this._onBreakStart.dispose();
    this._onBreakComplete.dispose();
  }
}
