<div align="center">

# Cmdify

**Developer productivity toolkit for VS Code**

AI command generation, focus timer, TODO scanner, and achievements.

[![Version](https://img.shields.io/visual-studio-marketplace/v/canhta.cmdify?style=flat-square)](https://marketplace.visualstudio.com/items?itemName=canhta.cmdify)
[![Installs](https://img.shields.io/visual-studio-marketplace/i/canhta.cmdify?style=flat-square)](https://marketplace.visualstudio.com/items?itemName=canhta.cmdify)
[![License](https://img.shields.io/github/license/canhta/cmdify?style=flat-square)](LICENSE)

</div>

---

## Quick Start

1. Press `Cmd+Shift+C` (Mac) or `Ctrl+Shift+C` (Windows/Linux)
2. Type what you want: *"delete all merged git branches"*
3. Review and run the generated command

## Features

**🤖 AI Command Generation**  
Supports OpenAI, Anthropic Claude, Ollama (local/free), Azure OpenAI, and custom endpoints.

**📚 Command Library**  
Save, organize with tags, and reuse commands. Sync across machines via GitHub Gist.

**⏱️ Focus Timer**  
Pomodoro timer with animated companions, session tracking, and streak counter.

**📋 TODO Scanner**  
Auto-detects `TODO`, `FIXME`, `HACK` comments. Set reminders with `@tomorrow` or `@2024-12-01`.

## AI Provider Setup

1. Run `Cmdify: Configure AI Provider` from Command Palette
2. Select your provider and enter API key
3. Choose a model

> 💡 **Ollama** runs locally — no API key needed!

## Key Commands

| Command | Description |
|---------|-------------|
| `Cmdify: Create Command` | Generate command from natural language |
| `Cmdify: Run Command` | Execute a saved command |
| `Cmdify: Sync Commands` | Sync with GitHub Gist |
| `Cmdify Focus: Start` | Start focus timer |
| `Cmdify TODOs: Scan` | Scan workspace for TODOs |

## Settings

| Setting | Description | Default |
|---------|-------------|---------|
| `cmdify.ai.provider` | AI provider | `openai` |
| `cmdify.ai.model` | Model to use | `gpt-4o-mini` |
| `cmdify.focus.focusDuration` | Focus duration (min) | `25` |
| `cmdify.todos.scanOnSave` | Auto-scan on save | `true` |

---

<div align="center">

**[Documentation](https://github.com/canhta/cmdify#readme)** · **[Report Issue](https://github.com/canhta/cmdify/issues)** · **[Support on Ko-fi](https://ko-fi.com/canhta)**

</div>
