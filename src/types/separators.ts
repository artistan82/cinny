// Separator-related types
export interface ChannelSeparator {
  id: string;
  name: string;
  order: number;
  isBase: boolean;
  isCollapsed: boolean;
  createdAt: number;
}

export interface SpaceSeparators {
  separators: ChannelSeparator[];
  channelAssignments: Record<string, string>; // channelId -> separatorId
}

// Channel types
export interface BaseChannel {
  id: string;
  name: string;
}

export interface TextChannel extends BaseChannel {
  type: 'text';
  isPrivate?: boolean;
  topic?: string;
  lastMessageAt?: number;
}

export interface VoiceChannel extends BaseChannel {
  type: 'voice';
  bitrate?: number;
  userLimit?: number;
  connectedUsers?: string[];
}

export interface ForumChannel extends BaseChannel {
  type: 'forum';
  tags?: string[];
  defaultSortOrder?: 'latest' | 'top';
}

export type Channel = TextChannel | VoiceChannel | ForumChannel;

// Space types
export interface Space {
  id: string;
  name: string;
  icon?: string;
  description?: string;
  channels: Channel[];
  ownerId?: string;
  memberIds?: string[];
  createdAt?: number;
  updatedAt?: number;
}

// Drag and drop types
export interface DragItem {
  id: string;
  type: 'channel' | 'separator';
  name?: string;
  order?: number;
  sourceSpaceId?: string;
  sourceSeparatorId?: string;
}

export interface DropResult {
  targetSeparatorId: string;
  targetOrder?: number;
  targetSpaceId?: string;
}

// Operation result types
export interface OperationResult {
  success: boolean;
  id?: string;
  error?: string;
  cancelled?: boolean;
}

export interface CreateSeparatorResult extends OperationResult {
  separator?: ChannelSeparator;
}

export interface DeleteSeparatorResult extends OperationResult {
  movedChannelCount?: number;
}

// Hook types
export interface UseSeparatorsOptions {
  spaceId: string;
  channels?: Channel[];
  autoInitialize?: boolean;
  onError?: (error: Error) => void;
}

export interface ChannelWithSeparator {
  channel: Channel;
  separatorId: string;
  separatorName: string;
  separatorOrder: number;
}

export interface SeparatorWithChannels {
  separator: ChannelSeparator;
  channels: Channel[];
  channelCount: number;
}

// Event types for tracking changes
export interface SeparatorEvent {
  type: 'created' | 'renamed' | 'deleted' | 'reordered' | 'collapsed';
  spaceId: string;
  separatorId: string;
  timestamp: number;
  data?: any;
}

export interface ChannelMoveEvent {
  type: 'channel_moved';
  spaceId: string;
  channelId: string;
  fromSeparatorId: string;
  toSeparatorId: string;
  timestamp: number;
}

// Store state type
export interface SeparatorsStoreState {
  spaceSeparators: Record<string, SpaceSeparators>;
  
  // Actions
  initializeSpace: (spaceId: string) => void;
  createSeparator: (spaceId: string, name: string, afterSeparatorId?: string) => string;
  renameSeparator: (spaceId: string, separatorId: string, newName: string) => void;
  deleteSeparator: (spaceId: string, separatorId: string) => void;
  toggleSeparatorCollapse: (spaceId: string, separatorId: string) => void;
  assignChannelToSeparator: (spaceId: string, channelId: string, separatorId: string) => void;
  getChannelSeparator: (spaceId: string, channelId: string) => string;
  reorderSeparators: (spaceId: string, separatorIds: string[]) => void;
  moveSeparator: (spaceId: string, separatorId: string, newOrder: number) => void;
  
  // Getters
  getSpaceSeparators: (spaceId: string) => ChannelSeparator[];
  getChannelsInSeparator: (spaceId: string, separatorId: string) => string[];
  getSeparatorById: (spaceId: string, separatorId: string) => ChannelSeparator | undefined;
  
  // Bulk operations
  batchAssignChannels: (spaceId: string, assignments: Array<{ channelId: string; separatorId: string }>) => void;
  moveAllChannels: (spaceId: string, fromSeparatorId: string, toSeparatorId: string) => void;
  
  // Import/Export
  exportSpaceConfiguration: (spaceId: string) => SpaceSeparators | null;
  importSpaceConfiguration: (spaceId: string, config: SpaceSeparators) => void;
  
  // Cleanup
  clearSpaceData: (spaceId: string) => void;
  resetStore: () => void;
}

// Component prop types
export interface SeparatorContainerProps {
  spaceId: string;
  separator: ChannelSeparator;
  channels: Channel[];
  renderChannel: (channel: Channel) => React.ReactNode;
  onChannelDrop?: (channelId: string, separatorId: string) => void;
  onSeparatorReorder?: (separatorId: string, newOrder: number) => void;
  allowDelete?: boolean;
  allowRename?: boolean;
  allowReorder?: boolean;
  className?: string;
}

export interface DraggableChannelProps {
  channel: Channel;
  isActive?: boolean;
  isDraggable?: boolean;
  onClick?: (channelId: string) => void;
  onDoubleClick?: (channelId: string) => void;
  renderIcon?: (channel: Channel) => React.ReactNode;
  className?: string;
}

export interface SpaceWithSeparatorsProps {
  space: Space;
  activeChannelId?: string;
  onChannelSelect?: (channelId: string) => void;
  onChannelCreate?: (separatorId: string) => void;
  onSeparatorCreate?: (name: string, afterSeparatorId?: string) => void;
  allowChannelCreation?: boolean;
  allowSeparatorManagement?: boolean;
  className?: string;
}

// Validation types
export interface ValidationRules {
  maxSeparatorsPerSpace?: number;
  maxSeparatorNameLength?: number;
  minSeparatorNameLength?: number;
  allowEmptySeparators?: boolean;
  allowDuplicateNames?: boolean;
  reservedNames?: string[];
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings?: string[];
}

// Constants
export const SEPARATOR_CONSTANTS = {
  BASE_SEPARATOR_ID: 'base-rooms',
  DEFAULT_MAX_SEPARATORS: 20,
  DEFAULT_MAX_NAME_LENGTH: 50,
  DEFAULT_MIN_NAME_LENGTH: 1,
  DRAG_TYPE_CHANNEL: 'channel',
  DRAG_TYPE_SEPARATOR: 'separator',
} as const;

// Type guards
export function isTextChannel(channel: Channel): channel is TextChannel {
  return channel.type === 'text';
}

export function isVoiceChannel(channel: Channel): channel is VoiceChannel {
  return channel.type === 'voice';
}

export function isForumChannel(channel: Channel): channel is ForumChannel {
  return channel.type === 'forum';
}

export function isBaseSeparator(separator: ChannelSeparator): boolean {
  return separator.isBase === true;
}

// Utility types
export type SeparatorId = string;
export type ChannelId = string;
export type SpaceId = string;

export type SeparatorOrder = number;
export type Timestamp = number;

export type ChannelAssignments = Record<ChannelId, SeparatorId>;
export type SpaceSeparatorsMap = Record<SpaceId, SpaceSeparators>;
