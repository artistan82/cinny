// Central registry for managing website handlers. Import and register new handlers here

import { WebsiteHandler, WebsiteHandlerRegistry } from './types';
import { youtubeHandler } from './YouTubeHandler';
import { twitterHandler } from './TwitterHandler';

class WebsiteHandlerRegistryImpl implements WebsiteHandlerRegistry {
  handlers: WebsiteHandler[] = [];
  private errorCount = new Map<string, number>();
  private readonly MAX_ERROR_COUNT = 5;

  constructor() {
    this.safeRegisterHandler(youtubeHandler);
    this.safeRegisterHandler(twitterHandler);
  }

  getHandler(url: string): WebsiteHandler | null {
    const activeHandlers = this.handlers.filter(handler => {
      const errorCount = this.errorCount.get(handler.name) || 0;
      return errorCount < this.MAX_ERROR_COUNT;
    });

    // Sort handlers by priority (higher priority first)
    activeHandlers.sort((a, b) => (b.priority || 0) - (a.priority || 0));

    for (const handler of activeHandlers) {
      try {
        if (handler.test(url)) {
          return handler;
        }
      } catch (error) {
        this.recordError(handler.name, error);
        console.warn(`Handler "${handler.name}" test function failed for URL: ${url}`, error);
      }
    }

    return null;
  }

  registerHandler(handler: WebsiteHandler): void {
    this.safeRegisterHandler(handler);
  }

  private safeRegisterHandler(handler: WebsiteHandler): void {
    try {
      if (!handler.name || typeof handler.name !== 'string') {
        throw new Error('Handler must have a valid name');
      }
      
      if (typeof handler.test !== 'function') {
        throw new Error('Handler must have a test function');
      }
      
      if (typeof handler.handle !== 'function') {
        throw new Error('Handler must have a handle function');
      }

      // Remove any existing handler with the same name
      this.handlers = this.handlers.filter(h => h.name !== handler.name);
      
      // Add the new handler
      this.handlers.push(handler);
      
      // Clear any error count for this handler
      this.errorCount.delete(handler.name);
      
      console.debug(`Website handler "${handler.name}" registered successfully`);
    } catch (error) {
      console.error(`Failed to register website handler "${handler?.name || 'unknown'}":`, error);
    }
  }

  private recordError(handlerName: string, error: any): void {
    const currentCount = this.errorCount.get(handlerName) || 0;
    const newCount = currentCount + 1;
    this.errorCount.set(handlerName, newCount);

    if (newCount >= this.MAX_ERROR_COUNT) {
      console.warn(`Website handler "${handlerName}" has been disabled due to repeated errors (${newCount} errors)`);
    }
  }

  getRegisteredHandlers(): string[] {
    return this.handlers.map(h => h.name);
  }

  getErrorCounts(): Map<string, number> {
    return new Map(this.errorCount);
  }

  resetErrorCount(handlerName: string): void {
    this.errorCount.delete(handlerName);
  }

  clearAllErrors(): void {
    this.errorCount.clear();
  }
}

export const websiteHandlerRegistry = new WebsiteHandlerRegistryImpl();
