import React, { useEffect, useState } from 'react';
import {
  Play,
  Sparkles,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  Globe,
  Wifi,
  Gamepad2,
  ThumbsUp,
  Users,
  Compass,
  UserCheck,
  Server,
  Copy,
  Check,
  Backpack,
  Flame,
  Edit3,
  Dices,
  X,
  MessageSquare,
  Download,
  Crown,
  Keyboard,
  UserPlus,
  Send,
  KeyRound,
  LogIn,
  ShoppingBag,
  Sliders,
  User,
  Star,
} from 'lucide-react';
import { EMPTY_FEEDBACK_SUMMARY, FeedbackSummary } from '../game/feedback';
import { isFileProtocol } from '../game/env';
import { CharacterSkin, GameId, MultiplayerMode, MultiplayerSessionConfig, RemotePlayerInfo } from '../game/types';
import { isUserAdmin } from '../game/controls';
import { FriendsTab } from './FriendsTab';
import { FriendUser, GameInvite, getStoredFriends, addFriend, removeFriend } from '../game/friends';
import { RoomCodePanel } from './RoomCodeModal';
import {
  CloudUserProfile,
  NICKNAME_CHANGE_GEM_COST,
  isProtectedOwnerUsername,
  validateNicknameChangeAffordability,
} from '../game/auth';
import { PublicProfileLookupInput } from '../game/publicProfile';
import { AvatarPortraitIcon } from './AvatarPortraitIcon';
import { PlayerProfileHUD } from './PlayerProfileHUD';
import { PlayerTitleBadge } from './PlayerTitleBadge';
import { LeaderboardPanel } from './LeaderboardPanel';
import { getPlayerTitleById } from '../game/titles';

interface TitleScreenProps {
  onStartGame: (config: MultiplayerSessionConfig) => void;
  onOpenCustomizer: () => void;
  skin: CharacterSkin;
  onChangeSkin?: (skin: CharacterSkin) => void;
  onRenameNickname?: (nextName: string) => Promise<{ ok: boolean; error?: string }>;
  isMuted: boolean;
  onToggleMute: () => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  sessionConfig: MultiplayerSessionConfig;
  onChangeSessionConfig: (config: MultiplayerSessionConfig) => void;
  onlineCount: number;
  isConnected: boolean;
  onOpenFeedback: () => void;
  onOpenShop: () => void;
  onOpenControls?: () => void;
  onOpenAdmin?: () => void;
  isAdminUnlocked?: boolean;
  onOpenRoomCode?: () => void;
  onOpenAuth?: () => void;
  cloudProfile?: CloudUserProfile | null;
  isGuestSession?: boolean;
  coins?: number;
  gems?: number;
  isModalOpen?: boolean;
  remotePlayers?: RemotePlayerInfo[];
  viewerPlayerKey?: string;
  leaderboardVersion?: number;
  feedbackVersion?: number;
  onInspectPlayer?: (lookup: PublicProfileLookupInput) => void;
  onInspectSelfProfile?: () => void;
  onEnterVRMenu?: () => void;
}

