/**
 * Companion types and interfaces - Simplified
 */

/**
 * Available companion types
 */
export type CompanionType = 'cat' | 'dog' | 'robot' | 'plant' | 'flame';

/**
 * Companion mood states
 */
export type CompanionMood = 'happy' | 'focused' | 'tired' | 'celebrating';

/**
 * SVG animation states (maps to file names)
 */
export type CompanionSvgState = 'idle' | 'focus' | 'break' | 'celebrate';

/**
 * Companion state stored in globalState
 */
export interface CompanionState {
  type: CompanionType;
  mood: CompanionMood;
}

/**
 * Companion emojis for status bar
 */
export const COMPANION_EMOJIS: Record<CompanionType, Record<string, string>> = {
  cat: {
    idle: '🐱',
    focusing: '😺',
    break: '😸',
    paused: '😿',
    celebrating: '😻',
  },
  dog: {
    idle: '🐶',
    focusing: '🐕',
    break: '🦮',
    paused: '🐕‍🦺',
    celebrating: '🐩',
  },
  robot: {
    idle: '🤖',
    focusing: '🤖',
    break: '🔋',
    paused: '⏸️',
    celebrating: '🎉',
  },
  plant: {
    idle: '🌱',
    focusing: '🌿',
    break: '🌻',
    paused: '🥀',
    celebrating: '🌸',
  },
  flame: {
    idle: '🔥',
    focusing: '🔥',
    break: '✨',
    paused: '💫',
    celebrating: '🎆',
  },
};

/**
 * Companion display names
 */
export const COMPANION_NAMES: Record<CompanionType, string> = {
  cat: 'Cat',
  dog: 'Dog',
  robot: 'Robot',
  plant: 'Plant',
  flame: 'Flame',
};

/**
 * Default companion state
 */
export const DEFAULT_COMPANION_STATE: CompanionState = {
  type: 'cat',
  mood: 'happy',
};

/**
 * All available companions
 */
export const ALL_COMPANIONS: CompanionType[] = ['cat', 'dog', 'robot', 'plant', 'flame'];
