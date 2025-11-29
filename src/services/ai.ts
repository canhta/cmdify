import * as vscode from 'vscode';
import { CommandVariable } from '../models/command';

export interface AIContext {
  os: string;
  shell: string;
  existingTags?: string[];
}

export interface AIResponse {
  command: string;
  explanation?: string;
  variables?: CommandVariable[];
  suggestedTags?: string[];
}

export interface AIProvider {
  id: string;
  name: string;
  generate(prompt: string, context: AIContext): Promise<AIResponse>;
}

// Cached system info (doesn't change during session)
let cachedOS: string | undefined;
let cachedShell: string | undefined;

/**
 * Get the system prompt for AI command generation
 */
export function getSystemPrompt(context: AIContext): string {
  return `You are a CLI command generator. Convert natural language to shell commands.

Context:
- OS: ${context.os}
- Shell: ${context.shell}

Rules:
1. Return ONLY valid shell commands
2. Use {{variable_name}} for user-configurable values
3. Prefer safe, portable commands
4. For destructive operations, prefer safer alternatives when possible

Response format (JSON):
{
  "command": "the shell command",
  "explanation": "one-line explanation (optional)",
  "variables": [
    {"name": "var_name", "defaultValue": "value", "description": "what it is"}
  ],
  "suggestedTags": ["tag1", "tag2"] // Maximum 2 tags
}`;
}

/**
 * Parse AI response into AIResponse object
 */
export function parseAIResponse(response: string): AIResponse {
  try {
    // Try to find JSON in the response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        command: parsed.command || '',
        explanation: parsed.explanation,
        variables: parsed.variables?.map((v: Record<string, string>) => ({
          name: v.name,
          defaultValue: v.defaultValue || v.default,
          description: v.description,
        })),
        suggestedTags: (parsed.suggestedTags || parsed.tags)?.slice(0, 2),
      };
    }
    // If no JSON found, treat the whole response as a command
    return { command: response.trim() };
  } catch {
    // If parsing fails, treat the response as a command
    return { command: response.trim() };
  }
}

/**
 * Get the current OS name (cached)
 */
export function getOS(): string {
  if (cachedOS) {
    return cachedOS;
  }

  switch (process.platform) {
    case 'darwin':
      cachedOS = 'macOS';
      break;
    case 'win32':
      cachedOS = 'Windows';
      break;
    case 'linux':
      cachedOS = 'Linux';
      break;
    default:
      cachedOS = process.platform;
  }

  return cachedOS;
}

/**
 * Get the current shell (cached with config listener)
 */
export function getShell(): string {
  // Check if we need to refresh cache
  if (cachedShell) {
    return cachedShell;
  }

  const config = vscode.workspace.getConfiguration('terminal.integrated');
  const defaultProfile = config.get<string>('defaultProfile.' + getOSKey());

  if (defaultProfile) {
    cachedShell = defaultProfile.toLowerCase();
  } else {
    // Fallback
    cachedShell = process.platform === 'win32' ? 'powershell' : 'zsh';
  }

  return cachedShell;
}

/**
 * Clear cached values (call when config changes)
 */
export function clearCache(): void {
  cachedShell = undefined;
}

function getOSKey(): string {
  switch (process.platform) {
    case 'darwin':
      return 'osx';
    case 'win32':
      return 'windows';
    default:
      return 'linux';
  }
}

/**
 * Create AI context
 */
export function createAIContext(existingTags?: string[]): AIContext {
  return {
    os: getOS(),
    shell: getShell(),
    existingTags,
  };
}

/**
 * Detect if input looks like a natural language prompt or an actual command
 */
export function detectInputType(input: string): 'natural' | 'command' {
  const commandIndicators = [
    /^(git|npm|yarn|pnpm|docker|kubectl|aws|gcloud|az|terraform|ansible)\s/,
    /\|/, // Has pipe
    /&&|\|\|/, // Has operators
    /^[a-z]+\s+-/, // Has flags
    /\$\(|\`/, // Has subshell
    /^(cd|ls|rm|cp|mv|cat|echo|grep|find|chmod|chown|mkdir|touch|tar|curl|wget|ssh|scp)\s/,
    /^(python|node|ruby|php|go|cargo|make|cmake|gcc|javac)\s/,
    /^(brew|apt|apt-get|yum|dnf|pacman)\s/,
  ];

  return commandIndicators.some((r) => r.test(input.trim())) ? 'command' : 'natural';
}
