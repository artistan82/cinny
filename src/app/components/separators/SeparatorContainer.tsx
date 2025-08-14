import React, { useState, useRef, useEffect } from 'react';
import { useDrag, useDrop } from 'react-dnd';
import { ChevronDown, ChevronRight, MoreHorizontal, Plus, Edit2, Trash2 } from 'lucide-react';
import { useSeparatorsStore, ChannelSeparator } from '@/app/state/separators';
import { cn } from '@/lib/utils';

interface SeparatorContainerProps {
  spaceId: string;
  separator: ChannelSeparator;
  channels: any[];
  renderChannel: (channel: any) => React.ReactNode;
  onChannelDrop?: (channelId: string, separatorId: string) => void;
}

export const SeparatorContainer: React.FC<SeparatorContainerProps> = ({
  spaceId,
  separator,
  channels,
  renderChannel,
  onChannelDrop,
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameName, setRenameName] = useState(separator.name);
  const [isCreating, setIsCreating] = useState(false);
  const [newSeparatorName, setNewSeparatorName] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);
  const createInputRef = useRef<HTMLInputElement>(null);

  const {
    toggleSeparatorCollapse,
    createSeparator,
    renameSeparator,
    deleteSeparator,
    moveSeparator,
    assignChannelToSeparator,
    getChannelsInSeparator,
  } = useSeparatorsStore();

  const channelsInSeparator = channels.filter(channel =>
    getChannelsInSeparator(spaceId, separator.id).includes(channel.id)
  );

  // Drag and drop for separator reordering
  const [{ isDragging }, drag, preview] = useDrag({
    type: 'separator',
    item: { id: separator.id, order: separator.order },
    canDrag: !separator.isBase,
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  const [{ isOver }, drop] = useDrop({
    accept: ['channel', 'separator'],
    drop: (item: any, monitor) => {
      if (monitor.getItemType() === 'channel') {
        // Handle channel drop
        assignChannelToSeparator(spaceId, item.id, separator.id);
        onChannelDrop?.(item.id, separator.id);
      } else if (monitor.getItemType() === 'separator' && item.id !== separator.id) {
        // Handle separator reorder
        moveSeparator(spaceId, item.id, separator.order);
      }
    },
    collect: (monitor) => ({
      isOver: monitor.isOver({ shallow: true }),
    }),
  });

  // Close menu on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };

    if (isMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isMenuOpen]);

  // Focus rename input when renaming starts
  useEffect(() => {
    if (isRenaming && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [isRenaming]);

  // Focus create input when creating starts
  useEffect(() => {
    if (isCreating && createInputRef.current) {
      createInputRef.current.focus();
    }
  }, [isCreating]);

  const handleToggleCollapse = () => {
    toggleSeparatorCollapse(spaceId, separator.id);
  };

  const handleCreateNew = () => {
    setIsCreating(true);
    setIsMenuOpen(false);
  };

  const handleConfirmCreate = () => {
    if (newSeparatorName.trim()) {
      try {
        createSeparator(spaceId, newSeparatorName, separator.id);
        setNewSeparatorName('');
        setIsCreating(false);
      } catch (error: any) {
        alert(error.message);
      }
    }
  };

  const handleCancelCreate = () => {
    setNewSeparatorName('');
    setIsCreating(false);
  };

  const handleRename = () => {
    setIsRenaming(true);
    setRenameName(separator.name);
    setIsMenuOpen(false);
  };

  const handleConfirmRename = () => {
    if (renameName.trim() && renameName !== separator.name) {
      try {
        renameSeparator(spaceId, separator.id, renameName);
      } catch (error: any) {
        alert(error.message);
        setRenameName(separator.name);
      }
    }
    setIsRenaming(false);
  };

  const handleCancelRename = () => {
    setRenameName(separator.name);
    setIsRenaming(false);
  };

  const handleDelete = () => {
    if (channelsInSeparator.length > 0) {
      setShowDeleteConfirm(true);
      setIsMenuOpen(false);
    } else {
      deleteSeparator(spaceId, separator.id);
    }
  };

  const handleConfirmDelete = () => {
    deleteSeparator(spaceId, separator.id);
    setShowDeleteConfirm(false);
  };

  const handleCancelDelete = () => {
    setShowDeleteConfirm(false);
  };

  const combinedRef = (el: HTMLDivElement) => {
    drag(el);
    drop(el);
    preview(el);
  };

  return (
    <>
      <div
        ref={combinedRef}
        className={cn(
          'group relative transition-all',
          isDragging && 'opacity-50',
          isOver && 'bg-accent/10'
        )}
      >
        {/* Separator Header */}
        <div
          className={cn(
            'flex items-center justify-between px-2 py-1.5 hover:bg-accent/5 rounded-md cursor-pointer select-none',
            !separator.isBase && 'draggable'
          )}
          onClick={handleToggleCollapse}
        >
          <div className="flex items-center gap-1 flex-1">
            {separator.isCollapsed ? (
              <ChevronRight className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
            
            {isRenaming ? (
              <input
                ref={renameInputRef}
                type="text"
                value={renameName}
                onChange={(e) => setRenameName(e.target.value)}
                onKeyDown={(e) => {
                  e.stopPropagation();
                  if (e.key === 'Enter') handleConfirmRename();
                  if (e.key === 'Escape') handleCancelRename();
                }}
                onBlur={handleConfirmRename}
                onClick={(e) => e.stopPropagation()}
                className="px-1 py-0.5 text-sm bg-background border border-border rounded outline-none focus:ring-1 focus:ring-primary"
              />
            ) : (
              <span className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
                {separator.name}
              </span>
            )}
            
            <span className="text-xs text-muted-foreground ml-1">
              ({channelsInSeparator.length})
            </span>
          </div>

          {/* Options Menu */}
          <div className="relative" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsMenuOpen(!isMenuOpen);
              }}
              className={cn(
                'p-1 rounded hover:bg-accent/10 opacity-0 group-hover:opacity-100 transition-opacity',
                isMenuOpen && 'opacity-100'
              )}
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>

            {isMenuOpen && (
              <div
                ref={menuRef}
                className="absolute right-0 top-full mt-1 w-40 bg-popover border border-border rounded-md shadow-lg z-50"
              >
                <button
                  onClick={handleCreateNew}
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-accent/10 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Create New
                </button>
                
                {!separator.isBase && (
                  <>
                    <button
                      onClick={handleRename}
                      className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-accent/10 transition-colors"
                    >
                      <Edit2 className="w-4 h-4" />
                      Rename
                    </button>
                    
                    <button
                      onClick={handleDelete}
                      className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-accent/10 transition-colors text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                      Delete
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Channel List */}
        {!separator.isCollapsed && (
          <div className="ml-4 space-y-0.5">
            {channelsInSeparator.length === 0 ? (
              <div className="px-2 py-8 text-center text-sm text-muted-foreground border-2 border-dashed border-border/50 rounded-md">
                Drop channels here
              </div>
            ) : (
              channelsInSeparator.map(channel => renderChannel(channel))
            )}
          </div>
        )}
      </div>

      {/* Create New Separator Input */}
      {isCreating && (
        <div className="ml-4 px-2 py-1.5">
          <input
            ref={createInputRef}
            type="text"
            value={newSeparatorName}
            onChange={(e) => setNewSeparatorName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleConfirmCreate();
              if (e.key === 'Escape') handleCancelCreate();
            }}
            placeholder="New separator name..."
            className="w-full px-2 py-1 text-sm bg-background border border-border rounded outline-none focus:ring-1 focus:ring-primary"
          />
          <div className="flex gap-2 mt-1">
            <button
              onClick={handleConfirmCreate}
              className="px-2 py-0.5 text-xs bg-primary text-primary-foreground rounded hover:bg-primary/90"
            >
              Create
            </button>
            <button
              onClick={handleCancelCreate}
              className="px-2 py-0.5 text-xs bg-secondary text-secondary-foreground rounded hover:bg-secondary/90"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-popover p-6 rounded-lg shadow-xl max-w-md">
            <h3 className="text-lg font-semibold mb-2">Delete Separator</h3>
            <p className="text-sm text-muted-foreground mb-4">
              This separator contains {channelsInSeparator.length} channel(s). 
              All channels will be moved to the base "rooms" separator.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={handleCancelDelete}
                className="px-4 py-2 text-sm bg-secondary text-secondary-foreground rounded hover:bg-secondary/90"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                className="px-4 py-2 text-sm bg-destructive text-destructive-foreground rounded hover:bg-destructive/90"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
