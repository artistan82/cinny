import React, { useEffect, useState } from 'react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { useSeparatorsStore } from '@/app/state/separators';
import { SeparatorContainer } from '../separators/SeparatorContainer';
import { DraggableChannel } from '../separators/DraggableChannel';
import { cn } from '@/lib/utils';

interface Channel {
  id: string;
  name: string;
  type?: 'text' | 'voice';
  isPrivate?: boolean;
}

interface Space {
  id: string;
  name: string;
  icon?: string;
  channels: Channel[];
}

interface SpaceWithSeparatorsProps {
  space: Space;
  activeChannelId?: string;
  onChannelSelect?: (channelId: string) => void;
}

export const SpaceWithSeparators: React.FC<SpaceWithSeparatorsProps> = ({
  space,
  activeChannelId,
  onChannelSelect,
}) => {
  const {
    initializeSpace,
    getSpaceSeparators,
    getChannelSeparator,
    assignChannelToSeparator,
  } = useSeparatorsStore();

  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize space on mount
  useEffect(() => {
    initializeSpace(space.id);
    
    // Assign any unassigned channels to base separator
    space.channels.forEach(channel => {
      const currentSeparator = getChannelSeparator(space.id, channel.id);
      if (!currentSeparator) {
        assignChannelToSeparator(space.id, channel.id, 'base-rooms');
      }
    });
    
    setIsInitialized(true);
  }, [space.id]);

  if (!isInitialized) {
    return <div className="p-4 text-center">Loading...</div>;
  }

  const separators = getSpaceSeparators(space.id);

  const renderChannel = (channel: Channel) => (
    <DraggableChannel
      key={channel.id}
      channel={channel}
      isActive={channel.id === activeChannelId}
      onClick={onChannelSelect}
    />
  );

  const handleChannelDrop = (channelId: string, separatorId: string) => {
    // Additional handling if needed when a channel is dropped
    console.log(`Channel ${channelId} dropped to separator ${separatorId}`);
  };

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="h-full overflow-y-auto">
        {/* Space Header */}
        <div className="p-4 border-b border-border">
          <div className="flex items-center gap-2">
            {space.icon && (
              <span className="text-2xl">{space.icon}</span>
            )}
            <h2 className="text-lg font-semibold">{space.name}</h2>
          </div>
        </div>

        {/* Separators and Channels */}
        <div className="p-2 space-y-2">
          {separators.map(separator => (
            <SeparatorContainer
              key={separator.id}
              spaceId={space.id}
              separator={separator}
              channels={space.channels}
              renderChannel={renderChannel}
              onChannelDrop={handleChannelDrop}
            />
          ))}
        </div>
      </div>
    </DndProvider>
  );
};
