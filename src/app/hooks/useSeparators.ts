import { useCallback, useEffect, useMemo } from 'react';
import { useSeparatorsStore } from '@/app/state/separators';

export interface UseSeparatorsOptions {
  spaceId: string;
  channels?: Array<{ id: string; [key: string]: any }>;
  autoInitialize?: boolean;
}

export interface ChannelWithSeparator {
  channel: any;
  separatorId: string;
  separatorName: string;
}

export const useSeparators = ({
  spaceId,
  channels = [],
  autoInitialize = true,
}: UseSeparatorsOptions) => {
  const {
    initializeSpace,
    getSpaceSeparators,
    getChannelSeparator,
    assignChannelToSeparator,
    createSeparator,
    renameSeparator,
    deleteSeparator,
    toggleSeparatorCollapse,
    moveSeparator,
    getChannelsInSeparator,
    getSeparatorById,
  } = useSeparatorsStore();

  // Auto-initialize space if enabled
  useEffect(() => {
    if (autoInitialize && spaceId) {
      initializeSpace(spaceId);
    }
  }, [spaceId, autoInitialize]);

  // Get all separators for the space
  const separators = useMemo(
    () => getSpaceSeparators(spaceId),
    [spaceId, getSpaceSeparators]
  );

  // Group channels by separator
  const channelsBySeparator = useMemo(() => {
    const grouped: Record<string, any[]> = {};
    
    separators.forEach(separator => {
      grouped[separator.id] = [];
    });

    channels.forEach(channel => {
      const separatorId = getChannelSeparator(spaceId, channel.id);
      if (!grouped[separatorId]) {
        grouped['base-rooms'] = grouped['base-rooms'] || [];
        grouped['base-rooms'].push(channel);
      } else {
        grouped[separatorId].push(channel);
      }
    });

    return grouped;
  }, [channels, separators, spaceId, getChannelSeparator]);

  // Get channels with their separator info
  const channelsWithSeparators = useMemo((): ChannelWithSeparator[] => {
    return channels.map(channel => {
      const separatorId = getChannelSeparator(spaceId, channel.id);
      const separator = getSeparatorById(spaceId, separatorId);
      
      return {
        channel,
        separatorId,
        separatorName: separator?.name || 'rooms',
      };
    });
  }, [channels, spaceId, getChannelSeparator, getSeparatorById]);

  // Create a new separator
  const handleCreateSeparator = useCallback(
    (name: string, afterSeparatorId?: string) => {
      try {
        const newId = createSeparator(spaceId, name, afterSeparatorId);
        return { success: true, id: newId };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    },
    [spaceId, createSeparator]
  );

  // Rename a separator
  const handleRenameSeparator = useCallback(
    (separatorId: string, newName: string) => {
      try {
        renameSeparator(spaceId, separatorId, newName);
        return { success: true };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    },
    [spaceId, renameSeparator]
  );

  // Delete a separator
  const handleDeleteSeparator = useCallback(
    (separatorId: string, confirmIfNotEmpty = true) => {
      const channelsInSep = getChannelsInSeparator(spaceId, separatorId);
      
      if (channelsInSep.length > 0 && confirmIfNotEmpty) {
        const confirmed = window.confirm(
          `This separator contains ${channelsInSep.length} channel(s). ` +
          `They will be moved to the base "rooms" separator. Continue?`
        );
        
        if (!confirmed) {
          return { success: false, cancelled: true };
        }
      }

      try {
        deleteSeparator(spaceId, separatorId);
        return { success: true };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    },
    [spaceId, deleteSeparator, getChannelsInSeparator]
  );

  // Move a channel to a different separator
  const handleMoveChannel = useCallback(
    (channelId: string, targetSeparatorId: string) => {
      assignChannelToSeparator(spaceId, channelId, targetSeparatorId);
    },
    [spaceId, assignChannelToSeparator]
  );

  // Move multiple channels to a separator
  const handleMoveChannels = useCallback(
    (channelIds: string[], targetSeparatorId: string) => {
      channelIds.forEach(channelId => {
        assignChannelToSeparator(spaceId, channelId, targetSeparatorId);
      });
    },
    [spaceId, assignChannelToSeparator]
  );

  // Toggle separator collapse state
  const handleToggleCollapse = useCallback(
    (separatorId: string) => {
      toggleSeparatorCollapse(spaceId, separatorId);
    },
    [spaceId, toggleSeparatorCollapse]
  );

  // Reorder a separator
  const handleReorderSeparator = useCallback(
    (separatorId: string, newOrder: number) => {
      moveSeparator(spaceId, separatorId, newOrder);
    },
    [spaceId, moveSeparator]
  );

  // Check if a channel is in a specific separator
  const isChannelInSeparator = useCallback(
    (channelId: string, separatorId: string) => {
      return getChannelSeparator(spaceId, channelId) === separatorId;
    },
    [spaceId, getChannelSeparator]
  );

  // Get the separator for a specific channel
  const getChannelSeparatorInfo = useCallback(
    (channelId: string) => {
      const separatorId = getChannelSeparator(spaceId, channelId);
      const separator = getSeparatorById(spaceId, separatorId);
      return separator;
    },
    [spaceId, getChannelSeparator, getSeparatorById]
  );

  // Batch assign channels to separators
  const batchAssignChannels = useCallback(
    (assignments: Array<{ channelId: string; separatorId: string }>) => {
      assignments.forEach(({ channelId, separatorId }) => {
        assignChannelToSeparator(spaceId, channelId, separatorId);
      });
    },
    [spaceId, assignChannelToSeparator]
  );

  return {
    // Data
    separators,
    channelsBySeparator,
    channelsWithSeparators,
    
    // Actions
    createSeparator: handleCreateSeparator,
    renameSeparator: handleRenameSeparator,
    deleteSeparator: handleDeleteSeparator,
    moveChannel: handleMoveChannel,
    moveChannels: handleMoveChannels,
    toggleCollapse: handleToggleCollapse,
    reorderSeparator: handleReorderSeparator,
    batchAssignChannels,
    
    // Utilities
    isChannelInSeparator,
    getChannelSeparatorInfo,
    getChannelsInSeparator: (separatorId: string) => 
      getChannelsInSeparator(spaceId, separatorId),
  };
};
