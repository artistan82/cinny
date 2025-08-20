import React from 'react';
import { WebsiteHandler, CreateHandlerOptions, WebsiteHandlerError, HandlerComponentProps } from './types';

/**
 * Creates a website handler with built-in error handling and validation
 */
export function createWebsiteHandler(options: CreateHandlerOptions): WebsiteHandler {
  const {
    name,
    patterns,
    component,
    shouldReplace = false,
    priority = 0,
    config = {}
  } = options;

  // Validate options
  if (!name || typeof name !== 'string') {
    throw new Error('Handler name must be a non-empty string');
  }

  if (!patterns) {
    throw new Error('Handler patterns must be provided');
  }

  if (!component) {
    throw new Error('Handler component must be provided');
  }

  // Create test function from patterns
  const testFunction = Array.isArray(patterns)
    ? (url: string) => patterns.some(pattern => pattern.test(url))
    : patterns;

  return {
    name,
    priority,
    config: {
      enabled: true,
      timeout: 5000,
      maxRetries: 3,
      ...config
    },
    test: (url: string) => {
      try {
        if (!config.enabled) return false;
        return testFunction(url);
      } catch (error) {
        throw new WebsiteHandlerError(
          `Test function failed for handler "${name}"`,
          name,
          url,
          error
        );
      }
    },
    handle: (url: string) => {
      try {
        if (!config.enabled) return null;
        
        return {
          type: shouldReplace ? 'embed' : 'enhanced-preview',
          component,
          shouldReplace,
          priority,
          metadata: {
            handlerName: name,
            url
          }
        };
      } catch (error) {
        throw new WebsiteHandlerError(
          `Handle function failed for handler "${name}"`,
          name,
          url,
          error
        );
      }
    }
  };
}

/**
 * Creates an error boundary wrapper for handler components
 */
export function withErrorBoundary<P extends HandlerComponentProps>(
  Component: React.ComponentType<P>,
  handlerName: string
): React.ComponentType<P> {
  return class ErrorBoundaryWrapper extends React.Component<P, { hasError: boolean; error?: Error }> {
    constructor(props: P) {
      super(props);
      this.state = { hasError: false };
    }

    static getDerivedStateFromError(error: Error) {
      return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
      console.error(`Website handler "${handlerName}" component crashed:`, error, errorInfo);
    }

    render() {
      if (this.state.hasError) {
        return React.createElement('div', {
          style: {
            padding: '16px',
            borderRadius: '8px',
            backgroundColor: '#f5f5f5',
            border: '1px solid #ddd',
            textAlign: 'center' as const,
            color: '#666'
          }
        }, `Failed to load ${handlerName} preview`);
      }

      return React.createElement(Component, this.props);
    }
  };
}

/**
 * Utility for safely extracting patterns from URLs
 */
export class UrlPatternExtractor {
  private patterns: Map<string, RegExp>;

  constructor() {
    this.patterns = new Map();
  }

  addPattern(name: string, pattern: RegExp): void {
    this.patterns.set(name, pattern);
  }

  extract(url: string): Map<string, string[]> {
    const results = new Map<string, string[]>();

    for (const [name, pattern] of this.patterns) {
      try {
        const match = url.match(pattern);
        if (match) {
          results.set(name, Array.from(match));
        }
      } catch (error) {
        console.warn(`Pattern "${name}" failed to match URL: ${url}`, error);
      }
    }

    return results;
  }

  extractFirst(url: string, patternName: string): string | null {
    const pattern = this.patterns.get(patternName);
    if (!pattern) return null;

    try {
      const match = url.match(pattern);
      return match?.[1] || null;
    } catch (error) {
      console.warn(`Pattern "${patternName}" failed to match URL: ${url}`, error);
      return null;
    }
  }
}

/**
 * Common URL patterns for popular platforms
 */
export const commonPatterns = {
  youtube: {
    watch: /^https?:\/\/(www\.)?youtube\.com\/watch\?v=([a-zA-Z0-9_-]+)(?:&.*)?$/,
    embed: /^https?:\/\/(www\.)?youtube\.com\/embed\/([a-zA-Z0-9_-]+)(?:\?.*)?$/,
    shortUrl: /^https?:\/\/()?youtu\.be\/([a-zA-Z0-9_-]+)(?:\?.*)?$/,
    shorts: /^https?:\/\/(www\.)?youtube\.com\/shorts\/([a-zA-Z0-9_-]+)(?:\?.*)?$/,
  },
  twitter: {
    status: /^https?:\/\/(www\.)?(twitter\.com|x\.com)\/\w+\/status\/(\d+)(?:\?.*)?$/,
  },
  instagram: {
    post: /^https?:\/\/(www\.)?instagram\.com\/p\/([a-zA-Z0-9_-]+)(?:\/.*)?$/,
    reel: /^https?:\/\/(www\.)?instagram\.com\/reel\/([a-zA-Z0-9_-]+)(?:\/.*)?$/,
  },
  tiktok: {
    video: /^https?:\/\/(www\.)?tiktok\.com\/@[\w.-]+\/video\/(\d+)(?:\?.*)?$/,
  },
  spotify: {
    track: /^https?:\/\/open\.spotify\.com\/track\/([a-zA-Z0-9]+)(?:\?.*)?$/,
    album: /^https?:\/\/open\.spotify\.com\/album\/([a-zA-Z0-9]+)(?:\?.*)?$/,
    playlist: /^https?:\/\/open\.spotify\.com\/playlist\/([a-zA-Z0-9]+)(?:\?.*)?$/,
  }
};

/**
 * Debounce utility for handler operations
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout;
  
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func.apply(null, args), delay);
  };
}
