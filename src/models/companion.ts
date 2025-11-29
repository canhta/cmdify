/**
 * Companion types and interfaces - Enhanced with Evolution 2.0
 */

import {
  COMPANION_STATUS_CODICONS,
  COMPANION_TYPE_EMOJIS,
  COMPANION_MOOD_EMOJIS,
  ACCESSORY_EMOJIS,
} from '../utils/icons';

/**
 * Available companion types (including new unlockable ones)
 */
export type CompanionType =
  | 'cat' | 'dog' | 'robot' | 'plant' | 'flame'  // Original companions
  | 'fox' | 'owl' | 'panda' | 'star';              // New unlockable companions

/**
 * Companion mood states
 */
export type CompanionMood = 'happy' | 'focused' | 'tired' | 'celebrating';

/**
 * Re-export mood emojis from centralized icon system
 */
export const MOOD_EMOJIS = COMPANION_MOOD_EMOJIS;

/**
 * SVG animation states (maps to file names)
 */
export type CompanionSvgState = 'idle' | 'focus' | 'break' | 'celebrate';

/**
 * Accessory IDs for cosmetic items
 */
export type AccessoryId =
  | 'party_hat'
  | 'crown'
  | 'sunglasses'
  | 'nerd_glasses'
  | 'confetti';

/**
 * Unlock condition types
 */
export type UnlockConditionType = 'sessions' | 'streak' | 'todos' | 'level' | 'special';

/**
 * Unlock condition for companions and accessories
 */
export interface UnlockCondition {
  type: UnlockConditionType;
  value: number;
  description?: string;
}

/**
 * Accessory definition
 */
export interface Accessory {
  id: AccessoryId;
  name: string;
  category: 'hat' | 'glasses' | 'background';
  unlockedBy: UnlockCondition;
  emoji: string;
}

/**
 * Companion unlock definition
 */
export interface CompanionUnlock {
  type: CompanionType;
  name: string;
  emoji: string;
  unlockedBy: UnlockCondition;
  isDefault: boolean;
}

/**
 * Enhanced companion state with progression
 */
export interface CompanionState {
  type: CompanionType;
  mood: CompanionMood;
  name?: string;  // User-defined name (max 20 chars)

  // Progression fields
  level: number;
  experience: number;
  totalXP: number;

  // Unlocks
  unlockedCompanions: CompanionType[];
  unlockedAccessories: AccessoryId[];
  equippedAccessory?: AccessoryId;

  // Metadata
  joinedDate: string;

  // Special tracking for unlocks
  nightOwlCount?: number;  // Times used after midnight
}

/**
 * XP Rewards for different actions
 */
export const XP_REWARDS = {
  focusSessionComplete: 100,
  breakTaken: 25,
  todoComplete: 50,
  dailyGoalReached: 200,
  streakDay: 50,
  streakWeek: 500,
  streakMonth: 2000,
} as const;

/**
 * Calculate XP required for a given level (exponential curve)
 * Formula: 100 * 1.5^(level - 1)
 */
export function xpForLevel(level: number): number {
  return Math.floor(100 * Math.pow(1.5, level - 1));
}

/**
 * Calculate total XP required to reach a level from level 1
 */
export function totalXpForLevel(level: number): number {
  let total = 0;
  for (let i = 1; i < level; i++) {
    total += xpForLevel(i);
  }
  return total;
}

/**
 * Companion unlock conditions
 * Note: emoji values reference COMPANION_TYPE_EMOJIS from utils/icons
 */
