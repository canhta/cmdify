import { StylesProvider } from './StylesProvider';

/**
 * Options for creating a webview HTML template
 */
export interface TemplateOptions {
  /** Page title */
  title: string;
  /** Body content (HTML) */
  body: string;
  /** Additional head content (meta tags, links, etc.) */
  head?: string;
  /** Additional styles (CSS) */
  styles?: string;
  /** Script content (JavaScript) */
  script?: string;
  /** Nonce for CSP */
  nonce?: string;
  /** Whether to include base styles */
  includeBaseStyles?: boolean;
  /** Whether to include component styles */
  includeComponentStyles?: boolean;
  /** Whether to include animation styles */
  includeAnimationStyles?: boolean;
}

/**
 * Template engine for generating webview HTML.
 * Provides a consistent structure for all webview panels.
 *
 * @example
 * ```typescript
 * const html = WebviewTemplate.create({
 *   title: 'My Panel',
 *   body: '<h1>Hello World</h1>',
 *   script: 'console.log("Panel loaded");'
 * });
 * ```
 */
export class WebviewTemplate {
  /**
   * Create a complete HTML document for a webview.
   *
   * @param options - Template options
   * @returns Complete HTML document string
   */
  public static create(options: TemplateOptions): string {
    const {
      title,
      body,
      head = '',
      styles = '',
      script = '',
      nonce = '',
      includeBaseStyles = true,
      includeComponentStyles = true,
      includeAnimationStyles = true,
    } = options;

    const csp = nonce ? StylesProvider.getCSP(nonce) : '';
    const baseStyles = includeBaseStyles ? StylesProvider.getBaseStyles() : '';
    const componentStyles = includeComponentStyles ? StylesProvider.getComponentStyles() : '';
    const animationStyles = includeAnimationStyles ? StylesProvider.getAnimationStyles() : '';

    return `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	${csp}
	<title>${this.escapeHtml(title)}</title>
	${head}
	<style>
		${baseStyles}
		${componentStyles}
		${animationStyles}
		${styles}
	</style>
</head>
<body>
	${body}
	${script ? `<script nonce="${nonce}">${script}</script>` : ''}
</body>
</html>`;
  }

  /**
   * Create a simple page with a container wrapper
   *
   * @param title - Page title
   * @param content - Content HTML
   * @param options - Additional options
   */
  public static createPage(
    title: string,
    content: string,
    options: Partial<TemplateOptions> = {}
  ): string {
    const body = `
			<div class="container">
				<h1>${this.escapeHtml(title)}</h1>
				${content}
			</div>
		`;

    return this.create({
      title,
      body,
      ...options,
    });
  }

  /**
   * Create a loading state template
   *
   * @param message - Loading message
   */
  public static createLoading(message: string = 'Loading...'): string {
    return this.create({
      title: 'Loading',
      body: `
				<div class="flex flex-column items-center justify-center" style="height: 100vh;">
					<div class="loading" style="width: 40px; height: 40px;"></div>
					<p class="text-muted mt-2">${this.escapeHtml(message)}</p>
				</div>
			`,
    });
  }

  /**
   * Create an error state template
   *
   * @param title - Error title
   * @param message - Error message
   * @param details - Optional error details
   */
  public static createError(title: string, message: string, details?: string): string {
    return this.create({
      title: 'Error',
      body: `
				<div class="container">
					<div class="card">
						<h2 style="color: var(--vscode-errorForeground);">⚠️ ${this.escapeHtml(title)}</h2>
						<p>${this.escapeHtml(message)}</p>
						${
              details
                ? `
							<details class="mt-2">
								<summary style="cursor: pointer;">Details</summary>
								<pre class="mt-1"><code>${this.escapeHtml(details)}</code></pre>
							</details>
						`
                : ''
            }
					</div>
				</div>
			`,
    });
  }

  /**
   * Create an empty state template
   *
   * @param icon - Emoji or icon
   * @param title - Empty state title
   * @param message - Empty state message
   * @param action - Optional action button HTML
   */
  public static createEmptyState(
    icon: string,
    title: string,
    message: string,
    action?: string
  ): string {
    return `
			<div class="flex flex-column items-center justify-center text-center" style="padding: 40px;">
				<div style="font-size: 48px; margin-bottom: 16px;">${icon}</div>
				<h2>${this.escapeHtml(title)}</h2>
				<p class="text-muted">${this.escapeHtml(message)}</p>
				${action ? `<div class="mt-2">${action}</div>` : ''}
			</div>
		`;
  }

  // ========== Helper Methods ==========

  /**
   * Escape HTML to prevent XSS
   */
  public static escapeHtml(text: string): string {
    const map: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;',
    };
    return text.replace(/[&<>"']/g, (m) => map[m]);
  }

  /**
   * Create a card component
   */
  public static card(header: string, content: string, className: string = ''): string {
    return `
			<div class="card ${className}">
				${header ? `<div class="card-header">${this.escapeHtml(header)}</div>` : ''}
				${content}
			</div>
		`;
  }

  /**
   * Create a button element
   */
  public static button(
    text: string,
    command: string,
    className: string = '',
    disabled: boolean = false
  ): string {
    return `
			<button 
				class="button ${className}" 
				onclick="sendMessage('${command}')"
				${disabled ? 'disabled' : ''}
			>
				${this.escapeHtml(text)}
			</button>
		`;
  }

  /**
   * Create a badge element
   */
  public static badge(text: string, className: string = ''): string {
    return `<span class="badge ${className}">${this.escapeHtml(text)}</span>`;
  }

  /**
   * Create a list item
   */
  public static listItem(
    content: string,
    command?: string,
    className: string = '',
    active: boolean = false
  ): string {
    const classes = `list-item ${className} ${active ? 'active' : ''}`.trim();
    const onclick = command ? `onclick="sendMessage('${command}')"` : '';
    return `<li class="${classes}" ${onclick}>${content}</li>`;
  }

  /**
   * Get the standard message sending script
   */
  public static getMessagingScript(): string {
    return `
			const vscode = acquireVsCodeApi();

			function sendMessage(command, data = {}) {
				vscode.postMessage({ command, ...data });
			}

			window.addEventListener('message', event => {
				const message = event.data;
				handleMessage(message);
			});

			// Override in your custom script
			function handleMessage(message) {
				console.log('Received message:', message);
			}
		`;
  }
}

/**
 * Generate a nonce for CSP (Content Security Policy).
 * Used to allow only specific inline scripts.
 *
 * @returns A random 32-character alphanumeric string
 */
export function getNonce(): string {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
