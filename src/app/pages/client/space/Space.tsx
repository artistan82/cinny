import React, {
  MouseEventHandler,
  forwardRef,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useAtom, useAtomValue } from 'jotai';
import {
  Avatar,
  Box,
  Button,
  Icon,
  IconButton,
  Icons,
  Line,
  Menu,
  MenuItem,
  PopOut,
  RectCords,
  Spinner,
  Text,
  color,
  config,
  toRem,
} from 'folds';
import { useVirtualizer } from '@tanstack/react-virtual';
import { JoinRule, Room } from 'matrix-js-sdk';
import { RoomJoinRulesEventContent } from 'matrix-js-sdk/lib/types';
import FocusTrap from 'focus-trap-react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { useDrag, useDrop } from 'react-dnd';
import { useMatrixClient } from '../../../hooks/useMatrixClient';
import { mDirectAtom } from '../../../state/mDirectList';
import {
  NavCategory,
  NavCategoryHeader,
  NavItem,
  NavItemContent,
  NavLink,
} from '../../../components/nav';
import { getSpaceLobbyPath, getSpaceRoomPath, getSpaceSearchPath } from '../../pathUtils';
import { getCanonicalAliasOrRoomId, isRoomAlias } from '../../../utils/matrix';
import { useSelectedRoom } from '../../../hooks/router/useSelectedRoom';
import {
  useSpaceLobbySelected,
  useSpaceSearchSelected,
} from '../../../hooks/router/useSelectedSpace';
import { useSpace } from '../../../hooks/useSpace';
import { VirtualTile } from '../../../components/virtualizer';
import { RoomNavCategoryButton, RoomNavItem } from '../../../features/room-nav';
import { makeNavCategoryId } from '../../../state/closedNavCategories';
import { roomToUnreadAtom } from '../../../state/room/roomToUnread';
import { useCategoryHandler } from '../../../hooks/useCategoryHandler';
import { useNavToActivePathMapper } from '../../../hooks/useNavToActivePathMapper';
import { useRoomName } from '../../../hooks/useRoomMeta';
import { useSpaceJoinedHierarchy } from '../../../hooks/useSpaceHierarchy';
import { allRoomsAtom } from '../../../state/room-list/roomList';
import { PageNav, PageNavContent, PageNavHeader } from '../../../components/page';
import { usePowerLevels } from '../../../hooks/usePowerLevels';
import { openInviteUser } from '../../../../client/action/navigation';
import { useRecursiveChildScopeFactory, useSpaceChildren } from '../../../state/hooks/roomList';
import { roomToParentsAtom } from '../../../state/room/roomToParents';
import { markAsRead } from '../../../../client/action/notifications';
import { useRoomsUnread } from '../../../state/hooks/unread';
import { UseStateProvider } from '../../../components/UseStateProvider';
import { LeaveSpacePrompt } from '../../../components/leave-space-prompt';
import { copyToClipboard } from '../../../utils/dom';
import { useClosedNavCategoriesAtom } from '../../../state/hooks/closedNavCategories';
import { useStateEvent } from '../../../hooks/useStateEvent';
import { Membership, StateEvent } from '../../../../types/matrix/room';
import { stopPropagation } from '../../../utils/keyboard';
import { getMatrixToRoom } from '../../../plugins/matrix-to';
import { getViaServers } from '../../../plugins/via-servers';
import { useSetting } from '../../../state/hooks/settings';
import { settingsAtom } from '../../../state/settings';
import {
  getRoomNotificationMode,
  useRoomsNotificationPreferencesContext,
} from '../../../hooks/useRoomsNotificationPreferences';
import { useOpenSpaceSettings } from '../../../state/hooks/spaceSettings';
import { useRoomNavigate } from '../../../hooks/useRoomNavigate';
import { useRoomCreators } from '../../../hooks/useRoomCreators';
import { useRoomPermissions } from '../../../hooks/useRoomPermissions';
import { ContainerColor } from '../../../styles/ContainerColor.css';
import { AsyncStatus, useAsyncCallback } from '../../../hooks/useAsyncCallback';
import { BreakWord } from '../../../styles/Text.css';
import { useSeparatorsStore, ChannelSeparator } from '../../../state/separators';

