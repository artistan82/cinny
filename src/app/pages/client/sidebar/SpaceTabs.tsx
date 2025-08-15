import React, {
  MouseEventHandler,
  ReactNode,
  RefObject,
  forwardRef,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Icon,
  IconButton,
  Icons,
  Line,
  Menu,
  MenuItem,
  PopOut,
  RectCords,
  Text,
  config,
  toRem,
} from 'folds';
import { useAtom, useAtomValue } from 'jotai';
import { Room } from 'matrix-js-sdk';
import { DndProvider, useDrag, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import FocusTrap from 'focus-trap-react';
import {
  useOrphanSpaces,
  useRecursiveChildScopeFactory,
  useSpaceChildren,
} from '../../../state/hooks/roomList';
import { useMatrixClient } from '../../../hooks/useMatrixClient';
import { roomToParentsAtom } from '../../../state/room/roomToParents';
import { allRoomsAtom } from '../../../state/room-list/roomList';
import { getSpaceLobbyPath, getSpacePath, joinPathComponent } from '../../pathUtils';
import {
  SidebarAvatar,
  SidebarItem,
  SidebarItemBadge,
  SidebarItemTooltip,
  SidebarStack,
  SidebarStackSeparator,
  SidebarFolder,
  SidebarFolderDropTarget,
} from '../../../components/sidebar';
import { RoomUnreadProvider, RoomsUnreadProvider } from '../../../components/RoomUnreadProvider';
import { useSelectedSpace } from '../../../hooks/router/useSelectedSpace';
import { UnreadBadge } from '../../../components/unread-badge';
import { getCanonicalAliasOrRoomId, isRoomAlias } from '../../../utils/matrix';
import { RoomAvatar } from '../../../components/room-avatar';
import { nameInitials, randomStr } from '../../../utils/common';
import {
  ISidebarFolder,
  SidebarItems,
  TSidebarItem,
  makeCinnySpacesContent,
  parseSidebar,
  sidebarItemWithout,
  useSidebarItems,
} from '../../../hooks/useSidebarItems';
import { AccountDataEvent } from '../../../../types/matrix/accountData';
import { ScreenSize, useScreenSizeContext } from '../../../hooks/useScreenSize';
import { useNavToActivePathAtom } from '../../../state/hooks/navToActivePath';
import { useOpenedSidebarFolderAtom } from '../../../state/hooks/openedSidebarFolder';
import { usePowerLevels } from '../../../hooks/usePowerLevels';
import { useRoomsUnread } from '../../../state/hooks/unread';
import { roomToUnreadAtom } from '../../../state/room/roomToUnread';
import { markAsRead } from '../../../../client/action/notifications';
import { copyToClipboard } from '../../../utils/dom';
import { openInviteUser } from '../../../../client/action/navigation';
import { stopPropagation } from '../../../utils/keyboard';
import { getMatrixToRoom } from '../../../plugins/matrix-to';
import { getViaServers } from '../../../plugins/via-servers';
import { getRoomAvatarUrl } from '../../../utils/room';
import { useMediaAuthentication } from '../../../hooks/useMediaAuthentication';
import { useSetting } from '../../../state/hooks/settings';
import { settingsAtom } from '../../../state/settings';
import { useOpenSpaceSettings } from '../../../state/hooks/spaceSettings';
import { useRoomCreators } from '../../../hooks/useRoomCreators';
import { useRoomPermissions } from '../../../hooks/useRoomPermissions';

const ItemTypes = {
  SPACE: 'space',
  FOLDER: 'folder',
};

type SpaceMenuProps = {
  room: Room;
  requestClose: () => void;
  onUnpin?: (roomId: string) => void;
};
const SpaceMenu = forwardRef<HTMLDivElement, SpaceMenuProps>(
  ({ room, requestClose, onUnpin }, ref) => {
    const mx = useMatrixClient();
    const [hideActivity] = useSetting(settingsAtom, 'hideActivity');
    const roomToParents = useAtomValue(roomToParentsAtom);
    const powerLevels = usePowerLevels(room);
    const creators = useRoomCreators(room);

    const permissions = useRoomPermissions(creators, powerLevels);
    const canInvite = permissions.action('invite', mx.getSafeUserId());
    const openSpaceSettings = useOpenSpaceSettings();

    const allChild = useSpaceChildren(
      allRoomsAtom,
      room.roomId,
      useRecursiveChildScopeFactory(mx, roomToParents)
    );
    const unread = useRoomsUnread(allChild, roomToUnreadAtom);

    const handleMarkAsRead = () => {
      allChild.forEach((childRoomId) => markAsRead(mx, childRoomId, hideActivity));
      requestClose();
    };

    const handleUnpin = () => {
      onUnpin?.(room.roomId);
      requestClose();
    };

    const handleCopyLink = () => {
      const roomIdOrAlias = getCanonicalAliasOrRoomId(mx, room.roomId);
      const viaServers = isRoomAlias(roomIdOrAlias) ? undefined : getViaServers(room);
      copyToClipboard(getMatrixToRoom(roomIdOrAlias, viaServers));
      requestClose();
    };

    const handleInvite = () => {
      openInviteUser(room.roomId);
      requestClose();
    };

    const handleRoomSettings = () => {
      openSpaceSettings(room.roomId);
      requestClose();
    };

    return (
      <Menu ref={ref} style={{ maxWidth: toRem(160), width: '100vw' }}>
        <Box direction="Column" gap="100" style={{ padding: config.space.S100 }}>
          <MenuItem
            onClick={handleMarkAsRead}
            size="300"
            after={<Icon size="100" src={Icons.CheckTwice} />}
            radii="300"
            disabled={!unread}
          >
            <Text style={{ flexGrow: 1 }} as="span" size="T300" truncate>
              Mark as Read
            </Text>
          </MenuItem>
          {onUnpin && (
            <MenuItem
              size="300"
              radii="300"
              onClick={handleUnpin}
              after={<Icon size="100" src={Icons.Pin} />}
            >
              <Text style={{ flexGrow: 1 }} as="span" size="T300" truncate>
                Unpin
              </Text>
            </MenuItem>
          )}
        </Box>
        <Line variant="Surface" size="300" />
        <Box direction="Column" gap="100" style={{ padding: config.space.S100 }}>
          <MenuItem
            onClick={handleInvite}
            variant="Primary"
            fill="None"
            size="300"
            after={<Icon size="100" src={Icons.UserPlus} />}
            radii="300"
            disabled={!canInvite}
          >
            <Text style={{ flexGrow: 1 }} as="span" size="T300" truncate>
              Invite
            </Text>
          </MenuItem>
          <MenuItem
            onClick={handleCopyLink}
            size="300"
            after={<Icon size="100" src={Icons.Link} />}
            radii="300"
          >
            <Text style={{ flexGrow: 1 }} as="span" size="T300" truncate>
              Copy Link
            </Text>
          </MenuItem>
          <MenuItem
            onClick={handleRoomSettings}
            size="300"
            after={<Icon size="100" src={Icons.Setting} />}
            radii="300"
          >
            <Text style={{ flexGrow: 1 }} as="span" size="T300" truncate>
              Space Settings
            </Text>
          </MenuItem>
        </Box>
      </Menu>
    );
  }
);
type SpaceTabProps = {
  space: Room;
  selected: boolean;
  onClick: MouseEventHandler<HTMLButtonElement>;
  folder?: ISidebarFolder;
  onDrop: (item: any, instruction: string) => void;
  disabled?: boolean;
  onUnpin?: (roomId: string) => void;
};
function SpaceTab({
  space,
  selected,
  onClick,
  folder,
  onDrop,
  disabled,
  onUnpin,
}: SpaceTabProps) {
  const mx = useMatrixClient();
  const useAuthentication = useMediaAuthentication();
  const ref = useRef<HTMLDivElement>(null);

  const [{ isDragging }, drag] = useDrag(() => ({
    type: ItemTypes.SPACE,
    item: { id: space.roomId, folder },
    collect: (monitor) => ({
      isDragging: !!monitor.isDragging(),
    }),
  }));

  const [{ isOver, canDrop }, drop] = useDrop(() => ({
    accept: [ItemTypes.SPACE, ItemTypes.FOLDER],
    drop: (item: any, monitor) => {
      const instruction = monitor.getDropResult()?.instruction ?? 'reorder-below';
      onDrop(item, instruction);
    },
    collect: (monitor) => ({
      isOver: !!monitor.isOver(),
      canDrop: !!monitor.canDrop(),
    }),
    hover: (item, monitor) => {
      if (!ref.current) {
        return;
      }
      const hoverBoundingRect = ref.current.getBoundingClientRect();
      const hoverMiddleY = (hoverBoundingRect.bottom - hoverBoundingRect.top) / 2;
      const clientOffset = monitor.getClientOffset();
      const hoverClientY = clientOffset.y - hoverBoundingRect.top;

      if (hoverClientY < hoverMiddleY) {
        // @ts-ignore
        monitor.internalMonitor.store.dispatch({
          type: 'dnd-core/DROP',
          payload: {
            instruction: 'reorder-above',
          },
        });
      } else {
        // @ts-ignore
        monitor.internalMonitor.store.dispatch({
          type: 'dnd-core/DROP',
          payload: {
            instruction: 'reorder-below',
          },
        });
      }
    },
  }));

  const [menuAnchor, setMenuAnchor] = useState<RectCords>();

  const handleContextMenu: MouseEventHandler<HTMLButtonElement> = (evt) => {
    evt.preventDefault();
    const cords = evt.currentTarget.getBoundingClientRect();
    setMenuAnchor((currentState) => {
      if (currentState) return undefined;
      return cords;
    });
  };

  drag(drop(ref));

  return (
    <RoomUnreadProvider roomId={space.roomId}>
      {(unread) => (
        <SidebarItem
          active={selected}
          ref={ref}
          aria-disabled={disabled || isDragging}
          data-drop-child={isOver && canDrop && !folder}
          data-drop-above={isOver && canDrop}
          data-drop-below={isOver && canDrop}
          data-inside-folder={!!folder}
          style={{ opacity: isDragging ? 0.5 : 1 }}
        >
          <SidebarItemTooltip tooltip={disabled ? undefined : space.name}>
            {(triggerRef) => (
              <SidebarAvatar
                as="button"
                data-id={space.roomId}
                ref={triggerRef}
                size={folder ? '300' : '400'}
                onClick={onClick}
                onContextMenu={handleContextMenu}
              >
                <RoomAvatar
                  roomId={space.roomId}
                  src={getRoomAvatarUrl(mx, space, 96, useAuthentication) ?? undefined}
                  alt={space.name}
                  renderFallback={() => (
                    <Text size={folder ? 'H6' : 'H4'}>{nameInitials(space.name, 2)}</Text>
                  )}
                />
              </SidebarAvatar>
            )}
          </SidebarItemTooltip>
          {unread && (
            <SidebarItemBadge hasCount={unread.total > 0}>
              <UnreadBadge highlight={unread.highlight > 0} count={unread.total} />
            </SidebarItemBadge>
          )}
          {menuAnchor && (
            <PopOut
              anchor={menuAnchor}
              position="Right"
              align="Start"
              content={
                <FocusTrap
                  focusTrapOptions={{
                    initialFocus: false,
                    returnFocusOnDeactivate: false,
                    onDeactivate: () => setMenuAnchor(undefined),
                    clickOutsideDeactivates: true,
                    isKeyForward: (evt: KeyboardEvent) => evt.key === 'ArrowDown',
                    isKeyBackward: (evt: KeyboardEvent) => evt.key === 'ArrowUp',
                    escapeDeactivates: stopPropagation,
                  }}
                >
                  <SpaceMenu
                    room={space}
                    requestClose={() => setMenuAnchor(undefined)}
                    onUnpin={onUnpin}
                  />
                </FocusTrap>
              }
            />
          )}
        </SidebarItem>
      )}
    </RoomUnreadProvider>
  );
}

type OpenedSpaceFolderProps = {
  folder: ISidebarFolder;
  onClose: MouseEventHandler<HTMLButtonElement>;
  children?: ReactNode;
};
function OpenedSpaceFolder({ folder, onClose, children }: OpenedSpaceFolderProps) {
  const ref = useRef<HTMLDivElement>(null);

  const [{ isOver, canDrop }, drop] = useDrop(() => ({
    accept: [ItemTypes.SPACE, ItemTypes.FOLDER],
    collect: (monitor) => ({
      isOver: !!monitor.isOver(),
      canDrop: !!monitor.canDrop(),
    }),
  }));

  drop(ref);

  return (
    <SidebarFolder
      ref={ref}
      state="Open"
      data-drop-above={isOver && canDrop}
      data-drop-below={isOver && canDrop}
    >
      <SidebarFolderDropTarget position="Top" />
      <SidebarAvatar size="300">
        <IconButton data-id={folder.id} size="300" variant="Background" onClick={onClose}>
          <Icon size="400" src={Icons.ChevronTop} filled />
        </IconButton>
      </SidebarAvatar>
      {children}
      <SidebarFolderDropTarget position="Bottom" />
    </SidebarFolder>
  );
}

type ClosedSpaceFolderProps = {
  folder: ISidebarFolder;
  selected: boolean;
  onOpen: MouseEventHandler<HTMLButtonElement>;
  onDrop: (item: any, instruction: string) => void;
  disabled?: boolean;
};
function ClosedSpaceFolder({
  folder,
  selected,
  onOpen,
  onDrop,
  disabled,
}: ClosedSpaceFolderProps) {
  const mx = useMatrixClient();
  const useAuthentication = useMediaAuthentication();
  const ref = useRef<HTMLDivElement>(null);

  const [{ isDragging }, drag] = useDrag(() => ({
    type: ItemTypes.FOLDER,
    item: { id: folder.id, folder },
    collect: (monitor) => ({
      isDragging: !!monitor.isDragging(),
    }),
  }));

  const [{ isOver, canDrop }, drop] = useDrop(() => ({
    accept: [ItemTypes.SPACE, ItemTypes.FOLDER],
    drop: (item: any, monitor) => {
      const instruction = monitor.getDropResult()?.instruction ?? 'make-child';
      onDrop(item, instruction);
    },
    collect: (monitor) => ({
      isOver: !!monitor.isOver(),
      canDrop: !!monitor.canDrop(),
    }),
  }));

  drag(drop(ref));

  const tooltipName =
    folder.name ?? folder.content.map((i) => mx.getRoom(i)?.name ?? '').join(', ') ?? 'Unnamed';

  return (
    <RoomsUnreadProvider rooms={folder.content}>
      {(unread) => (
        <SidebarItem
          active={selected}
          ref={ref}
          aria-disabled={disabled || isDragging}
          data-drop-child={isOver && canDrop}
          data-drop-above={isOver && canDrop}
          data-drop-below={isOver && canDrop}
          style={{ opacity: isDragging ? 0.5 : 1 }}
        >
          <SidebarItemTooltip tooltip={disabled ? undefined : tooltipName}>
            {(tooltipRef) => (
              <SidebarFolder data-id={folder.id} as="button" ref={tooltipRef} onClick={onOpen}>
                {folder.content.map((sId) => {
                  const space = mx.getRoom(sId);
                  if (!space) return null;

                  return (
                    <SidebarAvatar key={sId} size="200" radii="300">
                      <RoomAvatar
                        roomId={space.roomId}
                        src={getRoomAvatarUrl(mx, space, 96, useAuthentication) ?? undefined}
                        alt={space.name}
                        renderFallback={() => (
                          <Text size="Inherit">
                            <b>{nameInitials(space.name, 2)}</b>
                          </Text>
                        )}
                      />
                    </SidebarAvatar>
                  );
                })}
              </SidebarFolder>
            )}
          </SidebarItemTooltip>
          {unread && (
            <SidebarItemBadge hasCount={unread.total > 0}>
              <UnreadBadge highlight={unread.highlight > 0} count={unread.total} />
            </SidebarItemBadge>
          )}
        </SidebarItem>
      )}
    </RoomsUnreadProvider>
  );
}

type SpaceTabsProps = {
  scrollRef: RefObject<HTMLDivElement>;
};
export function SpaceTabs({ scrollRef }: SpaceTabsProps) {
  const navigate = useNavigate();
  const mx = useMatrixClient();
  const screenSize = useScreenSizeContext();
  const roomToParents = useAtomValue(roomToParentsAtom);
  const orphanSpaces = useOrphanSpaces(mx, allRoomsAtom, roomToParents);
  const [sidebarItems, localEchoSidebarItem] = useSidebarItems(orphanSpaces);
  const navToActivePath = useAtomValue(useNavToActivePathAtom());
  const [openedFolder, setOpenedFolder] = useAtom(useOpenedSidebarFolderAtom());

  const handleDrop = useCallback(
    (item, containerItem, instructionType) => {
      const newItems: SidebarItems = [];

      const matchDest = (sI: TSidebarItem, dI: any): boolean => {
        if (typeof sI === 'string' && typeof dI.id === 'string') {
          return sI === dI.id;
        }
        if (typeof sI === 'object' && typeof dI.folder === 'object') {
          return sI.id === dI.folder.id;
        }
        return false;
      };
      const itemAsFolderContent = (i: any): string[] => {
        if (typeof i.id === 'string' && !i.folder) {
          return [i.id];
        }
        if (i.folder) {
          return [i.id];
        }
        return [...i.folder.content];
      };

      sidebarItems.forEach((i) => {
        const sameFolders =
          typeof item.folder === 'object' &&
          typeof containerItem.folder === 'object' &&
          item.folder.id === containerItem.folder.id;

        // remove draggable space from current position or folder
        if (!sameFolders && matchDest(i, item)) {
          if (typeof item.folder === 'object' && item.id) {
            const folderContent = item.folder.content.filter((s) => s !== item.id);
            if (folderContent.length === 0) {
              // remove open state from local storage
              setOpenedFolder({ type: 'DELETE', id: item.folder.id });
              return;
            }
            newItems.push({
              ...item.folder,
              content: folderContent,
            });
          }
          return;
        }
        if (matchDest(i, containerItem)) {
          // we can make child only if
          // container item is space or closed folder
          if (instructionType === 'make-child') {
            const child: string[] = itemAsFolderContent(item);
            if (typeof containerItem.id === 'string') {
              const folder: ISidebarFolder = {
                id: randomStr(),
                content: [containerItem.id].concat(child),
              };
              newItems.push(folder);
              return;
            }
            newItems.push({
              ...containerItem.folder,
              content: containerItem.folder.content.concat(child),
            });
            return;
          }

          // drop inside opened folder
          // or reordering inside same folder
          if (typeof containerItem.folder === 'object' && containerItem.id) {
            const child = itemAsFolderContent(item);
            const newContent: string[] = [];
            containerItem.folder.content
              .filter((sId) => !child.includes(sId))
              .forEach((sId) => {
                if (sId === containerItem.id) {
                  if (instructionType === 'reorder-below') {
                    newContent.push(sId, ...child);
                  }
                  if (instructionType === 'reorder-above') {
                    newContent.push(...child, sId);
                  }
                  return;
                }
                newContent.push(sId);
              });
            const folder = {
              ...containerItem.folder,
              content: newContent,
            };

            newItems.push(folder);
            return;
          }

          // drop above or below space or closed/opened folder
          if (typeof item.id === 'string' && !item.folder) {
            if (instructionType === 'reorder-below') newItems.push(i);
            newItems.push(item.id);
            if (instructionType === 'reorder-above') newItems.push(i);
          } else if (item.id) {
            if (instructionType === 'reorder-above') {
              newItems.push(item.id);
            }
            if (sameFolders && typeof i === 'object') {
              // remove from folder if placing around itself
              const newI = { ...i, content: i.content.filter((sId) => sId !== item.id) };
              if (newI.content.length > 0) newItems.push(newI);
            } else {
              newItems.push(i);
            }
            if (instructionType === 'reorder-below') {
              newItems.push(item.id);
            }
          } else {
            if (instructionType === 'reorder-below') newItems.push(i);
            newItems.push(item.folder);
            if (instructionType === 'reorder-above') newItems.push(i);
          }
          return;
        }
        newItems.push(i);
      });

      const newSpacesContent = makeCinnySpacesContent(mx, newItems);
      localEchoSidebarItem(parseSidebar(mx, orphanSpaces, newSpacesContent));
      mx.setAccountData(AccountDataEvent.CinnySpaces, newSpacesContent);
    },
    [mx, sidebarItems, setOpenedFolder, localEchoSidebarItem, orphanSpaces]
  );

  const selectedSpaceId = useSelectedSpace();

  const handleSpaceClick: MouseEventHandler<HTMLButtonElement> = (evt) => {
    const target = evt.currentTarget;
    const targetSpaceId = target.getAttribute('data-id');
    if (!targetSpaceId) return;

    const spacePath = getSpacePath(getCanonicalAliasOrRoomId(mx, targetSpaceId));
    if (screenSize === ScreenSize.Mobile) {
      navigate(spacePath);
      return;
    }

    const activePath = navToActivePath.get(targetSpaceId);
    if (activePath && activePath.pathname.startsWith(spacePath)) {
      navigate(joinPathComponent(activePath));
      return;
    }

    navigate(getSpaceLobbyPath(getCanonicalAliasOrRoomId(mx, targetSpaceId)));
  };

  const handleFolderToggle: MouseEventHandler<HTMLButtonElement> = (evt) => {
    const target = evt.currentTarget;
    const targetFolderId = target.getAttribute('data-id');
    if (!targetFolderId) return;

    setOpenedFolder({
      type: openedFolder.has(targetFolderId) ? 'DELETE' : 'PUT',
      id: targetFolderId,
    });
  };

  const handleUnpin = useCallback(
    (roomId: string) => {
      if (orphanSpaces.includes(roomId)) return;
      const newItems = sidebarItemWithout(sidebarItems, roomId);

      const newSpacesContent = makeCinnySpacesContent(mx, newItems);
      localEchoSidebarItem(parseSidebar(mx, orphanSpaces, newSpacesContent));
      mx.setAccountData(AccountDataEvent.CinnySpaces, newSpacesContent);
    },
    [mx, sidebarItems, orphanSpaces, localEchoSidebarItem]
  );

  if (sidebarItems.length === 0) return null;
  return (
    <DndProvider backend={HTML5Backend}>
      <SidebarStackSeparator />
      <SidebarStack>
        {sidebarItems.map((item) => {
          if (typeof item === 'object') {
            if (openedFolder.has(item.id)) {
              return (
                <OpenedSpaceFolder key={item.id} folder={item} onClose={handleFolderToggle}>
                  {item.content.map((sId) => {
                    const space = mx.getRoom(sId);
                    if (!space) return null;
                    return (
                      <SpaceTab
                        key={space.roomId}
                        space={space}
                        selected={space.roomId === selectedSpaceId}
                        onClick={handleSpaceClick}
                        folder={item}
                        onDrop={(draggedItem, instruction) =>
                          handleDrop(draggedItem, { id: space.roomId, folder: item }, instruction)
                        }
                        onUnpin={orphanSpaces.includes(space.roomId) ? undefined : handleUnpin}
                      />
                    );
                  })}
                </OpenedSpaceFolder>
              );
            }

            return (
              <ClosedSpaceFolder
                key={item.id}
                folder={item}
                selected={!!selectedSpaceId && item.content.includes(selectedSpaceId)}
                onOpen={handleFolderToggle}
                onDrop={(draggedItem, instruction) =>
                  handleDrop(draggedItem, { folder: item }, instruction)
                }
              />
            );
          }

          const space = mx.getRoom(item);
          if (!space) return null;

          return (
            <SpaceTab
              key={space.roomId}
              space={space}
              selected={space.roomId === selectedSpaceId}
              onClick={handleSpaceClick}
              onDrop={(draggedItem, instruction) =>
                handleDrop(draggedItem, { id: space.roomId }, instruction)
              }
              onUnpin={orphanSpaces.includes(space.roomId) ? undefined : handleUnpin}
            />
          );
        })}
      </SidebarStack>
    </DndProvider>
  );
}
