/**
 * Code Note data model
 * Notes attached to code selections in the workspace
 */

/**
 * A note attached to a code selection
 */
export interface CodeNote {
  id: string;
  filePath: string;
  startLine: number; // 0-based
  endLine: number; // 0-based
  startCharacter: number;
  endCharacter: number;
  selectedText: string; // The code that was selected
  note: string; // The user's note
  language?: string; // Programming language of the code
  languageId?: string; // VS Code language ID
  createdAt: string;
  updatedAt: string;
  tags?: string[];
  color?: NoteColor; // Optional color for visual distinction
}

/**
 * Available colors for notes
 */
export type NoteColor = 'yellow' | 'green' | 'blue' | 'purple' | 'red' | 'orange';

/**
 * Note color configuration
 */
export const NOTE_COLORS: Record<NoteColor, { label: string; hex: string }> = {
  yellow: { label: 'Yellow', hex: '#fef08a' },
  green: { label: 'Green', hex: '#bbf7d0' },
  blue: { label: 'Blue', hex: '#bfdbfe' },
  purple: { label: 'Purple', hex: '#ddd6fe' },
  red: { label: 'Red', hex: '#fecaca' },
  orange: { label: 'Orange', hex: '#fed7aa' },
};

/**
 * Language display configuration with VS Code theme icon names
 */
export const LANGUAGE_ICONS: Record<string, { icon: string; label: string }> = {
  typescript: { icon: 'symbol-class', label: 'TypeScript' },
  javascript: { icon: 'symbol-method', label: 'JavaScript' },
  typescriptreact: { icon: 'symbol-interface', label: 'TSX' },
  javascriptreact: { icon: 'symbol-interface', label: 'JSX' },
  python: { icon: 'symbol-misc', label: 'Python' },
  java: { icon: 'symbol-class', label: 'Java' },
  csharp: { icon: 'symbol-class', label: 'C#' },
  cpp: { icon: 'symbol-class', label: 'C++' },
  c: { icon: 'symbol-variable', label: 'C' },
  go: { icon: 'symbol-package', label: 'Go' },
  rust: { icon: 'symbol-struct', label: 'Rust' },
  ruby: { icon: 'ruby', label: 'Ruby' },
  php: { icon: 'symbol-method', label: 'PHP' },
  swift: { icon: 'symbol-class', label: 'Swift' },
  kotlin: { icon: 'symbol-class', label: 'Kotlin' },
  html: { icon: 'code', label: 'HTML' },
  css: { icon: 'symbol-color', label: 'CSS' },
  scss: { icon: 'symbol-color', label: 'SCSS' },
  less: { icon: 'symbol-color', label: 'Less' },
  json: { icon: 'json', label: 'JSON' },
  yaml: { icon: 'symbol-namespace', label: 'YAML' },
  xml: { icon: 'code', label: 'XML' },
  markdown: { icon: 'markdown', label: 'Markdown' },
  sql: { icon: 'database', label: 'SQL' },
  shell: { icon: 'terminal', label: 'Shell' },
  bash: { icon: 'terminal-bash', label: 'Bash' },
  powershell: { icon: 'terminal-powershell', label: 'PowerShell' },
  dockerfile: { icon: 'package', label: 'Dockerfile' },
  vue: { icon: 'symbol-event', label: 'Vue' },
  svelte: { icon: 'symbol-event', label: 'Svelte' },
  plaintext: { icon: 'file-text', label: 'Plain Text' },
};

/**
 * Get language display info
 */
export function getLanguageInfo(languageId?: string): { icon: string; label: string } {
  if (!languageId) {
    return { icon: 'file', label: 'Unknown' };
  }
  return LANGUAGE_ICONS[languageId] || { icon: 'file-code', label: languageId };
}

/**
 * Generate a unique ID for a note
 */
export function generateNoteId(): string {
  return `note_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
