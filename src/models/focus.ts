/**
 * Focus Timer types and interfaces
 */

/**
 * Focus timer configuration
 */
export interface FocusConfig {
  focusDuration: number; // minutes, default 25
  shortBreakDuration: number; // minutes, default 5
  longBreakDuration: number; // minutes, default 15
  sessionsBeforeLongBreak: number; // default 4
  soundEnabled: boolean;
  autoStartBreak: boolean;
  minimumFocusForStreak: number; // minutes, minimum focus time to count for streak
  minimumSessionPercent: number; // percentage of session required for full credit (0-100)
}

/**
 * Focus timer status
 */
export type FocusStatus = 'idle' | 'focusing' | 'break' | 'paused';

/**
 * Focus timer state
 */
export interface FocusState {
  status: FocusStatus;
  timeRemaining: number; // seconds
  currentSession: number; // 1-4
  todaySessions: number;
  todayFocusMinutes: number;
  pausedAt?: number; // timestamp when paused
  wasBreak?: boolean; // whether paused during break
}

/**
 * Focus statistics stored in globalState
 */
export interface FocusStats {
  totalSessions: number;
  totalCompletedSessions: number; // sessions that met minimum requirement
  totalFocusMinutes: number;
  totalActualFocusMinutes: number; // actual time focused (not skipped)
  currentStreak: number; // consecutive days with 1+ completed session
  longestStreak: number;
  longestSessionMinutes: number; // longest single session
  lastSessionDate: string; // YYYY-MM-DD (last completed session)
  lastActivityDate: string; // YYYY-MM-DD (any focus activity)
  skippedSessions: number; // sessions skipped before completion
  dailyStats: DailyFocusStats[]; // last 30 days
}

/**
 * Daily focus statistics
 */
export interface DailyFocusStats {
  date: string; // YYYY-MM-DD
  sessions: number; // total sessions started
  completedSessions: number; // sessions meeting minimum requirement
  focusMinutes: number; // configured focus minutes
  actualFocusMinutes: number; // actual time focused
  skippedSessions: number; // sessions skipped
}

/**
 * Default focus configuration
 */
export const DEFAULT_FOCUS_CONFIG: FocusConfig = {
  focusDuration: 25,
  shortBreakDuration: 5,
  longBreakDuration: 15,
  sessionsBeforeLongBreak: 4,
  soundEnabled: true,
  autoStartBreak: false,
  minimumFocusForStreak: 10, // at least 10 minutes to count for streak
  minimumSessionPercent: 80, // must complete 80% of session for full credit
};

/**
 * Default focus state
 */
export const DEFAULT_FOCUS_STATE: FocusState = {
  status: 'idle',
  timeRemaining: 0,
  currentSession: 1,
  todaySessions: 0,
  todayFocusMinutes: 0,
};

/**
 * Default focus stats
 */
export const DEFAULT_FOCUS_STATS: FocusStats = {
  totalSessions: 0,
  totalCompletedSessions: 0,
  totalFocusMinutes: 0,
  totalActualFocusMinutes: 0,
  currentStreak: 0,
  longestStreak: 0,
  longestSessionMinutes: 0,
  lastSessionDate: '',
  lastActivityDate: '',
  skippedSessions: 0,
  dailyStats: [],
};