export const COMPANION_UNLOCKS: CompanionUnlock[] = [
  {
    type: 'robot',
    name: 'Robot',
    emoji: COMPANION_TYPE_EMOJIS['robot'],
    unlockedBy: { type: 'level', value: 0 },  // Default
    isDefault: true,
  },
  {
    type: 'cat',
    name: 'Cat',
    emoji: COMPANION_TYPE_EMOJIS['cat'],
    unlockedBy: { type: 'sessions', value: 10, description: 'Complete 10 focus sessions' },
    isDefault: false,
  },
  {
    type: 'dog',
    name: 'Dog',
    emoji: COMPANION_TYPE_EMOJIS['dog'],
    unlockedBy: { type: 'sessions', value: 25, description: 'Complete 25 focus sessions' },
    isDefault: false,
  },
  {
    type: 'plant',
    name: 'Plant',
    emoji: COMPANION_TYPE_EMOJIS['plant'],
    unlockedBy: { type: 'streak', value: 7, description: 'Achieve 7-day streak' },
    isDefault: false,
  },
  {
    type: 'flame',
    name: 'Flame',
    emoji: COMPANION_TYPE_EMOJIS['flame'],
    unlockedBy: { type: 'streak', value: 30, description: 'Achieve 30-day streak' },
    isDefault: false,
  },
  {
    type: 'fox',
    name: 'Fox',
    emoji: COMPANION_TYPE_EMOJIS['fox'],
    unlockedBy: { type: 'todos', value: 50, description: 'Complete 50 TODOs' },
    isDefault: false,
  },
  {
    type: 'owl',
    name: 'Owl',
    emoji: COMPANION_TYPE_EMOJIS['owl'],
    unlockedBy: { type: 'special', value: 5, description: 'Use extension after midnight 5 times' },
    isDefault: false,
  },
  {
    type: 'panda',
    name: 'Panda',
    emoji: COMPANION_TYPE_EMOJIS['panda'],
    unlockedBy: { type: 'streak', value: 100, description: 'Achieve 100-day streak (legendary!)' },
    isDefault: false,
  },
  {
    type: 'star',
    name: 'Star',
    emoji: COMPANION_TYPE_EMOJIS['star'],
    unlockedBy: { type: 'level', value: 25, description: 'Reach level 25' },
    isDefault: false,
  },
];

/**
 * Accessory definitions
 * Note: emoji values reference ACCESSORY_EMOJIS from utils/icons
 */
export const ACCESSORIES: Accessory[] = [
  {
    id: 'party_hat',
    name: 'Party Hat',
    emoji: ACCESSORY_EMOJIS['party_hat'],
    category: 'hat',
    unlockedBy: { type: 'level', value: 5, description: 'Reach level 5' },
  },
  {
    id: 'crown',
    name: 'Crown',
    emoji: ACCESSORY_EMOJIS['crown'],
    category: 'hat',
    unlockedBy: { type: 'streak', value: 30, description: 'Achieve 30-day streak' },
  },
  {
    id: 'sunglasses',
    name: 'Sunglasses',
    emoji: ACCESSORY_EMOJIS['sunglasses'],
    category: 'glasses',
    unlockedBy: { type: 'sessions', value: 50, description: 'Complete 50 focus sessions' },
  },
  {
    id: 'nerd_glasses',
    name: 'Nerd Glasses',
    emoji: ACCESSORY_EMOJIS['nerd_glasses'],
    category: 'glasses',
    unlockedBy: { type: 'todos', value: 100, description: 'Complete 100 TODOs' },
  },
  {
    id: 'confetti',
    name: 'Confetti',
    emoji: ACCESSORY_EMOJIS['confetti'],
    category: 'background',
    unlockedBy: { type: 'level', value: 10, description: 'Reach level 10' },
  },
];

/**
 * Companion codicons for status bar (VS Code built-in icons)
 * Re-export from centralized icon system
 */
export const COMPANION_ICONS = COMPANION_STATUS_CODICONS;

/**
 * Companion display names
 */
export const COMPANION_NAMES: Record<CompanionType, string> = {
  cat: 'Cat',
  dog: 'Dog',
  robot: 'Robot',
  plant: 'Plant',
  flame: 'Flame',
  fox: 'Fox',
  owl: 'Owl',
  panda: 'Panda',
  star: 'Star',
};

/**
 * Default companion state (with progression)
 */
export const DEFAULT_COMPANION_STATE: CompanionState = {
  type: 'robot',  // Default companion
  mood: 'happy',
  level: 1,
  experience: 0,
  totalXP: 0,
  unlockedCompanions: ['robot'],  // Robot is unlocked by default
  unlockedAccessories: [],
  equippedAccessory: undefined,
  joinedDate: new Date().toISOString(),
  nightOwlCount: 0,
};

/**
 * All available companions
 */
export const ALL_COMPANIONS: CompanionType[] = [
  'robot', 'cat', 'dog', 'plant', 'flame',
  'fox', 'owl', 'panda', 'star'
];

// =============================================================================
// Companion Messages (Phase 4)
// =============================================================================

/**
 * Contextual message categories for companion
 */
export type CompanionMessageCategory = 
  | 'focusStart' 
  | 'focusComplete' 
  | 'breakStart' 
  | 'streakMilestone'
  | 'levelUp'
  | 'achievementUnlock'
  | 'idle'
  | 'welcomeBack'
  | 'todoComplete';

/**
 * Companion messages for different contexts
 */
