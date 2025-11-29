/**
 * Notes Panel Webview Provider
 * Displays all code notes in a webview panel
 */

import * as vscode from 'vscode';
import { NotesService } from '../services/notes';
import { CodeNote, NOTE_COLORS, NoteColor, getLanguageInfo } from '../models/note';
import { icon, getLucideStyles } from '../utils/lucide';

/**
 * Notes Panel Webview Provider
 */
export class NotesPanelProvider implements vscode.Disposable {
  public static readonly viewType = 'cmdify.notes';

  private panel: vscode.WebviewPanel | undefined;
  private disposables: vscode.Disposable[] = [];

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly notesService: NotesService
  ) {
    // Update panel when notes change
    this.disposables.push(notesService.onNotesChanged(() => this.updatePanel()));
  }

  /**
   * Show the notes panel
   */
  show(): void {
    if (this.panel) {
      this.panel.reveal();
      return;
    }

    this.panel = vscode.window.createWebviewPanel(
      NotesPanelProvider.viewType,
      'Code Notes',
      vscode.ViewColumn.Two,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [this.extensionUri],
      }
    );

    this.panel.webview.html = this.getHtmlContent();

    this.panel.webview.onDidReceiveMessage(
      async (message) => {
        switch (message.command) {
          case 'goToNote':
            if (!message.noteId) {
              vscode.window.showWarningMessage('No note ID provided');
              return;
            }
            const note = this.notesService.getNote(message.noteId);
            if (note) {
              await this.notesService.goToNote(note);
            } else {
              vscode.window.showWarningMessage('Note not found');
            }
            break;
          case 'deleteNote':
            const confirmDelete = await vscode.window.showWarningMessage(
              'Delete this note?',
              { modal: true },
              'Delete'
            );
            if (confirmDelete === 'Delete') {
              await this.notesService.deleteNote(message.noteId);
            }
            break;
          case 'editNote':
            const noteToEdit = this.notesService.getNote(message.noteId);
            if (noteToEdit) {
              await this.showEditNoteDialog(noteToEdit);
            }
            break;
        }
      },
      undefined,
      this.disposables
    );

    this.panel.onDidDispose(
      () => {
        this.panel = undefined;
      },
      undefined,
      this.disposables
    );
  }

  /**
   * Update the panel content
   */
  private updatePanel(): void {
    if (this.panel) {
      // Re-generate the HTML content to refresh the view
      this.panel.webview.html = this.getHtmlContent();
    }
  }

  /**
   * Get the HTML content for the webview
   */
  private getHtmlContent(): string {
    const notes = this.notesService.getAllNotes();

    // Group notes by file
    const notesByFile = new Map<string, CodeNote[]>();
    for (const note of notes) {
      if (!notesByFile.has(note.filePath)) {
        notesByFile.set(note.filePath, []);
      }
      notesByFile.get(note.filePath)!.push(note);
    }

    const fileGroups = Array.from(notesByFile.entries())
      .map(
        ([filePath, fileNotes]) => `
      <div class="file-group">
        <div class="file-header">
          ${icon('fileText', 16)}
          <span class="file-path">${this.escapeHtml(filePath)}</span>
          <span class="note-count">${fileNotes.length}</span>
        </div>
        <div class="notes-list">
          ${fileNotes.map((note) => this.getNoteHtml(note)).join('')}
        </div>
      </div>
    `
      )
      .join('');

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Code Notes</title>
  <style>
    ${getLucideStyles()}
    
    * { box-sizing: border-box; margin: 0; padding: 0; }
    
    body {
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      color: var(--vscode-foreground);
      padding: 16px;
      line-height: 1.5;
    }
    
    .header {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 24px;
      padding-bottom: 16px;
      border-bottom: 1px solid var(--vscode-widget-border);
    }
    
    .header h1 {
      font-size: 20px;
      font-weight: 600;
      flex: 1;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    
    .total-count {
      font-size: 12px;
      background: var(--vscode-badge-background);
      color: var(--vscode-badge-foreground);
      padding: 2px 8px;
      border-radius: 10px;
    }
    
    .empty-state {
      text-align: center;
      padding: 48px 24px;
      color: var(--vscode-descriptionForeground);
    }
    
    .empty-state svg {
      margin-bottom: 16px;
      opacity: 0.5;
    }
    
    .empty-state h2 {
      font-size: 16px;
      margin-bottom: 8px;
    }
    
    .empty-state p {
      font-size: 13px;
    }
    
    .file-group {
      margin-bottom: 20px;
    }
    
    .file-header {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      background: var(--vscode-editor-inactiveSelectionBackground);
      border-radius: 6px 6px 0 0;
      font-weight: 500;
      font-size: 12px;
    }
    
    .file-path {
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    
    .note-count {
      background: var(--vscode-badge-background);
      color: var(--vscode-badge-foreground);
      padding: 1px 6px;
      border-radius: 8px;
      font-size: 11px;
    }
    
    .notes-list {
      border: 1px solid var(--vscode-widget-border);
      border-top: none;
      border-radius: 0 0 6px 6px;
    }
    
    .note-item {
      padding: 12px;
      border-bottom: 1px solid var(--vscode-widget-border);
      cursor: pointer;
      transition: background 0.15s;
    }
    
    .note-item:last-child {
      border-bottom: none;
    }
    
    .note-item:hover {
      background: var(--vscode-list-hoverBackground);
    }
    
    .note-header {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      margin-bottom: 8px;
    }
    
    .note-color {
      width: 12px;
      height: 12px;
      border-radius: 3px;
      flex-shrink: 0;
      margin-top: 3px;
    }
    
    .note-content {
      flex: 1;
      min-width: 0;
    }
    
    .note-text {
      font-size: 13px;
      margin-bottom: 4px;
      word-wrap: break-word;
    }
    
    .note-meta {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
    }
    
    .note-location {
      display: flex;
      align-items: center;
      gap: 4px;
    }
    
    .code-preview {
      background: var(--vscode-textCodeBlock-background);
      border-radius: 4px;
      padding: 8px;
      margin-top: 8px;
      font-family: var(--vscode-editor-font-family);
      font-size: 12px;
      overflow-x: auto;
      white-space: pre-wrap;
      word-break: break-all;
      max-height: 80px;
      overflow-y: auto;
    }
    
    .note-actions {
      display: flex;
      gap: 4px;
      opacity: 0;
      transition: opacity 0.15s;
    }
    
    .note-item:hover .note-actions {
      opacity: 1;
    }
    
    .action-btn {
      border: none;
      background: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
      width: 24px;
      height: 24px;
      border-radius: 4px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    
    .action-btn:hover {
      background: var(--vscode-button-secondaryHoverBackground);
    }
    
    .action-btn.danger:hover {
      background: var(--vscode-errorBackground);
      color: var(--vscode-errorForeground);
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>${icon('stickyNote', 24)} Code Notes</h1>
    <span class="total-count">${notes.length} note${notes.length !== 1 ? 's' : ''}</span>
  </div>
  
  <div id="content">
    ${
      notes.length === 0
        ? `
      <div class="empty-state">
        ${icon('stickyNote', 48)}
        <h2>No notes yet</h2>
        <p>Select code and use "Add Note" to create your first note.</p>
      </div>
    `
        : fileGroups
    }
  </div>
  
  <script>
    const vscode = acquireVsCodeApi();
    
    document.addEventListener('click', (e) => {
      const noteItem = e.target.closest('.note-item');
      const actionBtn = e.target.closest('.action-btn');
      
      if (actionBtn) {
        e.stopPropagation();
        const action = actionBtn.dataset.action;
        const noteId = actionBtn.dataset.noteId;
        
        if (action === 'edit') {
          vscode.postMessage({ command: 'editNote', noteId });
        } else if (action === 'delete') {
          vscode.postMessage({ command: 'deleteNote', noteId });
        }
        return;
      }
      
      if (noteItem) {
        const noteId = noteItem.dataset.noteId;
        vscode.postMessage({ command: 'goToNote', noteId });
      }
    });
    
    window.addEventListener('message', (e) => {
      const msg = e.data;
      if (msg.type === 'update') {
        // Refresh the page to update content
        location.reload();
      }
    });
  </script>
</body>
</html>`;
  }

  /**
   * Get HTML for a single note item
   */
  private getNoteHtml(note: CodeNote): string {
    const color = NOTE_COLORS[note.color || 'yellow'];
    const lineInfo =
      note.startLine === note.endLine
        ? `Line ${note.startLine + 1}`
        : `Lines ${note.startLine + 1}-${note.endLine + 1}`;

    const date = new Date(note.createdAt).toLocaleDateString();
    const langInfo = getLanguageInfo(note.languageId);

    return `
      <div class="note-item" data-note-id="${note.id}">
        <div class="note-header">
          <div class="note-color" style="background: ${color.hex};"></div>
          <div class="note-content">
            <div class="note-text">${this.escapeHtml(note.note)}</div>
            <div class="note-meta">
              <span class="note-location">
                ${icon('mapPin', 12)}
                ${lineInfo}
              </span>
              <span>•</span>
              <span class="note-language" title="${langInfo.label}">
                ${icon('fileText', 12)}
                ${langInfo.label}
              </span>
              <span>•</span>
              <span>${date}</span>
            </div>
          </div>
          <div class="note-actions">
            <button class="action-btn" data-action="edit" data-note-id="${note.id}" title="Edit">
              ${icon('pencil', 14)}
            </button>
            <button class="action-btn danger" data-action="delete" data-note-id="${note.id}" title="Delete">
              ${icon('trash', 14)}
            </button>
          </div>
        </div>
        <div class="code-preview">${this.escapeHtml(this.truncateCode(note.selectedText))}</div>
      </div>
    `;
  }

  /**
   * Show edit note dialog with multiple fields
   */
  private async showEditNoteDialog(note: CodeNote): Promise<void> {
    const editOptions = [
      { label: '$(edit) Edit Note Text', value: 'text' },
      { label: '$(symbol-color) Change Color', value: 'color' },
      { label: '$(tag) Edit Tags', value: 'tags' },
    ];

    const selection = await vscode.window.showQuickPick(editOptions, {
      placeHolder: 'What would you like to edit?',
      title: 'Edit Note',
    });

    if (!selection) {
      return;
    }

    switch (selection.value) {
      case 'text':
        const newText = await vscode.window.showInputBox({
          prompt: 'Edit note text',
          value: note.note,
          placeHolder: 'Enter your note',
        });
        if (newText !== undefined) {
          await this.notesService.updateNote(note.id, { note: newText });
        }
        break;

      case 'color':
        const colorOptions = Object.entries(NOTE_COLORS).map(([key, value]) => ({
          label: `$(circle-filled) ${value.label}`,
          value: key as NoteColor,
          description: note.color === key ? '(current)' : '',
        }));

        const colorSelection = await vscode.window.showQuickPick(colorOptions, {
          placeHolder: 'Select a color',
          title: 'Change Note Color',
        });

        if (colorSelection) {
          await this.notesService.updateNote(note.id, { color: colorSelection.value });
        }
        break;

      case 'tags':
        const currentTags = note.tags?.join(', ') || '';
        const newTags = await vscode.window.showInputBox({
          prompt: 'Edit tags (comma-separated)',
          value: currentTags,
          placeHolder: 'e.g., bug, important, review',
        });

        if (newTags !== undefined) {
          const tagsArray = newTags
            .split(',')
            .map((t) => t.trim())
            .filter((t) => t.length > 0);
          await this.notesService.updateNote(note.id, { tags: tagsArray });
        }
        break;
    }
  }

  /**
   * Truncate code preview
   */
  private truncateCode(code: string): string {
    const maxLength = 200;
    if (code.length <= maxLength) {
      return code;
    }
    return code.substring(0, maxLength) + '...';
  }

  /**
   * Escape HTML special characters
   */
  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  dispose(): void {
    this.panel?.dispose();
    this.disposables.forEach((d) => d.dispose());
  }
}
