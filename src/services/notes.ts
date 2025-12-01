/**
 * Notes Service
 * Manages code notes stored at workspace level
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { CodeNote, generateNoteId } from '../models/note';

const NOTES_FILE = 'cmdify-notes.json';

interface NotesStorage {
  version: string;
  notes: CodeNote[];
}

/**
 * Service for managing code notes at workspace level
 */
export class NotesService implements vscode.Disposable {
  private notes: Map<string, CodeNote> = new Map();
  private storagePath: string | undefined;
  private _onNotesChanged = new vscode.EventEmitter<void>();
  private disposables: vscode.Disposable[] = [];
  private decorationType: vscode.TextEditorDecorationType;

  readonly onNotesChanged = this._onNotesChanged.event;

  constructor() {
    // Create decoration type for highlighted notes
    this.decorationType = vscode.window.createTextEditorDecorationType({
      backgroundColor: 'rgba(255, 235, 59, 0.2)',
      borderRadius: '3px',
      overviewRulerColor: 'rgba(255, 235, 59, 0.8)',
      overviewRulerLane: vscode.OverviewRulerLane.Right,
    });

    // Listen for active editor changes to update decorations
    this.disposables.push(
      vscode.window.onDidChangeActiveTextEditor(() => this.updateDecorations())
    );

    // Listen for text document changes
    this.disposables.push(
      vscode.workspace.onDidChangeTextDocument((e) => {
        if (vscode.window.activeTextEditor?.document === e.document) {
          this.updateDecorations();
        }
      })
    );
  }

  /**
   * Initialize the service with workspace context
   */
  async initialize(): Promise<void> {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (workspaceFolder) {
      // Store in .vscode folder within workspace
      const vscodeDir = path.join(workspaceFolder.uri.fsPath, '.vscode');
      this.storagePath = path.join(vscodeDir, NOTES_FILE);
      await this.load();
      this.updateDecorations();
    }
  }

  /**
   * Load notes from storage
   */
  private async load(): Promise<void> {
    if (!this.storagePath) {
      return;
    }

    try {
      if (fs.existsSync(this.storagePath)) {
        const data = await fs.promises.readFile(this.storagePath, 'utf-8');
        const storage: NotesStorage = JSON.parse(data);
        this.notes.clear();
        for (const note of storage.notes) {
          this.notes.set(note.id, note);
        }
      }
    } catch (error) {
      console.error('Failed to load notes:', error);
      this.notes.clear();
    }
  }

  /**
   * Save notes to storage
   */
  private async save(): Promise<void> {
    if (!this.storagePath) {
      return;
    }

    try {
      // Ensure .vscode directory exists
      const dir = path.dirname(this.storagePath);
      if (!fs.existsSync(dir)) {
        await fs.promises.mkdir(dir, { recursive: true });
      }

      const storage: NotesStorage = {
        version: '1.0',
        notes: Array.from(this.notes.values()),
      };
      await fs.promises.writeFile(this.storagePath, JSON.stringify(storage, null, 2));
      this._onNotesChanged.fire();
    } catch (error) {
      console.error('Failed to save notes:', error);
      throw error;
    }
  }

  /**
   * Add a new note for a code selection
   */
  async addNote(
    editor: vscode.TextEditor,
    selection: vscode.Selection,
    noteText: string,
    color?: CodeNote['color']
  ): Promise<CodeNote> {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      throw new Error('No workspace folder open');
    }

    const filePath = vscode.workspace.asRelativePath(editor.document.uri);
    const selectedText = editor.document.getText(selection);
    const languageId = editor.document.languageId;

    const note: CodeNote = {
      id: generateNoteId(),
      filePath,
      startLine: selection.start.line,
      endLine: selection.end.line,
      startCharacter: selection.start.character,
      endCharacter: selection.end.character,
      selectedText,
      note: noteText,
      languageId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      color: color || 'yellow',
    };