export const TitleScreen: React.FC<TitleScreenProps> = ({
  onStartGame,
  onOpenCustomizer,
  skin,
  onChangeSkin,
  onRenameNickname,
  isMuted,
  onToggleMute,
  isFullscreen,
  onToggleFullscreen,
  sessionConfig,
  onChangeSessionConfig,
  onlineCount,
  isConnected,
  onOpenFeedback,
  onOpenShop,
  onOpenControls,
  onOpenAdmin,
  isAdminUnlocked = false,
  onOpenRoomCode,
  onOpenAuth,
  cloudProfile,
  isGuestSession = false,
  coins = 0,
  gems = 0,
  isModalOpen = false,
  remotePlayers = [],
  viewerPlayerKey,
  leaderboardVersion = 0,
  feedbackVersion = 0,
  onInspectPlayer,
  onInspectSelfProfile,
  onEnterVRMenu,
}) => {
  const [activeTab, setActiveTab] = useState<'games' | 'servers' | 'friends'>('games');
  const [friends, setFriends] = useState<FriendUser[]>(() => getStoredFriends());
  const [incomingInvite, setIncomingInvite] = useState<GameInvite | null>(null);
  const [roomCodeInput, setRoomCodeInput] = useState(
    sessionConfig.mode === 'lan_room' ? sessionConfig.roomId : 'OBBY777'
  );
  const [copiedCode, setCopiedCode] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(skin.name);
  const [feedbackSummary, setFeedbackSummary] = useState<FeedbackSummary>(EMPTY_FEEDBACK_SUMMARY);

  useEffect(() => {
    if (isFileProtocol()) return;
    let active = true;
    fetch('/api/feedback/summary', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (active && data?.summary) {
          setFeedbackSummary(data.summary);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [feedbackVersion]);

  // Keep nameInput in sync when skin changes
  useEffect(() => {
    setNameInput(skin.name);
  }, [skin.name]);

  const [nameError, setNameError] = useState<string | null>(null);
  const [isRenamingName, setIsRenamingName] = useState(false);

  const handleSaveNickname = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const clean = nameInput.trim().slice(0, 16);
    if (!clean) {
      setIsEditingName(false);
      return;
    }
    if (clean === skin.name) {
      setNameError(null);
      setIsEditingName(false);
      return;
    }
    if (!cloudProfile && isProtectedOwnerUsername(clean)) {
      setNameError('Никнейм «gerdgrad92» защищён и недоступен для гостей.');
      return;
    }
    const afford = validateNicknameChangeAffordability(skin.name, clean, gems);
    if (!afford.ok) {
      setNameError(afford.error || `Нужно ${NICKNAME_CHANGE_GEM_COST} 💎 для смены ника.`);
      return;
    }

    if (onRenameNickname) {
      setIsRenamingName(true);
      setNameError(null);
      try {
        const res = await onRenameNickname(clean);
        if (!res.ok) {
          setNameError(res.error || 'Не удалось сменить никнейм.');
          return;
        }
        setIsEditingName(false);
      } finally {
        setIsRenamingName(false);
      }
      return;
    }

    setNameError(null);
    onChangeSkin?.({ ...skin, name: clean });
    setIsEditingName(false);
  };

  const handleRandomizeTitleName = () => {
    const prefixes = ['Pro', 'Blox', 'Mega', 'Super', 'Epic', 'Speedy', 'Cool', 'Neon', 'Fire', 'Shadow', 'Lucky', 'Hyper'];
    const suffixes = ['Runner', 'Master', 'Gamer', 'Knight', 'Ninja', 'Player', 'Hero', 'Boy', 'Star', 'King', 'Bloxer', 'Rox'];
    const p = prefixes[Math.floor(Math.random() * prefixes.length)];
    const s = suffixes[Math.floor(Math.random() * suffixes.length)];
    const n = Math.floor(10 + Math.random() * 89);
    const newName = `${p}${s}_${n}`;
    setNameInput(newName);
    setNameError(null);
  };

  // Listen for incoming game invites across tabs and windows
  useEffect(() => {
    const handleInviteEvent = (e: any) => {
      const invite = e.detail as GameInvite;
      if (invite && invite.fromName !== skin.name) {
        setIncomingInvite(invite);
      }
    };
    window.addEventListener('blox_game_invite', handleInviteEvent);

    let bc: BroadcastChannel | null = null;
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        bc = new BroadcastChannel('blox_game_invites');
        bc.onmessage = (ev) => {
          const invite = ev.data as GameInvite;
          if (invite && invite.fromName !== skin.name) {
            setIncomingInvite(invite);
          }
        };
      } catch {}
    }

    return () => {
      window.removeEventListener('blox_game_invite', handleInviteEvent);
      bc?.close();
    };
  }, [skin.name]);

  const handleAddFriend = (name: string) => {
    const created = addFriend(name);
    setFriends((prev) => [created, ...prev.filter((f) => f.id !== created.id)]);
  };

  const handleRemoveFriend = (id: string) => {
    const updated = removeFriend(id);
    setFriends(updated);
  };

  // Keep roomCodeInput in sync if URL/modal sets a LAN room externally
  useEffect(() => {
    if (sessionConfig.mode === 'lan_room' && sessionConfig.roomId) {
      setRoomCodeInput(sessionConfig.roomId);
    }
  }, [sessionConfig.mode, sessionConfig.roomId]);

  const handleJoinFriendGame = (gameId: GameId, roomId?: string) => {
    const cleanCustomRoom =
      roomId && !roomId.startsWith('public_') && !roomId.endsWith('-main')
        ? roomId.toUpperCase().replace(/[^A-Z0-9_-]/g, '')
        : '';

    const targetRoom =
      cleanCustomRoom ||
      roomId ||
      (gameId === 'doors'
        ? 'public_doors'
        : gameId === 'lava_survival'
        ? 'public_lava'
        : gameId === 'bee_swarm'
        ? 'public_bee'
        : gameId === 'studio'
        ? 'public_studio'
        : 'public_obby');

    const newConfig: MultiplayerSessionConfig = {
      mode: cleanCustomRoom ? 'lan_room' : 'online',
      gameId,
      roomId: targetRoom,
    };
    onChangeSessionConfig(newConfig);
    onStartGame(newConfig);
  };

  const handleAcceptInvite = (invite: GameInvite) => {
    const cleanRoom = invite.roomId || '';
    const isCustomRoom =
      cleanRoom.length > 0 && !cleanRoom.startsWith('public_') && !cleanRoom.endsWith('-main');

    const newConfig: MultiplayerSessionConfig = {
      mode: isCustomRoom ? 'lan_room' : 'online',
      gameId: invite.gameId,
      roomId: cleanRoom,
    };
    onChangeSessionConfig(newConfig);
    setIncomingInvite(null);
    onStartGame(newConfig);
  };

  const selectedGame: GameId = sessionConfig.gameId || 'doors';

  const handleSelectGame = (gameId: GameId) => {
    onChangeSessionConfig({
      ...sessionConfig,
      gameId,
      roomId:
        sessionConfig.mode === 'online'
          ? gameId === 'doors'
            ? 'public_doors'
            : gameId === 'lava_survival'
            ? 'public_lava'
            : gameId === 'bee_swarm'
            ? 'public_bee'
            : gameId === 'studio'
            ? 'public_studio'
            : 'public_obby'
          : sessionConfig.roomId,
    });
  };

  // Listen for Enter or Space to start immediately (unless typing in an input, modal is open, or browsing Servers/Friends)
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (activeTab !== 'games' || isModalOpen) return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.code === 'Enter' || e.code === 'Space') {
        e.preventDefault();
        onStartGame(sessionConfig);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onStartGame, sessionConfig, activeTab, isModalOpen]);

  const handleSelectMode = (mode: MultiplayerMode) => {
    if (mode === 'online') {
      const publicRoom =
        selectedGame === 'doors'
          ? 'public_doors'
          : selectedGame === 'lava_survival'
          ? 'public_lava'
          : selectedGame === 'bee_swarm'
          ? 'public_bee'
          : selectedGame === 'studio'
          ? 'public_studio'
          : 'public_obby';
      onChangeSessionConfig({
        mode: 'online',
        gameId: selectedGame,
        roomId: publicRoom,
      });
    } else if (mode === 'lan_room') {
      const clean = roomCodeInput.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '') || 'OBBY777';
      setRoomCodeInput(clean);
      onChangeSessionConfig({ mode: 'lan_room', gameId: selectedGame, roomId: clean });
    } else {
      onChangeSessionConfig({ mode: 'local_coop', gameId: selectedGame, roomId: 'local_coop' });
    }
  };

  const commitRoomCode = (val: string = roomCodeInput) => {
    const clean = val.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 12) || 'OBBY777';
    setRoomCodeInput(clean);
    onChangeSessionConfig({
      mode: 'lan_room',
      gameId: selectedGame,
      roomId: clean,
    });
  };

  const handleRoomCodeChange = (val: string) => {
    const clean = val.toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 12);
    setRoomCodeInput(clean);
  };

  const handleGenerateRandomCode = () => {
    const num = Math.floor(100 + Math.random() * 900);
    const code = `ROOM${num}`;
    setRoomCodeInput(code);
    onChangeSessionConfig({ mode: 'lan_room', gameId: selectedGame, roomId: code });
  };

  const handleCopyCode = () => {
    navigator.clipboard?.writeText(roomCodeInput || 'OBBY777');
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 1800);
  };

  const handleDownloadStandaloneHtml = async () => {
    if (isFileProtocol()) return;
    try {
      const params = new URLSearchParams();
      params.set('game', selectedGame);
      if (sessionConfig.mode === 'lan_room') {
        const activeRoomCode = (roomCodeInput || sessionConfig.roomId || 'OBBY777')
          .toUpperCase()
          .replace(/[^A-Z0-9_-]/g, '')
          .slice(0, 16);
        params.set('mode', 'lan_room');
        if (activeRoomCode.length >= 2) {
          params.set('room', activeRoomCode);
        }
      } else {
        params.set('mode', 'online');
      }
      const res = await fetch(`/api/download-html?${params.toString()}`);
      if (!res.ok) return;
      const htmlText = await res.text();
      const blob = new Blob([htmlText], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'Blox_Hub_3D_Standalone.html';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      // Fallback
    }
  };

  return (
    <div className="fixed inset-0 z-30 flex flex-col justify-between pointer-events-auto bg-slate-950/92 text-slate-100 overflow-y-auto pb-20 md:pb-0">
      {/* TOP NAVIGATION BAR */}
      <header className="sticky top-0 z-30 w-full bg-slate-900/95 backdrop-blur-xl border-b border-slate-800 px-3 sm:px-6 py-2 pt-safe flex items-center justify-between gap-2 sm:gap-3 shrink-0">
        {/* Left: Emblem + Brand & Desktop Nav */}
        <div className="flex items-center gap-3 sm:gap-6 min-w-0">
          <div className="flex items-center gap-2 shrink-0">
            <svg viewBox="0 0 44 44" className="w-8 h-8 sm:w-9 sm:h-9 shrink-0">
              <g transform="translate(22, 22) rotate(-14)">
                <rect x="-16" y="-16" width="32" height="32" rx="6" fill="#ef4444" stroke="#ffffff" strokeWidth="2.5" />
                <rect x="-6" y="-6" width="12" height="12" rx="2" fill="#0f172a" />
              </g>
            </svg>
            <div className="flex flex-col">
              <span className="font-black tracking-wider text-base sm:text-lg leading-none text-white whitespace-nowrap">
                BLOX HUB
              </span>
            </div>
          </div>

          {/* Desktop Navigation Pills */}
          <nav className="hidden md:flex items-center gap-1 bg-slate-950/80 p-1 rounded-xl border border-slate-800 text-xs font-bold overflow-x-auto max-w-[560px]">
            <button
              onClick={() => setActiveTab('games')}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                activeTab === 'games'
                  ? 'bg-red-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Compass size={14} />
              <span>Игры (5)</span>
            </button>
            <button
              onClick={() => setActiveTab('friends')}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap relative ${
                activeTab === 'friends'
                  ? 'bg-red-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Users size={14} />
              <span>Друзья ({friends.filter((f) => f.status !== 'offline').length})</span>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            </button>
            <button
              onClick={onOpenCustomizer}
              className="px-3 py-1.5 rounded-lg text-slate-400 hover:text-white transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <Backpack size={14} />
              <span>Аватар & Рюкзак</span>
            </button>
            <button
              onClick={onOpenShop}
              className="px-3 py-1.5 rounded-lg text-amber-300 hover:text-amber-200 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 transition-all flex items-center gap-1.5 cursor-pointer font-bold whitespace-nowrap"
            >
              <Sparkles size={14} className="text-amber-400" />
              <span>Магазин 🛍️</span>
            </button>
            <button
              onClick={() => setActiveTab('servers')}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                activeTab === 'servers'
                  ? 'bg-red-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Server size={14} />
              <span>Комнаты</span>
            </button>
            {onOpenRoomCode && (
              <button
                type="button"
                data-testid="open-room-code-btn"
                onClick={onOpenRoomCode}
                className="px-3 py-1.5 rounded-lg text-amber-300 hover:text-amber-200 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 transition-all flex items-center gap-1.5 cursor-pointer font-black whitespace-nowrap"
              >
                <KeyRound size={14} className="text-amber-400" />
                <span>Войти по коду</span>
              </button>
            )}
          </nav>
        </div>

        {/* Right: Player Profile HUD + Utility Controls */}
        <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
          <PlayerProfileHUD
            skin={skin}
            username={cloudProfile?.username || skin.name}
            coins={coins}
            gems={gems}
            isCloudAccount={Boolean(cloudProfile)}
            isGuest={isGuestSession}
            variant="header"
            onClick={() => {
              if (onOpenAuth) {
                onOpenAuth();
              } else {
                onOpenCustomizer();
              }
            }}
          />

          <div
            className={`hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-semibold border ${
              isConnected
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
              }`}
            />
            <span>{onlineCount} в сети</span>
          </div>

          {/* Password-protected Admin Panel button (PC & Mobile) */}
          <button
            type="button"
            onClick={onOpenAdmin}
            title={isAdminUnlocked ? 'Админ Панель (Открыта) [F2]' : 'Админ Панель (Вход по паролю) [F2]'}
            className={`min-h-[40px] flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl font-black text-xs border cursor-pointer transition-all ${
              isAdminUnlocked || isUserAdmin(skin.name)
                ? 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 shadow-[0_0_15px_rgba(245,158,11,0.5)] border-amber-300'
                : 'bg-slate-800 hover:bg-slate-700 text-amber-300 border-amber-500/40'
            }`}
          >
            <Crown size={15} />
            <span className="hidden sm:inline">АДМИН</span>
          </button>

          {/* Controls Config Button (42px mobile touch target) */}
          <button
            onClick={onOpenControls}
            aria-label="Настройка управления"
            title="Настройка управления и джойстика"
            className="min-w-[40px] min-h-[40px] flex items-center justify-center p-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-sky-400 hover:text-white cursor-pointer transition-all"
          >
            <Sliders size={18} className="sm:hidden" />
            <Keyboard size={17} className="hidden sm:block" />
          </button>

          <button
            onClick={onToggleFullscreen}
            aria-label="Полный экран"
            className="hidden sm:flex min-w-[40px] min-h-[40px] items-center justify-center p-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white cursor-pointer transition-all"
            title={isFullscreen ? 'Выйти из полноэкранного режима (F)' : 'Полный экран (F)'}
          >
            {isFullscreen ? <Minimize size={17} /> : <Maximize size={17} />}
          </button>

          <button
            onClick={onToggleMute}
            aria-label={isMuted ? 'Включить звук' : 'Выключить звук'}
            className="min-w-[40px] min-h-[40px] flex items-center justify-center p-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white cursor-pointer transition-all"
            title={isMuted ? 'Включить звук' : 'Выключить звук'}
          >
            {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </button>
        </div>
      </header>

      {/* MAIN HERO & GAME DISCOVERY AREA */}
      <div className="flex-1 w-full max-w-6xl mx-auto px-3 sm:px-4 py-3 sm:py-6 flex flex-col justify-start md:justify-center">
        {/* Incoming Invite Notification Toast / Banner */}
        {incomingInvite && (
          <div className="w-full mb-4 bg-gradient-to-r from-red-600 via-rose-600 to-amber-600 text-white p-3.5 sm:p-4 rounded-2xl shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-2 border-white/30 animate-pulse">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🎮</span>
              <div>
                <span className="font-black text-sm sm:text-base block">
                  {incomingInvite.fromName} приглашает вас в игру «{incomingInvite.gameTitle}»!
                </span>
                <span className="text-xs text-rose-100">
                  Комната: {incomingInvite.roomId} · Нажмите «Принять», чтобы зайти прямо сейчас.
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => handleAcceptInvite(incomingInvite)}
                className="px-4 py-2 rounded-xl bg-white text-rose-700 hover:bg-rose-50 font-black text-xs sm:text-sm shadow-md cursor-pointer transition-all flex items-center gap-1.5"
              >
                <Play size={14} className="fill-rose-700" />
                <span>Принять и играть</span>
              </button>
              <button
                onClick={() => setIncomingInvite(null)}
                className="px-3 py-2 rounded-xl bg-black/20 hover:bg-black/30 text-white text-xs font-bold cursor-pointer transition-colors"
              >
                Отклонить
              </button>
            </div>
          </div>
        )}

        {activeTab === 'friends' ? (
          <FriendsTab
            friends={friends}
            onAddFriend={handleAddFriend}
            onRemoveFriend={handleRemoveFriend}
            onJoinFriendGame={handleJoinFriendGame}
            currentSkin={skin}
            sessionConfig={sessionConfig}
            remotePlayers={remotePlayers}
            onlineCount={onlineCount}
            onInspectPlayer={onInspectPlayer}
          />
        ) : activeTab === 'servers' ? (
          <RoomCodePanel
            embedded
            sessionConfig={sessionConfig}
            onJoinOrCreateRoom={(cfg) => {
              onChangeSessionConfig(cfg);
              onStartGame(cfg);
            }}
            onlineCount={onlineCount}
            isConnected={isConnected}
          />
        ) : (
          <>
            {/* User Welcome Banner with Equipped Skin Portrait (Compact on Mobile) */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3 bg-gradient-to-r from-slate-900/90 via-slate-900/60 to-slate-950/90 border border-slate-800 rounded-2xl p-3 sm:p-4 mb-3 sm:mb-4 shadow-lg backdrop-blur">
          <div className="flex items-center gap-3 min-w-0">
            <AvatarPortraitIcon
              skin={skin}
              size="lg"
              onClick={onOpenCustomizer}
              className="border-2 border-red-500/70 shadow-lg shrink-0"
              title="Ваш скин смотрит на вас! Нажмите, чтобы настроить"
            />
            <div className="flex flex-col min-w-0">
              {isEditingName ? (
                <form onSubmit={handleSaveNickname} className="flex items-center gap-1.5 flex-wrap my-0.5">
                  <input
                    type="text"
                    value={nameInput}
                    onChange={(e) => {
                      setNameInput(e.target.value.slice(0, 16));
                      if (nameError) setNameError(null);
                    }}
                    placeholder="Введите никнейм..."
                    maxLength={16}
                    autoFocus
                    className="px-3 py-1.5 rounded-xl bg-slate-950 border-2 border-amber-400 text-white font-black text-sm outline-none w-36 sm:w-44"
                  />
                  <button
                    type="submit"
                    disabled={isRenamingName}
                    data-testid="title-rename-confirm-btn"
                    className={`min-h-[36px] px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1 cursor-pointer transition-colors shadow-md disabled:opacity-60 ${
                      nameInput.trim() !== skin.name && gems < NICKNAME_CHANGE_GEM_COST
                        ? 'bg-slate-700 hover:bg-slate-600 text-rose-300 border border-rose-500/40'
                        : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                    }`}
                  >
                    <Check size={14} />
                    <span>{nameInput.trim() !== skin.name ? `${NICKNAME_CHANGE_GEM_COST} 💎` : 'OK'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleRandomizeTitleName}
                    title="Случайный никнейм"
                    className="min-h-[36px] min-w-[36px] flex items-center justify-center p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-600 cursor-pointer transition-colors"
                  >
                    <Dices size={15} />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditingName(false);
                      setNameInput(skin.name);
                      setNameError(null);
                    }}
                    title="Отмена"
                    className="min-h-[36px] min-w-[36px] flex items-center justify-center p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white border border-slate-600 cursor-pointer transition-colors"
                  >
                    <X size={15} />
                  </button>
                  <span className="w-full text-[11px] font-bold text-cyan-300/90 mt-0.5">
                    Смена ника стоит {NICKNAME_CHANGE_GEM_COST} 💎 (у вас: {gems} 💎 · гипер редкие)
                  </span>
                  {nameError && (
                    <span
                      data-testid="title-name-error"
                      className="w-full text-[11px] font-bold text-rose-400 mt-0.5"
                    >
                      {nameError}
                    </span>
                  )}
                </form>
              ) : (
                <div className="flex flex-col min-w-0">
                  {getPlayerTitleById(skin.playerTitleId) && (
                    <div className="mb-1 flex items-center">
                      <button
                        type="button"
                        onClick={() => (onInspectSelfProfile ? onInspectSelfProfile() : onOpenCustomizer())}
                        title="Изменить титул игрока"
                        className="cursor-pointer transition-transform hover:scale-[1.03] active:scale-[0.98]"
                      >
                        <PlayerTitleBadge
                          title={getPlayerTitleById(skin.playerTitleId)!}
                          size="sm"
                        />
                      </button>
                    </div>
                  )}
                  <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                    <h1 className="text-base sm:text-2xl font-black text-white leading-tight truncate max-w-[190px] sm:max-w-none">
                      Привет, {skin.name}! 👋
                    </h1>
                  <button
                    type="button"
                    data-testid="title-rename-btn"
                    onClick={() => {
                      setIsEditingName(true);
                      setNameInput(skin.name);
                      setNameError(null);
                    }}
                    title={`Сменить никнейм за ${NICKNAME_CHANGE_GEM_COST} 💎`}
                    className="flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 text-[11px] font-bold text-amber-300 hover:text-white cursor-pointer transition-colors shadow-sm"
                  >
                    <Edit3 size={11} />
                    <span className="hidden sm:inline">Сменить ник</span>
                    <span className="px-1.5 py-0.2 rounded bg-cyan-500/20 border border-cyan-400/40 text-cyan-300 text-[10px] font-black">
                      {NICKNAME_CHANGE_GEM_COST} 💎
                    </span>
                  </button>
                  <span className="hidden sm:flex px-2 py-0.5 rounded-md bg-amber-500/20 border border-amber-400/50 text-amber-300 text-[10px] font-black uppercase items-center gap-1">
                    <Backpack size={11} />
                    {skin.backpack === 'fuel_jetpack'
                      ? 'Джетпак FUEL'
                      : skin.backpack === 'roblox_classic'
                      ? 'Рюкзак Roblox'
                      : skin.backpack === 'treasure_pack'
                      ? 'Рюкзак Сокровищ'
                      : 'Без рюкзака'}
                  </span>
                </div>
                </div>
              )}
              <p className="text-[11px] sm:text-xs text-slate-400 mt-0.5">
                <span className="sm:hidden">5 режимов 3D · Выберите игру ниже</span>
                <span className="hidden sm:inline">
                  Доступно режимов: <span className="text-slate-200 font-bold">5 Игр (DOORS, Просторный Obby, Лава, Bee Farm и Студия 3D)</span> · Рюкзак по кнопке <span className="text-amber-300 font-bold">[B]</span>
                </span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap self-stretch sm:self-auto">
            {onInspectSelfProfile && (
              <button
                type="button"
                data-testid="open-self-profile-card-btn"
                onClick={onInspectSelfProfile}
                className="flex-1 sm:flex-none min-h-[42px] px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-xs sm:text-sm font-bold text-sky-300 flex items-center justify-center gap-2 cursor-pointer transition-all"
              >
                <User size={16} />
                <span>Карточка профиля</span>
              </button>
            )}
            {onOpenAuth && !cloudProfile && (
              <button
                type="button"
                onClick={onOpenAuth}
                className="flex-1 sm:flex-none min-h-[42px] px-3.5 py-2 rounded-xl bg-red-600 hover:bg-red-500 border border-red-400/50 text-xs sm:text-sm font-black text-white flex items-center justify-center gap-2 cursor-pointer transition-all shadow-md"
              >
                <LogIn size={16} />
                <span>Войти / Аккаунт</span>
              </button>
            )}
            <button
              onClick={onOpenCustomizer}
              className="hidden sm:flex min-h-[42px] px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-xs sm:text-sm font-bold text-amber-300 items-center gap-2 cursor-pointer transition-all"
            >
              <Sparkles size={16} />
              <span>Мой Скин / Рюкзак</span>
            </button>
          </div>
        </div>

        {/* 5 PLAYABLE EXPERIENCES SELECTOR TABS */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-2.5 mb-3 sm:mb-4">
          {/* Game 4 (Featured First): DOORS Hotel Horror POV */}
          <button
            type="button"
            data-testid="game-select-doors"
            onClick={() => handleSelectGame('doors')}
            className={`text-left p-3 rounded-2xl border-2 transition-all cursor-pointer flex items-center justify-between gap-2.5 ${
              selectedGame === 'doors'
                ? 'bg-gradient-to-r from-purple-600/30 via-rose-700/25 to-slate-900 border-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.3)]'
                : 'bg-slate-900/80 hover:bg-slate-800/80 border-slate-800 text-slate-300'
            }`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-700 via-red-900 to-slate-950 flex items-center justify-center text-xl shrink-0 shadow-md border border-amber-400/50">
                🚪
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-black text-xs sm:text-sm text-white truncate">
                    DOORS: Отель [POV]
                  </span>
                  <span className="px-1 py-0.2 rounded bg-rose-500/30 text-rose-300 text-[9px] font-black">
                    ХОРРОР 👁️
                  </span>
                </div>
                <p className="text-[11px] text-amber-200/80 truncate mt-0.5">
                  Раш, Глаза, Скрич и Дверь 100
                </p>
              </div>
            </div>
            <span
              className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase shrink-0 ${
                selectedGame === 'doors'
                  ? 'bg-amber-400 text-slate-950 shadow'
                  : 'bg-slate-800 text-slate-400'
              }`}
            >
              {selectedGame === 'doors' ? 'Выбрана' : 'Выбрать'}
            </span>
          </button>

          {/* Game 1: Parkour Obby */}
          <button
            type="button"
            data-testid="game-select-obby"
            onClick={() => handleSelectGame('obby')}
            className={`text-left p-3 rounded-2xl border-2 transition-all cursor-pointer flex items-center justify-between gap-2.5 ${
              selectedGame === 'obby'
                ? 'bg-gradient-to-r from-sky-500/20 via-blue-600/15 to-slate-900 border-sky-400 shadow-lg'
                : 'bg-slate-900/80 hover:bg-slate-800/80 border-slate-800 text-slate-300'
            }`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-400 to-blue-700 flex items-center justify-center text-xl shrink-0 shadow-md border border-sky-300/40">
                🏃
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-black text-xs sm:text-sm text-white truncate">
                    Паркур Obby
                  </span>
                  <span className="px-1 py-0.2 rounded bg-sky-500/20 text-sky-300 text-[9px] font-black">
                    97%
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 truncate mt-0.5">
                  Небесные острова и Кубок
                </p>
              </div>
            </div>
            <span
              className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase shrink-0 ${
                selectedGame === 'obby'
                  ? 'bg-sky-400 text-slate-950 shadow'
                  : 'bg-slate-800 text-slate-400'
              }`}
            >
              {selectedGame === 'obby' ? 'Выбрана' : 'Выбрать'}
            </span>
          </button>

          {/* Game 2: The Floor is Lava Survival */}
          <button
            type="button"
            data-testid="game-select-lava_survival"
            onClick={() => handleSelectGame('lava_survival')}
            className={`text-left p-3 rounded-2xl border-2 transition-all cursor-pointer flex items-center justify-between gap-2.5 ${
              selectedGame === 'lava_survival'
                ? 'bg-gradient-to-r from-orange-500/25 via-red-600/20 to-slate-900 border-orange-400 shadow-lg'
                : 'bg-slate-900/80 hover:bg-slate-800/80 border-slate-800 text-slate-300'
            }`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 via-orange-600 to-red-700 flex items-center justify-center text-xl shrink-0 shadow-md border border-orange-300/40">
                🌋
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-black text-xs sm:text-sm text-white truncate">
                    Пол — это Лава
                  </span>
                  <span className="px-1 py-0.2 rounded bg-orange-500/20 text-orange-300 text-[9px] font-black">
                    ЭКШЕН
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 truncate mt-0.5">
                  Крыши, краны и Вертолёт
                </p>
              </div>
            </div>
            <span
              className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase shrink-0 ${
                selectedGame === 'lava_survival'
                  ? 'bg-orange-500 text-slate-950 shadow'
                  : 'bg-slate-800 text-slate-400'
              }`}
            >
              {selectedGame === 'lava_survival' ? 'Выбрана' : 'Выбрать'}
            </span>
          </button>

          {/* Game 3: Bee Swarm Simulator */}
          <button
            type="button"
            data-testid="game-select-bee_swarm"
            onClick={() => handleSelectGame('bee_swarm')}
            className={`text-left p-3 rounded-2xl border-2 transition-all cursor-pointer flex items-center justify-between gap-2.5 ${
              selectedGame === 'bee_swarm'
                ? 'bg-gradient-to-r from-amber-500/25 via-yellow-600/20 to-slate-900 border-yellow-400 shadow-lg'
                : 'bg-slate-900/80 hover:bg-slate-800/80 border-slate-800 text-slate-300'
            }`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 via-yellow-500 to-amber-700 flex items-center justify-center text-xl shrink-0 shadow-md border border-amber-300/40">
                🐝
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-black text-xs sm:text-sm text-white truncate">
                    Bee Farm (Ферма)
                  </span>
                  <span className="px-1 py-0.2 rounded bg-yellow-500/20 text-yellow-300 text-[9px] font-black">
                    СИМУЛЯТОР
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 truncate mt-0.5">
                  Рой пчёл, пыльца и Улей
                </p>
              </div>
            </div>
            <span
              className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase shrink-0 ${
                selectedGame === 'bee_swarm'
                  ? 'bg-yellow-400 text-slate-950 shadow'
                  : 'bg-slate-800 text-slate-400'
              }`}
            >
              {selectedGame === 'bee_swarm' ? 'Выбрана' : 'Выбрать'}
            </span>
          </button>

          {/* Game 5: Blox Studio 3D (World Builder) */}
          <button
            type="button"
            data-testid="game-select-studio"
            onClick={() => handleSelectGame('studio')}
            className={`col-span-2 sm:col-span-1 text-left p-3 rounded-2xl border-2 transition-all cursor-pointer flex items-center justify-between gap-2.5 ${
              selectedGame === 'studio'
                ? 'bg-gradient-to-r from-cyan-500/25 via-indigo-600/20 to-slate-900 border-cyan-400 shadow-[0_0_20px_rgba(34,211,238,0.28)]'
                : 'bg-slate-900/80 hover:bg-slate-800/80 border-slate-800 text-slate-300'
            }`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 via-sky-600 to-indigo-700 flex items-center justify-center text-xl shrink-0 shadow-md border border-cyan-300/40">
                🛠️
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-black text-xs sm:text-sm text-white truncate">
                    Студия 3D
                  </span>
                  <span className="px-1 py-0.2 rounded bg-cyan-500/25 text-cyan-300 text-[9px] font-black">
                    РЕДАКТОР
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 truncate mt-0.5">
                  Строй карты и тестируй!
                </p>
              </div>
            </div>
            <span
              className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase shrink-0 ${
                selectedGame === 'studio'
                  ? 'bg-cyan-400 text-slate-950 shadow'
                  : 'bg-slate-800 text-slate-400'
              }`}
            >
              {selectedGame === 'studio' ? 'Выбрана' : 'Выбрать'}
            </span>
          </button>
        </div>

        {/* ROBLOX FEATURED EXPERIENCE CARD & MULTIPLAYER CONTROLS (Play CTA first on Phone!) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 sm:gap-6 bg-slate-900/95 border border-slate-800 rounded-3xl p-3.5 sm:p-6 shadow-2xl">
          {/* Left Column (7 cols on Desktop, below Play CTA on Mobile): Selected Game Details & Thumbnail */}
          <div className="lg:col-span-7 order-2 lg:order-1 flex flex-col justify-between gap-3 sm:gap-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span
                  className={`px-2.5 py-0.5 rounded-md border text-[11px] font-extrabold uppercase tracking-wider ${
                    selectedGame === 'doors'
                      ? 'bg-rose-500/20 border-rose-500/40 text-rose-300'
                      : selectedGame === 'bee_swarm'
                      ? 'bg-yellow-500/20 border-yellow-500/40 text-yellow-300'
                      : selectedGame === 'lava_survival'
                      ? 'bg-orange-500/20 border-orange-500/40 text-orange-300'
                      : selectedGame === 'studio'
                      ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300'
                      : 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                  }`}
                >
                  {selectedGame === 'doors'
                    ? 'ХОРРОР ОТ 1-ГО ЛИЦА (POV)'
                    : selectedGame === 'bee_swarm'
                    ? 'Симулятор Пасеки'
                    : selectedGame === 'lava_survival'
                    ? 'Выживание в Лаве'
                    : selectedGame === 'studio'
                    ? 'КОНСТРУКТОР МИРОВ 3D'
                    : 'Паркур Obby'}
                </span>
                <span className="text-xs text-slate-400 font-semibold">
                  {selectedGame === 'doors'
                    ? 'Отель DOORS · Дверь 100 · Фигура и Лифт'
                    : selectedGame === 'bee_swarm'
                    ? 'Пасека и Пчёлы (НЕ паркур!)'
                    : selectedGame === 'lava_survival'
                    ? 'Экшен и Джетпак'
                    : selectedGame === 'studio'
                    ? 'База 240×240 · Сетка · Мгновенный Тест'
                    : 'Просторный Паркур Obby'}
                </span>
              </div>
              <div className="flex items-center gap-3 text-xs font-bold text-slate-300">
                {feedbackSummary.ratedCount > 0 && (
                  <button
                    type="button"
                    onClick={onOpenFeedback}
                    title="Общая оценка игры по отзывам — нажмите, чтобы открыть отзывы"
                    className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-400/40 text-amber-300 cursor-pointer transition-colors"
                  >
                    <Star size={12} className="fill-amber-400 text-amber-400" />
                    <span>{feedbackSummary.averageRating.toFixed(1)}</span>
                    <span className="text-amber-200/70 text-[10px]">({feedbackSummary.ratedCount})</span>
                  </button>
                )}
                <span className="flex items-center gap-1 text-emerald-400">
                  <ThumbsUp size={13} /> {selectedGame === 'doors' || selectedGame === 'lava_survival' || selectedGame === 'studio' ? '99%' : '97%'}
                </span>
                <span className="flex items-center gap-1 text-sky-400">
                  <Users size={13} /> {onlineCount} играют
                </span>
              </div>
            </div>

            {/* Illustrated Game Thumbnail Banner */}
            <div className="relative w-full h-44 sm:h-56 rounded-2xl overflow-hidden border-2 border-slate-700/80 bg-slate-950 shadow-inner flex items-center justify-center">
              {selectedGame === 'doors' ? (
                /* DOORS Hotel Horror POV SVG Artwork */
                <svg viewBox="0 0 600 260" className="w-full h-full object-cover">
                  <defs>
                    <linearGradient id="doorsHall" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="#09050b" />
                      <stop offset="50%" stopColor="#1c0d18" />
                      <stop offset="100%" stopColor="#2a1215" />
                    </linearGradient>
                  </defs>
                  <rect width="600" height="260" fill="url(#doorsHall)" />
                  {/* Perspective Corridor Lines */}
                  <polygon points="0,0 210,65 210,195 0,260" fill="#23120e" stroke="#3e2017" strokeWidth="2" />
                  <polygon points="600,0 390,65 390,195 600,260" fill="#23120e" stroke="#3e2017" strokeWidth="2" />
                  {/* Red Velvet Carpet */}
                  <polygon points="150,260 245,195 355,195 450,260" fill="#7f1d1d" stroke="#b45309" strokeWidth="3" />
                  {/* Massive Numbered Wooden Door 0100 in Center */}
                  <rect x="245" y="65" width="110" height="130" rx="4" fill="#451a03" stroke="#78350f" strokeWidth="4" />
                  <rect x="275" y="80" width="50" height="20" rx="3" fill="#f59e0b" stroke="#fef08a" strokeWidth="1.5" />
                  <text x="300" y="95" fontSize="13" fontWeight="bold" fill="#1c1917" textAnchor="middle">0100</text>
                  <circle cx="340" cy="135" r="5" fill="#fbbf24" />
                  {/* Glowing Purple Eyes on Left Wall */}
                  <circle cx="105" cy="115" r="14" fill="#9333ea" fillOpacity="0.45" />
                  <circle cx="100" cy="112" r="4" fill="#e879f9" />
                  <circle cx="114" cy="118" r="3.5" fill="#e879f9" />
                  <circle cx="98" cy="123" r="3" fill="#ffffff" />
                  {/* Figure Silhouette & Flickering Chandelier */}
                  <circle cx="300" cy="34" r="18" fill="#fbbf24" fillOpacity="0.3" />
                  <line x1="300" y1="0" x2="300" y2="28" stroke="#d97706" strokeWidth="4" />
                  <circle cx="300" cy="32" r="7" fill="#fef08a" />
                  {/* Screech in Top Right Corner */}
                  <circle cx="490" cy="85" r="16" fill="#09090b" stroke="#ef4444" strokeWidth="2" />
                  <circle cx="484" cy="82" r="3" fill="#ffffff" />
                  <circle cx="496" cy="82" r="3" fill="#ffffff" />
                </svg>
              ) : selectedGame === 'obby' ? (
                /* Obby SVG Artwork */
                <svg viewBox="0 0 600 260" className="w-full h-full object-cover">
                  <defs>
                    <linearGradient id="skyGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="#0284c7" />
                      <stop offset="100%" stopColor="#0f172a" />
                    </linearGradient>
                    <linearGradient id="platGreen" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#4ade80" />
                      <stop offset="100%" stopColor="#16a34a" />
                    </linearGradient>
                    <linearGradient id="platRed" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#f87171" />
                      <stop offset="100%" stopColor="#dc2626" />
                    </linearGradient>
                    <linearGradient id="platGold" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#fde047" />
                      <stop offset="100%" stopColor="#ca8a04" />
                    </linearGradient>
                  </defs>

                  <rect width="600" height="260" fill="url(#skyGrad)" />

                  {/* Floating Obby Platforms in Perspective */}
                  <polygon points="30,200 150,180 180,205 60,225" fill="url(#platGreen)" stroke="#14532d" strokeWidth="3" />
                  <polygon points="185,165 280,145 305,168 210,188" fill="#38bdf8" stroke="#0369a1" strokeWidth="3" />
                  <polygon points="315,135 410,115 435,135 340,155" fill="url(#platRed)" stroke="#7f1d1d" strokeWidth="3" />
                  <polygon points="445,95 565,75 585,98 465,118" fill="url(#platGold)" stroke="#854d0e" strokeWidth="3" />

                  {/* Jumping Character */}
                  <g transform="translate(235, 92) rotate(-10)">
                    <rect x="-12" y="34" width="10" height="22" rx="2" fill="#22c55e" />
                    <rect x="2" y="28" width="10" height="22" rx="2" fill="#22c55e" transform="rotate(-25)" />
                    <rect x="-14" y="6" width="28" height="28" rx="3" fill="#2563eb" />
                    <rect x="-24" y="4" width="9" height="24" rx="2" fill="#facc15" transform="rotate(35)" />
                    <rect x="15" y="-6" width="9" height="24" rx="2" fill="#facc15" transform="rotate(-40)" />
                    <rect x="-11" y="-18" width="22" height="22" rx="5" fill="#facc15" />
                    <circle cx="-4" cy="-9" r="2" fill="#0f172a" />
                    <circle cx="5" cy="-9" r="2" fill="#0f172a" />
                  </g>

                  {/* Trophy at Summit */}
                  <circle cx="515" cy="52" r="18" fill="#fef08a" fillOpacity="0.25" />
                  <polygon points="515,32 521,45 535,47 525,56 527,70 515,63 503,70 505,56 495,47 509,45" fill="#facc15" stroke="#ca8a04" strokeWidth="2" />
                </svg>
              ) : selectedGame === 'bee_swarm' ? (
                /* Bee Swarm Simulator SVG Artwork */
                <svg viewBox="0 0 600 260" className="w-full h-full object-cover">
                  <defs>
                    <linearGradient id="beeSky" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="#fef08a" />
                      <stop offset="100%" stopColor="#84cc16" />
                    </linearGradient>
                  </defs>
                  <rect width="600" height="260" fill="url(#beeSky)" />
                  <polygon points="300,50 350,80 350,140 300,170 250,140 250,80" fill="#f59e0b" stroke="#d97706" strokeWidth="4" />
                  <circle cx="300" cy="110" r="26" fill="#1e293b" />
                  <circle cx="150" cy="190" r="18" fill="#38bdf8" />
                  <circle cx="450" cy="200" r="18" fill="#ef4444" />
                </svg>
              ) : selectedGame === 'studio' ? (
                /* Blox Studio 3D SVG Artwork */
                <svg viewBox="0 0 600 260" className="w-full h-full object-cover">
                  <defs>
                    <linearGradient id="studioSky" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#0f172a" />
                      <stop offset="55%" stopColor="#0c4a6e" />
                      <stop offset="100%" stopColor="#1e1b4b" />
                    </linearGradient>
                    <linearGradient id="studioCubeTop" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#38bdf8" />
                      <stop offset="100%" stopColor="#0284c7" />
                    </linearGradient>
                  </defs>
                  <rect width="600" height="260" fill="url(#studioSky)" />
                  {/* Isometric Studio Baseplate Grid */}
                  <polygon points="80,190 300,120 520,190 300,255" fill="#1e293b" stroke="#38bdf8" strokeWidth="2.5" />
                  <line x1="190" y1="155" x2="410" y2="222" stroke="#334155" strokeWidth="1.5" />
                  <line x1="410" y1="155" x2="190" y2="222" stroke="#334155" strokeWidth="1.5" />
                  <line x1="135" y1="173" x2="355" y2="238" stroke="#334155" strokeWidth="1.5" />
                  <line x1="245" y1="138" x2="465" y2="205" stroke="#334155" strokeWidth="1.5" />
                  {/* Placed Studio Blocks */}
                  <polygon points="150,155 190,140 230,155 190,170" fill="#22c55e" stroke="#bbf7d0" strokeWidth="1.5" />
                  <polygon points="150,155 190,170 190,190 150,175" fill="#15803d" />
                  <polygon points="230,155 190,170 190,190 230,175" fill="#166534" />
                  {/* Lava Strip */}
                  <polygon points="250,172 310,152 350,165 290,185" fill="#ef4444" stroke="#fca5a5" strokeWidth="1.5" />
                  {/* Glowing Wireframe Preview Cube + Axis Gizmo */}
                  <polygon points="295,70 355,48 415,70 355,92" fill="url(#studioCubeTop)" fillOpacity="0.85" stroke="#7dd3fc" strokeWidth="2.5" />
                  <polygon points="295,70 355,92 355,148 295,126" fill="#0369a1" fillOpacity="0.8" stroke="#38bdf8" strokeWidth="2" />
                  <polygon points="415,70 355,92 355,148 415,126" fill="#075985" fillOpacity="0.8" stroke="#38bdf8" strokeWidth="2" />
                  {/* XYZ Gizmo Arrows */}
                  <line x1="355" y1="70" x2="355" y2="25" stroke="#22c55e" strokeWidth="4" strokeLinecap="round" />
                  <line x1="355" y1="70" x2="405" y2="82" stroke="#ef4444" strokeWidth="4" strokeLinecap="round" />
                  <line x1="355" y1="70" x2="310" y2="85" stroke="#38bdf8" strokeWidth="4" strokeLinecap="round" />
                  {/* Finish Star Platform */}
                  <polygon points="420,120 475,102 525,118 470,136" fill="#facc15" stroke="#fef08a" strokeWidth="2" />
                </svg>
              ) : (
                /* The Floor is Lava SVG Artwork */
                <svg viewBox="0 0 600 260" className="w-full h-full object-cover">
                  <defs>
                    <linearGradient id="lavaSky" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="#450a0a" />
                      <stop offset="60%" stopColor="#7c2d12" />
                      <stop offset="100%" stopColor="#ea580c" />
                    </linearGradient>
                    <linearGradient id="lavaMagma" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#ef4444" />
                      <stop offset="35%" stopColor="#f97316" />
                      <stop offset="70%" stopColor="#eab308" />
                      <stop offset="100%" stopColor="#dc2626" />
                    </linearGradient>
                  </defs>

                  <rect width="600" height="260" fill="url(#lavaSky)" />

                  {/* City Rooftops sticking out of boiling lava */}
                  <rect x="40" y="110" width="110" height="150" fill="#1e293b" stroke="#334155" strokeWidth="3" />
                  <rect x="180" y="90" width="120" height="170" fill="#0f172a" stroke="#475569" strokeWidth="3" />
                  <rect x="330" y="70" width="130" height="190" fill="#1e293b" stroke="#64748b" strokeWidth="3" />
                  <rect x="480" y="45" width="100" height="215" fill="#0f172a" stroke="#cbd5e1" strokeWidth="3" />

                  {/* Yellow Construction Crane */}
                  <line x1="280" y1="90" x2="280" y2="40" stroke="#facc15" strokeWidth="6" />
                  <line x1="240" y1="40" x2="350" y2="40" stroke="#facc15" strokeWidth="6" />

                  {/* Rising Boiling Lava Layer */}
                  <rect x="0" y="200" width="600" height="60" fill="url(#lavaMagma)" />
                  <path d="M 0 200 Q 75 190, 150 200 T 300 200 T 450 200 T 600 200 L 600 260 L 0 260 Z" fill="#fbbf24" fillOpacity="0.6" />

                  {/* Player with Jetpack flying upward escaping lava */}
                  <g transform="translate(380, 80) rotate(-15)">
                    <rect x="-18" y="2" width="8" height="24" rx="2" fill="#0284c7" />
                    <polygon points="-16,26 -12,42 -8,26" fill="#f97316" />
                    <polygon points="-15,26 -12,38 -9,26" fill="#facc15" />
                    <rect x="-8" y="26" width="7" height="16" rx="2" fill="#1e293b" />
                    <rect x="1" y="24" width="7" height="16" rx="2" fill="#1e293b" />
                    <rect x="-10" y="6" width="20" height="20" rx="2" fill="#0284c7" />
                    <rect x="-8" y="-12" width="16" height="16" rx="3" fill="#fed7aa" />
                  </g>

                  <circle cx="530" cy="35" r="14" fill="#fbbf24" fillOpacity="0.4" />
                  <text x="520" y="42" fontSize="20">🚁</text>
                </svg>
              )}

              {/* Overlay Title Badge inside Thumbnail */}
              <div className="absolute inset-x-0 bottom-0 p-3 sm:p-4 bg-gradient-to-t from-slate-950 via-slate-950/80 to-transparent flex items-end justify-between">
                <div>
                  <span className={`px-2 py-0.5 rounded text-white text-[10px] font-black uppercase tracking-wider ${
                    selectedGame === 'doors'
                      ? 'bg-rose-700'
                      : selectedGame === 'bee_swarm'
                      ? 'bg-yellow-600'
                      : selectedGame === 'lava_survival'
                      ? 'bg-orange-600'
                      : selectedGame === 'studio'
                      ? 'bg-cyan-600'
                      : 'bg-red-600'
                  }`}>
                    {selectedGame === 'doors'
                      ? 'ВИД ОТ 1-ГО ЛИЦА (POV) · ХОРРОР ОТЕЛЬ'
                      : selectedGame === 'bee_swarm'
                      ? 'СИМУЛЯТОР ПАСЕКИ (НЕ ПАРКУР)'
                      : selectedGame === 'lava_survival'
                      ? 'ВЫЖИВАНИЕ BLOX'
                      : selectedGame === 'studio'
                      ? 'КОНСТРУКТОР МИРОВ 3D'
                      : 'ХИТ BLOX'}
                  </span>
                  <h2 className="text-xl sm:text-2xl font-black text-white drop-shadow mt-0.5">
                    {selectedGame === 'doors'
                      ? 'DOORS: Отель Ужасов [POV]'
                      : selectedGame === 'bee_swarm'
                      ? 'Bee Farm Simulator 3D'
                      : selectedGame === 'lava_survival'
                      ? 'Пол — это Лава! Выживание 3D'
                      : selectedGame === 'studio'
                      ? 'Blox Студия 3D'
                      : 'Паркур: Blox Obby 3D'}
                  </h2>
                </div>
                <span className="text-xs font-bold text-amber-300 bg-slate-900/90 border border-amber-400/40 px-2.5 py-1 rounded-lg">
                  {selectedGame === 'doors'
                    ? 'Раш · Глаза · Скрич · Дверь 100 Фигура и Лифт'
                    : selectedGame === 'bee_swarm'
                    ? 'Зелёная Поляна · 4 Поля · Рой Пчёл · Улей'
                    : selectedGame === 'lava_survival'
                    ? 'Кипящая Лава · Джетпак · Вертолёт'
                    : selectedGame === 'studio'
                    ? '240×240 База · Блоки · Лава · Тест'
                    : 'Просторные Острова · 6 Этапов · Кубок'}
                </span>
              </div>
            </div>

            {/* Game Description */}
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              {selectedGame === 'doors' ? (
                <>
                  Напряжённый хоррор <strong className="text-amber-300">от первого лица (POV) в стиле Roblox DOORS</strong>! Шагайте по старинным коридорам со скрипящими половицами, распахивайте массивные двери с золотыми номерами <strong className="text-white">[E]</strong>. Когда дико мерцает свет — прячьтесь в шкаф от грохочущего <strong className="text-rose-400">Раша (Rush)</strong>, отводите взгляд от <strong className="text-purple-400">Глаз (Eyes)</strong>, прогоняйте фонариком <strong className="text-amber-300">Скрича [F]</strong>, а за <strong className="text-amber-400">Дверью 100</strong> прокрадитесь на 2-й этаж мимо слепой <strong className="text-red-400">Фигуры [C]</strong> и закройте створки грузового лифта!
                </>
              ) : selectedGame === 'bee_swarm' ? (
                <>
                  Настоящий <strong className="text-amber-300">Симулятор Пасеки и Фермы (НЕ паркур!)</strong>: просторная зеленая поляна 130х130 stud с забором и деревьями, 4 цветочных поля (Подсолнухи, Клевер, Розы, Одуванчики), летающие пчёлы-питомцы с трепещущими крыльями, совок для пыльцы и Золотая Платформа в Улье для переработки пыльцы в Мёд! Никаких пропастей, лавы и паркура. 🐝🍯
                </>
              ) : selectedGame === 'lava_survival' ? (
                <>
                  Внизу поднимается смертоносное кипящее море лавы! Прыгайте по крышам небоскрёбов, балансируйте на балках башенного крана, активируйте <strong className="text-amber-300">Рюкзак [B]</strong>, чтобы взлететь на Джетпаке или выпить Bloxy Cola, и спаситесь на вертолётной площадке!
                </>
              ) : selectedGame === 'studio' ? (
                <>
                  Полноценный 3D-конструктор <strong className="text-cyan-300">Blox Студия 3D</strong>! Стройте собственные уровни на просторной базе <strong className="text-white">240×240</strong>: ставьте блоки, рампы, трамплины, лазер-вертушки, лаву, чекпоинты, монеты и Кубок Победы, меняйте материалы и небо, экспортируйте в JSON и нажимайте <strong className="text-emerald-400">«Тест»</strong>, чтобы сразу пробежать свою карту!
                </>
              ) : (
                <>
                  Пройдите просторный и зрелищный <strong className="text-white">Паркур Obby</strong> до Золотого Кубка! Широкие стартовые и небесные площади, большой каньон с лавой, просторные переправы, вращающиеся лазеры, Секретный Оазис и <strong className="text-amber-300">Рюкзак Roblox [B]</strong> со Speed/Gravity койлами.
                </>
              )}
            </p>
          </div>

          {/* Right Column (5 cols on Desktop, First / Above-the-Fold on Mobile): Multiplayer Mode Selector + Play CTA */}
          <div className="lg:col-span-5 order-1 lg:order-2 flex flex-col justify-between bg-slate-950/90 border border-slate-800 rounded-2xl p-3.5 sm:p-5 gap-3 sm:gap-4">
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold uppercase tracking-wider text-slate-400">
                  Режим игры (Сеть / Локалка)
                </span>
                <span className="text-[11px] font-bold text-emerald-400">Выбирай сам!</span>
              </div>

              {/* Option 1: Online Public Server */}
              <button
                type="button"
                onClick={() => handleSelectMode('online')}
                className={`w-full text-left p-3 rounded-xl border-2 transition-all cursor-pointer flex items-start gap-3 ${
                  sessionConfig.mode === 'online'
                    ? 'bg-sky-500/15 border-sky-400 text-white shadow-md'
                    : 'bg-slate-900/80 hover:bg-slate-800/80 border-slate-800 text-slate-300'
                }`}
              >
                <div className="p-2 rounded-lg bg-sky-500/20 text-sky-400 shrink-0 mt-0.5">
                  <Globe size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-sm">По сети (Онлайн сервер)</span>
                    {sessionConfig.mode === 'online' && (
                      <span className="text-[10px] font-extrabold px-2 py-0.5 rounded bg-sky-400 text-slate-950">
                        ВЫБРАНО
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Общий сервер в реальном времени (видно всех игроков и постройки).
                  </p>
                </div>
              </button>

              {/* Option 2: LAN Room by Code */}
              <div
                onClick={() => handleSelectMode('lan_room')}
                className={`w-full p-3 rounded-xl border-2 transition-all cursor-pointer flex flex-col gap-2.5 ${
                  sessionConfig.mode === 'lan_room'
                    ? 'bg-amber-500/15 border-amber-400 text-white shadow-md'
                    : 'bg-slate-900/80 hover:bg-slate-800/80 border-slate-800 text-slate-300'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-amber-500/20 text-amber-400 shrink-0 mt-0.5">
                    <Wifi size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-sm">По локалке (Код комнаты)</span>
                      {sessionConfig.mode === 'lan_room' && (
                        <span className="text-[10px] font-extrabold px-2 py-0.5 rounded bg-amber-400 text-slate-950">
                          ВЫБРАНО
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Играйте с другом по одной сети Wi-Fi или в соседних вкладках по коду комнаты.
                    </p>
                  </div>
                </div>

                {sessionConfig.mode === 'lan_room' && (
                  <div
                    className="flex flex-col gap-2 pt-1.5 border-t border-slate-800"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={roomCodeInput}
                        onChange={(e) => handleRoomCodeChange(e.target.value)}
                        onBlur={() => commitRoomCode()}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            commitRoomCode();
                          }
                        }}
                        maxLength={12}
                        className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold text-amber-300 uppercase tracking-widest focus:outline-none focus:border-amber-400"
                        placeholder="НАПР. OBBY777"
                      />
                      <button
                        type="button"
                        onClick={() => commitRoomCode()}
                        title="Применить код комнаты"
                        className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black cursor-pointer"
                      >
                        OK
                      </button>
                      <button
                        type="button"
                        onClick={handleGenerateRandomCode}
                        className="px-2 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold cursor-pointer"
                      >
                        🎲
                      </button>
                      <button
                        type="button"
                        onClick={handleCopyCode}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 cursor-pointer"
                        title="Скопировать код"
                      >
                        {copiedCode ? <Check size={15} /> : <Copy size={15} />}
                      </button>
                    </div>
                    {onOpenRoomCode && (
                      <button
                        type="button"
                        onClick={onOpenRoomCode}
                        className="w-full py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/50 text-amber-200 text-[11px] font-black flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                      >
                        <KeyRound size={13} />
                        <span>Открыть отдельный интерфейс кода</span>
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Option 3: Local 2 Players on 1 Device (Split-Screen) */}
              <button
                type="button"
                onClick={() => handleSelectMode('local_coop')}
                className={`w-full text-left p-3 rounded-xl border-2 transition-all cursor-pointer flex items-start gap-3 ${
                  sessionConfig.mode === 'local_coop'
                    ? 'bg-emerald-500/15 border-emerald-400 text-white shadow-md'
                    : 'bg-slate-900/80 hover:bg-slate-800/80 border-slate-800 text-slate-300'
                }`}
              >
                <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400 shrink-0 mt-0.5">
                  <Gamepad2 size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-sm">По локалке (Раздельный экран)</span>
                    {sessionConfig.mode === 'local_coop' && (
                      <span className="text-[10px] font-extrabold px-2 py-0.5 rounded bg-emerald-400 text-slate-950">
                        ВЫБРАНО
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Разделение экрана 2 игрока: <strong className="text-slate-200">WASD + Пробел</strong> и <strong className="text-slate-200">Стрелки + Enter</strong>.
                  </p>
                </div>
              </button>
            </div>

            {/* Primary Green Roblox PLAY Button */}
            <button
              data-start="true"
              data-testid="play-game-btn"
              onClick={() => {
                if (sessionConfig.mode === 'lan_room') {
                  const clean =
                    roomCodeInput.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 12) || 'OBBY777';
                  onStartGame({ ...sessionConfig, roomId: clean });
                } else {
                  onStartGame(sessionConfig);
                }
              }}
              className="w-full py-4 rounded-2xl bg-gradient-to-b from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white font-black text-lg sm:text-xl shadow-[0_6px_0_#065f46] hover:shadow-[0_4px_0_#065f46] active:translate-y-1 active:shadow-none transition-all flex items-center justify-center gap-3 cursor-pointer border-2 border-emerald-300/40"
            >
              <Play size={24} className="fill-white" />
              <span>
                {selectedGame === 'doors'
                  ? 'ВОЙТИ В ОТЕЛЬ DOORS [POV]'
                  : selectedGame === 'bee_swarm'
                  ? 'ИГРАТЬ В BEE FARM 3D'
                  : selectedGame === 'lava_survival'
                  ? 'ИГРАТЬ В ВЫЖИВАНИЕ В ЛАВЕ'
                  : selectedGame === 'studio'
                  ? 'ОТКРЫТЬ СТУДИЮ 3D'
                  : 'ИГРАТЬ В ПАРКУР OBBY'}
              </span>
            </button>
          </div>
        </div>

        {/* GLOBAL LEADERBOARD (TOP 10 BY COMPLETED LEVELS & TIME) */}
        <LeaderboardPanel
          viewerPlayerKey={viewerPlayerKey}
          viewerSkin={skin}
          refreshTrigger={leaderboardVersion}
          onInspectPlayer={onInspectPlayer}
        />
        </>
        )}
      </div>

      {/* Footer Control Hint Bar (Clean on Mobile) */}
      <footer className="w-full px-3 sm:px-4 py-2.5 flex flex-wrap items-center justify-center sm:justify-between gap-2 text-xs text-slate-400 border-t border-slate-900 bg-slate-950/90 shrink-0">
        <span className="hidden sm:inline flex-1 text-left">
          WASD / Джойстик Бег · Пробел Прыжок · 🎒 [B] Рюкзак Blox · 1-7 Предметы · F Полный экран
        </span>
        <div className="flex items-center gap-2">
          {!isFileProtocol() && (
            <button
              onClick={handleDownloadStandaloneHtml}
              title="Скачать игру в одном HTML-файле с приглашением в текущую комнату"
              className="min-h-[38px] flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 font-bold transition-colors cursor-pointer"
            >
              <Download size={14} />
              <span>Скачать HTML</span>
            </button>
          )}
          <button
            onClick={onOpenFeedback}
            className="min-h-[38px] flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-blue-400 font-bold transition-colors cursor-pointer"
          >
            <MessageSquare size={14} />
            <span>Отзыв</span>
            {feedbackSummary.ratedCount > 0 ? (
              <span className="ml-0.5 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px] font-black">
                <Star size={10} className="fill-amber-400 text-amber-400" />
                {feedbackSummary.averageRating.toFixed(1)} ({feedbackSummary.ratedCount})
              </span>
            ) : feedbackSummary.totalLetters > 0 ? (
              <span className="ml-0.5 px-1.5 py-0.5 rounded bg-slate-700 text-slate-200 text-[10px] font-black">
                {feedbackSummary.totalLetters}
              </span>
            ) : null}
          </button>
        </div>
      </footer>

      {/* MOBILE BOTTOM THUMB NAVIGATION BAR (< md) */}
      <nav
        aria-label="Мобильная навигация"
        className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-slate-900/95 backdrop-blur-xl border-t border-slate-800 px-1 pb-safe shadow-[0_-8px_30px_rgba(0,0,0,0.6)]"
      >
        <div className="grid grid-cols-5 items-center h-15">
          <button
            type="button"
            onClick={() => setActiveTab('games')}
            className={`min-h-[52px] flex flex-col items-center justify-center gap-0.5 cursor-pointer transition-colors ${
              activeTab === 'games' ? 'text-red-400' : 'text-slate-400'
            }`}
          >
            <Compass size={20} />
            <span className="text-[10px] font-bold">Игры</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('friends')}
            className={`relative min-h-[52px] flex flex-col items-center justify-center gap-0.5 cursor-pointer transition-colors ${
              activeTab === 'friends' ? 'text-red-400' : 'text-slate-400'
            }`}
          >
            <Users size={20} />
            <span className="text-[10px] font-bold">Друзья</span>
            {friends.filter((f) => f.status !== 'offline').length > 0 && (
              <span className="absolute top-2 right-3 min-w-[15px] h-[15px] px-1 rounded-full bg-emerald-500 text-slate-950 text-[9px] font-black flex items-center justify-center">
                {friends.filter((f) => f.status !== 'offline').length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('servers')}
            className={`min-h-[52px] flex flex-col items-center justify-center gap-0.5 cursor-pointer transition-colors ${
              activeTab === 'servers' ? 'text-amber-400' : 'text-slate-400'
            }`}
          >
            <KeyRound size={20} />
            <span className="text-[10px] font-bold">Комнаты</span>
          </button>

          <button
            type="button"
            onClick={onOpenShop}
            className="min-h-[52px] flex flex-col items-center justify-center gap-0.5 text-amber-300 cursor-pointer"
          >
            <ShoppingBag size={20} />
            <span className="text-[10px] font-bold">Магазин</span>
          </button>

          <button
            type="button"
            onClick={onOpenCustomizer}
            className="min-h-[52px] flex flex-col items-center justify-center gap-0.5 text-slate-300 cursor-pointer"
          >
            <Backpack size={20} />
            <span className="text-[10px] font-bold">Скин</span>
          </button>
        </div>
      </nav>
    </div>
  );
};
