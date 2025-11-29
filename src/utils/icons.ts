/**
 * Centralized Icon System
 *
 * This module provides a consistent icon system across the extension.
 *
 * Icon Types:
 * - ThemeIcon: VS Code built-in icons for tree views and native UI
 * - Codicon: Text format $(icon-name) for status bar
 * - Emoji: Unicode characters for webview panels and notifications
 */

import * as vscode from 'vscode';

// ============================================
// ThemeIcon Definitions (for Tree Views)
// ============================================

/**
 * TODO type icons for tree views
 */
export const TODO_TYPE_THEME_ICONS: Record<string, string> = {
  TODO: 'checklist',
  FIXME: 'tools',
  BUG: 'bug',
  HACK: 'zap',
  XXX: 'warning',
  OPTIMIZE: 'rocket',
  REVIEW: 'eye',
  DEFAULT: 'note',
};

/**
 * TODO category icons for tree views
 */
export const TODO_CATEGORY_THEME_ICONS: Record<string, string> = {
  overdue: 'error',
  today: 'calendar',
  thisWeek: 'watch',
  upcoming: 'clock',
  noDate: 'note',
  completed: 'pass-filled',
  reminder: 'bell',
};

/**
 * Command source icons for tree views
 */
export const COMMAND_SOURCE_THEME_ICONS: Record<string, string> = {
  ai: 'sparkle',
  manual: 'edit',
  imported: 'cloud-download',
  shared: 'cloud',
  DEFAULT: 'terminal',
};

/**
 * Command type icons based on command content
 */
export const COMMAND_TYPE_THEME_ICONS: Record<string, string> = {
  'git-commit': 'git-commit',
  'git-push': 'git-pull-request',
  'git-branch': 'git-branch',
  'git-merge': 'git-merge',
  'git-stash': 'git-stash',
  'git-default': 'git-commit',
  package: 'package',
  docker: 'server',
  file: 'file',
  folder: 'folder',
  network: 'globe',
  python: 'symbol-misc',
  build: 'tools',
  text: 'output',
  system: 'settings-gear',
  DEFAULT: 'terminal',
};

/**
 * Category icons for tree views
 */
export const CATEGORY_THEME_ICONS: Record<string, string> = {
  favorites: 'star-full',
  recent: 'history',
  tag: 'tag',
  source: 'symbol-misc',
  mostUsed: 'graph',
};

// ============================================
// Codicon Definitions (for Status Bar)
// ============================================

/**
 * Companion status codicons for status bar
 */
export const COMPANION_STATUS_CODICONS: Record<string, Record<string, string>> = {
  cat: {
    idle: '$(smiley)',
    focusing: '$(flame)',
    break: '$(coffee)',
    paused: '$(watch)',
    celebrating: '$(star-full)',
  },
  dog: {
    idle: '$(smiley)',
    focusing: '$(flame)',
    break: '$(coffee)',
    paused: '$(watch)',
    celebrating: '$(star-full)',
  },
  robot: {
    idle: '$(hubot)',
    focusing: '$(flame)',
    break: '$(coffee)',
    paused: '$(watch)',
    celebrating: '$(star-full)',
  },
  plant: {
    idle: '$(smiley)',
    focusing: '$(flame)',
    break: '$(coffee)',
    paused: '$(watch)',
    celebrating: '$(star-full)',
  },
  flame: {
    idle: '$(flame)',
    focusing: '$(flame)',
    break: '$(coffee)',
    paused: '$(watch)',
    celebrating: '$(star-full)',
  },
  fox: {
    idle: '$(smiley)',
    focusing: '$(flame)',
    break: '$(coffee)',
    paused: '$(watch)',
    celebrating: '$(star-full)',
  },
  owl: {
    idle: '$(smiley)',
    focusing: '$(flame)',
    break: '$(coffee)',
    paused: '$(watch)',
    celebrating: '$(star-full)',
  },
  panda: {
    idle: '$(smiley)',
    focusing: '$(flame)',
    break: '$(coffee)',
    paused: '$(watch)',
    celebrating: '$(star-full)',
  },
  star: {
    idle: '$(star-full)',
    focusing: '$(flame)',
    break: '$(coffee)',
    paused: '$(watch)',
    celebrating: '$(star-full)',
  },
};