interface DraggableRoomItemProps {
  room: Room;
  selected: boolean;
  showAvatar: boolean;
  direct: boolean;
  linkPath: string;
  notificationMode: any;
  spaceId: string;
  separatorId: string;
}

const DraggableRoomItem: React.FC<DraggableRoomItemProps> = ({
  room,
  selected,
  showAvatar,
  direct,
  linkPath,
  notificationMode,
  spaceId,
  separatorId,
}) => {
  const { assignChannelToSeparator } = useSeparatorsStore();
  
  const [{ isDragging }, drag] = useDrag({
    type: 'room',
    item: { roomId: room.roomId, sourceSeparatorId: separatorId },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  return (
    <div ref={drag} style={{ opacity: isDragging ? 0.5 : 1 }}>
      <RoomNavItem
        room={room}
        selected={selected}
        showAvatar={showAvatar}
        direct={direct}
        linkPath={linkPath}
        notificationMode={notificationMode}
      />
    </div>
  );
};

interface SeparatorContainerProps {
  separator: ChannelSeparator;
  spaceId: string;
  children: React.ReactNode;
  onRenameSeparator: () => void;
  onDeleteSeparator: () => void;
}

const SeparatorContainer: React.FC<SeparatorContainerProps> = ({
  separator,
  spaceId,
  children,
  onRenameSeparator,
  onDeleteSeparator,
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState<RectCords>();
  const [isHovered, setIsHovered] = useState(false);
  const { toggleSeparatorCollapse, assignChannelToSeparator, moveSeparator } = useSeparatorsStore();
  const categoryId = `separator-${spaceId}-${separator.id}`;

  const [{ isDragging }, drag] = useDrag({
    type: 'separator',
    item: { id: separator.id, order: separator.order },
    canDrag: !separator.isBase,
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  const [{ isOver }, drop] = useDrop({
    accept: ['room', 'separator'],
    drop: (item: any) => {
      if (item.roomId) {
        assignChannelToSeparator(spaceId, item.roomId, separator.id);
      } else if (item.id && item.id !== separator.id) {
        moveSeparator(spaceId, item.id, separator.order);
      }
    },
    collect: (monitor) => ({
      isOver: monitor.isOver({ shallow: true }),
    }),
  });

  const combinedRef = (el: HTMLDivElement | null) => {
    if (el) {
      drag(el);
      drop(el);
    }
  };

  const handleToggleCollapse = (e: React.MouseEvent) => {
    // Only toggle if not clicking on the menu button area
    const target = e.target as HTMLElement;
    if (!target.closest('[data-menu-button]')) {
      toggleSeparatorCollapse(spaceId, separator.id);
    }
  };

  const handleOpenMenu: MouseEventHandler<HTMLButtonElement> = (evt) => {
    evt.stopPropagation();
    const cords = evt.currentTarget.getBoundingClientRect();
    setMenuAnchor(cords);
    setIsMenuOpen(true);
  };

  return (
    <>
      <div
        ref={combinedRef}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        style={{
          opacity: isDragging ? 0.5 : 1,
          backgroundColor: isOver ? 'rgba(59, 130, 246, 0.1)' : undefined,
          borderRadius: config.radii.R300,
          transition: 'background-color 0.2s',
          position: 'relative',
        }}
      >
        <NavCategoryHeader>
          <Box 
            style={{ 
              width: '100%',
              position: 'relative',
            }}
            onClick={handleToggleCollapse}
          >
            <RoomNavCategoryButton
              data-category-id={categoryId}
              onClick={() => {}}
              closed={separator.isCollapsed}
              style={{ 
                width: '100%',
                paddingRight: !separator.isBase ? '32px' : undefined,
                position: 'relative',
              }}
            >
              {separator.name}
            </RoomNavCategoryButton>
            {!separator.isBase && (
              <button
                data-menu-button
                onClick={handleOpenMenu}
                style={{
                  position: 'absolute',
                  right: '6px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  width: '20px',
                  height: '20px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: 'transparent',
                  border: 'none',
                  borderRadius: '3px',
                  opacity: isHovered || isMenuOpen ? 0.7 : 0,
                  transition: 'opacity 0.2s ease',
                  cursor: 'pointer',
                  padding: 0,
                  zIndex: 2,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.1)';
                  e.currentTarget.style.opacity = '1';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.opacity = isHovered ? '0.7' : '0';
                }}
              >
                <Icon src={Icons.VerticalDots} size="100" />
              </button>
            )}
          </Box>
        </NavCategoryHeader>
        {!separator.isCollapsed && (
          <Box direction="Column" gap="100" style={{ marginLeft: config.space.S300 }}>
            {React.Children.count(children) === 0 ? (
              <Box
                style={{
                  padding: config.space.S400,
                  textAlign: 'center',
                  border: `2px dashed ${color.Surface.ContainerLine}`,
                  borderRadius: config.radii.R300,
                  opacity: 0.5,
                }}
              >
                <Text size="T200" style={{ color: color.Surface.OnContainer }}>
                  Drop channels here
                </Text>
              </Box>
            ) : (
              children
            )}
          </Box>
        )}
      </div>

      {isMenuOpen && menuAnchor && (
        <PopOut
          anchor={menuAnchor}
          position="Bottom"
          align="End"
          offset={6}
          content={
            <FocusTrap
              focusTrapOptions={{
                initialFocus: false,
                returnFocusOnDeactivate: false,
                onDeactivate: () => setIsMenuOpen(false),
                clickOutsideDeactivates: true,
                escapeDeactivates: stopPropagation,
              }}
            >
              <Menu style={{ maxWidth: toRem(160) }}>
                <Box direction="Column" gap="100" style={{ padding: config.space.S100 }}>
                  <MenuItem onClick={onRenameSeparator} size="300" radii="300">
                    <Text as="span" size="T300">Rename</Text>
                  </MenuItem>
                  <MenuItem
                    onClick={onDeleteSeparator}
                    variant="Critical"
                    size="300"
                    radii="300"
                  >
                    <Text as="span" size="T300">Delete</Text>
                  </MenuItem>
                </Box>
              </Menu>
            </FocusTrap>
          }
        />
      )}
    </>
  );
};

type SpaceMenuProps = {
  room: Room;
  requestClose: () => void;
};
const SpaceMenu = forwardRef<HTMLDivElement, SpaceMenuProps>(({ room, requestClose }, ref) => {
  const mx = useMatrixClient();
  const [hideActivity] = useSetting(settingsAtom, 'hideActivity');
  const [developerTools] = useSetting(settingsAtom, 'developerTools');
  const roomToParents = useAtomValue(roomToParentsAtom);
  const powerLevels = usePowerLevels(room);
  const creators = useRoomCreators(room);

  const permissions = useRoomPermissions(creators, powerLevels);
  const canInvite = permissions.action('invite', mx.getSafeUserId());
  const openSpaceSettings = useOpenSpaceSettings();
  const { navigateRoom } = useRoomNavigate();

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

  const handleOpenTimeline = () => {
    navigateRoom(room.roomId);
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
        {developerTools && (
          <MenuItem
            onClick={handleOpenTimeline}
            size="300"
            after={<Icon size="100" src={Icons.Terminal} />}
            radii="300"
          >
            <Text style={{ flexGrow: 1 }} as="span" size="T300" truncate>
              Event Timeline
            </Text>
          </MenuItem>
        )}
      </Box>
      <Line variant="Surface" size="300" />
      <Box direction="Column" gap="100" style={{ padding: config.space.S100 }}>
        <UseStateProvider initial={false}>
          {(promptLeave, setPromptLeave) => (
            <>
              <MenuItem
                onClick={() => setPromptLeave(true)}
                variant="Critical"
                fill="None"
                size="300"
                after={<Icon size="100" src={Icons.ArrowGoLeft} />}
                radii="300"
                aria-pressed={promptLeave}
              >
                <Text style={{ flexGrow: 1 }} as="span" size="T300" truncate>
                  Leave Space
                </Text>
              </MenuItem>
              {promptLeave && (
                <LeaveSpacePrompt
                  roomId={room.roomId}
                  onDone={requestClose}
                  onCancel={() => setPromptLeave(false)}
                />
              )}
            </>
          )}
        </UseStateProvider>
      </Box>
    </Menu>
  );
});

function SpaceHeader() {
  const space = useSpace();
  const spaceName = useRoomName(space);
  const [menuAnchor, setMenuAnchor] = useState<RectCords>();

  const joinRules = useStateEvent(
    space,
    StateEvent.RoomJoinRules
  )?.getContent<RoomJoinRulesEventContent>();

  const handleOpenMenu: MouseEventHandler<HTMLButtonElement> = (evt) => {
    const cords = evt.currentTarget.getBoundingClientRect();
    setMenuAnchor((currentState) => {
      if (currentState) return undefined;
      return cords;
    });
  };

  return (
    <>
      <PageNavHeader>
        <Box alignItems="Center" grow="Yes" gap="300">
          <Box grow="Yes" alignItems="Center" gap="100">
            <Text size="H4" truncate>
              {spaceName}
            </Text>
            {joinRules?.join_rule !== JoinRule.Public && <Icon src={Icons.Lock} size="50" />}
          </Box>
          <Box>
            <IconButton aria-pressed={!!menuAnchor} variant="Background" onClick={handleOpenMenu}>
              <Icon src={Icons.VerticalDots} size="200" />
            </IconButton>
          </Box>
        </Box>
      </PageNavHeader>
      {menuAnchor && (
        <PopOut
          anchor={menuAnchor}
          position="Bottom"
          align="End"
          offset={6}
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
              <SpaceMenu room={space} requestClose={() => setMenuAnchor(undefined)} />
            </FocusTrap>
          }
        />
      )}
    </>
  );
}

type SpaceTombstoneProps = { roomId: string; replacementRoomId: string };
export function SpaceTombstone({ roomId, replacementRoomId }: SpaceTombstoneProps) {
  const mx = useMatrixClient();
  const { navigateRoom } = useRoomNavigate();

  const [joinState, handleJoin] = useAsyncCallback(
    useCallback(() => {
      const currentRoom = mx.getRoom(roomId);
      const via = currentRoom ? getViaServers(currentRoom) : [];
      return mx.joinRoom(replacementRoomId, {
        viaServers: via,
      });
    }, [mx, roomId, replacementRoomId])
  );
  const replacementRoom = mx.getRoom(replacementRoomId);

  const handleOpen = () => {
    if (replacementRoom) navigateRoom(replacementRoom.roomId);
    if (joinState.status === AsyncStatus.Success) navigateRoom(joinState.data.roomId);
  };

  return (
    <Box
      style={{
        padding: config.space.S200,
        borderRadius: config.radii.R400,
        borderWidth: config.borderWidth.B300,
      }}
      className={ContainerColor({ variant: 'Surface' })}
      direction="Column"
      gap="300"
    >
      <Box direction="Column" grow="Yes" gap="100">
        <Text size="L400">Space Upgraded</Text>
        <Text size="T200">This space has been replaced and is no longer active.</Text>
        {joinState.status === AsyncStatus.Error && (
          <Text className={BreakWord} style={{ color: color.Critical.Main }} size="T200">
            {(joinState.error as any)?.message ?? 'Failed to join replacement space!'}
          </Text>
        )}
      </Box>
      <Box direction="Column" shrink="No">
        {replacementRoom?.getMyMembership() === Membership.Join ||
        joinState.status === AsyncStatus.Success ? (
          <Button onClick={handleOpen} size="300" variant="Success" fill="Solid" radii="300">
            <Text size="B300">Open New Space</Text>
          </Button>
        ) : (
          <Button
            onClick={handleJoin}
            size="300"
            variant="Primary"
            fill="Solid"
            radii="300"
            before={
              joinState.status === AsyncStatus.Loading && (
                <Spinner size="100" variant="Primary" fill="Solid" />
              )
            }
            disabled={joinState.status === AsyncStatus.Loading}
          >
            <Text size="B300">Join New Space</Text>
          </Button>
        )}
      </Box>
    </Box>
  );
}

export function Space() {
  const mx = useMatrixClient();
  const space = useSpace();
  useNavToActivePathMapper(space.roomId);
  const spaceIdOrAlias = getCanonicalAliasOrRoomId(mx, space.roomId);
  const scrollRef = useRef<HTMLDivElement>(null);
  const mDirects = useAtomValue(mDirectAtom);
  const roomToUnread = useAtomValue(roomToUnreadAtom);
  const allRooms = useAtomValue(allRoomsAtom);
  const allJoinedRooms = useMemo(() => new Set(allRooms), [allRooms]);
  const notificationPreferences = useRoomsNotificationPreferencesContext();

  const tombstoneEvent = useStateEvent(space, StateEvent.RoomTombstone);

  const selectedRoomId = useSelectedRoom();
  const lobbySelected = useSpaceLobbySelected(spaceIdOrAlias);
  const searchSelected = useSpaceSearchSelected(spaceIdOrAlias);

  const [closedCategories, setClosedCategories] = useAtom(useClosedNavCategoriesAtom());

  const {
    initializeSpace,
    getSpaceSeparators,
    getChannelSeparator,
    assignChannelToSeparator,
    createSeparator,
    renameSeparator,
    deleteSeparator,
    getChannelsInSeparator,
  } = useSeparatorsStore();

  const [isCreatingSeparator, setIsCreatingSeparator] = useState(false);
  const [newSeparatorName, setNewSeparatorName] = useState('');
  const [renamingSeparatorId, setRenamingSeparatorId] = useState<string | null>(null);
  const [renameSeparatorValue, setRenameSeparatorValue] = useState('');

  useEffect(() => {
    initializeSpace(space.roomId);
  }, [space.roomId, initializeSpace]);

  const separators = getSpaceSeparators(space.roomId);

  const getRoom = useCallback(
    (rId: string) => {
      if (allJoinedRooms.has(rId)) {
        return mx.getRoom(rId) ?? undefined;
      }
      return undefined;
    },
    [mx, allJoinedRooms]
  );

  const hierarchy = useSpaceJoinedHierarchy(
    space.roomId,
    getRoom,
    useCallback(
      (parentId, roomId) => {
        if (!closedCategories.has(makeNavCategoryId(space.roomId, parentId))) {
          return false;
        }
        const showRoom = roomToUnread.has(roomId) || roomId === selectedRoomId;
        if (showRoom) return false;
        return true;
      },
      [space.roomId, closedCategories, roomToUnread, selectedRoomId]
    ),
    useCallback(
      (sId) => closedCategories.has(makeNavCategoryId(space.roomId, sId)),
      [closedCategories, space.roomId]
    )
  );

  useEffect(() => {
    hierarchy.forEach(({ roomId }) => {
      const room = mx.getRoom(roomId);
      if (room && !room.isSpaceRoom()) {
        const currentSeparator = getChannelSeparator(space.roomId, roomId);
        if (!currentSeparator || currentSeparator === 'base-rooms') {
          assignChannelToSeparator(space.roomId, roomId, 'base-rooms');
        }
      }
    });
  }, [hierarchy, mx, space.roomId, getChannelSeparator, assignChannelToSeparator]);

  const roomsBySeparator = useMemo(() => {
    const grouped: Record<string, Room[]> = {};
    
    separators.forEach(separator => {
      grouped[separator.id] = [];
    });

    hierarchy.forEach(({ roomId }) => {
      const room = mx.getRoom(roomId);
      if (room && !room.isSpaceRoom()) {
        const separatorId = getChannelSeparator(space.roomId, roomId) || 'base-rooms';
        if (!grouped[separatorId]) {
          grouped[separatorId] = [];
        }
        grouped[separatorId].push(room);
      }
    });

    return grouped;
  }, [hierarchy, separators, mx, space.roomId, getChannelSeparator]);

  const getToLink = (roomId: string) =>
    getSpaceRoomPath(spaceIdOrAlias, getCanonicalAliasOrRoomId(mx, roomId));

  const handleCreateSeparator = (afterSeparatorId?: string) => {
    setIsCreatingSeparator(true);
  };

  const handleConfirmCreateSeparator = () => {
    if (newSeparatorName.trim()) {
      try {
        createSeparator(space.roomId, newSeparatorName);
        setNewSeparatorName('');
        setIsCreatingSeparator(false);
      } catch (error: any) {
        alert(error.message);
      }
    }
  };

  const handleRenameSeparator = (separatorId: string, currentName: string) => {
    setRenamingSeparatorId(separatorId);
    setRenameSeparatorValue(currentName);
  };

  const handleConfirmRenameSeparator = () => {
    if (renamingSeparatorId && renameSeparatorValue.trim()) {
      try {
        renameSeparator(space.roomId, renamingSeparatorId, renameSeparatorValue);
        setRenamingSeparatorId(null);
        setRenameSeparatorValue('');
      } catch (error: any) {
        alert(error.message);
      }
    }
  };

  const handleDeleteSeparator = (separatorId: string) => {
    const channelsInSep = getChannelsInSeparator(space.roomId, separatorId);
    if (channelsInSep.length > 0) {
      const confirmed = window.confirm(
        `This separator contains ${channelsInSep.length} channel(s). They will be moved to the base "rooms" separator. Continue?`
      );
      if (!confirmed) return;
    }
    deleteSeparator(space.roomId, separatorId);
  };

  return (
    <DndProvider backend={HTML5Backend}>
      <PageNav size="400" resizable>
        <SpaceHeader />
        <PageNavContent scrollRef={scrollRef}>
          <Box direction="Column" gap="300">
            {tombstoneEvent && (
              <SpaceTombstone
                roomId={space.roomId}
                replacementRoomId={tombstoneEvent.getContent().replacement_room}
              />
            )}
            
            {/* Lobby and Search sections */}
            <NavCategory>
              <NavItem variant="Background" radii="400" aria-selected={lobbySelected}>
                <NavLink to={getSpaceLobbyPath(getCanonicalAliasOrRoomId(mx, space.roomId))}>
                  <NavItemContent>
                    <Box as="span" grow="Yes" alignItems="Center" gap="200">
                      <Avatar size="200" radii="400">
                        <Icon src={Icons.Flag} size="100" filled={lobbySelected} />
                      </Avatar>
                      <Box as="span" grow="Yes">
                        <Text as="span" size="Inherit" truncate>
                          Lobby
                        </Text>
                      </Box>
                    </Box>
                  </NavItemContent>
                </NavLink>
              </NavItem>
              <NavItem variant="Background" radii="400" aria-selected={searchSelected}>
                <NavLink to={getSpaceSearchPath(getCanonicalAliasOrRoomId(mx, space.roomId))}>
                  <NavItemContent>
                    <Box as="span" grow="Yes" alignItems="Center" gap="200">
                      <Avatar size="200" radii="400">
                        <Icon src={Icons.Search} size="100" filled={searchSelected} />
                      </Avatar>
                      <Box as="span" grow="Yes">
                        <Text as="span" size="Inherit" truncate>
                          Message Search
                        </Text>
                      </Box>
                    </Box>
                  </NavItemContent>
                </NavLink>
              </NavItem>
            </NavCategory>

            {/* Separators with rooms */}
            {separators.map((separator) => (
              <NavCategory key={separator.id}>
                {renamingSeparatorId === separator.id ? (
                  <Box 
                    direction="Row" 
                    gap="100" 
                    style={{ 
                      padding: config.space.S200,
                      display: 'flex',
                      flexWrap: 'nowrap',
                    }}
                  >
                    <input
                      type="text"
                      value={renameSeparatorValue}
                      onChange={(e) => setRenameSeparatorValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleConfirmRenameSeparator();
                        if (e.key === 'Escape') {
                          setRenamingSeparatorId(null);
                          setRenameSeparatorValue('');
                        }
                      }}
                      autoFocus
                      style={{
                        flex: '1 1 auto',
                        minWidth: '60px',
                        padding: '4px 8px',
                        borderRadius: config.radii.R300,
                        border: `1px solid ${color.Surface.Container}`,
                        backgroundColor: 'transparent',
                        color: 'inherit',
                        fontSize: '12px',
                      }}
                    />
                    <Box gap="100" shrink="No" style={{ display: 'flex' }}>
                      <IconButton
                        size="200"
                        variant="Primary"
                        onClick={handleConfirmRenameSeparator}
                        style={{ flexShrink: 0 }}
                      >
                        <Icon src={Icons.Check} size="100" />
                      </IconButton>
                      <IconButton
                        size="200"
                        variant="Surface"
                        onClick={() => {
                          setRenamingSeparatorId(null);
                          setRenameSeparatorValue('');
                        }}
                        style={{ flexShrink: 0 }}
                      >
                        <Icon src={Icons.Cross} size="100" />
                      </IconButton>
                    </Box>
                  </Box>
                ) : (
                  <SeparatorContainer
                    separator={separator}
                    spaceId={space.roomId}
                    onRenameSeparator={() => handleRenameSeparator(separator.id, separator.name)}
                    onDeleteSeparator={() => handleDeleteSeparator(separator.id)}
                  >
                    {roomsBySeparator[separator.id]?.map((room) => (
                      <DraggableRoomItem
                        key={room.roomId}
                        room={room}
                        selected={selectedRoomId === room.roomId}
                        showAvatar={mDirects.has(room.roomId)}
                        direct={mDirects.has(room.roomId)}
                        linkPath={getToLink(room.roomId)}
                        notificationMode={getRoomNotificationMode(notificationPreferences, room.roomId)}
                        spaceId={space.roomId}
                        separatorId={separator.id}
                      />
                    ))}
                  </SeparatorContainer>
                )}
              </NavCategory>
            ))}

            {/* Create new separator input */}
            {isCreatingSeparator && (
              <NavCategory>
                <Box 
                  direction="Row" 
                  gap="100" 
                  style={{ 
                    padding: config.space.S200,
                    display: 'flex',
                    flexWrap: 'nowrap',
                  }}
                >
                  <input
                    type="text"
                    value={newSeparatorName}
                    onChange={(e) => setNewSeparatorName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleConfirmCreateSeparator();
                      if (e.key === 'Escape') {
                        setNewSeparatorName('');
                        setIsCreatingSeparator(false);
                      }
                    }}
                    placeholder="Name..."
                    autoFocus
                    style={{
                      flex: '1 1 auto',
                      minWidth: '60px',
                      padding: '4px 8px',
                      borderRadius: config.radii.R300,
                      border: `1px solid ${color.Surface.Container}`,
                      backgroundColor: 'transparent',
                      color: 'inherit',
                      fontSize: '12px',
                    }}
                  />
                  <Box gap="100" shrink="No" style={{ display: 'flex' }}>
                    <IconButton
                      size="200"
                      variant="Primary"
                      onClick={handleConfirmCreateSeparator}
                      style={{ flexShrink: 0 }}
                    >
                      <Icon src={Icons.Check} size="100" />
                    </IconButton>
                    <IconButton
                      size="200"
                      variant="Surface"
                      onClick={() => {
                        setNewSeparatorName('');
                        setIsCreatingSeparator(false);
                      }}
                      style={{ flexShrink: 0 }}
                    >
                      <Icon src={Icons.Cross} size="100" />
                    </IconButton>
                  </Box>
                </Box>
              </NavCategory>
            )}

            {/* Add separator button */}
            <NavCategory>
              <Button
                variant="Surface"
                fill="None"
                size="300"
                onClick={() => handleCreateSeparator()}
                style={{ width: '100%' }}
              >
                <Text size="T300">Add Separator</Text>
              </Button>
            </NavCategory>
          </Box>
        </PageNavContent>
      </PageNav>
    </DndProvider>
  );
}