    this.notes.set(note.id, note);
    await this.save();
    this.updateDecorations();
    return note;
  }

  /**
   * Update an existing note
   */
  async updateNote(
    id: string,
    updates: { note?: string; color?: CodeNote['color']; tags?: string[] }
  ): Promise<void> {
    const existingNote = this.notes.get(id);
    if (!existingNote) {
      throw new Error(`Note not found: ${id}`);
    }

    if (updates.note !== undefined) {
      existingNote.note = updates.note;
    }
    if (updates.color !== undefined) {
      existingNote.color = updates.color;
    }
    if (updates.tags !== undefined) {
      existingNote.tags = updates.tags;
    }
    existingNote.updatedAt = new Date().toISOString();

    await this.save();
  }

  /**
   * Delete a note
   */
  async deleteNote(id: string): Promise<void> {
    if (!this.notes.has(id)) {
      throw new Error(`Note not found: ${id}`);
    }

    this.notes.delete(id);
    await this.save();
    this.updateDecorations();
  }

  /**
   * Delete all notes
   */
  async deleteAllNotes(): Promise<number> {
    const count = this.notes.size;
    this.notes.clear();
    await this.save();
    this.updateDecorations();
    return count;
  }

  /**
   * Delete all notes for a specific file
   */
  async deleteNotesForFile(filePath: string): Promise<number> {
    const relativePath = vscode.workspace.asRelativePath(filePath);
    const idsToDelete: string[] = [];

    for (const [id, note] of this.notes) {
      if (note.filePath === relativePath) {
        idsToDelete.push(id);
      }
    }

    for (const id of idsToDelete) {
      this.notes.delete(id);
    }

    if (idsToDelete.length > 0) {
      await this.save();
      this.updateDecorations();
    }

    return idsToDelete.length;
  }

  /**
   * Get all notes
   */
  getAllNotes(): CodeNote[] {
    return Array.from(this.notes.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  /**
   * Get notes for a specific file
   */
  getNotesForFile(filePath: string): CodeNote[] {
    const relativePath = vscode.workspace.asRelativePath(filePath);
    return this.getAllNotes().filter((note) => note.filePath === relativePath);
  }

  /**
   * Get a note by ID
   */
  getNote(id: string): CodeNote | undefined {
    return this.notes.get(id);
  }

  /**
   * Navigate to a note's location in the editor
   */
  async goToNote(note: CodeNote): Promise<void> {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      vscode.window.showWarningMessage('No workspace folder open');
      return;
    }

    if (!note || !note.filePath) {
      vscode.window.showWarningMessage('Invalid note');
      return;
    }

    try {
      const fullPath = path.join(workspaceFolder.uri.fsPath, note.filePath);
      const document = await vscode.workspace.openTextDocument(fullPath);
      const editor = await vscode.window.showTextDocument(document);

      const range = new vscode.Range(
        note.startLine,
        note.startCharacter,
        note.endLine,
        note.endCharacter
      );

      editor.selection = new vscode.Selection(range.start, range.end);
      editor.revealRange(range, vscode.TextEditorRevealType.InCenter);
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to open note: ${error}`);
    }
  }

  /**
   * Update decorations in the active editor
   */
  private updateDecorations(): void {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      return;
    }

    const filePath = vscode.workspace.asRelativePath(editor.document.uri);
    const notesForFile = this.getNotesForFile(filePath);

    const decorations: vscode.DecorationOptions[] = notesForFile.map((note) => {
      const range = new vscode.Range(
        note.startLine,
        note.startCharacter,
        note.endLine,
        note.endCharacter
      );

      return {
        range,
        hoverMessage: new vscode.MarkdownString(`**📝 Note:** ${note.note}`),
      };
    });

    editor.setDecorations(this.decorationType, decorations);
  }

  /**
   * Check if there's a note at the current selection
   */
  getNoteAtSelection(editor: vscode.TextEditor, selection: vscode.Selection): CodeNote | undefined {
    const filePath = vscode.workspace.asRelativePath(editor.document.uri);
    const notesForFile = this.getNotesForFile(filePath);

    return notesForFile.find(
      (note) =>
        note.startLine === selection.start.line &&
        note.startCharacter === selection.start.character &&
        note.endLine === selection.end.line &&
        note.endCharacter === selection.end.character
    );
  }

  dispose(): void {
    this.decorationType.dispose();
    this._onNotesChanged.dispose();
    this.disposables.forEach((d) => d.dispose());
  }
}
