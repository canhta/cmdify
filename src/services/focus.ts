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

  // Public events
  readonly onTick = this._onTick.event;
  readonly onStateChange = this._onStateChange.event;
  readonly onSessionComplete = this._onSessionComplete.event;
  readonly onBreakStart = this._onBreakStart.event;
  readonly onBreakComplete = this._onBreakComplete.event;

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
      shortBreakDuration: config.get<number>('shortBreakDuration', DEFAULT_FOCUS_CONFIG.shortBreakDuration),
      longBreakDuration: config.get<number>('longBreakDuration', DEFAULT_FOCUS_CONFIG.longBreakDuration),
      sessionsBeforeLongBreak: config.get<number>('sessionsBeforeLongBreak', DEFAULT_FOCUS_CONFIG.sessionsBeforeLongBreak),
      soundEnabled: config.get<boolean>('soundEnabled', DEFAULT_FOCUS_CONFIG.soundEnabled),
      autoStartBreak: config.get<boolean>('autoStartBreak', DEFAULT_FOCUS_CONFIG.autoStartBreak),
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
    return saved || { ...DEFAULT_FOCUS_STATS };
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
   */
  async skip(): Promise<void> {
    this.stopTimer();

    if (this.state.status === 'focusing' || this.state.status === 'paused') {
      // Skip to break
      await this.startBreak();
    } else if (this.state.status === 'break') {
      // Skip break, start new focus session
      this.state.status = 'idle';
      await this.saveState();
      await this.start();
    }
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
   * Complete a focus session
   */
  private async completeSession(): Promise<void> {
    const today = getTodayString();
    const sessionMinutes = this.config.focusDuration;

    // Update state
    this.state.todaySessions++;
    this.state.todayFocusMinutes += sessionMinutes;

    // Update stats
    this.stats.totalSessions++;
    this.stats.totalFocusMinutes += sessionMinutes;
    
    if (sessionMinutes > this.stats.longestSessionMinutes) {
      this.stats.longestSessionMinutes = sessionMinutes;
    }

    // Update streak
    if (this.stats.lastSessionDate !== today) {
      if (isYesterday(this.stats.lastSessionDate) || !this.stats.lastSessionDate) {
        this.stats.currentStreak++;
      } else {
        this.stats.currentStreak = 1;
      }
      
      if (this.stats.currentStreak > this.stats.longestStreak) {
        this.stats.longestStreak = this.stats.currentStreak;
      }
    }
    
    this.stats.lastSessionDate = today;

    // Update daily stats
    this.updateDailyStats(today, sessionMinutes);

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
   * Start a break
   */
  private async startBreak(): Promise<void> {
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
    this._onBreakStart.fire();
    this.startTimer();

    // Show break notification with suggestion (Phase 4)
    const suggestion = getBreakSuggestion(breakDuration);
    vscode.window.showInformationMessage(
      `$(coffee) Time for a ${isLongBreak ? 'long' : 'short'} break! (${breakDuration} min)\n${suggestion}`
    );
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
      '$(play) Break over! Ready for another focus session?',
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
  private updateDailyStats(date: string, minutes: number): void {
    const existingIndex = this.stats.dailyStats.findIndex(d => d.date === date);
    
    if (existingIndex >= 0) {
      this.stats.dailyStats[existingIndex].sessions++;
      this.stats.dailyStats[existingIndex].focusMinutes += minutes;
    } else {
      this.stats.dailyStats.unshift({
        date,
        sessions: 1,
        focusMinutes: minutes,
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
