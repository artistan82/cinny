export interface WebsiteHandlerResult {
  type: 'embed' | 'enhanced-preview';
  component: React.ComponentType<{ url: string; ts: number }>;
  shouldReplace?: boolean;
}

export interface WebsiteHandler {
  name: string;
  test: (url: string) => boolean;
  handle: (url: string) => WebsiteHandlerResult | null;
}

export interface WebsiteHandlerRegistry {
  handlers: WebsiteHandler[];
  getHandler: (url: string) => WebsiteHandler | null;
  registerHandler: (handler: WebsiteHandler) => void;
}
