import * as fs from 'fs';
import * as path from 'path';

/**
 * Panel-specific style identifiers
 */
export type PanelStyleType = 'companion' | 'onboarding' | 'activity' | 'achievement' | 'notes';

/**
 * Provides shared CSS styles for webview panels.
 * Centralizes styling to ensure consistency across all panels and reduce duplication.
 */
export class StylesProvider {
  private static styleCache: Map<string, string> = new Map();

  /**
   * Load a CSS file from the views/styles directory
   * @param filename - Name of the CSS file (without extension)
   * @returns CSS content as a string
   */
  public static loadStyleFile(filename: string, extensionPath: string): string {
    const cacheKey = `${extensionPath}:${filename}`;

    if (this.styleCache.has(cacheKey)) {
      return this.styleCache.get(cacheKey)!;
    }

    try {
      const stylePath = path.join(extensionPath, 'src', 'views', 'styles', `${filename}.css`);
      const css = fs.readFileSync(stylePath, 'utf8');
      this.styleCache.set(cacheKey, css);
      return css;
    } catch {
      console.warn(`Failed to load style file: ${filename}.css`);
      return '';
    }
  }

  /**
   * Get panel-specific styles by panel type
   * @param panelType - The type of panel
   * @param extensionPath - Path to the extension root
   * @returns CSS content for the panel
   */
  public static getPanelStyles(panelType: PanelStyleType, extensionPath: string): string {
    return this.loadStyleFile(panelType, extensionPath);
  }

  /**
   * Get combined styles for a panel (base + component + panel-specific)
   * @param panelType - The type of panel
   * @param extensionPath - Path to the extension root
   * @returns Combined CSS content
   */
  public static getCombinedStyles(panelType: PanelStyleType, extensionPath: string): string {
    return `
      ${this.getBaseStyles()}
      ${this.getComponentStyles()}
      ${this.getAnimationStyles()}
      ${this.getPanelStyles(panelType, extensionPath)}
    `;
  }

  /**
   * Get base CSS variables and reset styles.
   * These should be included in every webview panel.
   */
  public static getBaseStyles(): string {
    return `
			/* CSS Variables for theming */
			:root {
				--container-padding: 20px;
				--input-padding: 8px 12px;
				--border-radius: 6px;
				--transition-speed: 0.2s;
				
				/* VS Code theme colors */
				--vscode-font-family: var(--vscode-font-family, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif);
				--background: var(--vscode-editor-background);
				--foreground: var(--vscode-editor-foreground);
				--border-color: var(--vscode-panel-border);
				--hover-background: var(--vscode-list-hoverBackground);
				--active-background: var(--vscode-list-activeSelectionBackground);
				--button-background: var(--vscode-button-background);
				--button-foreground: var(--vscode-button-foreground);
				--button-hover-background: var(--vscode-button-hoverBackground);
				--input-background: var(--vscode-input-background);
				--input-foreground: var(--vscode-input-foreground);
				--input-border: var(--vscode-input-border);
				--link-color: var(--vscode-textLink-foreground);
				--link-active-color: var(--vscode-textLink-activeForeground);
			}

			/* Reset and base styles */
			* {
				box-sizing: border-box;
				margin: 0;
				padding: 0;
			}

			body {
				font-family: var(--vscode-font-family);
				font-size: var(--vscode-font-size, 13px);
				color: var(--foreground);
				background-color: var(--background);
				line-height: 1.6;
				padding: var(--container-padding);
			}

			h1, h2, h3, h4, h5, h6 {
				font-weight: 600;
				line-height: 1.3;
				margin-bottom: 0.5em;
			}

			h1 { font-size: 2em; }
			h2 { font-size: 1.5em; }
			h3 { font-size: 1.25em; }

			p {
				margin-bottom: 1em;
			}

			a {
				color: var(--link-color);
				text-decoration: none;
				cursor: pointer;
			}

			a:hover {
				color: var(--link-active-color);
				text-decoration: underline;
			}

			code {
				font-family: var(--vscode-editor-font-family, 'Courier New', monospace);
				background-color: var(--vscode-textCodeBlock-background);
				padding: 2px 4px;
				border-radius: 3px;
				font-size: 0.9em;
			}

			pre {
				background-color: var(--vscode-textCodeBlock-background);
				padding: 12px;
				border-radius: var(--border-radius);
				overflow-x: auto;
				margin-bottom: 1em;
			}

			pre code {
				background: none;
				padding: 0;
			}
		`;
  }

