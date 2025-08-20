// Central registry for managing website handlers. Import and register new handlers here

import { WebsiteHandler, WebsiteHandlerRegistry } from './types';
import { youtubeHandler } from './YouTubeHandler';

class WebsiteHandlerRegistryImpl implements WebsiteHandlerRegistry {
  handlers: WebsiteHandler[] = [];

  constructor() {
    this.registerHandler(youtubeHandler);
  }

  getHandler(url: string): WebsiteHandler | null {
    return this.handlers.find(handler => handler.test(url)) || null;
  }

  registerHandler(handler: WebsiteHandler): void {
    this.handlers = this.handlers.filter(h => h.name !== handler.name);
    this.handlers.push(handler);
  }
}

export const websiteHandlerRegistry = new WebsiteHandlerRegistryImpl();
