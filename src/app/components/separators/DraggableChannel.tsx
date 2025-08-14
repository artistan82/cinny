import React from 'react';
import { useDrag } from 'react-dnd';
import { cn } from '@/lib/utils';
import { Hash, Volume2, Lock } from 'lucide-react';

interface DraggableChannelProps {
  channel: {
    id: string;
    name: string;
    type?: 'text' | 'voice';
    isPrivate?: boolean;
  };
  isActive?: boolean;
  onClick?: (channelId: string) => void;
}

export const DraggableChannel: React.FC<DraggableChannelProps> = ({
  channel,
  isActive = false,
  onClick,
}) => {
  const [{ isDragging }, drag] = useDrag({
    type: 'channel',
    item: { id: channel.id, name: channel.name },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  const handleClick = () => {
    onClick?.(channel.id);
  };

  const getChannelIcon = () => {
    if (channel.type === 'voice') {
      return <Volume2 className="w-4 h-4" />;
    }
    if (channel.isPrivate) {
      return <Lock className="w-4 h-4" />;
    }
    return <Hash className="w-4 h-4" />;
  };

  return (
    <div
      ref={drag}
      onClick={handleClick}
      className={cn(
        'flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer transition-all select-none',
        'hover:bg-accent/10',
        isActive && 'bg-accent/20 font-medium',
        isDragging && 'opacity-50 cursor-move'
      )}
    >
      <span className="text-muted-foreground">
        {getChannelIcon()}
      </span>
      <span className="text-sm truncate">
        {channel.name}
      </span>
    </div>
  );
};
