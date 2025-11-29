/**
 * Notes Panel Webview Provider
 * Displays all code notes in a webview panel
 */

import * as vscode from 'vscode';
import { BaseWebviewPanel } from '../ui/webview';
import { StylesProvider } from '../ui/webview/StylesProvider';
import { NotesService } from '../services/notes';
import { CodeNote, NOTE_COLORS, NoteColor, getLanguageInfo } from '../models/note';
import { icon, getLucideStyles } from '../utils/lucide';

/**
 * Notes Panel Webview Provider
 */
export class NotesPanelProvider extends BaseWebviewPanel {
  public static readonly viewType = 'cmdify.notes';

  constructor(
    context: vscode.ExtensionContext,
    private readonly notesService: NotesService
  ) {
    super(context, {
      viewType: NotesPanelProvider.viewType,
      title: 'Code Notes',
      showOptions: vscode.ViewColumn.Two,
    });

    // Register message handlers
    this.registerMessageHandler('goToNote', async (data) => {
      if (!data.noteId) {
        vscode.window.showWarningMessage('No note ID provided');
        return;
      }
      const note = this.notesService.getNote(data.noteId);
      if (note) {
        await this.notesService.goToNote(note);
      } else {
        vscode.window.showWarningMessage('Note not found');
      }
    });

    this.registerMessageHandler('deleteNote', async (data) => {
      const confirmDelete = await vscode.window.showWarningMessage(
        'Delete this note?',
        { modal: true },
        'Delete'
      );
      if (confirmDelete === 'Delete') {
        await this.notesService.deleteNote(data.noteId);
      }
    });

    this.registerMessageHandler('editNote', async (data) => {
      const noteToEdit = this.notesService.getNote(data.noteId);
      if (noteToEdit) {
        await this.showEditNoteDialog(noteToEdit);
      }
    });

    // Update panel when notes change
    this.disposables.push(notesService.onNotesChanged(() => this.refresh()));
  }

  show(): void {
    this.getPanel();
  }

  protected getHtmlContent(): string {
    const notes = this.notesService.getAllNotes();

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

    // Load external CSS
    const panelStyles = StylesProvider.getPanelStyles('notes', this.context.extensionPath);

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
    
    ${panelStyles}
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
  </script>
</body>
</html>`;
  }

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

  private truncateCode(code: string): string {
    const maxLength = 200;
    if (code.length <= maxLength) {
      return code;
    }
    return code.substring(0, maxLength) + '...';
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  protected handleMessage(message: any): void {
    // All messages handled through registered handlers
  }
}