// ============================================
// Emoji Definitions (for Webviews)
// ============================================

/**
 * Companion type emojis
 */
export const COMPANION_TYPE_EMOJIS: Record<string, string> = {
  robot: '🤖',
  cat: '🐱',
  dog: '🐕',
  plant: '🌱',
  flame: '🔥',
  fox: '🦊',
  owl: '🦉',
  panda: '🐼',
  star: '⭐',
};

/**
 * Companion mood emojis
 */
export const COMPANION_MOOD_EMOJIS: Record<string, string> = {
  happy: '😊',
  focused: '🎯',
  tired: '😫',
  celebrating: '🤩',
};

/**
 * Accessory emojis
 */
export const ACCESSORY_EMOJIS: Record<string, string> = {
  party_hat: '🎩',
  crown: '👑',
  sunglasses: '😎',
  nerd_glasses: '🤓',
  confetti: '🎊',
};

/**
 * Feature icons for onboarding
 */
export const FEATURE_EMOJIS: Record<string, string> = {
  ai: '✨',
  focus: '🍅',
  todo: '📋',
  achievement: '🏆',
  keyboard: '⌨️',
  companion: '🤖',
};

/**
 * AI provider icons
 */
export const AI_PROVIDER_EMOJIS: Record<string, string> = {
  openai: '🧠',
  anthropic: '🤖',
  ollama: '🦙',
  azure: '☁️',
  custom: '⚙️',
};

// ============================================
// SVG Icons (for Webview Controls)
// ============================================

/**
 * Control button SVG icons
 */
export const CONTROL_SVGS = {
  play: '<svg viewBox="0 0 16 16"><path d="M4 2l10 6-10 6V2z"/></svg>',
  pause: '<svg viewBox="0 0 16 16"><path d="M4 2h3v12H4V2zm5 0h3v12H9V2z"/></svg>',
  skip: '<svg viewBox="0 0 16 16"><path d="M2 2l8 6-8 6V2zm9 0h3v12h-3V2z"/></svg>',
  stop: '<svg viewBox="0 0 16 16"><path d="M3 3h10v10H3z"/></svg>',
};

// ============================================
// Helper Functions
// ============================================

/**
 * Get ThemeIcon for a TODO type
 */
export function getTodoThemeIcon(type: string): vscode.ThemeIcon {
  const upperType = type.toUpperCase();
  const iconName = TODO_TYPE_THEME_ICONS[upperType] || TODO_TYPE_THEME_ICONS['DEFAULT'];
  return new vscode.ThemeIcon(iconName);
}

/**
 * Get ThemeIcon for a TODO category
 */
export function getTodoCategoryThemeIcon(category: string): vscode.ThemeIcon {
  const iconName = TODO_CATEGORY_THEME_ICONS[category] || TODO_CATEGORY_THEME_ICONS['noDate'];
  return new vscode.ThemeIcon(iconName);
}

/**
 * Get ThemeIcon for command source
 */
export function getCommandSourceThemeIcon(source: string): vscode.ThemeIcon {
  const iconName = COMMAND_SOURCE_THEME_ICONS[source] || COMMAND_SOURCE_THEME_ICONS['DEFAULT'];
  return new vscode.ThemeIcon(iconName);
}

/**
 * Get companion status codicon for status bar
 */
export function getCompanionCodicon(companionType: string, status: string): string {
  const icons = COMPANION_STATUS_CODICONS[companionType] || COMPANION_STATUS_CODICONS['robot'];
  return icons[status] || icons['idle'];
}

/**
 * Get companion type emoji
 */
export function getCompanionEmoji(companionType: string): string {
  return COMPANION_TYPE_EMOJIS[companionType] || COMPANION_TYPE_EMOJIS['robot'];
}
