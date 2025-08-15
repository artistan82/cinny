import React, { RefObject, useEffect, useRef, useState } from 'react';
import { useDrag, useDrop } from 'react-dnd';
import classNames from 'classnames';
import { Box, Icon, Icons, as } from 'folds';
import { HierarchyItem } from '../../hooks/useSpaceHierarchy';
import * as css from './DnD.css';

const ItemTypes = {
  HIERARCHY_ITEM: 'hierarchy_item',
};

export type DropContainerData = {
  item: HierarchyItem;
  nextRoomId?: string;
};
export type CanDropCallback = (item: HierarchyItem, container: DropContainerData) => boolean;

export const useDraggableItem = (
  item: HierarchyItem,
  targetRef: RefObject<HTMLElement>,
  onDragging: (item?: HierarchyItem) => void,
  dragHandleRef?: RefObject<HTMLElement>
): boolean => {
  const [{ isDragging }, drag, preview] = useDrag(() => ({
    type: ItemTypes.HIERARCHY_ITEM,
    item: () => {
      onDragging(item);
      return item;
    },
    end: () => {
      onDragging(undefined);
    },
    collect: (monitor) => ({
      isDragging: !!monitor.isDragging(),
    }),
  }));

  useEffect(() => {
    if (dragHandleRef?.current) {
      drag(dragHandleRef.current);
    }
    if (targetRef.current) {
      preview(targetRef.current);
    }
  }, [drag, preview, targetRef, dragHandleRef]);

  return isDragging;
};

export const ItemDraggableTarget = as<'div'>(({ className, ...props }, ref) => (
  <Box
    justifyContent="Center"
    alignItems="Center"
    className={classNames(css.ItemDraggableTarget, className)}
    ref={ref}
    {...props}
  >
    <Icon size="50" src={Icons.VerticalDots} />
  </Box>
));

type AfterItemDropTargetProps = {
  item: HierarchyItem;
  afterSpace?: boolean;
  nextRoomId?: string;
  canDrop: CanDropCallback;
  onDrop: (item: HierarchyItem, container: DropContainerData) => void;
};
export function AfterItemDropTarget({
  item,
  afterSpace,
  nextRoomId,
  canDrop,
  onDrop,
}: AfterItemDropTargetProps) {
  const ref = useRef<HTMLDivElement>(null);

  const [{ isOver, canDrop: canDropItem }, drop] = useDrop<
    HierarchyItem,
    void,
    { isOver: boolean; canDrop: boolean }
  >(() => ({
    accept: ItemTypes.HIERARCHY_ITEM,
    drop: (draggedItem) => {
      onDrop(draggedItem, { item, nextRoomId });
    },
    canDrop: (draggedItem) => canDrop(draggedItem, { item, nextRoomId }),
    collect: (monitor) => ({
      isOver: !!monitor.isOver(),
      canDrop: !!monitor.canDrop(),
    }),
  }));

  drop(ref);

  const dropState = isOver ? (canDropItem ? 'allow' : 'not-allow') : 'idle';

  return (
    <div
      className={afterSpace ? css.AfterSpaceItemDropTarget : css.AfterRoomItemDropTarget}
      data-hover={dropState !== 'idle'}
      data-error={dropState === 'not-allow'}
      ref={ref}
    />
  );
}
