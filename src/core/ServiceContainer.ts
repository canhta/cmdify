import * as vscode from 'vscode';

/**
 * Service identifier for type-safe service registration and retrieval
 */
export type ServiceIdentifier<T> = symbol & { __type?: T };

/**
 * Service lifecycle options
 */
export interface ServiceOptions {
  /** If true, service will be lazily initialized on first access */
  lazy?: boolean;
  /** If true, service will be disposed when container is disposed */
  disposable?: boolean;
}

/**
 * Service factory function
 */
export type ServiceFactory<T> = (container: ServiceContainer) => T | Promise<T>;

/**
 * Dependency Injection Container
 * Manages service lifecycle and dependencies throughout the extension
 */
export class ServiceContainer {
  private static instance: ServiceContainer | null = null;
  private services = new Map<symbol, any>();
  private factories = new Map<symbol, ServiceFactory<any>>();
  private options = new Map<symbol, ServiceOptions>();
  private initializing = new Set<symbol>();
  private disposables: vscode.Disposable[] = [];

  private constructor(private readonly context: vscode.ExtensionContext) {}

  /**
   * Initialize the singleton container
   */
  static initialize(context: vscode.ExtensionContext): ServiceContainer {
    if (ServiceContainer.instance) {
      throw new Error('ServiceContainer already initialized');
    }
    ServiceContainer.instance = new ServiceContainer(context);
    return ServiceContainer.instance;
  }

  /**
   * Get the singleton container instance
   */
  static getInstance(): ServiceContainer {
    if (!ServiceContainer.instance) {
      throw new Error('ServiceContainer not initialized. Call initialize() first.');
    }
    return ServiceContainer.instance;
  }

  /**
   * Reset the container (primarily for testing)
   */
  static reset(): void {
    if (ServiceContainer.instance) {
      ServiceContainer.instance.dispose();
      ServiceContainer.instance = null;
    }
  }

  /**
   * Register a service with the container
   */
  register<T>(
    identifier: ServiceIdentifier<T>,
    factory: ServiceFactory<T>,
    options: ServiceOptions = {}
  ): void {
    if (this.factories.has(identifier)) {
      throw new Error(`Service already registered: ${String(identifier)}`);
    }

    this.factories.set(identifier, factory);
    this.options.set(identifier, options);

    // If not lazy, initialize immediately
    if (!options.lazy) {
      void this.get(identifier);
    }
  }

  /**
   * Register a singleton instance
   */
  registerInstance<T>(identifier: ServiceIdentifier<T>, instance: T): void {
    if (this.services.has(identifier)) {
      throw new Error(`Service instance already registered: ${String(identifier)}`);
    }
    this.services.set(identifier, instance);
  }

  /**
   * Get a service from the container
   */
  async get<T>(identifier: ServiceIdentifier<T>): Promise<T> {
    // Return cached instance if available
    if (this.services.has(identifier)) {
      return this.services.get(identifier);
    }

    // Check for circular dependencies
    if (this.initializing.has(identifier)) {
      throw new Error(`Circular dependency detected: ${String(identifier)}`);
    }

    // Get factory
    const factory = this.factories.get(identifier);
    if (!factory) {
      throw new Error(`Service not registered: ${String(identifier)}`);
    }

    try {
      // Mark as initializing
      this.initializing.add(identifier);

      // Create instance
      const instance = await factory(this);

      // Cache instance
      this.services.set(identifier, instance);

      // Track disposable services
      const opts = this.options.get(identifier);
      if (opts?.disposable && this.isDisposable(instance)) {
        this.disposables.push(instance);
      }

      return instance;
    } finally {
      this.initializing.delete(identifier);
    }
  }

  /**
   * Get a service synchronously (only works for already initialized services)
   */
  getSync<T>(identifier: ServiceIdentifier<T>): T {
    if (!this.services.has(identifier)) {
      throw new Error(
        `Service not initialized: ${String(identifier)}. Use get() for lazy services.`
      );
    }
    return this.services.get(identifier);
  }

  /**
   * Check if a service is registered
   */
  has<T>(identifier: ServiceIdentifier<T>): boolean {
    return this.services.has(identifier) || this.factories.has(identifier);
  }

  /**
   * Get the extension context
   */
  getContext(): vscode.ExtensionContext {
    return this.context;
  }

  /**
   * Check if an object is disposable
   */
  private isDisposable(obj: any): obj is vscode.Disposable {
    return obj && typeof obj.dispose === 'function';
  }

  /**
   * Dispose all services and cleanup
   */
  dispose(): void {
    // Dispose in reverse order of creation
    for (const disposable of this.disposables.reverse()) {
      try {
        disposable.dispose();
      } catch (error) {
        console.error('Error disposing service:', error);
      }
    }

    this.services.clear();
    this.factories.clear();
    this.options.clear();
    this.disposables = [];
  }
}

/**
 * Create a typed service identifier
 */
export function createServiceIdentifier<T>(name: string): ServiceIdentifier<T> {
  return Symbol(name) as ServiceIdentifier<T>;
}
