/**
 * Notes Command Handlers
 * Handles code notes management commands
 */

import * as vscode from 'vscode';
import { NotesService } from '../../services/notes';
import { NotesPanelProvider } from '../../views/notesPanel';
import { NoteTreeItem } from '../../views/notesTreeProvider';
import { CodeNote } from '../../models/note';
import { CommandGroup, defineCommand, defineCommandGroup } from '../registry';

/**
 * Dependencies for notes commands
 */
export interface NoteCommandDependencies {
  notesService: NotesService;
  notesPanelProvider: NotesPanelProvider;
  updateNoNotesContext: () => Promise<void>;
}

/**
 * Create notes command handlers
 */
export function createNoteCommands(deps: NoteCommandDependencies): CommandGroup {
  const { notesService, notesPanelProvider, updateNoNotesContext } = deps;

  return defineCommandGroup('Notes Commands', [
    defineCommand('cmdify.notes.add', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showWarningMessage('No active editor');
        return;
      }

      const selection = editor.selection;
      if (selection.isEmpty) {
        vscode.window.showWarningMessage('Please select some code first');
        return;
      }

      const noteText = await vscode.window.showInputBox({
        prompt: 'Add a note for this code',
        placeHolder: 'Enter your note...',
      });

      if (noteText) {
        try {
          await notesService.addNote(editor, selection, noteText);
          await updateNoNotesContext();
          vscode.window.showInformationMessage('📝 Note added!');
        } catch (error) {
          vscode.window.showErrorMessage(`Failed to add note: ${error}`);
        }
      }
    }),

    defineCommand('cmdify.notes.showPanel', () => notesPanelProvider.show()),

    defineCommand(
      'cmdify.notes.goToNote',
      async (item: NoteTreeItem | CodeNote | { id: string }) => {
        let note: CodeNote | undefined;

        // Check if it's a NoteTreeItem (from context menu)
        if (item && 'itemType' in item && item.itemType === 'note' && item.note) {
          note = item.note;
        }
        // Check if it's a CodeNote directly (from tree item click)
        else if (item && 'filePath' in item && 'startLine' in item) {
          note = item as CodeNote;
        }
        // Check if it's just an id object
        else if (item && 'id' in item) {
          note = notesService.getNote((item as { id: string }).id);
        }

        if (note) {
          await notesService.goToNote(note);
        } else {
          vscode.window.showWarningMessage('Note not found');
        }
      }
    ),

    defineCommand('cmdify.notes.edit', async (item: NoteTreeItem) => {
      if (item.note) {
        const newText = await vscode.window.showInputBox({
          prompt: 'Edit note',
          value: item.note.note,
          placeHolder: 'Enter your note...',
        });
        if (newText !== undefined) {
          await notesService.updateNote(item.note.id, { note: newText });
          vscode.window.showInformationMessage('📝 Note updated!');
        }
      }
    }),

    defineCommand('cmdify.notes.delete', async (item: NoteTreeItem) => {
      if (item.note) {
        const confirm = await vscode.window.showWarningMessage(
          'Delete this note?',
          { modal: true },
          'Delete'
        );
        if (confirm === 'Delete') {
          await notesService.deleteNote(item.note.id);
          await updateNoNotesContext();
          vscode.window.showInformationMessage('Note deleted');
        }
      }
    }),
  ]);
}