  /**
   * Get common component styles (buttons, inputs, cards, etc.)
   */
  public static getComponentStyles(): string {
    return `
			/* Button styles */
			.button, button {
				background-color: var(--button-background);
				color: var(--button-foreground);
				border: none;
				padding: var(--input-padding);
				border-radius: var(--border-radius);
				cursor: pointer;
				font-size: inherit;
				font-family: inherit;
				transition: background-color var(--transition-speed);
				display: inline-flex;
				align-items: center;
				justify-content: center;
				gap: 6px;
			}

			.button:hover, button:hover {
				background-color: var(--button-hover-background);
			}

			.button:active, button:active {
				opacity: 0.8;
			}

			.button:disabled, button:disabled {
				opacity: 0.5;
				cursor: not-allowed;
			}

			.button-secondary {
				background-color: var(--vscode-button-secondaryBackground);
				color: var(--vscode-button-secondaryForeground);
			}

			.button-secondary:hover {
				background-color: var(--vscode-button-secondaryHoverBackground);
			}

			/* Input styles */
			input[type="text"],
			input[type="email"],
			input[type="password"],
			input[type="number"],
			input[type="date"],
			textarea,
			select {
				background-color: var(--input-background);
				color: var(--input-foreground);
				border: 1px solid var(--input-border, transparent);
				padding: var(--input-padding);
				border-radius: var(--border-radius);
				font-size: inherit;
				font-family: inherit;
				width: 100%;
				transition: border-color var(--transition-speed);
			}

			input:focus,
			textarea:focus,
			select:focus {
				outline: 1px solid var(--vscode-focusBorder);
				border-color: var(--vscode-focusBorder);
			}

			/* Card/Container styles */
			.card {
				background-color: var(--vscode-editor-background);
				border: 1px solid var(--border-color);
				border-radius: var(--border-radius);
				padding: 16px;
				margin-bottom: 16px;
			}

			.card-header {
				font-weight: 600;
				margin-bottom: 12px;
				padding-bottom: 8px;
				border-bottom: 1px solid var(--border-color);
			}

			/* List styles */
			.list {
				list-style: none;
			}

			.list-item {
				padding: 8px 12px;
				border-radius: var(--border-radius);
				cursor: pointer;
				transition: background-color var(--transition-speed);
			}

			.list-item:hover {
				background-color: var(--hover-background);
			}

			.list-item.active {
				background-color: var(--active-background);
			}

			/* Badge styles */
			.badge {
				display: inline-block;
				padding: 2px 8px;
				border-radius: 12px;
				font-size: 0.85em;
				font-weight: 500;
				background-color: var(--vscode-badge-background);
				color: var(--vscode-badge-foreground);
			}

			/* Utility classes */
			.flex {
				display: flex;
			}

			.flex-column {
				flex-direction: column;
			}

			.gap-small {
				gap: 8px;
			}

			.gap-medium {
				gap: 16px;
			}

			.gap-large {
				gap: 24px;
			}

			.items-center {
				align-items: center;
			}

			.justify-between {
				justify-content: space-between;
			}

			.justify-center {
				justify-content: center;
			}

			.text-center {
				text-align: center;
			}

			.text-muted {
				color: var(--vscode-descriptionForeground);
			}

			.text-small {
				font-size: 0.9em;
			}

			.mt-1 { margin-top: 8px; }
			.mt-2 { margin-top: 16px; }
			.mt-3 { margin-top: 24px; }
			.mb-1 { margin-bottom: 8px; }
			.mb-2 { margin-bottom: 16px; }
			.mb-3 { margin-bottom: 24px; }

			.hidden {
				display: none !important;
			}

			/* Scrollbar styles */
			::-webkit-scrollbar {
				width: 10px;
				height: 10px;
			}

			::-webkit-scrollbar-track {
				background: var(--vscode-scrollbarSlider-background);
			}

			::-webkit-scrollbar-thumb {
				background: var(--vscode-scrollbarSlider-background);
				border-radius: 5px;
			}

			::-webkit-scrollbar-thumb:hover {
				background: var(--vscode-scrollbarSlider-hoverBackground);
			}
		`;
  }

  /**
   * Get animation styles for interactive elements
   */
  public static getAnimationStyles(): string {
    return `
			@keyframes fadeIn {
				from { opacity: 0; }
				to { opacity: 1; }
			}

			@keyframes slideIn {
				from {
					transform: translateY(-10px);
					opacity: 0;
				}
				to {
					transform: translateY(0);
					opacity: 1;
				}
			}

			@keyframes pulse {
				0%, 100% { opacity: 1; }
				50% { opacity: 0.5; }
			}

			.fade-in {
				animation: fadeIn var(--transition-speed) ease-out;
			}

			.slide-in {
				animation: slideIn 0.3s ease-out;
			}

			.pulse {
				animation: pulse 1.5s ease-in-out infinite;
			}

			.loading {
				position: relative;
				pointer-events: none;
				opacity: 0.6;
			}

			.loading::after {
				content: '';
				position: absolute;
				top: 50%;
				left: 50%;
				width: 20px;
				height: 20px;
				margin: -10px 0 0 -10px;
				border: 2px solid var(--vscode-progressBar-background);
				border-radius: 50%;
				border-top-color: transparent;
				animation: spin 0.6s linear infinite;
			}

			@keyframes spin {
				to { transform: rotate(360deg); }
			}
		`;
  }

  /**
   * Get all styles combined
   */
  public static getAllStyles(): string {
    return `
			<style>
				${this.getBaseStyles()}
				${this.getComponentStyles()}
				${this.getAnimationStyles()}
			</style>
		`;
  }

  /**
   * Get Content Security Policy meta tag
   *
   * @param nonce - Nonce value for inline scripts
   */
  public static getCSP(nonce: string): string {
    return `
			<meta http-equiv="Content-Security-Policy" 
				content="default-src 'none'; 
				style-src 'unsafe-inline'; 
				script-src 'nonce-${nonce}'; 
				img-src vscode-resource: https:; 
				font-src vscode-resource:;">
		`;
  }
}
