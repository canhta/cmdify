/**
 * TODO Sync Service
 * Handles two-way sync between TODO comments in code and reminders
 */

import * as vscode from 'vscode';
import { DetectedTodo, DEFAULT_METADATA_FORMAT } from '../models/todo';
import { formatDateString } from '../utils/dateUtils';
import { TodoScannerService } from './todoScanner';

/**
 * TODO Sync Service
 * Manages syncing dates and status back to code comments
 */
export class TodoSyncService implements vscode.Disposable {
  private disposables: vscode.Disposable[] = [];

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly scanner: TodoScannerService
  ) {}

  /**
   * Get patterns from scanner (which loads from config)
   */
  private getPatterns() {
    return this.scanner.getMetadataPatterns();
  }

  /**
   * Get format config from scanner
   */
  private getFormat() {
    return this.scanner.getMetadataFormat();
  }

  /**
   * Parse existing metadata from a line
   * Returns { dueDate, assignee } from format like (due@2025-11-30, @assigned:John)
   */
  private parseMetadata(lineText: string): { dueDate?: string; assignee?: string } {
    const patterns = this.getPatterns();
    const metadataMatch = patterns.metadataPattern.exec(lineText);
    if (!metadataMatch) {
      return {};
    }

    const metadataContent = metadataMatch[1];
    let dueDate: string | undefined;
    let assignee: string | undefined;

    // Parse due date
    const dateMatch = patterns.datePattern.exec(metadataContent);
    if (dateMatch) {
      dueDate = dateMatch[1];
    }

    // Parse assignee
    const assigneeMatch = patterns.assigneePattern.exec(metadataContent);
    if (assigneeMatch) {
      assignee = assigneeMatch[1].trim();
    }

    return { dueDate, assignee };
  }

  /**
   * Build metadata string based on configured format
   */
  private buildMetadataString(dueDate?: string, assignee?: string): string {
    const format = this.getFormat();
    const parts: string[] = [];

    if (dueDate) {
      // Extract the prefix from datePattern (e.g., "due@" from "due@(\\d{4}-\\d{2}-\\d{2})")
      const datePrefix = format.datePattern.replace(/\(.*\)/, '').replace(/\\/g, '');
      parts.push(`${datePrefix}${dueDate}`);
    }

    if (assignee) {
      // Extract the prefix from assigneePattern (e.g., "@assigned:" from "@assigned:([^,)]+)")
      const assigneePrefix = format.assigneePattern.replace(/\(.*\)/, '').replace(/\\/g, '');
      parts.push(`${assigneePrefix}${assignee}`);
    }

    if (parts.length === 0) {
      return '';
    }

    // Build using configured wrapper format
    const metadataContent = parts.join(format.dateSeparator);
    const result = format.metadataWrapper.replace('{metadata}', metadataContent);
    return ` ${result}`;
  }

  /**
   * Update or add metadata to a TODO line
   */
  private updateLineMetadata(lineText: string, newDueDate?: string, newAssignee?: string): string {
    const patterns = this.getPatterns();

    // Parse existing metadata
    const existing = this.parseMetadata(lineText);

    // Merge with new values (new values override existing)
    const dueDate = newDueDate !== undefined ? newDueDate : existing.dueDate;
    const assignee = newAssignee !== undefined ? newAssignee : existing.assignee;

    // Remove existing metadata
    let cleanLine = lineText.replace(patterns.metadataPattern, '').trimEnd();

    // Add new metadata
    const metadata = this.buildMetadataString(dueDate, assignee);
    return cleanLine + metadata;
  }

  /**
   * Helper to apply a line edit and save
   */
  private async applyLineEdit(
    todo: DetectedTodo,
    editFn: (lineText: string) => string,
    errorContext: string
  ): Promise<boolean> {
    try {
      const document = await vscode.workspace.openTextDocument(todo.filePath);
      const line = document.lineAt(todo.lineNumber);
      const newText = editFn(line.text);

      const edit = new vscode.WorkspaceEdit();
      edit.replace(document.uri, line.range, newText);
      const success = await vscode.workspace.applyEdit(edit);

      if (success) {
        await document.save();
        await this.scanner.scanFile(document.uri);
      }

      return success;
    } catch (error) {
      console.error(`Error ${errorContext}:`, error);
      return false;
    }
  }

  /**
   * Add a due date to a TODO comment in code
   */
  async addReminder(todo: DetectedTodo, dueDate: Date): Promise<boolean> {
    const dateStr = formatDateString(dueDate);
    const result = await this.applyLineEdit(
      todo,
      (lineText) => this.updateLineMetadata(lineText, dateStr, undefined),
      'adding reminder to TODO'
    );
    if (!result) {
      vscode.window.showErrorMessage('Failed to add reminder');
    }
    return result;
  }

  /**
   * Remove the due date from a TODO comment
   */
  async removeReminder(todo: DetectedTodo): Promise<boolean> {
    const patterns = this.getPatterns();
    return this.applyLineEdit(
      todo,
      (lineText) => {
        const existing = this.parseMetadata(lineText);
        let cleanLine = lineText.replace(patterns.metadataPattern, '').trimEnd();
        if (existing.assignee) {
          cleanLine += this.buildMetadataString(undefined, existing.assignee);
        }
        return cleanLine;
      },
      'removing reminder from TODO'
    );
  }

  /**
   * Mark a TODO as done by changing TODO to DONE in the code
   */
  async markDoneInCode(todo: DetectedTodo): Promise<boolean> {
    try {
      const document = await vscode.workspace.openTextDocument(todo.filePath);
      const line = document.lineAt(todo.lineNumber);
      const lineText = line.text;

      // Replace TODO/FIXME/etc with DONE
      const typePattern = /\b(TODO|FIXME|HACK|XXX|BUG|OPTIMIZE|REVIEW)\b/gi;
      const newText = lineText.replace(typePattern, 'DONE');

      const edit = new vscode.WorkspaceEdit();
      edit.replace(document.uri, line.range, newText);
      const success = await vscode.workspace.applyEdit(edit);

      if (success) {
        await document.save();
        await this.scanner.markComplete(todo.id);
      }

      return success;
    } catch (error) {
      console.error('Error marking TODO as done:', error);
      return false;
    }
  }

  /**
   * Delete a TODO comment line entirely
   */
  async deleteTodoLine(todo: DetectedTodo): Promise<boolean> {
    // Confirm with user
    const confirm = await vscode.window.showWarningMessage(
      `Delete this TODO comment?\n"${todo.description}"`,
      { modal: true },
      'Delete',
      'Cancel'
    );

    if (confirm !== 'Delete') {
      return false;
    }

    try {
      const document = await vscode.workspace.openTextDocument(todo.filePath);
      const line = document.lineAt(todo.lineNumber);

      const edit = new vscode.WorkspaceEdit();
      // Delete the entire line including the newline
      const range = new vscode.Range(
        line.range.start,
        document.lineAt(Math.min(todo.lineNumber + 1, document.lineCount - 1)).range.start
      );
      edit.delete(document.uri, range);

      const success = await vscode.workspace.applyEdit(edit);

      if (success) {
        await document.save();
        // Rescan the entire file since line numbers changed
        await this.scanner.scanFile(document.uri);
      }

      return success;
    } catch (error) {
      console.error('Error deleting TODO line:', error);
      return false;
    }
  }

  /**
   * Open a TODO in the editor
   */
  async goToTodo(todo: DetectedTodo): Promise<void> {
    try {
      const document = await vscode.workspace.openTextDocument(todo.filePath);
      const editor = await vscode.window.showTextDocument(document);

      // Move cursor to the line
      const position = new vscode.Position(todo.lineNumber, 0);
      const selection = new vscode.Selection(position, position);
      editor.selection = selection;
      editor.revealRange(
        new vscode.Range(position, position),
        vscode.TextEditorRevealType.InCenter
      );
    } catch (error) {
      console.error('Error navigating to TODO:', error);
      vscode.window.showErrorMessage(`Failed to open file: ${todo.filePath}`);
    }
  }

  /**
   * Add an assignee to a TODO comment in code
   */
  async addAssignee(todo: DetectedTodo, assignee: string): Promise<boolean> {
    const result = await this.applyLineEdit(
      todo,
      (lineText) => this.updateLineMetadata(lineText, undefined, assignee),
      'adding assignee to TODO'
    );
    if (!result) {
      vscode.window.showErrorMessage('Failed to add assignee');
    }
    return result;
  }

  /**
   * Remove the assignee from a TODO comment
   */
  async removeAssignee(todo: DetectedTodo): Promise<boolean> {
    const patterns = this.getPatterns();
    return this.applyLineEdit(
      todo,
      (lineText) => {
        const existing = this.parseMetadata(lineText);
        let cleanLine = lineText.replace(patterns.metadataPattern, '').trimEnd();
        if (existing.dueDate) {
          cleanLine += this.buildMetadataString(existing.dueDate, undefined);
        }
        return cleanLine;
      },
      'removing assignee from TODO'
    );
  }

  /**
   * Update both due date and assignee at once
   */
  async updateMetadata(todo: DetectedTodo, dueDate?: Date, assignee?: string): Promise<boolean> {
    const dateStr = dueDate ? formatDateString(dueDate) : undefined;
    const result = await this.applyLineEdit(
      todo,
      (lineText) => this.updateLineMetadata(lineText, dateStr, assignee),
      'updating TODO metadata'
    );
    if (!result) {
      vscode.window.showErrorMessage('Failed to update TODO');
    }
    return result;
  }

  dispose(): void {
    for (const d of this.disposables) {
      d.dispose();
    }
  }
}
