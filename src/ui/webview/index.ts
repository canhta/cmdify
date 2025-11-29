/**
 * Webview infrastructure for Cmdify extension.
 * Provides base classes and utilities for creating consistent webview panels and views.
 */

export { BaseWebviewPanel, WebviewPanelOptions } from './BaseWebviewPanel';
export { BaseWebviewViewProvider, WebviewViewOptions } from './BaseWebviewViewProvider';
export { MessageHandler } from './MessageHandler';
export { StylesProvider } from './StylesProvider';
export { WebviewTemplate, TemplateOptions, getNonce } from './WebviewTemplate';
