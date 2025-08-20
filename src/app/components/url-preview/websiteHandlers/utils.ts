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
      console.error(`Error in ${handlerName} handler component:`, error, errorInfo);
    }

    render() {
      if (this.state.hasError) {
        return React.createElement('div', {
          style: {
            padding: '16px',
            backgroundColor: '#fee',
            border: '1px solid #fcc',
            borderRadius: '4px',
            color: '#900'
          }
        }, `Error loading ${handlerName} content`);
      }

      return React.createElement(Component, this.props);
    }
  };
}

/**
 * Common URL patterns for various platforms
 */
export const URL_PATTERNS = {
  youtube: {
    video: /^https?:\/\/(www\.)?youtube\.com\/watch\?v=([a-zA-Z0-9_-]+)(?:&.*)?$/,
    embed: /^https?:\/\/(www\.)?youtube\.com\/embed\/([a-zA-Z0-9_-]+)(?:\?.*)?$/,
    short: /^https?:\/\/()?youtu\.be\/([a-zA-Z0-9_-]+)(?:\?.*)?$/,
    shorts: /^https?:\/\/(www\.)?youtube\.com\/shorts\/([a-zA-Z0-9_-]+)(?:\?.*)?$/,
  },
  twitter: {
    tweet: /^https?:\/\/(www\.)?twitter\.com\/([a-zA-Z0-9_]+)\/status\/(\d+)(?:\/.*)?(?:\?.*)?$/,
    x_tweet: /^https?:\/\/(www\.)?x\.com\/([a-zA-Z0-9_]+)\/status\/(\d+)(?:\/.*)?(?:\?.*)?$/,
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

/**
 * Utility to extract URL parameters
 */
export function extractUrlParams(url: string): URLSearchParams {
  try {
    const urlObj = new URL(url);
    return urlObj.searchParams;
  } catch (error) {
    console.warn('Failed to parse URL parameters:', error);
    return new URLSearchParams();
  }
}

/**
 * Utility to validate URL
 */
export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Retry utility with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      
      if (attempt === maxRetries) {
        throw lastError;
      }
      
      const delay = baseDelay * Math.pow(2, attempt);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError!;
}
