import { create } from 'zustand';
import { persist } from 'zustand/middleware';

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
  channelAssignments: { [channelId: string]: string };
}

interface SeparatorsState {
  spaceSeparators: { [spaceId: string]: SpaceSeparators };
  
  // Initialization
  initializeSpace: (spaceId: string) => void;
  
  // Separator operations
  createSeparator: (spaceId: string, name: string, afterSeparatorId?: string) => string;
  renameSeparator: (spaceId: string, separatorId: string, newName: string) => void;
  deleteSeparator: (spaceId: string, separatorId: string) => void;
  toggleSeparatorCollapse: (spaceId: string, separatorId: string) => void;
  
  // Channel operations
  assignChannelToSeparator: (spaceId: string, channelId: string, separatorId: string) => void;
  getChannelSeparator: (spaceId: string, channelId: string) => string;
  
  // Reordering
  reorderSeparators: (spaceId: string, separatorIds: string[]) => void;
  moveSeparator: (spaceId: string, separatorId: string, newOrder: number) => void;
  
  // Getters
  getSpaceSeparators: (spaceId: string) => ChannelSeparator[];
  getChannelsInSeparator: (spaceId: string, separatorId: string) => string[];
  getSeparatorById: (spaceId: string, separatorId: string) => ChannelSeparator | undefined;
}

const BASE_SEPARATOR_ID = 'base-rooms';
const MAX_SEPARATORS_PER_SPACE = 20;

