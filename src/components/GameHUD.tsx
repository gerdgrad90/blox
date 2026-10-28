import React, { useEffect, useState } from 'react';
import {
  Coins,
  Gem,
  Heart,
  Flag,
  RotateCcw,
  Volume2,
  VolumeX,
  Pause,
  Users,
  MessageSquare,
  Sparkles,
  Hammer,
  Zap,
  Feather,
  Sword,
  Music,
  Maximize,
  Minimize,
  Smartphone,
  Globe,
  Wifi,
  Gamepad2,
  Backpack,
  Rocket,
  CupSoda,
  X,
  Check,
  Flame,
  Eye,
  EyeOff,
  ChevronUp,
  ChevronDown,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import {
  CharacterSkin,
  MultiplayerSessionConfig,
  PlayerStats,
  RemotePlayerInfo,
  ToolType,
} from '../game/types';
import { MobileControls } from './MobileControls';

interface GameHUDProps {
  stats: PlayerStats;
  activeTool: ToolType;
  onSelectTool: (tool: ToolType) => void;
  onRespawn: () => void;
  onPause: () => void;
  isMuted: boolean;
  onToggleMute: () => void;
  chatMessages: { id: string; text: string; author?: string }[];
  onSendChatMessage: (msg: string) => void;
  selectedColor: string;
  onSelectColor: (color: string) => void;
  skin: CharacterSkin;
  onOpenCustomizer: () => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  isTouchMode: boolean;
  onToggleTouchMode: () => void;
  onJoystickMove: (x: number, y: number) => void;
  onJump: () => void;
  onAction: (removeBlock?: boolean) => void;
  sessionConfig: MultiplayerSessionConfig;
  remotePlayers: RemotePlayerInfo[];
  isConnected: boolean;
}

interface InventoryItem {
  id: ToolType;
  label: string;
  key: string;
  category: 'gear' | 'consumable' | 'fun';
  icon: React.ReactNode;
  tag: string;
  tagColor: string;
  description: string;
  boostText: string;
}

export const GameHUD: React.FC<GameHUDProps> = ({
  stats,
  activeTool,
  onSelectTool,
  onRespawn,
  onPause,
  isMuted,
  onToggleMute,
  chatMessages,
  onSendChatMessage,
  selectedColor,
  onSelectColor,
  skin,
  onOpenCustomizer,
  isFullscreen,
  onToggleFullscreen,
  isTouchMode,
  onToggleTouchMode,
  onJoystickMove,
  onJump,
  onAction,
  sessionConfig,
  remotePlayers,
  isConnected,
}) => {
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [isBackpackOpen, setIsBackpackOpen] = useState(false);
  const [isHotbarVisible, setIsHotbarVisible] = useState(true);
  const [backpackFilter, setBackpackFilter] = useState<'all' | 'gear' | 'consumable' | 'fun'>('all');
  const [chatInput, setChatInput] = useState('');
  const [isChatOpen, setIsChatOpen] = useState(false);

  const blockColors = ['#ef4444', '#3b82f6', '#22c55e', '#eab308', '#ec4899', '#ffffff', '#0f172a'];

  const inventoryItems: InventoryItem[] = [
    {
      id: 'sword',
      label: 'Меч Blox',
      key: '1',
      category: 'gear',
      icon: <Sword size={22} className="text-amber-300" />,
      tag: 'Оружие',
      tagColor: 'bg-amber-500/20 text-amber-300 border-amber-400/40',
      description: 'Классический золотой меч Roblox для боя и разрушения преград.',
      boostText: 'Урон 25 · Взмах ЛКМ',
    },
    {
      id: 'speed_coil',
      label: 'Speed Coil',
      key: '2',
      category: 'gear',
      icon: <Zap size={22} className="text-red-400" />,
      tag: 'Спид-буст',
      tagColor: 'bg-red-500/20 text-red-300 border-red-400/40',
      description: 'Красная пружина скорости. Ускоряет бег персонажа в 1.55 раза.',
      boostText: '+55% Скорость бега',
    },
    {
      id: 'gravity_coil',
      label: 'Gravity Coil',
      key: '3',
      category: 'gear',
      icon: <Feather size={22} className="text-cyan-400" />,
      tag: 'Гравитация',
      tagColor: 'bg-cyan-500/20 text-cyan-300 border-cyan-400/40',
      description: 'Голубая пружина гравитации. Снижает вес и дарит невероятно высокий прыжок.',
      boostText: '+65% Высота прыжка',
    },
    {
      id: 'hammer',
      label: 'Молот BTools',
      key: '4',
      category: 'gear',
      icon: <Hammer size={22} className="text-slate-200" />,
      tag: 'Стройка',
      tagColor: 'bg-slate-500/20 text-slate-300 border-slate-400/40',
      description: 'Инструмент строителя (Building Tools). Ставьте цветные блоки на ЛКМ, убирайте на ПКМ.',
      boostText: 'Строительство мостов',
    },
    {
      id: 'jetpack_boost',
      label: 'Джетпак FUEL',
      key: '5',
      category: 'gear',
      icon: <Rocket size={22} className="text-lime-400" />,
      tag: 'Реактивный',
      tagColor: 'bg-lime-500/20 text-lime-300 border-lime-400/40',
      description: 'Реактивный ранец FUEL из гардероба. Зажимайте Пробел/ЛКМ для взлёта на реактивной тяге!',
      boostText: 'Полёт вверх + Пламя',
    },
    {
      id: 'bloxy_cola',
      label: 'Bloxy Cola',
      key: '6',
      category: 'consumable',
      icon: <CupSoda size={22} className="text-amber-400" />,
      tag: 'Напиток',
      tagColor: 'bg-amber-500/20 text-amber-300 border-amber-400/40',
      description: 'Легендарная газировка Bloxy Cola. Выпейте (ЛКМ) для мгновенного исцеления +35 HP!',
      boostText: '+35 Здоровья · Буст скорости',
    },
    {
      id: 'dance',
      label: 'Танец Blox',
      key: '7',
      category: 'fun',
      icon: <Music size={22} className="text-pink-400" />,
      tag: 'Эмоция',
      tagColor: 'bg-pink-500/20 text-pink-300 border-pink-400/40',
      description: 'Праздничный танец Roblox для празднования прохождения этапа!',
      boostText: 'Анимация танца',
    },
  ];

  // Hotkey [B], [I], or [`] to toggle Roblox Backpack
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      if (e.code === 'KeyB' || e.code === 'KeyI' || e.code === 'Backquote') {
        e.preventDefault();
        setIsBackpackOpen((prev) => !prev);
      } else if (e.code === 'KeyH') {
        e.preventDefault();
        setIsHotbarVisible((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleChatSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    onSendChatMessage(chatInput.trim());
    setChatInput('');
  };

  const filteredItems = inventoryItems.filter((item) => {
    if (backpackFilter === 'all') return true;
    return item.category === backpackFilter;
  });

  const totalPlayersInRoom = 1 + remotePlayers.length + (sessionConfig.mode === 'local_coop' ? 1 : 0);

  return (
    <div className="fixed inset-0 pointer-events-none z-10 flex flex-col justify-between p-2 sm:p-4 text-white">
      {/* TOP BAR: Health, Coins, Checkpoints & Utilities */}
      <div className="flex items-start justify-between w-full">
        {/* Top-Left: Stats HUD */}
        <div className="flex flex-col gap-2 pointer-events-auto">
          {/* Health Bar */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-slate-900/85 border border-slate-700/70 shadow-lg backdrop-blur-md">
            <Heart size={18} className="text-red-500 fill-red-500 shrink-0 animate-pulse" />
            <div className="flex flex-col">
              <div className="flex justify-between items-center text-[10px] sm:text-xs font-black tracking-wider text-slate-300">
                <span>HP</span>
                <span className="font-mono-numbers">{Math.max(0, Math.round(stats.hp))}/100</span>
              </div>
              <div className="w-24 sm:w-36 h-2 rounded-full bg-slate-800 overflow-hidden border border-slate-700 mt-0.5">
                <div
                  className="h-full bg-gradient-to-r from-red-600 via-amber-500 to-emerald-500 transition-all duration-200"
                  style={{ width: `${Math.max(0, Math.min(100, stats.hp))}%` }}
                />
              </div>
            </div>
          </div>

          {/* Badges: Coins, Gems, Stage */}
          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
            {/* Coins */}
            <div className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-slate-900/85 border border-amber-500/40 text-amber-300 font-bold text-xs sm:text-sm shadow-md">
              <Coins size={14} className="text-amber-400 fill-amber-400" />
              <span className="font-mono-numbers">{stats.coins}</span>
            </div>

            {/* Gems */}
            <div className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-slate-900/85 border border-cyan-500/40 text-cyan-300 font-bold text-xs sm:text-sm shadow-md">
              <Gem size={14} className="text-cyan-400 fill-cyan-400" />
              <span className="font-mono-numbers">{stats.gems}</span>
            </div>

            {/* Stage Checkpoint */}
            <div className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-slate-900/85 border border-emerald-500/40 text-emerald-300 font-bold text-xs sm:text-sm shadow-md">
              <Flag size={14} className="text-emerald-400" />
              <span>Этап <span className="font-mono-numbers">{stats.currentCheckpoint}</span>/6</span>
            </div>

            {/* Game Badge */}
            <div className="hidden sm:flex items-center gap-1 px-2.5 py-1 rounded-xl bg-slate-900/85 border border-slate-700 text-slate-300 font-bold text-xs shadow-md">
              <span>{sessionConfig.gameId === 'lava_survival' ? '🌋 Лава 3D' : '🏃 Паркур Obby'}</span>
            </div>
          </div>
        </div>

        {/* Top-Right: Quick Utilities & Roblox Backpack Button */}
        <div className="flex items-center gap-1.5 sm:gap-2 pointer-events-auto flex-wrap justify-end">
          {/* ROBLOX BACKPACK BUTTON (Top Bar shortcut) */}
          <button
            type="button"
            data-testid="roblox-backpack-btn"
            onClick={() => setIsBackpackOpen((prev) => !prev)}
            title="Открыть Рюкзак Roblox [B]"
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border shadow-lg cursor-pointer transition-all ${
              isBackpackOpen
                ? 'bg-amber-500 border-amber-300 text-slate-950 font-black'
                : 'bg-slate-900/90 hover:bg-slate-800 border-amber-500/50 text-amber-300 font-bold'
            }`}
          >
            <Backpack size={17} className={isBackpackOpen ? 'text-slate-950' : 'text-amber-400'} />
            <span className="text-xs sm:text-sm">Рюкзак [B]</span>
          </button>

          {/* Skin Customizer */}
          <button
            onClick={onOpenCustomizer}
            title="Гардероб / Скин"
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-2 rounded-xl bg-slate-900/85 hover:bg-slate-800 border border-slate-700/70 text-slate-200 text-xs sm:text-sm font-bold shadow-md cursor-pointer transition-all"
          >
            <Sparkles size={16} className="text-amber-400" />
            <span className="hidden md:inline">Скин</span>
          </button>

          {/* Toggle Hotbar Visibility [H] */}
          <button
            onClick={() => setIsHotbarVisible(!isHotbarVisible)}
            title={isHotbarVisible ? 'Скрыть панель инструментов [H]' : 'Показать панель инструментов [H]'}
            className={`p-2 rounded-xl border shadow-md cursor-pointer transition-all ${
              !isHotbarVisible
                ? 'bg-amber-600 border-amber-400 text-white'
                : 'bg-slate-900/85 hover:bg-slate-800 border-slate-700/70 text-slate-200'
            }`}
          >
            {isHotbarVisible ? <EyeOff size={17} /> : <Eye size={17} />}
          </button>

          {/* Touch Controls Toggle */}
          <button
            onClick={onToggleTouchMode}
            title="Сенсорное управление (Телефон)"
            className={`p-2 rounded-xl border shadow-md cursor-pointer transition-all ${
              isTouchMode
                ? 'bg-emerald-600 border-emerald-400 text-white'
                : 'bg-slate-900/85 hover:bg-slate-800 border-slate-700/70 text-slate-200'
            }`}
          >
            <Smartphone size={17} />
          </button>

          {/* Fullscreen Toggle [F] */}
          <button
            onClick={onToggleFullscreen}
            title={isFullscreen ? 'Выйти из полного экрана [F]' : 'Полный экран [F]'}
            className={`p-2 rounded-xl border shadow-md cursor-pointer transition-all ${
              isFullscreen
                ? 'bg-sky-600 border-sky-400 text-white'
                : 'bg-slate-900/85 hover:bg-slate-800 border-slate-700/70 text-slate-200'
            }`}
          >
            {isFullscreen ? <Minimize size={17} /> : <Maximize size={17} />}
          </button>

          {/* Leaderboard Toggle */}
          <button
            onClick={() => setShowLeaderboard(!showLeaderboard)}
            title="Таблица игроков"
            className={`flex items-center gap-1 px-2.5 py-2 rounded-xl border shadow-md cursor-pointer transition-all text-xs font-bold ${
              showLeaderboard
                ? 'bg-blue-600 border-blue-400 text-white'
                : 'bg-slate-900/85 hover:bg-slate-800 border-slate-700/70 text-slate-200'
            }`}
          >
            <Users size={16} />
            <span className="font-mono-numbers">{totalPlayersInRoom}</span>
          </button>

          {/* Sound Toggle */}
          <button
            onClick={onToggleMute}
            className="p-2 rounded-xl bg-slate-900/85 hover:bg-slate-800 border border-slate-700/70 text-slate-200 shadow-md cursor-pointer transition-all"
          >
            {isMuted ? <VolumeX size={17} /> : <Volume2 size={17} />}
          </button>

          {/* Reset Character [R] */}
          <button
            onClick={onRespawn}
            title="Сброс персонажа [R]"
            className="p-2 rounded-xl bg-slate-900/85 hover:bg-rose-900/80 border border-rose-500/40 text-rose-300 shadow-md cursor-pointer transition-all"
          >
            <RotateCcw size={17} />
          </button>

          {/* Pause Menu [Esc] */}
          <button
            onClick={onPause}
            title="Пауза [Esc]"
            className="p-2 rounded-xl bg-slate-900/85 hover:bg-slate-800 border border-slate-700/70 text-slate-200 shadow-md cursor-pointer transition-all"
          >
            <Pause size={17} />
          </button>
        </div>
      </div>

      {/* ROBLOX BACKPACK / INVENTORY MODAL DRAWER */}
      <AnimatePresence>
        {isBackpackOpen && (
          <motion.div
            data-testid="roblox-backpack-drawer"
            initial={{ opacity: 0, scale: 0.94, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: -20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 350 }}
            className="absolute top-16 inset-x-4 sm:inset-x-auto sm:right-6 sm:w-[480px] max-h-[80vh] overflow-y-auto pointer-events-auto bg-slate-950/95 border-2 border-amber-500/70 rounded-3xl p-4 sm:p-5 shadow-2xl backdrop-blur-xl z-50 text-slate-100 flex flex-col gap-3"
          >
            {/* Backpack Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-400/50 flex items-center justify-center text-amber-300 shadow">
                  <Backpack size={20} />
                </div>
                <div>
                  <h3 className="font-black text-base sm:text-lg text-white leading-none">
                    Рюкзак Roblox (Инвентарь)
                  </h3>
                  <span className="text-[11px] text-slate-400 font-semibold">
                    Нажмите на предмет или клавиши 1-7 на клавиатуре
                  </span>
                </div>
              </div>
              <button
                onClick={() => setIsBackpackOpen(false)}
                className="p-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white cursor-pointer transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Category Filter Pills */}
            <div className="flex items-center gap-1.5 text-xs font-bold">
              <button
                onClick={() => setBackpackFilter('all')}
                className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
                  backpackFilter === 'all'
                    ? 'bg-amber-500 text-slate-950 font-black shadow-md'
                    : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                Все (7)
              </button>
              <button
                onClick={() => setBackpackFilter('gear')}
                className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
                  backpackFilter === 'gear'
                    ? 'bg-amber-500 text-slate-950 font-black shadow-md'
                    : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                Снаряжение & Койлы
              </button>
              <button
                onClick={() => setBackpackFilter('consumable')}
                className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
                  backpackFilter === 'consumable'
                    ? 'bg-amber-500 text-slate-950 font-black shadow-md'
                    : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                Еда & Напитки
              </button>
              <button
                onClick={() => setBackpackFilter('fun')}
                className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
                  backpackFilter === 'fun'
                    ? 'bg-amber-500 text-slate-950 font-black shadow-md'
                    : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                Танцы
              </button>
            </div>

            {/* Inventory Items Grid */}
            <div className="grid grid-cols-1 gap-2 overflow-y-auto max-h-[50vh] pr-1">
              {filteredItems.map((item) => {
                const isEquipped = activeTool === item.id;
                return (
                  <div
                    key={item.id}
                    onClick={() => onSelectTool(item.id)}
                    className={`p-3 rounded-2xl border-2 transition-all cursor-pointer flex items-center justify-between gap-3 ${
                      isEquipped
                        ? 'bg-gradient-to-r from-amber-500/20 to-slate-900 border-amber-400 shadow-md'
                        : 'bg-slate-900/80 hover:bg-slate-850 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-12 h-12 rounded-xl bg-slate-950/80 border border-slate-700/80 flex items-center justify-center shrink-0 shadow-inner relative">
                        {item.icon}
                        <span className="absolute -top-1 -left-1 w-5 h-5 rounded-md bg-slate-800 border border-slate-600 text-[10px] font-mono font-bold text-slate-300 flex items-center justify-center">
                          {item.key}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-white truncate">
                            {item.label}
                          </span>
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-black border ${item.tagColor}`}>
                            {item.tag}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">
                          {item.description}
                        </p>
                        <span className="text-[11px] font-semibold text-emerald-400 mt-0.5 block">
                          ⚡ {item.boostText}
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectTool(item.id);
                      }}
                      className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase shrink-0 transition-all ${
                        isEquipped
                          ? 'bg-emerald-500 text-slate-950 shadow-md flex items-center gap-1'
                          : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                      }`}
                    >
                      {isEquipped ? (
                        <>
                          <Check size={14} /> В Руках
                        </>
                      ) : (
                        'Взять'
                      )}
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Quick Tip Footer */}
            <div className="border-t border-slate-800 pt-2 flex items-center justify-between text-[11px] text-slate-400">
              <span>Горячие клавиши: <strong>1-7</strong> выбор, <strong>B</strong> закрыть</span>
              <span className="text-amber-400 font-bold">Слот в хотбаре активен</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* LEADERBOARD OVERLAY */}
      {showLeaderboard && (
        <div className="absolute top-16 right-4 w-72 pointer-events-auto bg-slate-950/90 border border-slate-700 rounded-2xl p-3 shadow-2xl backdrop-blur-md z-40">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-2">
            <span className="font-black text-xs uppercase tracking-wider text-slate-300">
              Таблица Игроков
            </span>
            <span className="text-[10px] font-bold text-emerald-400">
              {totalPlayersInRoom} в комнате
            </span>
          </div>
          <div className="flex flex-col gap-1.5 max-h-56 overflow-y-auto">
            {/* Local Player */}
            <div className="flex items-center justify-between p-2 rounded-xl bg-sky-500/15 border border-sky-400/40 text-xs">
              <span className="font-bold text-white flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                {skin.name} (Вы)
              </span>
              <span className="text-amber-300 font-bold">{stats.coins} 🪙</span>
            </div>

            {/* Remote Players */}
            {remotePlayers.map((player) => (
              <div
                key={player.id}
                className="flex items-center justify-between p-2 rounded-xl bg-slate-900/70 border border-slate-800 text-xs"
              >
                <span className="font-semibold text-slate-200 flex items-center gap-1.5 truncate max-w-[140px]">
                  <span className="w-2 h-2 rounded-full bg-sky-400" />
                  {player.skin?.name || player.id}
                </span>
                <span className="text-slate-400 text-[11px]">Этап {player.checkpoint + 1}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MOBILE CONTROLS */}
      {isTouchMode && (
        <MobileControls
          onJoystickMove={onJoystickMove}
          onJump={onJump}
          onAction={onAction}
          activeTool={activeTool}
        />
      )}

      {/* BOTTOM AREA */}
      <div className="flex items-end justify-between w-full">
        {/* Bottom-Left: Chat & Quick Phrases */}
        {!isTouchMode && (
          <div className="flex flex-col gap-2 max-w-xs sm:max-w-sm pointer-events-auto">
            {/* Recent Chat Messages */}
            <div className="flex flex-col gap-1 max-h-36 overflow-y-auto pr-1">
              {chatMessages.slice(-4).map((msg) => (
                <div
                  key={msg.id}
                  className="px-3 py-1.5 rounded-xl bg-slate-950/80 border border-slate-800 text-xs text-slate-200 shadow-md"
                >
                  {msg.author && <span className="font-bold text-sky-400 mr-1.5">[{msg.author}]:</span>}
                  <span>{msg.text}</span>
                </div>
              ))}
            </div>

            {/* Quick Chat Buttons & Input */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => onSendChatMessage('Всем привет в Blox World!')}
                className="px-2.5 py-1 rounded-lg bg-slate-900/80 hover:bg-slate-800 border border-slate-700/60 text-[11px] font-medium text-slate-300 cursor-pointer"
              >
                👋 Привет!
              </button>
              <button
                onClick={() => onSendChatMessage('Рюкзак на [B] — огонь!')}
                className="px-2.5 py-1 rounded-lg bg-slate-900/80 hover:bg-slate-800 border border-slate-700/60 text-[11px] font-medium text-slate-300 cursor-pointer"
              >
                🎒 Рюкзак [B]!
              </button>
              <button
                onClick={() => setIsChatOpen(!isChatOpen)}
                className="p-1 rounded-lg bg-slate-900/80 hover:bg-slate-800 border border-slate-700/60 text-slate-300 cursor-pointer"
                title="Открыть чат"
              >
                <MessageSquare size={14} />
              </button>
            </div>

            {isChatOpen && (
              <form onSubmit={handleChatSubmit} className="flex gap-1">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Сообщение в чат..."
                  className="w-full px-3 py-1 text-xs rounded-lg bg-slate-900/90 border border-slate-700 text-white outline-none focus:border-sky-500"
                />
                <button
                  type="submit"
                  className="px-2.5 py-1 text-xs font-bold rounded-lg bg-sky-600 hover:bg-sky-500 text-white cursor-pointer"
                >
                  Отправить
                </button>
              </form>
            )}
          </div>
        )}

        {/* Bottom-Center: 7-Slot Roblox Hotbar + Toggle */}
        <div className="flex flex-col items-center gap-1 mx-auto pointer-events-auto">
          <AnimatePresence mode="wait">
            {isHotbarVisible ? (
              <motion.div
                key="hotbar-expanded"
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 20, scale: 0.95 }}
                transition={{ duration: 0.2 }}
                className="flex flex-col items-center gap-1.5"
              >
                {/* Header Strip with Collapse Button */}
                <div className="flex items-center justify-between w-full px-2">
                  <span className="text-[10px] font-bold text-slate-400">
                    Слот: {inventoryItems.find((i) => i.id === activeTool)?.label || 'Меч'}
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsHotbarVisible(false)}
                    className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-900/80 hover:bg-slate-800 border border-slate-700/60 text-[10px] font-bold text-slate-300 hover:text-white cursor-pointer transition-colors shadow-sm"
                    title="Скрыть панель инструментов [H]"
                  >
                    <span>Скрыть [H]</span>
                    <ChevronDown size={12} />
                  </button>
                </div>

                {/* Block Palette Picker (when hammer selected) */}
                {activeTool === 'hammer' && (
                  <div className="flex items-center gap-1.5 p-1.5 rounded-xl bg-slate-900/90 border border-slate-700 shadow-xl animate-in fade-in slide-in-from-bottom-2 duration-150">
                    <span className="hidden sm:inline text-[11px] font-bold text-slate-400 px-1">ЦВЕТ:</span>
                    {blockColors.map((col) => (
                      <button
                        key={col}
                        onClick={() => onSelectColor(col)}
                        style={{ backgroundColor: col }}
                        aria-label={`Цвет блока ${col}`}
                        className={`w-6 h-6 rounded-lg transition-transform cursor-pointer border ${
                          selectedColor === col ? 'scale-125 border-white shadow-lg' : 'border-black/40 hover:scale-110'
                        }`}
                      />
                    ))}
                  </div>
                )}

                {/* Hotbar Slots + Backpack Trigger */}
                <div className="flex items-center gap-1 sm:gap-1.5 p-1 sm:p-2 rounded-2xl bg-slate-950/90 border-2 border-slate-700/80 shadow-[0_10px_25px_rgba(0,0,0,0.7)]">
                  {/* Backpack Button inside Hotbar */}
                  <button
                    type="button"
                    onClick={() => setIsBackpackOpen((prev) => !prev)}
                    title="Рюкзак инвентаря [B / ~]"
                    className={`flex flex-col items-center justify-center w-10 sm:w-14 h-11 sm:h-14 rounded-xl border-2 transition-all cursor-pointer ${
                      isBackpackOpen
                        ? 'bg-amber-500 border-amber-300 text-slate-950 shadow-lg scale-105'
                        : 'bg-slate-900/90 hover:bg-slate-800 border-amber-500/60 text-amber-300 hover:border-amber-400'
                    }`}
                  >
                    <Backpack size={18} />
                    <span className="text-[8px] font-black uppercase tracking-tight mt-0.5">Рюкзак</span>
                  </button>

                  {/* 7 Item Slots */}
                  {inventoryItems.map((item) => {
                    const isEquipped = activeTool === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => onSelectTool(item.id)}
                        title={`${item.label} [${item.key}]`}
                        className={`relative flex flex-col items-center justify-center w-10 sm:w-14 h-11 sm:h-14 rounded-xl border-2 transition-all cursor-pointer ${
                          isEquipped
                            ? 'bg-gradient-to-b from-sky-500/30 to-blue-600/40 border-sky-400 shadow-[0_0_15px_rgba(56,189,248,0.5)] translate-y-[-2px]'
                            : 'bg-slate-900/90 hover:bg-slate-800/90 border-slate-700/70 hover:border-slate-500'
                        }`}
                      >
                        {/* Slot Number Badge */}
                        <span className="absolute top-0.5 left-1 text-[8px] sm:text-[10px] font-mono font-bold text-slate-400">
                          {item.key}
                        </span>

                        {/* Icon */}
                        <div className="mt-1 scale-90 sm:scale-100">{item.icon}</div>

                        {/* Tiny label */}
                        <span className="text-[7px] sm:text-[8px] font-semibold text-slate-300 truncate max-w-[36px] sm:max-w-[48px] mt-0.5">
                          {item.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </motion.div>
            ) : (
              <motion.button
                key="hotbar-collapsed-btn"
                initial={{ opacity: 0, y: 16, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 16, scale: 0.9 }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => setIsHotbarVisible(true)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-slate-950/90 hover:bg-slate-900 border-2 border-slate-700/90 shadow-[0_10px_25px_rgba(0,0,0,0.7)] text-slate-200 hover:text-white text-xs font-bold cursor-pointer transition-colors"
                title="Развернуть панель инструментов [H]"
              >
                <Sparkles size={16} className="text-amber-400" />
                <span>Инструменты [H]</span>
                <ChevronUp size={15} className="text-slate-400" />
              </motion.button>
            )}
          </AnimatePresence>
        </div>

        {/* Bottom-Right: Quick Emotes Wheel */}
        {!isTouchMode && (
          <div className="hidden sm:flex flex-col gap-1.5 pointer-events-auto">
            <button
              onClick={() => onSelectTool('dance')}
              className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-900/85 hover:bg-slate-800 border border-pink-500/40 text-pink-300 text-xs font-bold shadow-md cursor-pointer transition-all"
            >
              <Music size={16} />
              <span>Танец [7]</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
