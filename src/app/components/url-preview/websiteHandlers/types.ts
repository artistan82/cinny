export interface WebsiteHandlerResult {
  /** The type of result - 'embed' replaces default preview, 'enhanced-preview' supplements it */
  type: 'embed' | 'enhanced-preview';

  /** React component to render for this URL */
  component: React.ComponentType<{ url: string; ts: number }>;

  /** Whether this handler should completely replace the default preview (default: false) */
  shouldReplace?: boolean;

  /** Optional priority for when multiple handlers could apply (higher = more priority) */
  priority?: number;

  /** Optional metadata about the handler result */
  metadata?: {
    title?: string;
    description?: string;
    siteName?: string;
    [key: string]: any;
  };
}

export interface WebsiteHandler {
  /** Unique name for this handler */
  name: string;

  /** Function to test if this handler applies to a given URL */
  test: (url: string) => boolean;

  /** Function to handle the URL and return the result */
  handle: (url: string) => WebsiteHandlerResult | null;

  /** Optional priority for when multiple handlers could apply (higher = more priority) */
  priority?: number;

  /** Optional configuration for the handler */
  config?: {
    /** Whether this handler is enabled (default: true) */
    enabled?: boolean;

    /** Timeout for handler operations in milliseconds (default: 5000) */
    timeout?: number;

    /** Maximum number of retries on failure (default: 3) */
    maxRetries?: number;
  };
}

export interface WebsiteHandlerRegistry {
  /** Array of registered handlers */
  handlers: WebsiteHandler[];

  /** Get the best handler for a given URL */
  getHandler: (url: string) => WebsiteHandler | null;

  /** Register a new handler */
  registerHandler: (handler: WebsiteHandler) => void;

  /** Get list of registered handler names */
  getRegisteredHandlers?: () => string[];

  /** Get error counts for handlers */
  getErrorCounts?: () => Map<string, number>;

  /** Reset error count for a specific handler */
  resetErrorCount?: (handlerName: string) => void;

  /** Clear all error counts */
  clearAllErrors?: () => void;
}

/** Options for creating website handlers */
export interface CreateHandlerOptions {
  /** Unique name for the handler */
  name: string;

  /** URL patterns to match (regex or function) */
  patterns: RegExp[] | ((url: string) => boolean);

  /** Component to render */
  component: React.ComponentType<{ url: string; ts: number }>;

  /** Whether to replace default preview */
  shouldReplace?: boolean;

  /** Handler priority */
  priority?: number;

  /** Handler configuration */
  config?: WebsiteHandler['config'];
}

/** Utility type for handler component props */
export type HandlerComponentProps = {
  url: string;
  ts: number;
};

/** Error types for website handlers */
export class WebsiteHandlerError extends Error {
  constructor(
    message: string,
    public handlerName: string,
    public url: string,
    public originalError?: any
  ) {
    super(message);
    this.name = 'WebsiteHandlerError';
  }
}
