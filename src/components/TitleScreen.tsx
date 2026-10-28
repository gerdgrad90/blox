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
} from 'lucide-react';
import { CharacterSkin, GameId, MultiplayerMode, MultiplayerSessionConfig } from '../game/types';

interface TitleScreenProps {
  onStartGame: (config: MultiplayerSessionConfig) => void;
  onOpenCustomizer: () => void;
  skin: CharacterSkin;
  onChangeSkin?: (skin: CharacterSkin) => void;
  isMuted: boolean;
  onToggleMute: () => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  sessionConfig: MultiplayerSessionConfig;
  onChangeSessionConfig: (config: MultiplayerSessionConfig) => void;
  onlineCount: number;
  isConnected: boolean;
  onOpenFeedback: () => void;
}

export const TitleScreen: React.FC<TitleScreenProps> = ({
  onStartGame,
  onOpenCustomizer,
  skin,
  onChangeSkin,
  isMuted,
  onToggleMute,
  isFullscreen,
  onToggleFullscreen,
  sessionConfig,
  onChangeSessionConfig,
  onlineCount,
  isConnected,
  onOpenFeedback,
}) => {
  const [activeTab, setActiveTab] = useState<'games' | 'servers'>('games');
  const [roomCodeInput, setRoomCodeInput] = useState(
    sessionConfig.mode === 'lan_room' ? sessionConfig.roomId : 'OBBY777'
  );
  const [copiedCode, setCopiedCode] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(skin.name);

  // Keep nameInput in sync when skin changes
  useEffect(() => {
    setNameInput(skin.name);
  }, [skin.name]);

  const handleSaveNickname = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const clean = nameInput.trim().slice(0, 16);
    if (clean) {
      onChangeSkin?.({ ...skin, name: clean });
    }
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
    onChangeSkin?.({ ...skin, name: newName });
  };

  const selectedGame: GameId = sessionConfig.gameId || 'obby';

  const handleSelectGame = (gameId: GameId) => {
    onChangeSessionConfig({
      ...sessionConfig,
      gameId,
      roomId:
        sessionConfig.mode === 'online'
          ? gameId === 'lava_survival'
            ? 'public_lava'
            : 'public_obby'
          : sessionConfig.roomId,
    });
  };

  // Listen for Enter or Space to start immediately (unless typing in room code input)
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.code === 'Enter' || e.code === 'Space') {
        e.preventDefault();
        onStartGame(sessionConfig);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onStartGame, sessionConfig]);

  const handleSelectMode = (mode: MultiplayerMode) => {
    if (mode === 'online') {
      onChangeSessionConfig({
        mode: 'online',
        gameId: selectedGame,
        roomId: selectedGame === 'lava_survival' ? 'public_lava' : 'public_obby',
      });
    } else if (mode === 'lan_room') {
      const clean = roomCodeInput.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '') || 'OBBY777';
      setRoomCodeInput(clean);
      onChangeSessionConfig({ mode: 'lan_room', gameId: selectedGame, roomId: clean });
    } else {
      onChangeSessionConfig({ mode: 'local_coop', gameId: selectedGame, roomId: 'local_coop' });
    }
  };

  const handleRoomCodeChange = (val: string) => {
    const clean = val.toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 12);
    setRoomCodeInput(clean);
    onChangeSessionConfig({
      mode: 'lan_room',
      gameId: selectedGame,
      roomId: clean || 'OBBY777',
    });
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

  return (
    <div className="fixed inset-0 z-30 flex flex-col justify-between pointer-events-auto bg-slate-950/90 text-slate-100 overflow-y-auto">
      {/* ROBLOX-STYLE TOP NAVIGATION BAR */}
      <header className="w-full bg-slate-900/95 border-b border-slate-800 px-3 sm:px-6 py-2.5 flex items-center justify-between gap-3 shrink-0">
        {/* Left: Roblox Tilted Square Emblem + Brand & Nav Pills */}
        <div className="flex items-center gap-3 sm:gap-6">
          <div className="flex items-center gap-2.5">
            <svg viewBox="0 0 44 44" className="w-8 h-8 sm:w-9 sm:h-9 shrink-0">
              <g transform="translate(22, 22) rotate(-14)">
                <rect x="-16" y="-16" width="32" height="32" rx="6" fill="#ef4444" stroke="#ffffff" strokeWidth="2.5" />
                <rect x="-6" y="-6" width="12" height="12" rx="2" fill="#0f172a" />
              </g>
            </svg>
            <div className="flex flex-col">
              <span className="font-black tracking-wider text-base sm:text-lg leading-none text-white">
                BLOX HUB
              </span>
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-1 bg-slate-950/80 p-1 rounded-xl border border-slate-800 text-xs font-bold">
            <button
              onClick={() => setActiveTab('games')}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'games'
                  ? 'bg-red-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Compass size={14} />
              <span>Игры (2)</span>
            </button>
            <button
              onClick={onOpenCustomizer}
              className="px-3 py-1.5 rounded-lg text-slate-400 hover:text-white transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Backpack size={14} />
              <span>Аватар & Рюкзак</span>
            </button>
            <button
              onClick={() => setActiveTab('servers')}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'servers'
                  ? 'bg-red-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Server size={14} />
              <span>Мультиплеер</span>
            </button>
          </nav>
        </div>

        {/* Right: User Profile Chip + Utility Controls */}
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={onOpenCustomizer}
            className="flex items-center gap-2 bg-slate-800/90 hover:bg-slate-700/90 border border-slate-700 px-2.5 py-1.5 rounded-xl cursor-pointer transition-all"
            title="Настроить скин и рюкзак"
          >
            <div
              className="w-6 h-6 rounded-md border border-slate-600 shrink-0 shadow-sm overflow-hidden"
              style={{ backgroundColor: skin.torsoColor }}
            >
              <div
                className="w-full h-2.5"
                style={{ backgroundColor: skin.skinColor }}
              />
            </div>
            <span className="text-xs font-bold text-white max-w-[90px] sm:max-w-[130px] truncate">
              {skin.name}
            </span>
          </button>

          <div
            className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-semibold border ${
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

          <button
            onClick={onToggleFullscreen}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white cursor-pointer transition-all"
            title={isFullscreen ? 'Выйти из полноэкранного режима (F)' : 'Полный экран (F)'}
          >
            {isFullscreen ? <Minimize size={17} /> : <Maximize size={17} />}
          </button>

          <button
            onClick={onToggleMute}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white cursor-pointer transition-all"
            title={isMuted ? 'Включить звук' : 'Выключить звук'}
          >
            {isMuted ? <VolumeX size={17} /> : <Volume2 size={17} />}
          </button>
        </div>
      </header>

      {/* MAIN HERO & GAME DISCOVERY AREA */}
      <div className="flex-1 w-full max-w-6xl mx-auto px-4 py-4 sm:py-6 flex flex-col justify-center">
        {/* User Welcome Banner with Equipped Backpack */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gradient-to-r from-slate-900/90 via-slate-900/60 to-slate-950/90 border border-slate-800 rounded-2xl p-3.5 sm:p-4 mb-4 shadow-lg backdrop-blur">
          <div className="flex items-center gap-3">
            <div
              onClick={onOpenCustomizer}
              className="w-12 h-12 rounded-xl border-2 border-red-500/60 shadow-md flex items-center justify-center cursor-pointer shrink-0 hover:scale-105 transition-all overflow-hidden relative group"
              title="Нажмите, чтобы настроить скин или рюкзак"
            >
              <img
                src="/assets/aistudio/Screenshot_20261028_015816_Roblox_5e6c4b58.jpg"
                alt="Мой скин Roblox"
                className="w-full h-full object-cover group-hover:scale-110 transition-transform"
                onError={(e) => {
                  (e.currentTarget as HTMLElement).style.display = 'none';
                }}
              />
            </div>
            <div className="flex flex-col">
              {isEditingName ? (
                <form onSubmit={handleSaveNickname} className="flex items-center gap-1.5 flex-wrap my-0.5">
                  <input
                    type="text"
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value.slice(0, 16))}
                    placeholder="Введите никнейм..."
                    maxLength={16}
                    autoFocus
                    className="px-3 py-1 rounded-xl bg-slate-950 border-2 border-amber-400 text-white font-black text-sm outline-none w-44"
                  />
                  <button
                    type="submit"
                    className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1 cursor-pointer transition-colors shadow-md"
                  >
                    <Check size={14} /> <span>OK</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleRandomizeTitleName}
                    title="Случайный никнейм"
                    className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-600 cursor-pointer transition-colors"
                  >
                    <Dices size={15} />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditingName(false);
                      setNameInput(skin.name);
                    }}
                    title="Отмена"
                    className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white border border-slate-600 cursor-pointer transition-colors"
                  >
                    <X size={15} />
                  </button>
                </form>
              ) : (
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-lg sm:text-2xl font-black text-white leading-tight">
                    Привет, {skin.name}! 👋
                  </h1>
                  <button
                    onClick={() => {
                      setIsEditingName(true);
                      setNameInput(skin.name);
                    }}
                    title="Сменить никнейм"
                    className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 text-[11px] font-bold text-amber-300 hover:text-white cursor-pointer transition-colors shadow-sm"
                  >
                    <Edit3 size={11} />
                    <span>Сменить ник</span>
                  </button>
                  <span className="px-2 py-0.5 rounded-md bg-amber-500/20 border border-amber-400/50 text-amber-300 text-[10px] font-black uppercase flex items-center gap-1">
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
              )}
              <p className="text-xs text-slate-400">
                Доступно режимов: <span className="text-slate-200 font-bold">2 Игры (Паркур Obby & Пол — это Лава!)</span> · Рюкзак инвентаря в игре по кнопке <span className="text-amber-300 font-bold">[B]</span>
              </p>
            </div>
          </div>

          <button
            onClick={onOpenCustomizer}
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-xs sm:text-sm font-bold text-amber-300 flex items-center gap-2 cursor-pointer transition-all self-start sm:self-auto"
          >
            <Sparkles size={16} />
            <span>Мой Скин / Рюкзак</span>
          </button>
        </div>

        {/* 2 PLAYABLE GAMES SELECTOR TABS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
          {/* Game 1: Parkour Obby */}
          <button
            type="button"
            data-testid="game-select-obby"
            onClick={() => handleSelectGame('obby')}
            className={`text-left p-3.5 rounded-2xl border-2 transition-all cursor-pointer flex items-center justify-between gap-3 ${
              selectedGame === 'obby'
                ? 'bg-gradient-to-r from-sky-500/20 via-blue-600/15 to-slate-900 border-sky-400 shadow-lg'
                : 'bg-slate-900/80 hover:bg-slate-800/80 border-slate-800 text-slate-300'
            }`}
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-sky-400 to-blue-700 flex items-center justify-center text-2xl shrink-0 shadow-md border border-sky-300/40">
                🏃
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-black text-sm sm:text-base text-white truncate">
                    1. Паркур: Blox Obby 3D
                  </span>
                  <span className="px-1.5 py-0.5 rounded bg-sky-500/20 border border-sky-400/40 text-sky-300 text-[10px] font-black">
                    97% 👍
                  </span>
                </div>
                <p className="text-xs text-slate-400 truncate mt-0.5">
                  Небесные острова, неоновые ступени, вертушки и Золотой Кубок
                </p>
              </div>
            </div>
            <span
              className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase shrink-0 ${
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
            className={`text-left p-3.5 rounded-2xl border-2 transition-all cursor-pointer flex items-center justify-between gap-3 ${
              selectedGame === 'lava_survival'
                ? 'bg-gradient-to-r from-orange-500/25 via-red-600/20 to-slate-900 border-orange-400 shadow-lg'
                : 'bg-slate-900/80 hover:bg-slate-800/80 border-slate-800 text-slate-300'
            }`}
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 via-orange-600 to-red-700 flex items-center justify-center text-2xl shrink-0 shadow-md border border-orange-300/40">
                🌋
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-black text-sm sm:text-base text-white truncate">
                    2. Пол — это Лава! Выживание
                  </span>
                  <span className="px-1.5 py-0.5 rounded bg-orange-500/20 border border-orange-400/40 text-orange-300 text-[10px] font-black flex items-center gap-0.5">
                    <Flame size={10} /> НОВАЯ!
                  </span>
                </div>
                <p className="text-xs text-slate-400 truncate mt-0.5">
                  Кипящее море лавы, крыши небоскрёбов, башенные краны и Вертолёт!
                </p>
              </div>
            </div>
            <span
              className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase shrink-0 ${
                selectedGame === 'lava_survival'
                  ? 'bg-orange-500 text-slate-950 shadow'
                  : 'bg-slate-800 text-slate-400'
              }`}
            >
              {selectedGame === 'lava_survival' ? 'Выбрана' : 'Выбрать'}
            </span>
          </button>
        </div>

        {/* ROBLOX FEATURED EXPERIENCE CARD & MULTIPLAYER CONTROLS */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 bg-slate-900/95 border border-slate-800 rounded-3xl p-4 sm:p-6 shadow-2xl">
          {/* Left Column (7 cols): Selected Game Details & Thumbnail */}
          <div className="lg:col-span-7 flex flex-col justify-between gap-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span
                  className={`px-2.5 py-0.5 rounded-md border text-[11px] font-extrabold uppercase tracking-wider ${
                    selectedGame === 'lava_survival'
                      ? 'bg-orange-500/20 border-orange-500/40 text-orange-300'
                      : 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                  }`}
                >
                  {selectedGame === 'lava_survival' ? 'Игра 2 из 2 · Выживание' : 'Игра 1 из 2 · Паркур'}
                </span>
                <span className="text-xs text-slate-400 font-semibold">
                  {selectedGame === 'lava_survival' ? 'Экшен и Джетпак' : 'Оригинальный Паркур Obby'}
                </span>
              </div>
              <div className="flex items-center gap-3 text-xs font-bold text-slate-300">
                <span className="flex items-center gap-1 text-emerald-400">
                  <ThumbsUp size={13} /> {selectedGame === 'lava_survival' ? '99%' : '97%'}
                </span>
                <span className="flex items-center gap-1 text-sky-400">
                  <Users size={13} /> {onlineCount} играют
                </span>
              </div>
            </div>

            {/* Illustrated Game Thumbnail Banner */}
            <div className="relative w-full h-44 sm:h-56 rounded-2xl overflow-hidden border-2 border-slate-700/80 bg-slate-950 shadow-inner flex items-center justify-center">
              {selectedGame === 'obby' ? (
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
                    {/* Blue & Lime Jetpack with fire */}
                    <rect x="-18" y="2" width="8" height="24" rx="2" fill="#0284c7" />
                    <polygon points="-16,26 -12,42 -8,26" fill="#f97316" />
                    <polygon points="-15,26 -12,38 -9,26" fill="#facc15" />
                    {/* Legs */}
                    <rect x="-8" y="26" width="7" height="16" rx="2" fill="#1e293b" />
                    <rect x="1" y="24" width="7" height="16" rx="2" fill="#1e293b" />
                    {/* Torso */}
                    <rect x="-10" y="6" width="20" height="20" rx="2" fill="#0284c7" />
                    {/* Head */}
                    <rect x="-8" y="-12" width="16" height="16" rx="3" fill="#fed7aa" />
                  </g>

                  {/* Helicopter / Rescue Trophy at top right */}
                  <circle cx="530" cy="35" r="14" fill="#fbbf24" fillOpacity="0.4" />
                  <text x="520" y="42" fontSize="20">🚁</text>
                </svg>
              )}

              {/* Overlay Title Badge inside Thumbnail */}
              <div className="absolute inset-x-0 bottom-0 p-3 sm:p-4 bg-gradient-to-t from-slate-950 via-slate-950/80 to-transparent flex items-end justify-between">
                <div>
                  <span className={`px-2 py-0.5 rounded text-white text-[10px] font-black uppercase tracking-wider ${
                    selectedGame === 'lava_survival' ? 'bg-orange-600' : 'bg-red-600'
                  }`}>
                    {selectedGame === 'lava_survival' ? 'ВЫЖИВАНИЕ BLOX' : 'ХИТ BLOX'}
                  </span>
                  <h2 className="text-xl sm:text-2xl font-black text-white drop-shadow mt-0.5">
                    {selectedGame === 'lava_survival'
                      ? 'Пол — это Лава! Выживание 3D'
                      : 'Паркур: Blox Obby 3D'}
                  </h2>
                </div>
                <span className="text-xs font-bold text-amber-300 bg-slate-900/90 border border-amber-400/40 px-2.5 py-1 rounded-lg">
                  {selectedGame === 'lava_survival'
                    ? 'Кипящая Лава · Джетпак · Вертолёт'
                    : '6 Этапов · Лава · Трамплины'}
                </span>
              </div>
            </div>

            {/* Game Description */}
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              {selectedGame === 'lava_survival' ? (
                <>
                  Внизу поднимается смертоносное кипящее море лавы! Прыгайте по крышам небоскрёбов, балансируйте на балках башенного крана, активируйте <strong className="text-amber-300">Рюкзак [B]</strong>, чтобы взлететь на Джетпаке или выпить Bloxy Cola, и спаситесь на вертолётной площадке!
                </>
              ) : (
                <>
                  Пройдите классический <strong className="text-white">Паркур Obby</strong> до Золотого Кубка! Прыгайте по неоновым блокам, уворачивайтесь от вращающихся лазеров, открывайте <strong className="text-amber-300">Рюкзак Roblox [B]</strong> за Speed/Gravity койлами и стройте мосты вместе с друзьями.
                </>
              )}
            </p>
          </div>

          {/* Right Column (5 cols): Multiplayer Mode Selector + Play CTA */}
          <div className="lg:col-span-5 flex flex-col justify-between bg-slate-950/90 border border-slate-800 rounded-2xl p-4 sm:p-5 gap-4">
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
                    className="flex items-center gap-2 pt-1 border-t border-slate-800"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <input
                      type="text"
                      value={roomCodeInput}
                      onChange={(e) => handleRoomCodeChange(e.target.value)}
                      maxLength={12}
                      className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold text-amber-300 uppercase tracking-widest focus:outline-none focus:border-amber-400"
                      placeholder="НАПР. OBBY777"
                    />
                    <button
                      type="button"
                      onClick={handleGenerateRandomCode}
                      className="px-2 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold cursor-pointer"
                    >
                      🎲 Рандом
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
                )}
              </div>

              {/* Option 3: Local 2 Players on 1 Device */}
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
                    <span className="font-bold text-sm">По локалке (2 Игрока на 1 ПК)</span>
                    {sessionConfig.mode === 'local_coop' && (
                      <span className="text-[10px] font-extrabold px-2 py-0.5 rounded bg-emerald-400 text-slate-950">
                        ВЫБРАНО
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Два игрока сразу: <strong className="text-slate-200">WASD + Пробел</strong> и <strong className="text-slate-200">Стрелки + Enter</strong>.
                  </p>
                </div>
              </button>
            </div>

            {/* Primary Green Roblox PLAY Button */}
            <button
              data-start="true"
              data-testid="play-game-btn"
              onClick={() => onStartGame(sessionConfig)}
              className="w-full py-4 rounded-2xl bg-gradient-to-b from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white font-black text-lg sm:text-xl shadow-[0_6px_0_#065f46] hover:shadow-[0_4px_0_#065f46] active:translate-y-1 active:shadow-none transition-all flex items-center justify-center gap-3 cursor-pointer border-2 border-emerald-300/40"
            >
              <Play size={24} className="fill-white" />
              <span>
                {selectedGame === 'lava_survival'
                  ? 'ИГРАТЬ В ВЫЖИВАНИЕ В ЛАВЕ'
                  : 'ИГРАТЬ В ПАРКУР OBBY'}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Footer Control Hint Bar */}
      <footer className="w-full px-4 py-2.5 flex items-center justify-between text-xs text-slate-400 border-t border-slate-900 bg-slate-950/90 shrink-0">
        <span className="flex-1 text-center sm:text-left">
          WASD / Джойстик Бег · Пробел Прыжок · 🎒 [B] Рюкзак Blox · 1-7 Предметы · F Полный экран
        </span>
        <button
          onClick={onOpenFeedback}
          className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-blue-400 font-bold transition-colors cursor-pointer"
        >
          <MessageSquare size={14} />
          <span>Feedback</span>
        </button>
      </footer>
    </div>
  );
};
