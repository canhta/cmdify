/**
 * File Scanner
 * Handles file system operations for TODO scanning
 */

import * as vscode from 'vscode';

/**
 * File scanner configuration
 */
export interface FileScannerConfig {
  includePatterns: string[];
  excludePatterns: string[];
  scanOnSave: boolean;
}

/**
 * Default file scanner configuration
 */
export const DEFAULT_FILE_SCANNER_CONFIG: FileScannerConfig = {
  includePatterns: ['**/*.ts', '**/*.js', '**/*.tsx', '**/*.jsx', '**/*.py', '**/*.java'],
  excludePatterns: ['**/node_modules/**', '**/dist/**', '**/build/**', '**/.git/**'],
  scanOnSave: true,
};

/**
 * File Scanner Service
 * Handles workspace file discovery and monitoring
 */
export class FileScanner implements vscode.Disposable {
  private disposables: vscode.Disposable[] = [];
  private config: FileScannerConfig;

  // Event emitters
  private readonly _onFileSaved = new vscode.EventEmitter<vscode.Uri>();
  readonly onFileSaved = this._onFileSaved.event;

  private readonly _onFileDeleted = new vscode.EventEmitter<vscode.Uri[]>();
  readonly onFileDeleted = this._onFileDeleted.event;

  constructor(config?: Partial<FileScannerConfig>) {
    this.config = { ...DEFAULT_FILE_SCANNER_CONFIG, ...config };
    this.setupFileWatchers();
  }

  /**
   * Setup file system watchers
   */
  private setupFileWatchers(): void {
    // Listen for file saves
    this.disposables.push(
      vscode.workspace.onDidSaveTextDocument((doc) => {
        if (this.config.scanOnSave && this.shouldScanFile(doc.uri)) {
          this._onFileSaved.fire(doc.uri);
        }
      })
    );

    // Listen for file deletions
    this.disposables.push(
      vscode.workspace.onDidDeleteFiles((e) => {
        const relevantFiles = e.files.filter((uri) => this.shouldScanFile(uri));
        if (relevantFiles.length > 0) {
          this._onFileDeleted.fire(relevantFiles);
        }
      })
    );
  }

  /**
   * Update scanner configuration
   */
  updateConfig(config: Partial<FileScannerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Check if a file should be scanned
   */
  shouldScanFile(uri: vscode.Uri): boolean {
    const relativePath = vscode.workspace.asRelativePath(uri);

    // Check exclude patterns first
    for (const pattern of this.config.excludePatterns) {
      if (this.matchGlob(relativePath, pattern)) {
        return false;
      }
    }

    // Check include patterns
    for (const pattern of this.config.includePatterns) {
      if (this.matchGlob(relativePath, pattern)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Simple glob matching (simplified for common patterns)
   */
  matchGlob(path: string, pattern: string): boolean {
    // Convert glob to regex
    let regexStr = pattern
      .replace(/\./g, '\\.')
      .replace(/\*\*/g, '.*')
      .replace(/\*/g, '[^/]*')
      .replace(/\?/g, '.');

    try {
      const regex = new RegExp(`^${regexStr}$`, 'i');
      return regex.test(path);
    } catch {
      return false;
    }
  }

  /**
   * Find files matching the configured patterns
   */
  async findFiles(maxResults: number = 1000): Promise<vscode.Uri[]> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
      return [];
    }

    const includePattern = `{${this.config.includePatterns.join(',')}}`;
    const excludePattern = `{${this.config.excludePatterns.join(',')}}`;

    try {
      return await vscode.workspace.findFiles(includePattern, excludePattern, maxResults);
    } catch (error) {
      console.error('Error finding files:', error);
      return [];
    }
  }

  /**
   * Scan files in batches for better performance
   */
  async scanFilesInBatches<T>(
    files: vscode.Uri[],
    processor: (uri: vscode.Uri) => Promise<T>,
    batchSize: number = 20
  ): Promise<T[]> {
    const results: T[] = [];

    for (let i = 0; i < files.length; i += batchSize) {
      const batch = files.slice(i, i + batchSize);
      const batchResults = await Promise.all(batch.map(processor));
      results.push(...batchResults);
    }

    return results;
  }

  /**
   * Read file content
   */
  async readFileContent(uri: vscode.Uri): Promise<{ text: string; lines: string[] } | undefined> {
    try {
      const document = await vscode.workspace.openTextDocument(uri);
      const text = document.getText();
      return { text, lines: text.split('\n') };
    } catch (error) {
      console.warn(`Error reading file ${uri.fsPath}:`, error);
      return undefined;
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): FileScannerConfig {
    return { ...this.config };
  }

  dispose(): void {
    for (const d of this.disposables) {
      d.dispose();
    }
    this._onFileSaved.dispose();
    this._onFileDeleted.dispose();
  }
}
