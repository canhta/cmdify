/**
 * Workspace File Operations Utilities
 * Common workspace and file system operations
 */

import * as vscode from 'vscode';
import * as path from 'path';

/**
 * Get the current workspace folder
 */
export function getWorkspaceFolder(): vscode.WorkspaceFolder | undefined {
  return vscode.workspace.workspaceFolders?.[0];
}

/**
 * Get all workspace folders
 */
export function getWorkspaceFolders(): readonly vscode.WorkspaceFolder[] {
  return vscode.workspace.workspaceFolders || [];
}

/**
 * Check if a file is in the workspace
 */
export function isInWorkspace(filePath: string): boolean {
  const workspaceFolders = getWorkspaceFolders();
  return workspaceFolders.some((folder) => filePath.startsWith(folder.uri.fsPath));
}

/**
 * Get relative path from workspace root
 */
export function getRelativePath(absolutePath: string): string | undefined {
  const workspaceFolder = getWorkspaceFolder();
  if (!workspaceFolder) {
    return undefined;
  }
  return path.relative(workspaceFolder.uri.fsPath, absolutePath);
}

/**
 * Get absolute path from workspace relative path
 */
export function getAbsolutePath(relativePath: string): string | undefined {
  const workspaceFolder = getWorkspaceFolder();
  if (!workspaceFolder) {
    return undefined;
  }
  return path.join(workspaceFolder.uri.fsPath, relativePath);
}

/**
 * Find files in workspace matching a glob pattern
 */
export async function findFiles(
  include: vscode.GlobPattern,
  exclude?: vscode.GlobPattern,
  maxResults?: number
): Promise<vscode.Uri[]> {
  return await vscode.workspace.findFiles(include, exclude, maxResults);
}

/**
 * Read file contents
 */
export async function readFile(uri: vscode.Uri): Promise<string> {
  const bytes = await vscode.workspace.fs.readFile(uri);
  return new TextDecoder().decode(bytes);
}

/**
 * Write file contents
 */
export async function writeFile(uri: vscode.Uri, content: string): Promise<void> {
  const bytes = new TextEncoder().encode(content);
  await vscode.workspace.fs.writeFile(uri, bytes);
}

/**
 * Check if file exists
 */
export async function fileExists(uri: vscode.Uri): Promise<boolean> {
  try {
    await vscode.workspace.fs.stat(uri);
    return true;
  } catch {
    return false;
  }
}

/**
 * Delete file
 */
export async function deleteFile(
  uri: vscode.Uri,
  options?: { recursive?: boolean; useTrash?: boolean }
): Promise<void> {
  await vscode.workspace.fs.delete(uri, options);
}

/**
 * Create directory
 */
export async function createDirectory(uri: vscode.Uri): Promise<void> {
  await vscode.workspace.fs.createDirectory(uri);
}

/**
 * Get file stats
 */
export async function getFileStats(uri: vscode.Uri): Promise<vscode.FileStat> {
  return await vscode.workspace.fs.stat(uri);
}

/**
 * List directory contents
 */
export async function readDirectory(uri: vscode.Uri): Promise<[string, vscode.FileType][]> {
  return await vscode.workspace.fs.readDirectory(uri);
}

/**
 * Open a text document
 */
export async function openTextDocument(uri: vscode.Uri): Promise<vscode.TextDocument> {
  return await vscode.workspace.openTextDocument(uri);
}

/**
 * Show a text document in editor
 */
export async function showTextDocument(
  uri: vscode.Uri,
  options?: vscode.TextDocumentShowOptions
): Promise<vscode.TextEditor> {
  const document = await openTextDocument(uri);
  return await vscode.window.showTextDocument(document, options);
}

/**
 * Get configuration for a section
 */
export function getConfiguration(section?: string): vscode.WorkspaceConfiguration {
  return vscode.workspace.getConfiguration(section);
}

/**
 * Get configuration value with type safety
 */
export function getConfigValue<T>(section: string, key: string, defaultValue: T): T {
  return getConfiguration(section).get<T>(key, defaultValue);
}

/**
 * Update configuration value
 */
export async function updateConfigValue(
  section: string,
  key: string,
  value: any,
  target: vscode.ConfigurationTarget = vscode.ConfigurationTarget.Global
): Promise<void> {
  await getConfiguration(section).update(key, value, target);
}

/**
 * Get workspace name
 */
export function getWorkspaceName(): string | undefined {
  return vscode.workspace.name;
}

/**
 * Check if workspace is trusted
 */
export function isWorkspaceTrusted(): boolean {
  return vscode.workspace.isTrusted;
}

/**
 * Get text document at URI
 */
export function getTextDocument(uri: vscode.Uri): vscode.TextDocument | undefined {
  return vscode.workspace.textDocuments.find((doc) => doc.uri.toString() === uri.toString());
}

/**
 * Get active text editor
 */
export function getActiveEditor(): vscode.TextEditor | undefined {
  return vscode.window.activeTextEditor;
}

/**
 * Get active document
 */
export function getActiveDocument(): vscode.TextDocument | undefined {
  return getActiveEditor()?.document;
}

/**
 * Execute a workspace edit
 */
export async function applyWorkspaceEdit(edit: vscode.WorkspaceEdit): Promise<boolean> {
  return await vscode.workspace.applyEdit(edit);
}

/**
 * Create a workspace edit for text replacement
 */
export function createTextReplacement(
  uri: vscode.Uri,
  range: vscode.Range,
  newText: string
): vscode.WorkspaceEdit {
  const edit = new vscode.WorkspaceEdit();
  edit.replace(uri, range, newText);
  return edit;
}

/**
 * Create a workspace edit for text insertion
 */
export function createTextInsertion(
  uri: vscode.Uri,
  position: vscode.Position,
  text: string
): vscode.WorkspaceEdit {
  const edit = new vscode.WorkspaceEdit();
  edit.insert(uri, position, text);
  return edit;
}

/**
 * Create a workspace edit for text deletion
 */
export function createTextDeletion(uri: vscode.Uri, range: vscode.Range): vscode.WorkspaceEdit {
  const edit = new vscode.WorkspaceEdit();
  edit.delete(uri, range);
  return edit;
}

/**
 * Convert file URI to file system path
 */
export function uriToPath(uri: vscode.Uri): string {
  return uri.fsPath;
}

/**
 * Convert file system path to URI
 */
export function pathToUri(path: string): vscode.Uri {
  return vscode.Uri.file(path);
}
