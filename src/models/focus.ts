/**
 * Focus Timer types and interfaces
 */

/**
 * Focus timer configuration
 */
export interface FocusConfig {
  focusDuration: number;           // minutes, default 25
  shortBreakDuration: number;      // minutes, default 5
  longBreakDuration: number;       // minutes, default 15
  sessionsBeforeLongBreak: number; // default 4
  soundEnabled: boolean;
  autoStartBreak: boolean;
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
  timeRemaining: number;      // seconds
  currentSession: number;     // 1-4
  todaySessions: number;
  todayFocusMinutes: number;
  pausedAt?: number;          // timestamp when paused
  wasBreak?: boolean;         // whether paused during break
}

/**
 * Focus statistics stored in globalState
 */
export interface FocusStats {
  totalSessions: number;
  totalFocusMinutes: number;
  currentStreak: number;           // consecutive days with 1+ session
  longestStreak: number;
  longestSessionMinutes: number;   // longest single session
  lastSessionDate: string;         // YYYY-MM-DD
  dailyStats: DailyFocusStats[];   // last 30 days
}

/**
 * Daily focus statistics
 */
export interface DailyFocusStats {
  date: string;  // YYYY-MM-DD
  sessions: number;
  focusMinutes: number;
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
  totalFocusMinutes: 0,
  currentStreak: 0,
  longestStreak: 0,
  longestSessionMinutes: 0,
  lastSessionDate: '',
  dailyStats: [],
};
