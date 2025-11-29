/**
 * Achievement System Models
 * Provides gamification through unlockable achievements
 */

// Achievement condition types
export type AchievementConditionType =
  | 'sessions' // Focus sessions completed
  | 'streak' // Consecutive days with activity
  | 'todos' // TODOs completed
  | 'commands' // Commands created/saved
  | 'level' // Companion level reached
  | 'time' // Total time in VS Code
  | 'special'; // Special conditions (night owl, etc.)

// Achievement categories
export type AchievementCategory = 'focus' | 'todos' | 'commands' | 'streaks' | 'special';

export interface AchievementCondition {
  type: AchievementConditionType;
  value: number;
  comparison?: '>=' | '==' | '>';
}

export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: AchievementCategory;
  condition: AchievementCondition;
  xpReward: number;
  secret?: boolean; // Hidden until unlocked
}

export interface UnlockedAchievement {
  id: string;
  unlockedAt: string; // ISO date string
  notified: boolean; // Whether user was notified
}

export interface AchievementProgress {
  achievementId: string;
  currentValue: number;
  targetValue: number;
  percentage: number;
}

export interface AchievementStats {
  totalAchievements: number;
  unlockedCount: number;
  totalXPEarned: number;
  recentUnlocks: UnlockedAchievement[];
}

// ============================================
// Achievement Definitions
// ============================================

