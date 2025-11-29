/**
 * Security service for detecting destructive commands
 */

interface DestructivePattern {
  pattern: RegExp;
  label: string;
}

export interface SecurityAnalysis {
  blocked: boolean;
  warnings: string[];
}

const DESTRUCTIVE_PATTERNS: DestructivePattern[] = [
  { pattern: /rm\s+-[rf]*\s/i, label: 'rm (delete files)' },
  { pattern: /sudo\s/i, label: 'sudo (elevated privileges)' },
  { pattern: />\s*\/dev\//i, label: 'write to device' },
  { pattern: /mkfs/i, label: 'format filesystem' },
  { pattern: /dd\s/i, label: 'dd (disk copy)' },
  { pattern: /chmod\s+777/i, label: 'chmod 777 (world writable)' },
  { pattern: /rm\s+-rf\s+\/(?!\w)/i, label: 'rm -rf / (delete root)' },
  { pattern: />\s*\/etc\//i, label: 'write to /etc' },
  { pattern: /kill\s+-9/i, label: 'kill -9 (force kill)' },
  { pattern: /pkill/i, label: 'pkill (kill processes)' },
  { pattern: /shutdown/i, label: 'shutdown' },
  { pattern: /reboot/i, label: 'reboot' },
  { pattern: /init\s+[0-6]/i, label: 'init (change runlevel)' },
  { pattern: /systemctl\s+(stop|disable|mask)/i, label: 'systemctl stop/disable' },
  { pattern: /iptables\s+-F/i, label: 'iptables -F (flush rules)' },
  { pattern: /curl\s.*\|\s*(ba)?sh/i, label: 'curl pipe to shell' },
  { pattern: /wget\s.*\|\s*(ba)?sh/i, label: 'wget pipe to shell' },
];

const BLOCKED_PATTERNS: RegExp[] = [
  /:()\s*{\s*:|:&\s*};:/, // Fork bomb - never allow
  /rm\s+-rf\s+\/\s*$/, // rm -rf / (exact match)
  />\s*\/dev\/(sda|hda|nvme)/i, // Direct disk write
];

/**
 * Analyze a command for security concerns
 */
export function analyzeCommand(command: string): SecurityAnalysis {
  const blocked = BLOCKED_PATTERNS.some((p) => p.test(command));

  const warnings = DESTRUCTIVE_PATTERNS.filter((p) => p.pattern.test(command)).map((p) => p.label);

  return { blocked, warnings };
}

/**
 * Check if a command is destructive
 */
export function isDestructive(command: string): boolean {
  const analysis = analyzeCommand(command);
  return analysis.blocked || analysis.warnings.length > 0;
}

/**
 * Get warning message for destructive commands
 */
export function getWarningMessage(analysis: SecurityAnalysis): string {
  if (analysis.blocked) {
    return 'This command is blocked for safety reasons.';
  }

  if (analysis.warnings.length === 0) {
    return '';
  }

  if (analysis.warnings.length === 1) {
    return `Detected: ${analysis.warnings[0]}`;
  }

  return `Detected: ${analysis.warnings.join(', ')}`;
}