// Generate a simple unique ID
const generateId = () => {
  return `sep-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

export const useSeparatorsStore = create<SeparatorsState>()(
  persist(
    (set, get) => ({
      spaceSeparators: {},

      initializeSpace: (spaceId: string) => {
        set((state) => {
          if (state.spaceSeparators[spaceId]) {
            return state; // Already initialized
          }

          const baseSeparator: ChannelSeparator = {
            id: BASE_SEPARATOR_ID,
            name: 'rooms',
            order: 0,
            isBase: true,
            isCollapsed: false,
            createdAt: Date.now(),
          };

          return {
            spaceSeparators: {
              ...state.spaceSeparators,
              [spaceId]: {
                separators: [baseSeparator],
                channelAssignments: {},
              },
            },
          };
        });
      },

      createSeparator: (spaceId: string, name: string, afterSeparatorId?: string) => {
        const state = get();
        const spaceData = state.spaceSeparators[spaceId];
        
        if (!spaceData) {
          state.initializeSpace(spaceId);
          return state.createSeparator(spaceId, name, afterSeparatorId);
        }

        // Check limits
        if (spaceData.separators.length >= MAX_SEPARATORS_PER_SPACE) {
          throw new Error(`Maximum of ${MAX_SEPARATORS_PER_SPACE} separators allowed per space`);
        }

        // Check name uniqueness
        if (spaceData.separators.some(sep => sep.name.toLowerCase() === name.toLowerCase())) {
          throw new Error('Separator name must be unique within the space');
        }

        // Validate name
        if (!name.trim()) {
          throw new Error('Separator name cannot be empty');
        }

        const newSeparatorId = generateId();
        
        let newOrder = spaceData.separators.length;
        if (afterSeparatorId) {
          const afterSeparator = spaceData.separators.find(s => s.id === afterSeparatorId);
          if (afterSeparator) {
            newOrder = afterSeparator.order + 1;
          }
        }

        const newSeparator: ChannelSeparator = {
          id: newSeparatorId,
          name: name.trim(),
          order: newOrder,
          isBase: false,
          isCollapsed: false,
          createdAt: Date.now(),
        };

        set((state) => {
          const updatedSeparators = [...state.spaceSeparators[spaceId].separators];
          
          // Adjust orders if needed
          if (afterSeparatorId) {
            updatedSeparators.forEach(sep => {
              if (sep.order >= newOrder && sep.id !== newSeparatorId) {
                sep.order++;
              }
            });
          }
          
          updatedSeparators.push(newSeparator);
          updatedSeparators.sort((a, b) => a.order - b.order);

          return {
            spaceSeparators: {
              ...state.spaceSeparators,
              [spaceId]: {
                ...state.spaceSeparators[spaceId],
                separators: updatedSeparators,
              },
            },
          };
        });

        return newSeparatorId;
      },

      renameSeparator: (spaceId: string, separatorId: string, newName: string) => {
        const state = get();
        const spaceData = state.spaceSeparators[spaceId];
        
        if (!spaceData) return;

        const separator = spaceData.separators.find(s => s.id === separatorId);
        if (!separator || separator.isBase) {
          throw new Error('Cannot rename base separator');
        }

        // Check name uniqueness
        if (spaceData.separators.some(sep => 
          sep.id !== separatorId && sep.name.toLowerCase() === newName.toLowerCase()
        )) {
          throw new Error('Separator name must be unique within the space');
        }

        if (!newName.trim()) {
          throw new Error('Separator name cannot be empty');
        }

        set((state) => ({
          spaceSeparators: {
            ...state.spaceSeparators,
            [spaceId]: {
              ...state.spaceSeparators[spaceId],
              separators: state.spaceSeparators[spaceId].separators.map(sep =>
                sep.id === separatorId ? { ...sep, name: newName.trim() } : sep
              ),
            },
          },
        }));
      },

      deleteSeparator: (spaceId: string, separatorId: string) => {
        const state = get();
        const spaceData = state.spaceSeparators[spaceId];
        
        if (!spaceData) return;

        const separator = spaceData.separators.find(s => s.id === separatorId);
        if (!separator || separator.isBase) {
          throw new Error('Cannot delete base separator');
        }

        set((state) => {
          const updatedAssignments = { ...state.spaceSeparators[spaceId].channelAssignments };
          
          // Move all channels from deleted separator to base
          Object.keys(updatedAssignments).forEach(channelId => {
            if (updatedAssignments[channelId] === separatorId) {
              updatedAssignments[channelId] = BASE_SEPARATOR_ID;
            }
          });

          // Remove separator and adjust orders
          const updatedSeparators = state.spaceSeparators[spaceId].separators
            .filter(sep => sep.id !== separatorId)
            .map(sep => ({
              ...sep,
              order: sep.order > separator.order ? sep.order - 1 : sep.order,
            }));

          return {
            spaceSeparators: {
              ...state.spaceSeparators,
              [spaceId]: {
                separators: updatedSeparators,
                channelAssignments: updatedAssignments,
              },
            },
          };
        });
      },

      toggleSeparatorCollapse: (spaceId: string, separatorId: string) => {
        set((state) => {
          const spaceData = state.spaceSeparators[spaceId];
          if (!spaceData) return state;

          return {
            spaceSeparators: {
              ...state.spaceSeparators,
              [spaceId]: {
                ...state.spaceSeparators[spaceId],
                separators: state.spaceSeparators[spaceId].separators.map(sep =>
                  sep.id === separatorId ? { ...sep, isCollapsed: !sep.isCollapsed } : sep
                ),
              },
            },
          };
        });
      },

      assignChannelToSeparator: (spaceId: string, channelId: string, separatorId: string) => {
        const state = get();
        const spaceData = state.spaceSeparators[spaceId];
        
        if (!spaceData) {
          state.initializeSpace(spaceId);
          return state.assignChannelToSeparator(spaceId, channelId, separatorId);
        }

        // Verify separator exists
        if (!spaceData.separators.find(s => s.id === separatorId)) {
          separatorId = BASE_SEPARATOR_ID; // Fallback to base
        }

        set((state) => ({
          spaceSeparators: {
            ...state.spaceSeparators,
            [spaceId]: {
              ...state.spaceSeparators[spaceId],
              channelAssignments: {
                ...state.spaceSeparators[spaceId].channelAssignments,
                [channelId]: separatorId,
              },
            },
          },
        }));
      },

      getChannelSeparator: (spaceId: string, channelId: string) => {
        const state = get();
        const spaceData = state.spaceSeparators[spaceId];
        
        if (!spaceData) return BASE_SEPARATOR_ID;
        
        return spaceData.channelAssignments[channelId] || BASE_SEPARATOR_ID;
      },

      reorderSeparators: (spaceId: string, separatorIds: string[]) => {
        set((state) => {
          const spaceData = state.spaceSeparators[spaceId];
          if (!spaceData) return state;

          const updatedSeparators = separatorIds.map((id, index) => {
            const separator = spaceData.separators.find(s => s.id === id);
            if (!separator) return null;
            return { ...separator, order: index };
          }).filter(Boolean) as ChannelSeparator[];

          return {
            spaceSeparators: {
              ...state.spaceSeparators,
              [spaceId]: {
                ...state.spaceSeparators[spaceId],
                separators: updatedSeparators,
              },
            },
          };
        });
      },

      moveSeparator: (spaceId: string, separatorId: string, newOrder: number) => {
        const state = get();
        const spaceData = state.spaceSeparators[spaceId];
        
        if (!spaceData) return;

        const separator = spaceData.separators.find(s => s.id === separatorId);
        if (!separator || separator.isBase) return;

        set((state) => {
          const separators = [...state.spaceSeparators[spaceId].separators];
          const oldOrder = separator.order;
          
          separators.forEach(sep => {
            if (sep.id === separatorId) {
              sep.order = newOrder;
            } else if (oldOrder < newOrder && sep.order > oldOrder && sep.order <= newOrder) {
              sep.order--;
            } else if (oldOrder > newOrder && sep.order < oldOrder && sep.order >= newOrder) {
              sep.order++;
            }
          });

          separators.sort((a, b) => a.order - b.order);

          return {
            spaceSeparators: {
              ...state.spaceSeparators,
              [spaceId]: {
                ...state.spaceSeparators[spaceId],
                separators,
              },
            },
          };
        });
      },

      getSpaceSeparators: (spaceId: string) => {
        const state = get();
        const spaceData = state.spaceSeparators[spaceId];
        
        if (!spaceData) return [];
        
        return [...spaceData.separators].sort((a, b) => a.order - b.order);
      },

      getChannelsInSeparator: (spaceId: string, separatorId: string) => {
        const state = get();
        const spaceData = state.spaceSeparators[spaceId];
        
        if (!spaceData) return [];
        
        return Object.entries(spaceData.channelAssignments)
          .filter(([_, sepId]) => sepId === separatorId)
          .map(([channelId]) => channelId);
      },

      getSeparatorById: (spaceId: string, separatorId: string) => {
        const state = get();
        const spaceData = state.spaceSeparators[spaceId];
        
        if (!spaceData) return undefined;
        
        return spaceData.separators.find(s => s.id === separatorId);
      },
    }),
    {
      name: 'matrix-channel-separators',
      version: 1,
    }
  )
);
