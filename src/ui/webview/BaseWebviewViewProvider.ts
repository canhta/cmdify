import * as vscode from 'vscode';
import { MessageHandler } from './MessageHandler';
import { getNonce } from './WebviewTemplate';

/**
 * Base options for creating a webview view provider
 */
export interface WebviewViewOptions {
  /** Unique view type identifier (e.g., 'cmdify.focus') */
  viewType: string;
  /** Webview options */
  options?: vscode.WebviewOptions;
}

/**
 * Base class for all webview view providers in Cmdify.
 * Provides common functionality for sidebar webview lifecycle, messaging, and HTML generation.
 *
 * WebviewView providers are used for sidebar panels (like companion panel),
 * while BaseWebviewPanel is used for full editor webview panels.
 *
 * @example
 * ```typescript
 * class MyViewProvider extends BaseWebviewViewProvider {
 *   constructor(context: vscode.ExtensionContext) {
 *     super(context, { viewType: 'cmdify.myView' });
 *   }
 *
 *   protected getHtmlContent(webview: vscode.Webview): string {
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
export abstract class BaseWebviewViewProvider implements vscode.WebviewViewProvider {
  protected view?: vscode.WebviewView;
  protected messageHandler: MessageHandler;
  protected disposables: vscode.Disposable[] = [];

  constructor(
    protected readonly context: vscode.ExtensionContext,
    protected readonly options: WebviewViewOptions
  ) {
    this.messageHandler = new MessageHandler();
  }

  /**
   * Resolve and initialize the webview view.
   * Called by VS Code when the view becomes visible.
   */
  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void {
    this.view = webviewView;

    // Configure webview options
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this.context.extensionUri, 'media'),
        vscode.Uri.joinPath(this.context.extensionUri, 'out'),
      ],
      ...this.options.options,
    };

    // Set initial HTML content
    webviewView.webview.html = this.getHtmlContent(webviewView.webview);

    // Set up message handling
    webviewView.webview.onDidReceiveMessage(
      (message) => this.handleIncomingMessage(message),
      undefined,
      this.disposables
    );

    // Handle visibility changes
    webviewView.onDidChangeVisibility(
      () => this.onDidChangeVisibility(),
      undefined,
      this.disposables
    );

    // Handle disposal
    webviewView.onDidDispose(() => this.onViewDisposed(), undefined, this.disposables);

    // Call lifecycle hook
    this.onViewCreated();
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
    if (this.view) {
      this.view.webview.html = this.getHtmlContent(this.view.webview);
    }
  }

  /**
   * Post a message to the webview.
   *
   * @param message - Message to send to the webview
   * @returns Promise that resolves when the message is posted
   */
  public postMessage(message: any): Thenable<boolean> {
    if (!this.view) {
      return Promise.resolve(false);
    }
    return this.view.webview.postMessage(message);
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
   * @param pathSegments - Path segments to join (e.g., 'media', 'icon.png')
   * @returns Webview URI
   */
  protected getUri(...pathSegments: string[]): vscode.Uri {
    if (!this.view) {
      throw new Error('View not initialized');
    }
    const uri = vscode.Uri.joinPath(this.context.extensionUri, ...pathSegments);
    return this.view.webview.asWebviewUri(uri);
  }

  /**
   * Get nonce for CSP (Content Security Policy).
   * Used to allow only specific inline scripts.
   */
  protected getNonce(): string {
    return getNonce();
  }

  /**
   * Check if the view is visible.
   */
  public get isVisible(): boolean {
    return this.view?.visible ?? false;
  }

  /**
   * Dispose the view and clean up resources.
   */
  public dispose(): void {
    while (this.disposables.length) {
      const disposable = this.disposables.pop();
      if (disposable) {
        disposable.dispose();
      }
    }

    this.view = undefined;
  }

  // ========== Lifecycle Hooks ==========

  /**
   * Called after the view is created and resolved.
   * Override to perform initialization.
   */
  protected onViewCreated(): void {
    // Override in subclass
  }

  /**
   * Called when the view is disposed.
   * Override to perform cleanup.
   */
  protected onViewDisposed(): void {
    // Override in subclass
  }

  /**
   * Called when the view's visibility changes.
   * Override to handle visibility changes.
   */
  protected onDidChangeVisibility(): void {
    // Override in subclass
  }

  // ========== Abstract Methods ==========

  /**
   * Generate the HTML content for the webview.
   * Must be implemented by subclasses.
   *
   * @param webview - The webview instance to generate content for
   */
  protected abstract getHtmlContent(webview: vscode.Webview): string;

  /**
   * Handle messages from the webview.
   * Override to implement custom message handling.
   *
   * @param message - The message received from the webview
   */
  protected abstract handleMessage(message: any): void;
}
