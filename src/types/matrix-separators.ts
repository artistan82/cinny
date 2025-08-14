import { Room } from 'matrix-js-sdk';

// Core separator types
export interface MatrixChannelSeparator {
  id: string;
  name: string;
  order: number;
  isBase: boolean;
  isCollapsed: boolean;
  createdAt: number;
  spaceId: string;
}

export interface MatrixSpaceSeparators {
  separators: MatrixChannelSeparator[];
  roomAssignments: Record<string, string>; // roomId -> separatorId
}

// Drag and drop types for Matrix rooms
export interface MatrixDragItem {
  roomId: string;
  sourceSeparatorId: string;
  sourceSpaceId: string;
  roomType?: 'room' | 'space' | 'dm';
}

export interface MatrixSeparatorDragItem {
  id: string;
  order: number;
  spaceId: string;
}

// Component props
export interface DraggableMatrixRoomProps {
  room: Room;
  selected: boolean;
  showAvatar: boolean;
  direct: boolean;
  linkPath: string;
  notificationMode: any; // Use your notification type
  spaceId: string;
  separatorId: string;
  onDrop?: (roomId: string, targetSeparatorId: string) => void;
}

export interface MatrixSeparatorContainerProps {
  separator: MatrixChannelSeparator;
  spaceId: string;
  rooms: Room[];
  renderRoom: (room: Room, separatorId: string) => React.ReactNode;
  onCreateSeparator: () => void;
  onRenameSeparator: () => void;
  onDeleteSeparator: () => void;
  onToggleCollapse?: () => void;
  allowDrag?: boolean;
  allowDrop?: boolean;
}

export interface MatrixSpaceWithSeparatorsProps {
  space: Room;
  activeRoomId?: string;
  onRoomSelect?: (roomId: string) => void;
  allowSeparatorManagement?: boolean;
  virtualScrolling?: boolean;
}

// Store state extension for Matrix
export interface MatrixSeparatorsStoreState {
  spaceSeparators: Record<string, MatrixSpaceSeparators>;
  
  // Room-specific operations
  assignRoomToSeparator: (spaceId: string, roomId: string, separatorId: string) => void;
  getRoomSeparator: (spaceId: string, roomId: string) => string;
  getRoomsInSeparator: (spaceId: string, separatorId: string) => string[];
  
  // Bulk operations for Matrix rooms
  assignRoomsToSeparator: (spaceId: string, roomIds: string[], separatorId: string) => void;
  moveAllRooms: (spaceId: string, fromSeparatorId: string, toSeparatorId: string) => void;
  
  // Matrix-specific utilities
  getUnassignedRooms: (spaceId: string, allRoomIds: string[]) => string[];
  autoOrganizeRooms: (spaceId: string, rooms: Room[]) => void;
  
  // Import/Export for Matrix account data
  exportToAccountData: (spaceId: string) => string;
  importFromAccountData: (spaceId: string, data: string) => void;
}

// Matrix room categorization
export interface RoomCategory {
  id: string;
  name: string;
  matcher: (room: Room) => boolean;
  priority: number;
}

export const DEFAULT_ROOM_CATEGORIES: RoomCategory[] = [
  {
    id: 'announcements',
    name: 'Announcements',
    matcher: (room) => room.name?.toLowerCase().includes('announcement') || false,
    priority: 1,
  },
  {
    id: 'general',
    name: 'General',
    matcher: (room) => room.name?.toLowerCase().includes('general') || false,
    priority: 2,
  },
  {
    id: 'team',
    name: 'Team',
    matcher: (room) => room.name?.toLowerCase().includes('team') || false,
    priority: 3,
  },
  {
    id: 'direct',
    name: 'Direct Messages',
    matcher: (room) => room.getMyMembership() === 'join' && room.getJoinedMemberCount() === 2,
    priority: 10,
  },
];

// Operation results
export interface MatrixSeparatorOperationResult {
  success: boolean;
  error?: string;
  affectedRoomIds?: string[];
  separator?: MatrixChannelSeparator;
}

// Events for tracking changes
export interface MatrixSeparatorEvent {
  type: 'created' | 'renamed' | 'deleted' | 'reordered' | 'collapsed';
  spaceId: string;
  separatorId: string;
  userId: string;
  timestamp: number;
  data?: any;
}

export interface MatrixRoomMoveEvent {
  type: 'room_moved';
  spaceId: string;
  roomId: string;
  fromSeparatorId: string;
  toSeparatorId: string;
  userId: string;
  timestamp: number;
}

// Hook return types
export interface UseMatrixSeparatorsReturn {
  // Data
  separators: MatrixChannelSeparator[];
  roomsBySeparator: Record<string, Room[]>;
  unassignedRooms: Room[];
  
  // Actions
  createSeparator: (name: string) => MatrixSeparatorOperationResult;
  renameSeparator: (separatorId: string, newName: string) => MatrixSeparatorOperationResult;
  deleteSeparator: (separatorId: string) => MatrixSeparatorOperationResult;
  moveRoom: (roomId: string, targetSeparatorId: string) => void;
  moveRooms: (roomIds: string[], targetSeparatorId: string) => void;
  toggleCollapse: (separatorId: string) => void;
  reorderSeparator: (separatorId: string, newOrder: number) => void;
  
  // Utilities
  isRoomInSeparator: (roomId: string, separatorId: string) => boolean;
  getRoomSeparatorInfo: (roomId: string) => MatrixChannelSeparator | undefined;
  canManageSeparators: boolean;
  
  // Auto-organization
  autoOrganize: () => void;
  suggestSeparatorForRoom: (room: Room) => string;
}

// Configuration
export interface MatrixSeparatorConfig {
  maxSeparatorsPerSpace: number;
  maxSeparatorNameLength: number;
  minSeparatorNameLength: number;
  allowEmptySeparators: boolean;
  persistToAccountData: boolean;
  autoAssignNewRooms: boolean;
  defaultCollapsedState: boolean;
}

export const DEFAULT_MATRIX_SEPARATOR_CONFIG: MatrixSeparatorConfig = {
  maxSeparatorsPerSpace: 20,
  maxSeparatorNameLength: 50,
  minSeparatorNameLength: 1,
  allowEmptySeparators: true,
  persistToAccountData: false,
  autoAssignNewRooms: true,
  defaultCollapsedState: false,
};

// Type guards
export function isMatrixDragItem(item: any): item is MatrixDragItem {
  return item && typeof item.roomId === 'string' && typeof item.sourceSeparatorId === 'string';
}

export function isMatrixSeparatorDragItem(item: any): item is MatrixSeparatorDragItem {
  return item && typeof item.id === 'string' && typeof item.order === 'number';
}

// Constants
export const MATRIX_SEPARATOR_CONSTANTS = {
  BASE_SEPARATOR_ID: 'base-rooms',
  DEFAULT_SEPARATOR_NAME: 'rooms',
  DRAG_TYPE_ROOM: 'matrix-room',
  DRAG_TYPE_SEPARATOR: 'matrix-separator',
  STORAGE_KEY: 'matrix-channel-separators',
  ACCOUNT_DATA_TYPE: 'io.element.channel_separators',
} as const;
