import * as vscode from 'vscode';
import { MessageHandler } from './MessageHandler';
import { getNonce } from './WebviewTemplate';

/**
 * Base options for creating a webview panel
 */
export interface WebviewPanelOptions {
  /** Unique view type identifier */
  viewType: string;
  /** Panel title shown in the tab */
  title: string;
  /** Show options for where to display the panel */
  showOptions?: vscode.ViewColumn | { viewColumn: vscode.ViewColumn; preserveFocus?: boolean };
  /** Webview options */
  options?: vscode.WebviewPanelOptions & vscode.WebviewOptions;
  /** Icon path for the panel */
  iconPath?: vscode.Uri | { light: vscode.Uri; dark: vscode.Uri };
}

/**
 * Base class for all webview panels in Cmdify.
 * Provides common functionality for panel lifecycle, messaging, and HTML generation.
 *
 * @example
 * ```typescript
 * class MyPanel extends BaseWebviewPanel {
 *   constructor(context: vscode.ExtensionContext) {
 *     super(context, {
 *       viewType: 'cmdify.myPanel',
 *       title: 'My Panel'
 *     });
 *   }
 *
 *   protected getHtmlContent(): string {
 *     return '<h1>Hello World</h1>';
 *   }
 *
 *   protected handleMessage(message: any): void {
 *     if (message.command === 'myAction') {
 *       // Handle action
 *     }
 *   }
 * }
 * ```
 */
export abstract class BaseWebviewPanel {
  protected panel?: vscode.WebviewPanel;
  protected messageHandler: MessageHandler;
  protected disposables: vscode.Disposable[] = [];

  constructor(
    protected readonly context: vscode.ExtensionContext,
    protected readonly options: WebviewPanelOptions
  ) {
    this.messageHandler = new MessageHandler();
  }

  /**
   * Get or create the webview panel.
   * If panel already exists, it will be revealed. Otherwise, a new one is created.
   */
  public getPanel(): vscode.WebviewPanel {
    if (this.panel) {
      this.panel.reveal();
      return this.panel;
    }

    const showOptions = this.options.showOptions || vscode.ViewColumn.One;
    const panelOptions: vscode.WebviewPanelOptions & vscode.WebviewOptions = {
      enableScripts: true,
      retainContextWhenHidden: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this.context.extensionUri, 'media'),
        vscode.Uri.joinPath(this.context.extensionUri, 'out'),
      ],
      ...this.options.options,
    };

    this.panel = vscode.window.createWebviewPanel(
      this.options.viewType,
      this.options.title,
      showOptions,
      panelOptions
    );

    if (this.options.iconPath) {
      this.panel.iconPath = this.options.iconPath;
    }

    this.initializePanel();
    return this.panel;
  }

  /**
   * Initialize the panel after creation.
   * Sets up message handling, disposal, and initial content.
   */
  protected initializePanel(): void {
    if (!this.panel) {
      return;
    }

    // Set initial HTML content
    this.panel.webview.html = this.getHtmlContent();

    // Set up message handling
    this.panel.webview.onDidReceiveMessage(
      (message) => this.handleIncomingMessage(message),
      undefined,
      this.disposables
    );

    // Handle panel disposal
    this.panel.onDidDispose(() => this.dispose(), undefined, this.disposables);

    // Handle visibility changes
    this.panel.onDidChangeViewState(
      (e) => this.onDidChangeViewState(e),
      undefined,
      this.disposables
    );

    // Call lifecycle hook
    this.onPanelCreated();
  }

  /**
   * Handle incoming messages from the webview.
   * Routes to registered handlers or the abstract handleMessage method.
   */
  protected handleIncomingMessage(message: any): void {
    // Try registered handlers first
    if (this.messageHandler.handle(message)) {
      return;
    }

    // Fallback to subclass implementation
    this.handleMessage(message);
  }

  /**
   * Update the webview content.
   * Regenerates and sets the HTML content.
   */
  public refresh(): void {
    if (this.panel) {
      this.panel.webview.html = this.getHtmlContent();
    }
  }

  /**
   * Post a message to the webview.
   *
   * @param message - Message to send to the webview
   * @returns Promise that resolves when the message is posted
   */
  public postMessage(message: any): Thenable<boolean> {
    if (!this.panel) {
      return Promise.resolve(false);
    }
    return this.panel.webview.postMessage(message);
  }

  /**
   * Register a message handler for a specific command.
   *
   * @param command - Command name to handle
   * @param handler - Handler function
   */
  protected registerMessageHandler(
    command: string,
    handler: (data: any) => void | Promise<void>
  ): void {
    this.messageHandler.register(command, handler);
  }

  /**
   * Get a webview URI for a resource.
   *
   * @param relativePath - Path relative to extension root (e.g., 'media/icon.png')
   * @returns Webview URI
   */
  protected getUri(...pathSegments: string[]): vscode.Uri {
    if (!this.panel) {
      throw new Error('Panel not initialized');
    }
    const uri = vscode.Uri.joinPath(this.context.extensionUri, ...pathSegments);
    return this.panel.webview.asWebviewUri(uri);
  }

  /**
   * Get nonce for CSP (Content Security Policy).
   * Used to allow only specific inline scripts.
   */
  protected getNonce(): string {
    return getNonce();
  }

  /**
   * Dispose the panel and clean up resources.
   */
  public dispose(): void {
    this.onPanelDisposed();

    if (this.panel) {
      this.panel.dispose();
    }

    while (this.disposables.length) {
      const disposable = this.disposables.pop();
      if (disposable) {
        disposable.dispose();
      }
    }

    this.panel = undefined;
  }

  // ========== Lifecycle Hooks ==========

  /**
   * Called after the panel is created.
   * Override to perform initialization.
   */
  protected onPanelCreated(): void {
    // Override in subclass
  }

  /**
   * Called when the panel is disposed.
   * Override to perform cleanup.
   */
  protected onPanelDisposed(): void {
    // Override in subclass
  }

  /**
   * Called when the panel's visibility or focus state changes.
   */
  protected onDidChangeViewState(e: vscode.WebviewPanelOnDidChangeViewStateEvent): void {
    // Override in subclass
  }

  // ========== Abstract Methods ==========

  /**
   * Generate the HTML content for the webview.
   * Must be implemented by subclasses.
   */
  protected abstract getHtmlContent(): string;

  /**
   * Handle messages from the webview.
   * Override to implement custom message handling.
   */
  protected abstract handleMessage(message: any): void;
}
