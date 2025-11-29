/**
 * TODO Parser
 * Handles parsing of TODO comments from source code
 */

import * as crypto from 'crypto';
import {
  TodoPattern,
  DEFAULT_TODO_PATTERNS,
  inferPriorityFromType,
  DetectedTodo,
} from '../models/todo';
import { parseDueDateString } from '../utils/dateUtils';

/**
 * Metadata format configuration
 */
export interface MetadataFormat {
  datePattern: string;
  assigneePattern: string;
  metadataWrapper: string;
  dateSeparator: string;
}

/**
 * Default metadata format
 */
export const DEFAULT_METADATA_FORMAT: MetadataFormat = {
  datePattern: 'due@(\\d{4}-\\d{2}-\\d{2})',
  assigneePattern: '@assigned:([\\w\\s]+)',
  metadataWrapper: '({metadata})',
  dateSeparator: ', ',
};

/**
 * Parsed TODO result
 */
export interface ParsedTodo {
  id: string;
  type: string;
  text: string;
  description: string;
  dueDate?: Date;
  dueDateRaw?: string;
  assignee?: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  lineNumber: number;
}

/**
 * Parser configuration
 */
export interface TodoParserConfig {
  customPatterns: string[];
  metadataFormat: MetadataFormat;
}

/**
 * TODO Parser
 * Extracts TODO comments from source code lines
 */
export class TodoParser {
  private customPatterns: TodoPattern[] = [];
  private datePattern: RegExp;
  private assigneePattern: RegExp;
  private metadataPattern: RegExp;
  private config: TodoParserConfig;

  constructor(config?: Partial<TodoParserConfig>) {
    this.config = {
      customPatterns: config?.customPatterns || [],
      metadataFormat: { ...DEFAULT_METADATA_FORMAT, ...config?.metadataFormat },
    };

    this.datePattern = this.compilePattern(this.config.metadataFormat.datePattern);
    this.assigneePattern = this.compilePattern(this.config.metadataFormat.assigneePattern);
    this.metadataPattern = this.buildMetadataPattern();
    this.parseCustomPatterns();
  }

  /**
   * Compile a regex pattern from string
   */
  private compilePattern(pattern: string): RegExp {
    try {
      return new RegExp(pattern, 'i');
    } catch (e) {
      console.warn(`Invalid regex pattern: ${pattern}, using default`);
      return new RegExp(DEFAULT_METADATA_FORMAT.datePattern, 'i');
    }
  }

  /**
   * Build the metadata wrapper pattern from config
   * e.g., "({metadata})" becomes /\s*\(([^)]+)\)\s*$/
   */
  private buildMetadataPattern(): RegExp {
    const wrapper = this.config.metadataFormat.metadataWrapper;
    // Escape special regex chars except for the placeholder
    const token = '___METADATA___';
    const withToken = wrapper.replace('{metadata}', token);
    const escaped = withToken.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = escaped.replace(token, '([^)]+)');
    return new RegExp(`\\s*${pattern}\\s*$`);
  }

  /**
   * Parse custom regex patterns from config
   */
  private parseCustomPatterns(): void {
    this.customPatterns = [];
    for (const pattern of this.config.customPatterns) {
      try {
        const regex = new RegExp(pattern, 'gi');
        this.customPatterns.push({ regex, type: 'CUSTOM' });
      } catch (e) {
        console.warn(`Invalid custom TODO pattern: ${pattern}`);
      }
    }
  }

  /**
   * Update parser configuration
   */
  updateConfig(config: Partial<TodoParserConfig>): void {
    if (config.metadataFormat) {
      this.config.metadataFormat = { ...this.config.metadataFormat, ...config.metadataFormat };
      this.datePattern = this.compilePattern(this.config.metadataFormat.datePattern);
      this.assigneePattern = this.compilePattern(this.config.metadataFormat.assigneePattern);
      this.metadataPattern = this.buildMetadataPattern();
    }
    if (config.customPatterns) {
      this.config.customPatterns = config.customPatterns;
      this.parseCustomPatterns();
    }
  }

  /**
   * Generate a unique ID for a TODO
   */
  generateId(filePath: string, lineNumber: number): string {
    const hash = crypto.createHash('md5');
    hash.update(`${filePath}:${lineNumber}`);
    return hash.digest('hex').substring(0, 12);
  }

  /**
   * Parse a single line for TODO comments
   */
  parseLine(line: string, lineNumber: number, filePath: string): ParsedTodo[] {
    const todos: ParsedTodo[] = [];
    const allPatterns = [...DEFAULT_TODO_PATTERNS, ...this.customPatterns];

    for (const pattern of allPatterns) {
      // Reset regex lastIndex
      pattern.regex.lastIndex = 0;
      let match: RegExpExecArray | null;

      while ((match = pattern.regex.exec(line)) !== null) {
        const todoType = match[1]?.toUpperCase() || pattern.type;
        const description = match[2]?.trim() || match[0];
        const fullText = match[0];

        // Parse metadata
        const { dueDate, dueDateRaw, assignee, cleanDescription } = this.parseMetadata(description);

        const id = this.generateId(filePath, lineNumber);

        const todo: ParsedTodo = {
          id,
          type: todoType,
          text: fullText,
          description: cleanDescription,
          dueDate,
          dueDateRaw,
          assignee,
          priority: inferPriorityFromType(todoType),
          lineNumber,
        };

        todos.push(todo);

        // Only match once per line per pattern type
        break;
      }
    }

    return todos;
  }

  /**
   * Parse metadata from description
   */
  private parseMetadata(description: string): {
    dueDate?: Date;
    dueDateRaw?: string;
    assignee?: string;
    cleanDescription: string;
  } {
    let dueDate: Date | undefined;
    let dueDateRaw: string | undefined;
    let assignee: string | undefined;

    // Try to parse from metadata block using configured patterns
    const metadataMatch = this.metadataPattern.exec(description);
    if (metadataMatch) {
      const metadataContent = metadataMatch[1];

      // Parse due date from metadata
      const dateMatch = this.datePattern.exec(metadataContent);
      if (dateMatch && dateMatch[1]) {
        dueDateRaw = dateMatch[1];
        dueDate = parseDueDateString(dueDateRaw);
      }

      // Parse assignee from metadata
      const assigneeMatch = this.assigneePattern.exec(metadataContent);
      if (assigneeMatch) {
        assignee = assigneeMatch[1].trim();
      }
    }

    // Clean description by removing metadata block
    const cleanDescription = description.replace(this.metadataPattern, '').trim();

    return { dueDate, dueDateRaw, assignee, cleanDescription };
  }

  /**
   * Parse all lines in a file
   */
  parseLines(lines: string[], filePath: string): ParsedTodo[] {
    const todos: ParsedTodo[] = [];

    for (let lineNum = 0; lineNum < lines.length; lineNum++) {
      const lineTodos = this.parseLine(lines[lineNum], lineNum, filePath);
      todos.push(...lineTodos);
    }

    return todos;
  }

  /**
   * Get the compiled patterns for external use
   */
  getMetadataPatterns(): { datePattern: RegExp; assigneePattern: RegExp; metadataPattern: RegExp } {
    return {
      datePattern: this.datePattern,
      assigneePattern: this.assigneePattern,
      metadataPattern: this.metadataPattern,
    };
  }

  /**
   * Get metadata format config
   */
  getMetadataFormat(): MetadataFormat {
    return { ...this.config.metadataFormat };
  }
}
