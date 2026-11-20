import React, { useState } from 'react';
import { motion } from 'motion/react';
import {
  KeyRound,
  PlusCircle,
  LogIn,
  Copy,
  Check,
  Dices,
  X,
  ClipboardPaste,
  Wifi,
  Users,
  Sparkles,
  Play,
  History,
  Gamepad2,
  Globe,
} from 'lucide-react';
import { GameId, MultiplayerSessionConfig } from '../game/types';
import { isFileProtocol } from '../game/env';

interface RoomCodePanelProps {
  sessionConfig: MultiplayerSessionConfig;
  onJoinOrCreateRoom: (config: MultiplayerSessionConfig) => void;
  onClose?: () => void;
  embedded?: boolean;
  onlineCount?: number;
  isConnected?: boolean;
}

const RECENT_CODES_KEY = 'blox_recent_room_codes_v1';

interface RecentRoomEntry {
  code: string;
  gameId: GameId;
  usedAt: number;
}

function getRecentRooms(): RecentRoomEntry[] {
  try {
    const raw = localStorage.getItem(RECENT_CODES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.slice(0, 5) : [];
  } catch {
    return [];
  }
}

function saveRecentRoom(code: string, gameId: GameId): RecentRoomEntry[] {
  const prev = getRecentRooms().filter((r) => r.code !== code);
  const next = [{ code, gameId, usedAt: Date.now() }, ...prev].slice(0, 5);
  try {
    localStorage.setItem(RECENT_CODES_KEY, JSON.stringify(next));
  } catch {}
  return next;
}

function generateRoomCode(): string {
  const prefixes = ['BLOX', 'DOORS', 'OBBY', 'LAVA', 'BEE', 'TEAM', 'ROOM'];
  const p = prefixes[Math.floor(Math.random() * prefixes.length)];
  const n = Math.floor(100 + Math.random() * 900);
  return `${p}${n}`;
}

const GAME_OPTIONS: { id: GameId; title: string; icon: string; badge: string }[] = [
  { id: 'doors', title: 'DOORS: Отель [POV]', icon: '🚪', badge: 'Хоррор' },
  { id: 'obby', title: 'Паркур Obby 3D', icon: '🏃', badge: 'Паркур' },
  { id: 'lava_survival', title: 'Пол — это Лава', icon: '🌋', badge: 'Выживание' },
  { id: 'bee_swarm', title: 'Bee Farm 3D', icon: '🐝', badge: 'Ферма' },
  { id: 'studio', title: 'Blox Студия 3D', icon: '🛠️', badge: 'Студия' },
];

export const RoomCodePanel: React.FC<RoomCodePanelProps> = ({
  sessionConfig,
  onJoinOrCreateRoom,
  onClose,
  embedded = false,
  onlineCount = 1,
  isConnected = true,
}) => {
  const [subMode, setSubMode] = useState<'join' | 'create'>('join');
  const [selectedGame, setSelectedGame] = useState<GameId>(sessionConfig.gameId || 'doors');
  const [joinCode, setJoinCode] = useState<string>(
    sessionConfig.mode === 'lan_room' && sessionConfig.roomId ? sessionConfig.roomId : ''
  );
  const [createCode, setCreateCode] = useState<string>(() =>
    sessionConfig.mode === 'lan_room' && sessionConfig.roomId ? sessionConfig.roomId : generateRoomCode()
  );
  const [copied, setCopied] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [recentRooms, setRecentRooms] = useState<RecentRoomEntry[]>(() => getRecentRooms());

  const sanitizeCode = (val: string) =>
    val.toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 12);

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard?.readText();
      if (text) {
        setJoinCode(sanitizeCode(text));
        setErrorMsg(null);
      }
    } catch {
      setErrorMsg('Вставьте код вручную (Ctrl+V)');
    }
  };

  const handleCopyCreateCode = () => {
    const clean = sanitizeCode(createCode) || 'BLOX777';
    navigator.clipboard?.writeText(clean);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const handleLaunchJoin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const clean = sanitizeCode(joinCode);
    if (clean.length < 3) {
      setErrorMsg('Введите код комнаты (минимум 3 символа, например OBBY777)');
      return;
    }
    setErrorMsg(null);

    let resolvedGame: GameId = selectedGame;
    if (!isFileProtocol()) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 1800);
        const res = await fetch(`/api/rooms/lookup/${encodeURIComponent(clean)}`, {
          signal: controller.signal,
        });
        clearTimeout(timeout);
        if (res.ok) {
          const info = await res.json();
          if (
            info?.found &&
            (info.gameId === 'doors' ||
              info.gameId === 'obby' ||
              info.gameId === 'lava_survival' ||
              info.gameId === 'bee_swarm' ||
              info.gameId === 'studio')
          ) {
            resolvedGame = info.gameId;
            setSelectedGame(resolvedGame);
          }
        }
      } catch {
        // Fallback to manually selected game
      }
    }

    setRecentRooms(saveRecentRoom(clean, resolvedGame));
    onJoinOrCreateRoom({
      mode: 'lan_room',
      gameId: resolvedGame,
      roomId: clean,
    });
    onClose?.();
  };

  const handleLaunchCreate = () => {
    const clean = sanitizeCode(createCode) || generateRoomCode();
    setCreateCode(clean);
    setRecentRooms(saveRecentRoom(clean, selectedGame));
    onJoinOrCreateRoom({
      mode: 'lan_room',
      gameId: selectedGame,
      roomId: clean,
    });
    onClose?.();
  };

  const handleQuickRecentJoin = (entry: RecentRoomEntry) => {
    setRecentRooms(saveRecentRoom(entry.code, entry.gameId));
    onJoinOrCreateRoom({
      mode: 'lan_room',
      gameId: entry.gameId,
      roomId: entry.code,
    });
    onClose?.();
  };

  const content = (
    <div
      className={`w-full ${
        embedded ? 'max-w-5xl mx-auto' : 'max-w-2xl max-h-[92dvh] overflow-y-auto'
      } bg-slate-950/95 border-2 border-amber-500/70 rounded-3xl p-4 sm:p-6 shadow-[0_25px_70px_rgba(0,0,0,0.85)] text-slate-100 flex flex-col gap-4 backdrop-blur-xl`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 border-b border-slate-800 pb-3.5">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-slate-950 shadow-lg border border-amber-300/60 shrink-0">
            <KeyRound size={22} />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg sm:text-xl font-black text-white leading-tight">
                Вход в комнату по коду
              </h2>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-black border ${
                  isConnected
                    ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                    : 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                }`}
              >
                {onlineCount} в сети
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Создайте приватную комнату с кодом или подключитесь к другу по сети / Wi-Fi
            </p>
          </div>
        </div>

        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть окно входа по коду"
            className="min-w-[40px] min-h-[40px] flex items-center justify-center p-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-400 hover:text-white cursor-pointer transition-colors shrink-0"
          >
            <X size={18} />
          </button>
        )}
      </div>

      {/* Mode Switcher: Join by Code vs Create Room */}
      <div className="grid grid-cols-2 gap-2 p-1.5 rounded-2xl bg-slate-900 border border-slate-800">
        <button
          type="button"
          data-testid="room-tab-join"
          onClick={() => {
            setSubMode('join');
            setErrorMsg(null);
          }}
          className={`py-2.5 px-3 rounded-xl font-black text-xs sm:text-sm flex items-center justify-center gap-2 cursor-pointer transition-all ${
            subMode === 'join'
              ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 shadow-md'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <LogIn size={16} />
          <span>Войти по коду</span>
        </button>
        <button
          type="button"
          data-testid="room-tab-create"
          onClick={() => {
            setSubMode('create');
            setErrorMsg(null);
          }}
          className={`py-2.5 px-3 rounded-xl font-black text-xs sm:text-sm flex items-center justify-center gap-2 cursor-pointer transition-all ${
            subMode === 'create'
              ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 shadow-md'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <PlusCircle size={16} />
          <span>Создать комнату</span>
        </button>
      </div>

      {/* Step 1: Select Game World */}
      <div className="flex flex-col gap-2">
        <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">
          1. Выберите режим игры для комнаты
        </span>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
          {GAME_OPTIONS.map((g) => {
            const active = selectedGame === g.id;
            return (
              <button
                key={g.id}
                type="button"
                onClick={() => setSelectedGame(g.id)}
                className={`p-2.5 rounded-xl border-2 text-left transition-all cursor-pointer flex flex-col gap-1 ${
                  active
                    ? 'bg-amber-500/15 border-amber-400 text-white shadow-md'
                    : 'bg-slate-900/80 hover:bg-slate-800 border-slate-800 text-slate-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xl">{g.icon}</span>
                  <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                    {g.badge}
                  </span>
                </div>
                <span className="text-xs font-black truncate">{g.title}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Step 2: Join OR Create Section */}
      {subMode === 'join' ? (
        <form onSubmit={handleLaunchJoin} className="flex flex-col gap-3">
          <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">
            2. Введите код комнаты друга
          </span>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <div className="relative flex-1 flex items-center">
              <input
                type="text"
                data-testid="room-code-join-input"
                value={joinCode}
                onChange={(e) => {
                  setJoinCode(sanitizeCode(e.target.value));
                  setErrorMsg(null);
                }}
                maxLength={12}
                placeholder="НАПР. DOORS123"
                className="w-full bg-slate-900 border-2 border-slate-700 focus:border-amber-400 rounded-2xl px-4 py-3 text-base sm:text-lg font-mono font-black text-amber-300 uppercase tracking-[0.2em] outline-none placeholder:text-slate-600 placeholder:tracking-normal placeholder:text-sm"
              />
              <button
                type="button"
                onClick={handlePaste}
                title="Вставить код из буфера"
                className="absolute right-2 px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
              >
                <ClipboardPaste size={14} />
                <span className="hidden sm:inline">Вставить</span>
              </button>
            </div>

            <button
              type="submit"
              data-testid="room-code-join-submit"
              className="px-6 py-3.5 rounded-2xl bg-gradient-to-b from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white font-black text-sm shadow-[0_4px_0_#065f46] active:translate-y-0.5 active:shadow-none transition-all flex items-center justify-center gap-2 cursor-pointer shrink-0"
            >
              <Play size={18} className="fill-white" />
              <span>Войти в комнату</span>
            </button>
          </div>

          {errorMsg && (
            <div className="px-3 py-2 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-300 text-xs font-bold">
              ⚠️ {errorMsg}
            </div>
          )}

          {/* Quick sample & recent rooms */}
          <div className="flex flex-col gap-2 bg-slate-900/70 border border-slate-800 rounded-2xl p-3">
            <div className="flex items-center justify-between text-[11px] font-bold text-slate-400">
              <span className="flex items-center gap-1.5">
                <History size={13} className="text-amber-400" />
                {recentRooms.length > 0 ? 'Недавние комнаты' : 'Быстрые коды для теста'}
              </span>
              <span>Нажмите, чтобы войти сразу</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {recentRooms.length > 0 ? (
                recentRooms.map((entry) => {
                  const gMeta = GAME_OPTIONS.find((g) => g.id === entry.gameId);
                  return (
                    <button
                      key={`${entry.code}_${entry.gameId}`}
                      type="button"
                      onClick={() => handleQuickRecentJoin(entry)}
                      className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-bold text-amber-300 flex items-center gap-1.5 cursor-pointer transition-colors"
                    >
                      <span>{gMeta?.icon || '🎮'}</span>
                      <span className="font-mono tracking-wider">{entry.code}</span>
                    </button>
                  );
                })
              ) : (
                ['DOORS777', 'OBBY100', 'LAVA555', 'BEE2025'].map((sample) => (
                  <button
                    key={sample}
                    type="button"
                    onClick={() => {
                      setJoinCode(sample);
                      setErrorMsg(null);
                    }}
                    className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-mono font-bold text-amber-300 cursor-pointer transition-colors"
                  >
                    {sample}
                  </button>
                ))
              )}
            </div>
          </div>
        </form>
      ) : (
        <div className="flex flex-col gap-3">
          <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">
            2. Ваш секретный код комнаты (отправьте другу)
          </span>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <input
              type="text"
              data-testid="room-code-create-input"
              value={createCode}
              onChange={(e) => setCreateCode(sanitizeCode(e.target.value))}
              maxLength={12}
              className="flex-1 bg-slate-900 border-2 border-emerald-500/60 focus:border-emerald-400 rounded-2xl px-4 py-3 text-lg font-mono font-black text-emerald-300 uppercase tracking-[0.2em] outline-none"
            />
            <button
              type="button"
              onClick={() => setCreateCode(generateRoomCode())}
              className="px-3.5 py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-black flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
            >
              <Dices size={16} className="text-amber-400" />
              <span>Новый код</span>
            </button>
            <button
              type="button"
              onClick={handleCopyCreateCode}
              className={`px-3.5 py-3 rounded-2xl border text-xs font-black flex items-center justify-center gap-1.5 cursor-pointer transition-all ${
                copied
                  ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
                  : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-amber-300'
              }`}
            >
              {copied ? <Check size={16} /> : <Copy size={16} />}
              <span>{copied ? 'Скопировано!' : 'Копировать'}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] bg-slate-900/80 border border-slate-800 rounded-2xl p-3 text-slate-300">
            <div className="flex items-start gap-2">
              <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-300 font-black flex items-center justify-center shrink-0">
                1
              </span>
              <span>Скопируйте код и отправьте другу в чат</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-300 font-black flex items-center justify-center shrink-0">
                2
              </span>
              <span>Друг открывает «Вход по коду» и выбирает ту же игру</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-300 font-black flex items-center justify-center shrink-0">
                3
              </span>
              <span>Вы появитесь вместе в одной 3D-комнате!</span>
            </div>
          </div>

          <button
            type="button"
            data-testid="room-code-create-submit"
            onClick={handleLaunchCreate}
            className="w-full py-3.5 rounded-2xl bg-gradient-to-b from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white font-black text-sm sm:text-base shadow-[0_4px_0_#065f46] active:translate-y-0.5 active:shadow-none transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <Sparkles size={18} />
            <span>Создать комнату [{sanitizeCode(createCode) || 'BLOX777'}] и играть!</span>
          </button>
        </div>
      )}

      {/* Quick Alternative Modes Footer (only when embedded in Servers tab) */}
      {embedded && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2 border-t border-slate-800">
          <button
            type="button"
            onClick={() =>
              onJoinOrCreateRoom({
                mode: 'local_coop',
                gameId: selectedGame,
                roomId: 'local_coop',
              })
            }
            className="p-3 rounded-2xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/40 text-left flex items-center gap-3 cursor-pointer transition-all"
          >
            <div className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-300 shrink-0">
              <Gamepad2 size={20} />
            </div>
            <div className="min-w-0">
              <span className="font-black text-xs sm:text-sm text-white block">
                Раздельный экран (2 игрока на 1 ПК)
              </span>
              <span className="text-[11px] text-emerald-200/80 block truncate">
                Левый экран: WASD · Правый экран: Стрелки + Enter
              </span>
            </div>
          </button>

          <button
            type="button"
            onClick={() =>
              onJoinOrCreateRoom({
                mode: 'online',
                gameId: selectedGame,
                roomId:
                  selectedGame === 'doors'
                    ? 'public_doors'
                    : selectedGame === 'lava_survival'
                    ? 'public_lava'
                    : selectedGame === 'bee_swarm'
                    ? 'public_bee'
                    : selectedGame === 'studio'
                    ? 'public_studio'
                    : 'public_obby',
              })
            }
            className="p-3 rounded-2xl bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/40 text-left flex items-center gap-3 cursor-pointer transition-all"
          >
            <div className="p-2.5 rounded-xl bg-sky-500/20 text-sky-300 shrink-0">
              <Globe size={20} />
            </div>
            <div className="min-w-0">
              <span className="font-black text-xs sm:text-sm text-white block">
                Общий онлайн-сервер
              </span>
              <span className="text-[11px] text-sky-200/80 block truncate">
                Публичная комната со всеми игроками в сети
              </span>
            </div>
          </button>
        </div>
      )}

      {!embedded && (
        <div className="flex items-center justify-between text-[11px] text-slate-400 border-t border-slate-800 pt-2.5">
          <span className="flex items-center gap-1.5">
            <Wifi size={13} className="text-amber-400" />
            Работает между вкладками и устройствами в реальном времени
          </span>
          <span className="flex items-center gap-1 text-slate-300 font-bold">
            <Users size={13} className="text-emerald-400" />
            Приватный канал
          </span>
        </div>
      )}
    </div>
  );

  if (embedded) {
    return content;
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/75 backdrop-blur-sm pointer-events-auto"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.94, y: 12, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        exit={{ scale: 0.94, y: 12, opacity: 0 }}
        transition={{ type: 'spring', damping: 24, stiffness: 320 }}
        className="w-full max-w-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {content}
      </motion.div>
    </motion.div>
  );
};
