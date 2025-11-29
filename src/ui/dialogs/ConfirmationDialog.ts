/**
 * Confirmation Dialog
 * Standardized confirmation dialogs
 */

import * as vscode from 'vscode';

export interface ConfirmationOptions {
  message: string;
  detail?: string;
  modal?: boolean;
  confirmText?: string;
  cancelText?: string;
  destructive?: boolean;
}

/**
 * Show a confirmation dialog
 */
export async function showConfirmation(options: ConfirmationOptions): Promise<boolean> {
  const confirmText = options.confirmText || (options.destructive ? 'Delete' : 'Confirm');
  const cancelText = options.cancelText || 'Cancel';

  const messageOptions: vscode.MessageOptions = {
    modal: options.modal ?? true,
    detail: options.detail,
  };

  let result: string | undefined;

  if (options.destructive) {
    result = await vscode.window.showWarningMessage(
      options.message,
      messageOptions,
      confirmText,
      cancelText
    );
  } else {
    result = await vscode.window.showInformationMessage(
      options.message,
      messageOptions,
      confirmText,
      cancelText
    );
  }

  return result === confirmText;
}

/**
 * Show a simple yes/no confirmation
 */
export async function confirm(message: string, detail?: string): Promise<boolean> {
  return await showConfirmation({
    message,
    detail,
    confirmText: 'Yes',
    cancelText: 'No',
  });
}

/**
 * Show a destructive action confirmation
 */
export async function confirmDelete(
  itemName: string,
  options?: {
    detail?: string;
    confirmText?: string;
  }
): Promise<boolean> {
  return await showConfirmation({
    message: `Delete ${itemName}?`,
    detail: options?.detail || 'This action cannot be undone.',
    confirmText: options?.confirmText || 'Delete',
    destructive: true,
  });
}

/**
 * Show a confirmation with custom buttons
 */
export async function showChoice<T extends string>(
  message: string,
  choices: T[],
  options?: {
    detail?: string;
    modal?: boolean;
  }
): Promise<T | undefined> {
  const messageOptions: vscode.MessageOptions = {
    modal: options?.modal ?? false,
    detail: options?.detail,
  };

  const result = await vscode.window.showInformationMessage(message, messageOptions, ...choices);

  return result as T | undefined;
}

/**
 * Confirmation dialog builder for complex scenarios
 */
export class ConfirmationBuilder {
  private options: ConfirmationOptions = {
    message: '',
  };

  setMessage(message: string): this {
    this.options.message = message;
    return this;
  }

  setDetail(detail: string): this {
    this.options.detail = detail;
    return this;
  }

  setModal(modal: boolean = true): this {
    this.options.modal = modal;
    return this;
  }

  setConfirmText(text: string): this {
    this.options.confirmText = text;
    return this;
  }

  setCancelText(text: string): this {
    this.options.cancelText = text;
    return this;
  }

  setDestructive(destructive: boolean = true): this {
    this.options.destructive = destructive;
    return this;
  }

  async show(): Promise<boolean> {
    return await showConfirmation(this.options);
  }

  static create(): ConfirmationBuilder {
    return new ConfirmationBuilder();
  }
}
