/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Users,
  UserPlus,
  Play,
  Send,
  Search,
  Check,
  Copy,
  Trash2,
  Sparkles,
  ExternalLink,
  Flame,
  Globe,
  Radio,
  Gamepad2,
  Clock,
  Circle,
  X,
  Compass,
} from 'lucide-react';
import {
  FriendUser,
  GameInvite,
  broadcastGameInvite,
  getGameDisplayName,
} from '../game/friends';
import { CharacterSkin, GameId, MultiplayerSessionConfig, RemotePlayerInfo } from '../game/types';
import { PublicProfileLookupInput } from '../game/publicProfile';

interface FriendsTabProps {
  friends: FriendUser[];
  onAddFriend: (name: string) => void;
  onRemoveFriend: (id: string) => void;
  onJoinFriendGame: (gameId: GameId, roomId?: string) => void;
  currentSkin: CharacterSkin;
  sessionConfig: MultiplayerSessionConfig;
  remotePlayers: RemotePlayerInfo[];
  onlineCount: number;
  onInspectPlayer?: (lookup: PublicProfileLookupInput) => void;
}

export const FriendsTab: React.FC<FriendsTabProps> = ({
  friends,
  onAddFriend,
  onRemoveFriend,
  onJoinFriendGame,
  currentSkin,
  sessionConfig,
  remotePlayers,
  onlineCount,
  onInspectPlayer,
}) => {
  const [filter, setFilter] = useState<'all' | 'in_game' | 'online' | 'offline'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [newFriendName, setNewFriendName] = useState('');
  const [copiedFriendId, setCopiedFriendId] = useState<string | null>(null);
  const [activeInviteFriend, setActiveInviteFriend] = useState<FriendUser | null>(null);
  const [lastInviteSentToast, setLastInviteSentToast] = useState<{
    friendName: string;
    gameTitle: string;
  } | null>(null);

  // Filtered friends list
  const filteredFriends = friends.filter((f) => {
    const matchesSearch =
      f.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.statusText.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (filter === 'in_game') return f.status === 'in_game';
    if (filter === 'online') return f.status === 'online' || f.status === 'in_game';
    if (filter === 'offline') return f.status === 'offline';
    return true;
  });

  const inGameCount = friends.filter((f) => f.status === 'in_game').length;
  const onlineFriendsCount = friends.filter((f) => f.status !== 'offline').length;

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFriendName.trim()) return;
    onAddFriend(newFriendName.trim());
    setNewFriendName('');
  };

  const handleSendInvite = (friend: FriendUser, targetGameId: GameId) => {
    const gameTitle = getGameDisplayName(targetGameId);
    const roomId =
      sessionConfig.roomId ||
      (targetGameId === 'doors'
        ? 'public_doors'
        : targetGameId === 'lava_survival'
        ? 'public_lava'
        : targetGameId === 'bee_swarm'
        ? 'public_bee'
        : targetGameId === 'studio'
        ? 'public_studio'
        : 'public_obby');

    const invite: GameInvite = {
      id: `inv_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      fromName: currentSkin.name,
      toFriendId: friend.id,
      toFriendName: friend.name,
      gameId: targetGameId,
      gameTitle,
      roomId,
      timestamp: Date.now(),
    };

    broadcastGameInvite(invite);

    setLastInviteSentToast({
      friendName: friend.name,
      gameTitle,
    });
    setActiveInviteFriend(null);

    setTimeout(() => {
      setLastInviteSentToast((prev) => (prev?.friendName === friend.name ? null : prev));
    }, 4000);
  };

  const handleCopyInviteLink = (friend: FriendUser) => {
    const inviteLink = `${window.location.origin}/?game=${friend.currentGame || sessionConfig.gameId || 'obby'}&room=${friend.currentRoomId || sessionConfig.roomId || 'OBBY777'}`;
    navigator.clipboard?.writeText(inviteLink);
    setCopiedFriendId(friend.id);
    setTimeout(() => setCopiedFriendId(null), 2000);
  };

  return (
    <div className="w-full flex flex-col gap-5 text-slate-100">
      {/* Toast Notification when invite sent */}
      <AnimatePresence>
        {lastInviteSentToast && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -15, scale: 0.95 }}
            className="w-full bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 text-white px-4 py-3 rounded-2xl shadow-xl flex items-center justify-between gap-3 border border-emerald-400/50"
          >
            <div className="flex items-center gap-2.5">
              <span className="text-xl">📩</span>
              <div>
                <span className="font-black text-sm block">
                  Приглашение отправлено игроку {lastInviteSentToast.friendName}!
                </span>
                <span className="text-xs text-emerald-100">
                  Игра: {lastInviteSentToast.gameTitle} · Код комнаты: {sessionConfig.roomId || 'OBBY777'}
                </span>
              </div>
            </div>
            <button
              onClick={() => setLastInviteSentToast(null)}
              className="p-1 hover:bg-white/20 rounded-lg transition-colors cursor-pointer"
            >
              <X size={16} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top Controls: Search, Filter Tabs & Add Friend Input */}
      <div className="bg-slate-900/95 border border-slate-800 rounded-3xl p-4 sm:p-5 shadow-xl flex flex-col gap-4">
        {/* Row 1: Header summary & Add friend form */}
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-red-500 to-rose-700 flex items-center justify-center text-white shadow-md">
                <Users size={20} />
              </div>
              <div>
                <h2 className="text-xl sm:text-2xl font-black text-white leading-tight">
                  Друзья Blox Hub (Friends)
                </h2>
                <p className="text-xs text-slate-400">
                  Играйте вместе, следите за онлайн-статусом и отправляйте приглашения в 1 клик!
                </p>
              </div>
            </div>
          </div>

          {/* Add Friend Form */}
          <form onSubmit={handleAddSubmit} className="flex items-center gap-2 max-w-md w-full lg:w-auto">
            <div className="relative flex-1">
              <input
                type="text"
                value={newFriendName}
                onChange={(e) => setNewFriendName(e.target.value)}
                placeholder="Никнейм игрока..."
                maxLength={16}
                className="w-full bg-slate-950/90 border border-slate-700 focus:border-red-500 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-white placeholder-slate-500 outline-none transition-colors"
              />
            </div>
            <button
              type="submit"
              disabled={!newFriendName.trim()}
              className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-bold text-xs sm:text-sm flex items-center gap-1.5 shadow-md cursor-pointer transition-all shrink-0"
            >
              <UserPlus size={16} />
              <span>Добавить</span>
            </button>
          </form>
        </div>

        {/* Row 2: Status Filter Pills & Search Input */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-3 border-t border-slate-800/80">
          {/* Status Filter Buttons */}
          <div className="flex items-center gap-1.5 bg-slate-950/80 p-1 rounded-xl border border-slate-800 text-xs font-bold overflow-x-auto">
            <button
              onClick={() => setFilter('all')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                filter === 'all'
                  ? 'bg-slate-800 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Все ({friends.length})
            </button>
            <button
              onClick={() => setFilter('in_game')}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                filter === 'in_game'
                  ? 'bg-emerald-600 text-white shadow'
                  : 'text-emerald-400 hover:text-white'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>В игре ({inGameCount})</span>
            </button>
            <button
              onClick={() => setFilter('online')}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                filter === 'online'
                  ? 'bg-sky-600 text-white shadow'
                  : 'text-sky-400 hover:text-white'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-sky-400" />
              <span>В сети ({onlineFriendsCount})</span>
            </button>
            <button
              onClick={() => setFilter('offline')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                filter === 'offline'
                  ? 'bg-slate-800 text-white shadow'
                  : 'text-slate-500 hover:text-white'
              }`}
            >
              Оффлайн ({friends.length - onlineFriendsCount})
            </button>
          </div>

          {/* Quick Search */}
          <div className="relative w-full sm:w-60">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Поиск по никнейму..."
              className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-slate-950/80 border border-slate-800 focus:border-slate-700 text-xs text-white placeholder-slate-500 outline-none"
            />
          </div>
        </div>
      </div>

      {/* Friends Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
        {filteredFriends.map((friend) => {
          const isFriendInGame = friend.status === 'in_game';
          const isFriendOnline = friend.status === 'online';

          return (
            <motion.div
              key={friend.id}
              layout
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className={`relative bg-slate-900/95 border rounded-2xl p-4 flex flex-col justify-between gap-3.5 shadow-lg transition-all hover:border-slate-600 ${
                isFriendInGame
                  ? 'border-emerald-500/40 hover:shadow-emerald-950/40'
                  : isFriendOnline
                  ? 'border-sky-500/30'
                  : 'border-slate-800 opacity-80'
              }`}
            >
              {/* Card Header: Avatar & Info (click to open public profile) */}
              <div className="flex items-start gap-3">
                {/* Avatar with Status Badge */}
                <button
                  type="button"
                  onClick={() =>
                    onInspectPlayer?.({
                      username: friend.name,
                      remotePlayer:
                        remotePlayers.find(
                          (rp) => rp.skin.name.toLowerCase() === friend.name.toLowerCase()
                        ) || {
                          id: friend.id,
                          skin: {
                            skinColor: friend.skinColor,
                            torsoColor: friend.torsoColor,
                            legsColor: friend.legsColor,
                            headShape: friend.headShape || 'round',
                            hat: friend.hat || 'cap',
                            face: friend.face || 'smile',
                            outfit: friend.outfit || 'classic',
                            shirt: friend.shirt || 'custom_shirt',
                            pants: friend.pants || 'custom_pants',
                            backpack: friend.backpack || 'none',
                            name: friend.name,
                          },
                          position: [0, 1.5, 0],
                          rotationY: 0,
                          isMoving: false,
                          isGrounded: true,
                          activeTool: 'sword',
                          checkpoint: 0,
                          coins: 0,
                        },
                    })
                  }
                  title={`Профиль игрока ${friend.name}`}
                  className="relative shrink-0 cursor-pointer group/avatar"
                >
                  <div className="w-13 h-13 rounded-2xl overflow-hidden border-2 border-slate-700 group-hover/avatar:border-sky-400 transition-colors bg-slate-950 shadow-md flex items-center justify-center">
                    {friend.avatarUrl ? (
                      <img
                        src={friend.avatarUrl}
                        alt={friend.name}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.currentTarget as HTMLElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <div
                        className="w-full h-full flex flex-col items-center justify-center font-black text-slate-900"
                        style={{ backgroundColor: friend.torsoColor }}
                      >
                        <div
                          className="w-5 h-5 rounded-md mb-0.5 border border-black/20"
                          style={{ backgroundColor: friend.skinColor }}
                        />
                        <span className="text-[10px] text-white/90 uppercase font-black">
                          {friend.name.slice(0, 2)}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Status Indicator Dot */}
                  <span
                    className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-slate-900 flex items-center justify-center ${
                      isFriendInGame
                        ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)] animate-pulse'
                        : isFriendOnline
                        ? 'bg-sky-400'
                        : 'bg-slate-600'
                    }`}
                    title={
                      isFriendInGame
                        ? 'В игре'
                        : isFriendOnline
                        ? 'В сети (В лобби)'
                        : 'Оффлайн'
                    }
                  />
                </button>

                {/* Friend Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <button
                      type="button"
                      onClick={() =>
                        onInspectPlayer?.({
                          username: friend.name,
                          remotePlayer:
                            remotePlayers.find(
                              (rp) => rp.skin.name.toLowerCase() === friend.name.toLowerCase()
                            ) || {
                              id: friend.id,
                              skin: {
                                skinColor: friend.skinColor,
                                torsoColor: friend.torsoColor,
                                legsColor: friend.legsColor,
                                headShape: friend.headShape || 'round',
                                hat: friend.hat || 'cap',
                                face: friend.face || 'smile',
                                outfit: friend.outfit || 'classic',
                                shirt: friend.shirt || 'custom_shirt',
                                pants: friend.pants || 'custom_pants',
                                backpack: friend.backpack || 'none',
                                name: friend.name,
                              },
                              position: [0, 1.5, 0],
                              rotationY: 0,
                              isMoving: false,
                              isGrounded: true,
                              activeTool: 'sword',
                              checkpoint: 0,
                              coins: 0,
                            },
                        })
                      }
                      className="font-black text-base text-white hover:text-sky-300 transition-colors truncate cursor-pointer text-left"
                    >
                      {friend.name}
                    </button>
                    {friend.mutualCount !== undefined && friend.mutualCount > 0 && (
                      <span className="text-[10px] text-slate-400 font-semibold shrink-0">
                        {friend.mutualCount} общих
                      </span>
                    )}
                  </div>

                  <span className="text-xs text-slate-400 font-mono block truncate">
                    {friend.username}
                  </span>

                  {/* Status Badge */}
                  <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                    {isFriendInGame ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[11px] font-bold">
                        <span>
                          {friend.currentGame === 'bee_swarm'
                            ? '🐝'
                            : friend.currentGame === 'lava_survival'
                            ? '🌋'
                            : friend.currentGame === 'studio'
                            ? '🛠️'
                            : friend.currentGame === 'doors'
                            ? '🚪'
                            : '🏃'}
                        </span>
                        <span className="truncate max-w-[140px]">{friend.statusText}</span>
                      </span>
                    ) : isFriendOnline ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-sky-500/15 border border-sky-500/30 text-sky-400 text-[11px] font-semibold">
                        <Radio size={11} />
                        <span>В сети Blox Hub</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-800 text-slate-400 text-[10px]">
                        <Clock size={10} />
                        <span>{friend.statusText}</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 pt-2 border-t border-slate-800/80">
                {/* Join Game Button */}
                {isFriendInGame && friend.currentGame && (
                  <button
                    type="button"
                    onClick={() => onJoinFriendGame(friend.currentGame!, friend.currentRoomId)}
                    className="flex-1 py-2 px-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold text-xs shadow-md flex items-center justify-center gap-1.5 cursor-pointer transition-all active:scale-95"
                    title={`Подключиться к ${friend.name}`}
                  >
                    <Play size={14} className="fill-white" />
                    <span>Войти в игру</span>
                  </button>
                )}

                {/* Send Game Invite Button */}
                <button
                  type="button"
                  onClick={() => setActiveInviteFriend(friend)}
                  className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-all active:scale-95 ${
                    isFriendInGame
                      ? 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200'
                      : 'flex-1 bg-red-600/90 hover:bg-red-500 border-red-500 text-white shadow-md'
                  }`}
                  title="Отправить приглашение в игру"
                >
                  <Send size={13} />
                  <span>Позвать в игру</span>
                </button>

                {/* Copy Link / Room Code Button */}
                <button
                  type="button"
                  onClick={() => handleCopyInviteLink(friend)}
                  className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white cursor-pointer transition-colors"
                  title="Скопировать ссылку-приглашение в игру"
                >
                  {copiedFriendId === friend.id ? (
                    <Check size={14} className="text-emerald-400" />
                  ) : (
                    <Copy size={14} />
                  )}
                </button>

                {/* Remove Friend button (if custom added) */}
                {friend.isCustom && (
                  <button
                    type="button"
                    onClick={() => onRemoveFriend(friend.id)}
                    className="p-2 rounded-xl bg-slate-800/60 hover:bg-rose-950/60 hover:border-rose-700/60 border border-slate-700 text-slate-400 hover:text-rose-400 cursor-pointer transition-colors"
                    title="Удалить из друзей"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </motion.div>
          );
        })}

        {filteredFriends.length === 0 && (
          <div className="col-span-full py-12 text-center bg-slate-900/50 border border-slate-800 rounded-3xl p-6">
            <Users size={36} className="mx-auto text-slate-600 mb-2" />
            <h3 className="text-base font-bold text-white mb-1">Друзья не найдены</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto mb-4">
              По запросу «{searchQuery}» ничего не найдено. Добавьте игрока через поле вверху!
            </p>
            <button
              onClick={() => {
                setSearchQuery('');
                setFilter('all');
              }}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200"
            >
              Сбросить фильтры
            </button>
          </div>
        )}
      </div>

      {/* Online Players on Current Server Section */}
      {remotePlayers.length > 0 && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-4 sm:p-5 shadow-xl">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              <h3 className="font-black text-sm text-white uppercase tracking-wider">
                Игроки на вашем сервере сейчас ({remotePlayers.length})
              </h3>
            </div>
            <span className="text-xs text-slate-400">
              Комната: <span className="font-mono text-amber-400 font-bold">{sessionConfig.roomId}</span>
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {remotePlayers.map((rp) => {
              const isAlreadyFriend = friends.some(
                (f) => f.name.toLowerCase() === rp.skin.name.toLowerCase()
              );

              return (
                <div
                  key={rp.id}
                  className="flex items-center justify-between gap-3 p-2.5 rounded-xl bg-slate-950/80 border border-slate-800 hover:border-slate-700 transition-colors"
                >
                  <button
                    type="button"
                    onClick={() =>
                      onInspectPlayer?.({
                        playerKey: rp.playerKey,
                        username: rp.skin.name,
                        clientId: rp.id,
                        remotePlayer: rp,
                      })
                    }
                    className="flex items-center gap-2.5 min-w-0 flex-1 text-left cursor-pointer group"
                    title={`Открыть профиль ${rp.skin.name}`}
                  >
                    <div
                      className="w-8 h-8 rounded-lg border border-slate-700 group-hover:border-sky-400 shrink-0 transition-colors"
                      style={{ backgroundColor: rp.skin.torsoColor }}
                    />
                    <div className="min-w-0">
                      <span className="font-bold text-xs text-white group-hover:text-sky-300 transition-colors truncate block">
                        {rp.skin.name}
                      </span>
                      <span className="text-[10px] text-emerald-400">В игре · Профиль →</span>
                    </div>
                  </button>

                  {!isAlreadyFriend ? (
                    <button
                      type="button"
                      onClick={() => onAddFriend(rp.skin.name)}
                      className="px-2.5 py-1 rounded-lg bg-red-600/80 hover:bg-red-500 text-white text-xs font-bold flex items-center gap-1 cursor-pointer shrink-0"
                    >
                      <UserPlus size={12} />
                      <span>В друзья</span>
                    </button>
                  ) : (
                    <span className="text-[10px] text-slate-400 font-bold px-2 py-0.5 rounded bg-slate-800">
                      В друзьях ✓
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Select Game Modal to Send Game Invite */}
      <AnimatePresence>
        {activeInviteFriend && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm"
            onClick={() => setActiveInviteFriend(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md bg-slate-900 border-2 border-slate-700 rounded-3xl p-5 sm:p-6 shadow-2xl flex flex-col gap-4 text-slate-100"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-red-600 flex items-center justify-center text-white">
                    <Send size={16} />
                  </div>
                  <div>
                    <h3 className="font-black text-base text-white">
                      Пригласить {activeInviteFriend.name} в игру
                    </h3>
                    <span className="text-xs text-slate-400">
                      Выберите, в какую игру отправить приглашение:
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setActiveInviteFriend(null)}
                  className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Game Options to Invite */}
              <div className="flex flex-col gap-2.5">
                <button
                  onClick={() => handleSendInvite(activeInviteFriend, 'obby')}
                  className="p-3 rounded-2xl bg-slate-950/80 hover:bg-sky-950/40 border border-slate-800 hover:border-sky-500/60 transition-all text-left flex items-center justify-between cursor-pointer group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-sky-500/20 text-sky-400 flex items-center justify-center text-lg">
                      🏃
                    </div>
                    <div>
                      <span className="font-bold text-sm text-white group-hover:text-sky-300 block">
                        Паркур: Blox Obby 3D
                      </span>
                      <span className="text-xs text-slate-400">Классическая полоса препятствий</span>
                    </div>
                  </div>
                  <Send size={16} className="text-slate-500 group-hover:text-sky-400" />
                </button>

                <button
                  onClick={() => handleSendInvite(activeInviteFriend, 'lava_survival')}
                  className="p-3 rounded-2xl bg-slate-950/80 hover:bg-orange-950/40 border border-slate-800 hover:border-orange-500/60 transition-all text-left flex items-center justify-between cursor-pointer group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-orange-500/20 text-orange-400 flex items-center justify-center text-lg">
                      🌋
                    </div>
                    <div>
                      <span className="font-bold text-sm text-white group-hover:text-orange-300 block">
                        Пол — это Лава! Выживание
                      </span>
                      <span className="text-xs text-slate-400">Крыши, джетпаки и вертолёт</span>
                    </div>
                  </div>
                  <Send size={16} className="text-slate-500 group-hover:text-orange-400" />
                </button>

                <button
                  onClick={() => handleSendInvite(activeInviteFriend, 'bee_swarm')}
                  className="p-3 rounded-2xl bg-slate-950/80 hover:bg-yellow-950/40 border border-slate-800 hover:border-yellow-500/60 transition-all text-left flex items-center justify-between cursor-pointer group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-yellow-500/20 text-yellow-400 flex items-center justify-center text-lg">
                      🐝
                    </div>
                    <div>
                      <span className="font-bold text-sm text-white group-hover:text-yellow-300 block">
                        Bee Swarm Simulator 3D
                      </span>
                      <span className="text-xs text-slate-400">Сбор пыльцы, мёд и ульи</span>
                    </div>
                  </div>
                  <Send size={16} className="text-slate-500 group-hover:text-yellow-400" />
                </button>

                <button
                  onClick={() => handleSendInvite(activeInviteFriend, 'studio')}
                  className="p-3 rounded-2xl bg-slate-950/80 hover:bg-indigo-950/40 border border-slate-800 hover:border-indigo-500/60 transition-all text-left flex items-center justify-between cursor-pointer group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-lg">
                      🛠️
                    </div>
                    <div>
                      <span className="font-bold text-sm text-white group-hover:text-indigo-300 block">
                        Blox Студия 3D
                      </span>
                      <span className="text-xs text-slate-400">Конструктор миров и тест карт</span>
                    </div>
                  </div>
                  <Send size={16} className="text-slate-500 group-hover:text-indigo-400" />
                </button>
              </div>

              {/* Direct Link Copier */}
              <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
                <span>Или скопируйте прямую ссылку:</span>
                <button
                  onClick={() => handleCopyInviteLink(activeInviteFriend)}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 font-bold flex items-center gap-1 cursor-pointer"
                >
                  <Copy size={13} />
                  <span>Копировать ссылку</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
