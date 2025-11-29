/**
 * Core infrastructure module
 * Exports dependency injection and context management utilities
 */

export { ServiceContainer, createServiceIdentifier } from './ServiceContainer';
export type { ServiceIdentifier, ServiceOptions, ServiceFactory } from './ServiceContainer';
export { ExtensionContext } from './ExtensionContext';
