/**
 * Notification Service
 * Centralized notification management
 */

import * as vscode from 'vscode';

export type NotificationType = 'info' | 'warning' | 'error' | 'success';

export interface NotificationOptions {
  message: string;
  type?: NotificationType;
  buttons?: string[];
  modal?: boolean;
  detail?: string;
}

/**
 * Centralized notification service
 */
export class NotificationService {
  private static instance: NotificationService;

  private constructor() {}

  static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  /**
   * Show an information message
   */
  async info(message: string, ...buttons: string[]): Promise<string | undefined> {
    return await vscode.window.showInformationMessage(message, ...buttons);
  }

  /**
   * Show a warning message
   */
  async warn(message: string, ...buttons: string[]): Promise<string | undefined> {
    return await vscode.window.showWarningMessage(message, ...buttons);
  }

  /**
   * Show an error message
   */
  async error(message: string, ...buttons: string[]): Promise<string | undefined> {
    return await vscode.window.showErrorMessage(message, ...buttons);
  }

  /**
   * Show a success message (info with success icon)
   */
  async success(message: string, ...buttons: string[]): Promise<string | undefined> {
    return await vscode.window.showInformationMessage(`✅ ${message}`, ...buttons);
  }

  /**
   * Show a notification with options
   */
  async show(options: NotificationOptions): Promise<string | undefined> {
    const type = options.type || 'info';
    const messageOptions: vscode.MessageOptions | undefined = options.modal
      ? { modal: true, detail: options.detail }
      : undefined;

    const buttons = options.buttons || [];

    switch (type) {
      case 'error':
        return messageOptions
          ? await vscode.window.showErrorMessage(options.message, messageOptions, ...buttons)
          : await vscode.window.showErrorMessage(options.message, ...buttons);
      case 'warning':
        return messageOptions
          ? await vscode.window.showWarningMessage(options.message, messageOptions, ...buttons)
          : await vscode.window.showWarningMessage(options.message, ...buttons);
      case 'success':
        return messageOptions
          ? await vscode.window.showInformationMessage(
              `✅ ${options.message}`,
              messageOptions,
              ...buttons
            )
          : await vscode.window.showInformationMessage(`✅ ${options.message}`, ...buttons);
      case 'info':
      default:
        return messageOptions
          ? await vscode.window.showInformationMessage(options.message, messageOptions, ...buttons)
          : await vscode.window.showInformationMessage(options.message, ...buttons);
    }
  }

  /**
   * Show a progress notification
   */
  async withProgress<T>(
    title: string,
    task: (progress: vscode.Progress<{ message?: string; increment?: number }>) => Promise<T>
  ): Promise<T> {
    return await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title,
        cancellable: false,
      },
      task
    );
  }

  /**
   * Show a cancellable progress notification
   */
  async withCancellableProgress<T>(
    title: string,
    task: (
      progress: vscode.Progress<{ message?: string; increment?: number }>,
      token: vscode.CancellationToken
    ) => Promise<T>
  ): Promise<T> {
    return await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title,
        cancellable: true,
      },
      task
    );
  }
}

// Singleton instance
export const notifications = NotificationService.getInstance();

// Convenience exports
export const showInfo = (message: string, ...buttons: string[]) =>
  notifications.info(message, ...buttons);
export const showWarning = (message: string, ...buttons: string[]) =>
  notifications.warn(message, ...buttons);
export const showError = (message: string, ...buttons: string[]) =>
  notifications.error(message, ...buttons);
export const showSuccess = (message: string, ...buttons: string[]) =>
  notifications.success(message, ...buttons);