export const COMPANION_MESSAGES: Record<CompanionMessageCategory, string[]> = {
  focusStart: [
    "Let's do this! 💪",
    "Focus mode activated!",
    "Time to get things done!",
    "You've got this! 🎯",
    "Let's crush it!"
  ],
  focusComplete: [
    "Great session! 🎉",
    "You crushed it!",
    "Well deserved break!",
    "Awesome work!",
    "That was productive!"
  ],
  breakStart: [
    "Take a breather! ☕",
    "Stretch time!",
    "Rest those eyes 👀",
    "You earned this break!",
    "Recharge mode! 🔋"
  ],
  streakMilestone: [
    "{name} is so proud of your {streak}-day streak! 🔥",
    "🔥 {streak} days! Keep it going!",
    "Wow! {streak} days strong! 💪"
  ],
  levelUp: [
    "🎉 Level up! {name} reached level {level}!",
    "Woohoo! Level {level} unlocked!",
    "{name} evolved to level {level}! ⭐"
  ],
  achievementUnlock: [
    "{name} helped you unlock {achievement}! 🏆",
    "Achievement unlocked: {achievement}! 🎊"
  ],
  idle: [
    "Ready when you are! 😊",
    "Waiting for you~",
    "Let's code something cool!",
    "💭"
  ],
  welcomeBack: [
    "Welcome back! Ready to code? 💻",
    "Missed you! Let's get started.",
    "{name} is happy to see you! 😊"
  ],
  todoComplete: [
    "One down! ✅",
    "Nice! Task complete!",
    "Checked off! 📋"
  ]
};

/**
 * Get random message from category with variable replacement
 */
export function getCompanionMessage(
  category: CompanionMessageCategory,
  variables?: Record<string, string | number>
): string {
  const messages = COMPANION_MESSAGES[category];
  const message = messages[Math.floor(Math.random() * messages.length)];
  
  if (!variables) {return message;}
  
  return message.replace(/\{(\w+)\}/g, (_, key) => 
    String(variables[key] ?? `{${key}}`)
  );
}

// =============================================================================
// Break Suggestions (Phase 4)
// =============================================================================

/**
 * Break activity suggestions by duration
 */
export const BREAK_SUGGESTIONS: Record<number, string[]> = {
  5: [
    '🙆 Stretch your arms and shoulders',
    '👀 Look at something 20 feet away for 20 seconds',
    '💧 Drink some water',
    '🚶 Stand up and walk around',
    '🧘 Take 5 deep breaths'
  ],
  10: [
    '🚶 Take a short walk',
    '🙆 Do some stretches',
    '🍎 Grab a healthy snack',
    '☕ Make a cup of tea or coffee',
    '🌿 Step outside for fresh air'
  ],
  15: [
    '🚶 Go outside briefly',
    '💪 Do a quick workout',
    '🧘 Practice meditation',
    '📱 Call a friend or family',
    '🎵 Listen to your favorite song'
  ]
};

/**
 * Get a random break suggestion for the given duration
 */
export function getBreakSuggestion(breakMinutes: number): string {
  // Find the closest matching duration
  const durations = Object.keys(BREAK_SUGGESTIONS).map(Number).sort((a, b) => a - b);
  let bestMatch = durations[0];
  
  for (const duration of durations) {
    if (Math.abs(duration - breakMinutes) < Math.abs(bestMatch - breakMinutes)) {
      bestMatch = duration;
    }
  }
  
  const suggestions = BREAK_SUGGESTIONS[bestMatch];
  return suggestions[Math.floor(Math.random() * suggestions.length)];
}

// =============================================================================
// Session Types (Phase 4)
// =============================================================================

/**
 * Predefined session type configurations
 */
export interface SessionType {
  id: string;
  name: string;
  focusMinutes: number;
  breakMinutes: number;
  icon: string;
  description: string;
}

/**
 * Available session types
 */
export const SESSION_TYPES: SessionType[] = [
  { 
    id: 'standard', 
    name: 'Standard', 
    focusMinutes: 25, 
    breakMinutes: 5, 
    icon: '🍅',
    description: 'Classic Pomodoro technique'
  },
  { 
    id: 'deep', 
    name: 'Deep Work', 
    focusMinutes: 50, 
    breakMinutes: 10, 
    icon: '🧠',
    description: 'For complex tasks requiring concentration'
  },
  { 
    id: 'quick', 
    name: 'Quick Task', 
    focusMinutes: 15, 
    breakMinutes: 3, 
    icon: '⚡',
    description: 'Short bursts for simple tasks'
  },
  { 
    id: 'marathon', 
    name: 'Marathon', 
    focusMinutes: 90, 
    breakMinutes: 15, 
    icon: '🏃',
    description: 'Extended focus for deep work'
  },
];
