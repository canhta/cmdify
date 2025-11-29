/**
 * Notes Tree View Provider
 * Provides a tree view for code notes in the sidebar
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { CodeNote, NOTE_COLORS, getLanguageInfo } from '../models/note';
import { NotesService } from '../services/notes';

/**
 * Tree item for the Notes tree view
 */
export class NoteTreeItem extends vscode.TreeItem {
  constructor(
    label: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly itemType: 'file' | 'note',
    public readonly note?: CodeNote,
    public readonly filePath?: string
  ) {
    super(label, collapsibleState);

    if (note) {
      this.setupNoteItem(note);
    } else if (filePath) {
      this.setupFileItem(filePath);
    }
  }

  private setupNoteItem(note: CodeNote): void {
    const lineInfo =
      note.startLine === note.endLine
        ? `Line ${note.startLine + 1}`
        : `Lines ${note.startLine + 1}-${note.endLine + 1}`;

    const langInfo = getLanguageInfo(note.languageId);
    this.label = note.note.length > 50 ? note.note.substring(0, 50) + '...' : note.note;
    this.description = `${langInfo.label} · ${lineInfo}`;

    // Tooltip with full info
    let tooltip = `📝 ${note.note}\n\n`;
    tooltip += `File: ${note.filePath}\n`;
    tooltip += `Language: ${langInfo.label}\n`;
    tooltip += `${lineInfo}\n`;
    tooltip += `Code: ${note.selectedText.substring(0, 100)}${note.selectedText.length > 100 ? '...' : ''}`;
    this.tooltip = tooltip;

    this.contextValue = 'note';

    this.command = {
      command: 'cmdify.notes.goToNote',
      title: 'Go to Note',
      arguments: [note],
    };

    // Use language-specific icon from ThemeIcon
    this.iconPath = new vscode.ThemeIcon(langInfo.icon);
  }

  private setupFileItem(filePath: string): void {
    this.iconPath = new vscode.ThemeIcon('file-code');
    this.tooltip = filePath;
  }
}

/**
 * Notes Tree Data Provider
 */
export class NotesTreeProvider implements vscode.TreeDataProvider<NoteTreeItem>, vscode.Disposable {
  private _onDidChangeTreeData = new vscode.EventEmitter<NoteTreeItem | undefined | null | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private disposables: vscode.Disposable[] = [];

  constructor(private readonly notesService: NotesService) {
    // Refresh when notes change
    this.disposables.push(this.notesService.onNotesChanged(() => this.refresh()));
  }

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: NoteTreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: NoteTreeItem): Promise<NoteTreeItem[]> {
    if (!element) {
      // Root level - show files with notes
      return this.getRootItems();
    }

    // Children of a file - show notes for that file
    if (element.itemType === 'file' && element.filePath) {
      return this.getNotesForFile(element.filePath);
    }

    return [];
  }

  private getRootItems(): NoteTreeItem[] {
    const notes = this.notesService.getAllNotes();

    // Group notes by file
    const notesByFile = new Map<string, CodeNote[]>();
    for (const note of notes) {
      if (!notesByFile.has(note.filePath)) {
        notesByFile.set(note.filePath, []);
      }
      notesByFile.get(note.filePath)!.push(note);
    }

    // Create file items
    const items: NoteTreeItem[] = [];
    const sortedFiles = Array.from(notesByFile.keys()).sort();

    for (const filePath of sortedFiles) {
      const fileNotes = notesByFile.get(filePath)!;
      const fileName = path.basename(filePath);
      const item = new NoteTreeItem(
        `${fileName} (${fileNotes.length})`,
        vscode.TreeItemCollapsibleState.Expanded,
        'file',
        undefined,
        filePath
      );
      items.push(item);
    }

    return items;
  }

  private getNotesForFile(filePath: string): NoteTreeItem[] {
    const notes = this.notesService.getNotesForFile(filePath);

    // Sort by line number
    notes.sort((a, b) => a.startLine - b.startLine);

    return notes.map(
      (note) =>
        new NoteTreeItem(note.note, vscode.TreeItemCollapsibleState.None, 'note', note, undefined)
    );
  }

  dispose(): void {
    this._onDidChangeTreeData.dispose();
    this.disposables.forEach((d) => d.dispose());
  }
}

/**
 * Create and register the Notes tree view
 */
export function createNotesTreeView(notesService: NotesService): {
  treeView: vscode.TreeView<NoteTreeItem>;
  provider: NotesTreeProvider;
} {
  const provider = new NotesTreeProvider(notesService);

  const treeView = vscode.window.createTreeView('cmdify.notes', {
    treeDataProvider: provider,
    showCollapseAll: true,
  });

  return { treeView, provider };
}