export const ACHIEVEMENTS: Achievement[] = [
  // ==========================================
  // Focus Category
  // ==========================================
  {
    id: 'first_focus',
    name: 'First Focus',
    description: 'Complete your first focus session',
    icon: '🎯',
    category: 'focus',
    condition: { type: 'sessions', value: 1 },
    xpReward: 50,
  },
  {
    id: 'focus_10',
    name: 'Getting Focused',
    description: 'Complete 10 focus sessions',
    icon: '🍅',
    category: 'focus',
    condition: { type: 'sessions', value: 10 },
    xpReward: 100,
  },
  {
    id: 'focus_25',
    name: 'Focus Enthusiast',
    description: 'Complete 25 focus sessions',
    icon: '🎪',
    category: 'focus',
    condition: { type: 'sessions', value: 25 },
    xpReward: 200,
  },
  {
    id: 'focus_50',
    name: 'Focus Master',
    description: 'Complete 50 focus sessions',
    icon: '🧘',
    category: 'focus',
    condition: { type: 'sessions', value: 50 },
    xpReward: 300,
  },
  {
    id: 'focus_100',
    name: 'Centurion',
    description: 'Complete 100 focus sessions',
    icon: '💯',
    category: 'focus',
    condition: { type: 'sessions', value: 100 },
    xpReward: 500,
  },
  {
    id: 'focus_marathon',
    name: 'Marathon Runner',
    description: 'Complete 5 focus sessions in one day',
    icon: '🏃',
    category: 'focus',
    condition: { type: 'special', value: 5 },
    xpReward: 250,
  },

  // ==========================================
  // Streak Category
  // ==========================================
  {
    id: 'streak_3',
    name: 'Getting Started',
    description: 'Achieve a 3-day streak',
    icon: '🌱',
    category: 'streaks',
    condition: { type: 'streak', value: 3 },
    xpReward: 75,
  },
  {
    id: 'streak_7',
    name: 'Week Warrior',
    description: 'Achieve a 7-day streak',
    icon: '🔥',
    category: 'streaks',
    condition: { type: 'streak', value: 7 },
    xpReward: 150,
  },
  {
    id: 'streak_14',
    name: 'Fortnight Fighter',
    description: 'Achieve a 14-day streak',
    icon: '⚔️',
    category: 'streaks',
    condition: { type: 'streak', value: 14 },
    xpReward: 300,
  },
  {
    id: 'streak_30',
    name: 'Monthly Master',
    description: 'Achieve a 30-day streak',
    icon: '⚡',
    category: 'streaks',
    condition: { type: 'streak', value: 30 },
    xpReward: 500,
  },
  {
    id: 'streak_60',
    name: 'Two Month Titan',
    description: 'Achieve a 60-day streak',
    icon: '🌟',
    category: 'streaks',
    condition: { type: 'streak', value: 60 },
    xpReward: 1000,
  },
  {
    id: 'streak_100',
    name: 'Legendary',
    description: 'Achieve a 100-day streak',
    icon: '👑',
    category: 'streaks',
    condition: { type: 'streak', value: 100 },
    xpReward: 2000,
  },

  // ==========================================
  // TODO Category
  // ==========================================
  {
    id: 'todo_1',
    name: 'Task Tamer',
    description: 'Complete your first TODO',
    icon: '✓',
    category: 'todos',
    condition: { type: 'todos', value: 1 },
    xpReward: 25,
  },
  {
    id: 'todo_10',
    name: 'Task Tracker',
    description: 'Complete 10 TODOs',
    icon: '📝',
    category: 'todos',
    condition: { type: 'todos', value: 10 },
    xpReward: 75,
  },
  {
    id: 'todo_25',
    name: 'Task Tackler',
    description: 'Complete 25 TODOs',
    icon: '📋',
    category: 'todos',
    condition: { type: 'todos', value: 25 },
    xpReward: 150,
  },
  {
    id: 'todo_50',
    name: 'Task Titan',
    description: 'Complete 50 TODOs',
    icon: '📊',
    category: 'todos',
    condition: { type: 'todos', value: 50 },
    xpReward: 300,
  },
  {
    id: 'todo_100',
    name: 'TODO Terminator',
    description: 'Complete 100 TODOs',
    icon: '🏆',
    category: 'todos',
    condition: { type: 'todos', value: 100 },
    xpReward: 500,
  },

  // ==========================================
  // Command Category
  // ==========================================
  {
    id: 'cmd_1',
    name: 'Command Creator',
    description: 'Create your first command',
    icon: '⌨️',
    category: 'commands',
    condition: { type: 'commands', value: 1 },
    xpReward: 25,
  },
  {
    id: 'cmd_5',
    name: 'Command Collector',
    description: 'Save 5 commands',
    icon: '📚',
    category: 'commands',
    condition: { type: 'commands', value: 5 },
    xpReward: 75,
  },
  {
    id: 'cmd_10',
    name: 'Command Curator',
    description: 'Save 10 commands',
    icon: '🗂️',
    category: 'commands',
    condition: { type: 'commands', value: 10 },
    xpReward: 100,
  },
  {
    id: 'cmd_25',
    name: 'Command Connoisseur',
    description: 'Save 25 commands',
    icon: '🎖️',
    category: 'commands',
    condition: { type: 'commands', value: 25 },
    xpReward: 200,
  },
  {
    id: 'cmd_ai',
    name: 'AI Whisperer',
    description: 'Generate 10 commands with AI',
    icon: '🤖',
    category: 'commands',
    condition: { type: 'special', value: 10 },
    xpReward: 200,
  },

  // ==========================================
  // Special (Secret) Achievements
  // ==========================================
  {
    id: 'night_owl',
    name: 'Night Owl',
    description: 'Code after midnight',
    icon: '🦉',
    category: 'special',
    condition: { type: 'special', value: 1 },
    xpReward: 100,
    secret: true,
  },
  {
    id: 'early_bird',
    name: 'Early Bird',
    description: 'Start coding before 6 AM',
    icon: '🐦',
    category: 'special',
    condition: { type: 'special', value: 1 },
    xpReward: 100,
    secret: true,
  },
  {
    id: 'weekend_warrior',
    name: 'Weekend Warrior',
    description: 'Complete focus sessions on both weekend days',
    icon: '🎮',
    category: 'special',
    condition: { type: 'special', value: 1 },
    xpReward: 150,
    secret: true,
  },
  {
    id: 'level_5',
    name: 'Rising Star',
    description: 'Reach companion level 5',
    icon: '⭐',
    category: 'special',
    condition: { type: 'level', value: 5 },
    xpReward: 100,
  },
  {
    id: 'level_10',
    name: 'Seasoned Pro',
    description: 'Reach companion level 10',
    icon: '🌠',
    category: 'special',
    condition: { type: 'level', value: 10 },
    xpReward: 250,
  },
  {
    id: 'level_25',
    name: 'Elite Coder',
    description: 'Reach companion level 25',
    icon: '💫',
    category: 'special',
    condition: { type: 'level', value: 25 },
    xpReward: 1000,
  },
  {
    id: 'perfectionist',
    name: 'Perfectionist',
    description: 'Complete daily goal 7 days in a row',
    icon: '✨',
    category: 'special',
    condition: { type: 'special', value: 7 },
    xpReward: 300,
    secret: true,
  },
  {
    id: 'first_sync',
    name: 'Cloud Connected',
    description: 'Sync your commands to the cloud',
    icon: '☁️',
    category: 'commands',
    condition: { type: 'special', value: 1 },
    xpReward: 100,
  },
];

// Helper functions
export function getAchievementById(id: string): Achievement | undefined {
  return ACHIEVEMENTS.find((a) => a.id === id);
}

export function getAchievementsByCategory(category: AchievementCategory): Achievement[] {
  return ACHIEVEMENTS.filter((a) => a.category === category);
}

export function getVisibleAchievements(unlockedIds: Set<string>): Achievement[] {
  return ACHIEVEMENTS.filter((a) => !a.secret || unlockedIds.has(a.id));
}

export function getTotalXPFromAchievements(): number {
  return ACHIEVEMENTS.reduce((sum, a) => sum + a.xpReward, 0);
}
