# Changelog

All notable changes to Cmdify will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2025-12-01

### ✨ New Features

- **Bulk Actions** - Manage multiple items at once, similar to Source Control staging:
  - **Commands**: Delete selected, delete by tag, delete all
  - **TODOs**: Complete selected, complete by file, complete all
  - **Notes**: Delete for file, delete all
- All bulk actions available from view title menus and context menus
- Multi-select pickers for granular control over which items to affect
- Confirmation dialogs to prevent accidental deletions
- XP rewards for bulk TODO completions

## [1.0.1] - 2025-12-01

### 🐛 Bug Fixes

- **Fixed webview styling** - CSS styles are now embedded directly in the extension bundle, fixing broken UI in Welcome, Focus, and other panels
- **Fixed VS Code compatibility** - Lowered engine requirement from 1.106.1 to 1.85.0 for broader compatibility

### ✨ Improvements

- **Updated OpenAI models** - Added latest models with best price/performance options:
  - GPT-5 Nano ($0.05/1M input) - Best value
  - GPT-4.1 Nano ($0.10/1M input) - New recommended default
  - GPT-5 Mini, GPT-4.1 Mini, GPT-5, and more
- **Changed default model** - Now uses `gpt-4.1-nano` for optimal cost/quality balance

### 🧹 Cleanup

- Removed redundant CSS files (styles now bundled in code)

## [1.0.0] - 2025-11-29

### 🎉 Initial Release

**AI-Powered Command Generation**
- Generate CLI commands from natural language descriptions
- Support for OpenAI, Anthropic Claude, Azure OpenAI, and custom endpoints
- Smart detection of natural language vs direct commands
- Command library with tags, favorites, and fuzzy search
- Dynamic variables with `{{placeholder}}` syntax
- Safety warnings for destructive commands
- GitHub Gist sync for cross-machine access

**Focus Timer (Pomodoro)**
- Built-in Pomodoro timer with customizable durations
- Animated pixel art companions (robot, cat, dog, plant, flame)
- Unlockable companions (fox, owl, panda) via achievements
- Session tracking with daily streaks
- Companion leveling with XP system

**TODO Scanner & Reminders**
- Auto-detect TODO, FIXME, HACK, BUG comments
- Due date annotations (`@tomorrow`, `@next-week`, `@2024-12-01`)
- Sidebar organized by Overdue, Today, This Week, No Date
- Two-way sync between reminders and code comments
- Notification system with snooze options

**Achievement System**
- Unlock achievements for focus, streaks, TODOs, and commands
- XP rewards and progress tracking
- Secret achievements to discover
- Activity dashboard with coding insights

**Keyboard Shortcuts**
- `Cmd/Ctrl+Shift+C` — Create or run commands
