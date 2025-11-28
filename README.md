# Cmdify

AI-powered CLI command manager for VS Code. Describe what you want, get the command.

## Features

- **AI Command Generation** - Describe in plain English, get shell commands
- **Smart Detection** - Auto-detects if input is natural language or a command
- **Multiple AI Providers** - OpenAI, Anthropic Claude, or local Ollama
- **Command Library** - Save, organize, and reuse commands with tags
- **Variable Support** - Use `{{variable}}` syntax for dynamic commands
- **Safety Warnings** - Alerts before running destructive commands
- **GitHub Sync** - Sync commands across machines via Gist

## Quick Start

1. Press `Cmd+Shift+C` (Mac) or `Ctrl+Shift+C` (Windows/Linux)
2. Type what you want to do: *"delete all merged git branches"*
3. Review the generated command and save or run it

## Commands

| Command | Description |
|---------|-------------|
| `Cmdify: Create Command` | Create via AI or manual entry |
| `Cmdify: Run Command` | Execute a saved command |
| `Cmdify: Search Commands` | Find and run commands |
| `Cmdify: Configure AI Provider` | Set up OpenAI/Anthropic/Ollama |
| `Cmdify: Sync Commands` | Sync with GitHub Gist |

## Settings

| Setting | Description | Default |
|---------|-------------|--------|
| `cmdify.ai.provider` | AI provider (openai/anthropic/ollama) | `openai` |
| `cmdify.ai.model` | Model to use | `gpt-4o-mini` |
| `cmdify.execution.confirmDestructive` | Warn on dangerous commands | `true` |
| `cmdify.view.groupBy` | Group commands by tags/source/none | `tags` |
| `cmdify.sync.enabled` | Enable GitHub sync | `false` |

## AI Provider Setup

1. Run `Cmdify: Configure AI Provider`
2. Select your provider and enter API key
3. Choose a model

**Ollama** runs locally - no API key needed.

## License

MIT
