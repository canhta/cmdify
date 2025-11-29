import * as vscode from 'vscode';

/**
 * Centralized wrapper for VS Code Extension Context
 * Provides type-safe, convenient access to extension context features
 */
export class ExtensionContext {
  constructor(private readonly context: vscode.ExtensionContext) {}

  // =============================================================================
  // Configuration Access
  // =============================================================================

  /**
   * Get configuration section with type safety
   */
  getConfig<T = any>(section: string): vscode.WorkspaceConfiguration {
    return vscode.workspace.getConfiguration(section);
  }

  /**
   * Get a configuration value with default
   */
  getConfigValue<T>(section: string, key: string, defaultValue: T): T {
    return this.getConfig(section).get<T>(key, defaultValue);
  }

  /**
   * Update configuration value
   */
  async updateConfig(
    section: string,
    key: string,
    value: any,
    target: vscode.ConfigurationTarget = vscode.ConfigurationTarget.Global
  ): Promise<void> {
    await this.getConfig(section).update(key, value, target);
  }

  // =============================================================================
  // Secret Storage
  // =============================================================================

  /**
   * Store a secret
   */
  async storeSecret(key: string, value: string): Promise<void> {
    await this.context.secrets.store(key, value);
  }

  /**
   * Retrieve a secret
   */
  async getSecret(key: string): Promise<string | undefined> {
    return await this.context.secrets.get(key);
  }

  /**
   * Delete a secret
   */
  async deleteSecret(key: string): Promise<void> {
    await this.context.secrets.delete(key);
  }

  // =============================================================================
  // Global State
  // =============================================================================

  /**
   * Get global state value
   */
  getGlobalState<T>(key: string): T | undefined;
  getGlobalState<T>(key: string, defaultValue: T): T;
  getGlobalState<T>(key: string, defaultValue?: T): T | undefined {
    return this.context.globalState.get<T>(key, defaultValue!);
  }

  /**
   * Update global state
   */
  async updateGlobalState<T>(key: string, value: T): Promise<void> {
    await this.context.globalState.update(key, value);
  }

  /**
   * Get all global state keys
   */
  getGlobalStateKeys(): readonly string[] {
    return this.context.globalState.keys();
  }

  // =============================================================================
  // Workspace State
  // =============================================================================

  /**
   * Get workspace state value
   */
  getWorkspaceState<T>(key: string): T | undefined;
  getWorkspaceState<T>(key: string, defaultValue: T): T;
  getWorkspaceState<T>(key: string, defaultValue?: T): T | undefined {
    return this.context.workspaceState.get<T>(key, defaultValue!);
  }

  /**
   * Update workspace state
   */
  async updateWorkspaceState<T>(key: string, value: T): Promise<void> {
    await this.context.workspaceState.update(key, value);
  }

  /**
   * Get all workspace state keys
   */
  getWorkspaceStateKeys(): readonly string[] {
    return this.context.workspaceState.keys();
  }

  // =============================================================================
  // Context Keys (for when conditions)
  // =============================================================================

  /**
   * Set a context key for 'when' clauses
   */
  async setContext(key: string, value: any): Promise<void> {
    await vscode.commands.executeCommand('setContext', key, value);
  }

  /**
   * Set multiple context keys at once
   */
  async setContexts(contexts: Record<string, any>): Promise<void> {
    await Promise.all(Object.entries(contexts).map(([key, value]) => this.setContext(key, value)));
  }

  // =============================================================================
  // Subscriptions
  // =============================================================================

  /**
   * Add disposable to subscriptions
   */
  addDisposable(disposable: vscode.Disposable): void {
    this.context.subscriptions.push(disposable);
  }

  /**
   * Add multiple disposables
   */
  addDisposables(...disposables: vscode.Disposable[]): void {
    this.context.subscriptions.push(...disposables);
  }

  // =============================================================================
  // Extension Paths
  // =============================================================================

  /**
   * Get extension URI
   */
  get extensionUri(): vscode.Uri {
    return this.context.extensionUri;
  }

  /**
   * Get extension path
   */
  get extensionPath(): string {
    return this.context.extensionPath;
  }

  /**
   * Get global storage URI
   */
  get globalStorageUri(): vscode.Uri {
    return this.context.globalStorageUri;
  }

  /**
   * Get workspace storage URI
   */
  get storageUri(): vscode.Uri | undefined {
    return this.context.storageUri;
  }

  /**
   * Get log URI
   */
  get logUri(): vscode.Uri {
    return this.context.logUri;
  }

  // =============================================================================
  // Environment Information
  // =============================================================================

  /**
   * Get extension mode
   */
  get extensionMode(): vscode.ExtensionMode {
    return this.context.extensionMode;
  }

  /**
   * Check if in development mode
   */
  get isDevelopment(): boolean {
    return this.context.extensionMode === vscode.ExtensionMode.Development;
  }

  /**
   * Check if in production mode
   */
  get isProduction(): boolean {
    return this.context.extensionMode === vscode.ExtensionMode.Production;
  }

  /**
   * Check if in test mode
   */
  get isTest(): boolean {
    return this.context.extensionMode === vscode.ExtensionMode.Test;
  }

  // =============================================================================
  // Environment Variables
  // =============================================================================

  /**
   * Get environment variables
   */
  get environmentVariableCollection(): vscode.GlobalEnvironmentVariableCollection {
    return this.context.environmentVariableCollection;
  }

  // =============================================================================
  // Raw Context Access
  // =============================================================================

  /**
   * Get the underlying VS Code extension context
   * Use this sparingly - prefer the wrapper methods above
   */
  getRawContext(): vscode.ExtensionContext {
    return this.context;
  }
}
