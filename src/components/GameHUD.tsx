import React, { useEffect, useState } from 'react';
import {
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
  Crown,
  Keyboard,
  Menu,
  Sliders,
  KeyRound,
  Smile,
  HelpCircle,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import {
  CharacterSkin,
  EmoteId,
  MultiplayerSessionConfig,
  PlayerStats,
  RemotePlayerInfo,
  ToolType,
  BeeFarmState,
  DoorsGameState,
  DOORS_ROOMS_ATLAS,
  DoorsRoomTypeId,
  VoiceChatSnapshot,
  VoiceInputMode,
  VoiceSpatialMode,
} from '../game/types';
import type { VRState } from '../game/vr';
import type { PortalKind, PortalRuntimeState } from '../game/portals';
import { MobileControls } from './MobileControls';
import { EmoteMenu, ActiveEmoteState } from './EmoteMenu';
import { isUserAdmin, MobileLayoutConfig } from '../game/controls';
import { AvatarPortraitIcon } from './AvatarPortraitIcon';
import { PlayerProfileHUD } from './PlayerProfileHUD';
import { VoiceChatWidget, VoiceActiveSpeakersOverlay } from './VoiceChatWidget';
import type { CloudUserProfile } from '../game/auth';
import type { PublicProfileLookupInput } from '../game/publicProfile';

const SYSTEM_CHAT_AUTHORS = new Set([
  'Система',
  'Сервер',
  'Чекпоинт',
  'Гардероб',
  'Админ',
  'Мультиплеер',
  'Локалка',
]);

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
  onOpenFeedback: () => void;
  onOpenShop: () => void;
  onOpenControls?: () => void;
  onOpenAdmin?: () => void;
  isAdminUnlocked?: boolean;
  beeFarmState?: BeeFarmState;
  onUpgradeScooper?: () => boolean;
  onUpgradeBackpack?: () => boolean;
  onHatchBeeEgg?: () => boolean;
  doorsState?: DoorsGameState;
  onDoorsInteract?: () => void;
  onDoorsToggleCrouch?: () => void;
  onDoorsToggleFlashlight?: () => void;
  onDoorsTeleport100?: () => void;
  onDoorsSelectRoom?: (roomId: DoorsRoomTypeId) => void;
  onDoorsTriggerRush?: () => void;
  onOpenRoomCode?: () => void;
  mobileLayout?: MobileLayoutConfig;
  cloudProfile?: CloudUserProfile | null;
  isGuestSession?: boolean;
  onOpenAuth?: () => void;
  onInspectPlayer?: (lookup: PublicProfileLookupInput) => void;
  onInspectSelfProfile?: () => void;
  onTriggerEmote?: (emoteId: EmoteId) => void;
  onCancelEmote?: () => void;
  activeEmote?: ActiveEmoteState | null;
  isEmoteDisabled?: boolean;
  vrEnabled?: boolean;
  vrState?: VRState;
  onToggleVR?: () => void;
  onOpenVRModal?: () => void;
  onToggleVRControlsHint?: () => void;
  onToggleVRMainMenu?: () => void;
  onCalibrateVRHeight?: () => void;
  onReturnToTitle?: () => void;
  portalState?: PortalRuntimeState;
  onFirePortal?: (kind: PortalKind) => void;
  onClearPortals?: () => void;
  voiceState?: VoiceChatSnapshot;
  onVoiceJoin?: () => void;
  onVoiceLeave?: () => void;
  onVoiceToggleMute?: () => void;
  onVoiceToggleDeafen?: () => void;
  onVoiceSetInputMode?: (mode: VoiceInputMode) => void;
  onVoiceSetPttActive?: (active: boolean) => void;
  onVoiceSetSpatialMode?: (mode: VoiceSpatialMode) => void;
  onVoiceSetMasterVolume?: (volume: number) => void;
  onVoiceSetPeerVolume?: (peerId: string, volume: number) => void;
  onVoiceTogglePeerMute?: (peerId: string) => void;
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
  onOpenFeedback,
  onOpenShop,
  onOpenControls,
  onOpenAdmin,
  isAdminUnlocked = false,
  beeFarmState,
  onUpgradeScooper,
  onUpgradeBackpack,
  onHatchBeeEgg,
  doorsState,
  onDoorsInteract,
  onDoorsToggleCrouch,
  onDoorsToggleFlashlight,
  onDoorsTeleport100,
  onDoorsSelectRoom,
  onDoorsTriggerRush,
  onOpenRoomCode,
  mobileLayout,
  cloudProfile,
  isGuestSession = false,
  onOpenAuth,
  onInspectPlayer,
  onInspectSelfProfile,
  onTriggerEmote,
  onCancelEmote,
  activeEmote,
  isEmoteDisabled = false,
  vrEnabled = false,
  vrState,
  onToggleVR,
  onOpenVRModal,
  onToggleVRControlsHint,
  onToggleVRMainMenu,
  onCalibrateVRHeight,
  onReturnToTitle,
  portalState,
  onFirePortal,
  onClearPortals,
  voiceState,
  onVoiceJoin,
  onVoiceLeave,
  onVoiceToggleMute,
  onVoiceToggleDeafen,
  onVoiceSetInputMode,
  onVoiceSetPttActive,
  onVoiceSetSpatialMode,
  onVoiceSetMasterVolume,
  onVoiceSetPeerVolume,
  onVoiceTogglePeerMute,
}) => {
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [isBackpackOpen, setIsBackpackOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isEmoteMenuOpen, setIsEmoteMenuOpen] = useState(false);
  const [isBeeShopOpen, setIsBeeShopOpen] = useState(false);
  const [isDoorsAtlasOpen, setIsDoorsAtlasOpen] = useState(false);
  const [isControlsHelpOpen, setIsControlsHelpOpen] = useState(false);
  const [isVoicePanelOpen, setIsVoicePanelOpen] = useState(false);
  const [isHotbarVisible, setIsHotbarVisible] = useState(true);
  const [backpackFilter, setBackpackFilter] = useState<'all' | 'gear' | 'consumable' | 'fun'>('all');
  const [chatInput, setChatInput] = useState('');
  const [isChatOpen, setIsChatOpen] = useState(false);

  const blockColors = ['#ef4444', '#3b82f6', '#22c55e', '#eab308', '#ec4899', '#ffffff', '#0f172a'];

  const inventoryItems: InventoryItem[] = [
    ...(sessionConfig.gameId === 'bee_swarm'
      ? [
          {
            id: 'pollen_collector' as ToolType,
            label: beeFarmState?.scooperName || 'Совок для пыльцы',
            key: '1',
            category: 'gear' as const,
            icon: <Sparkles size={22} className="text-yellow-300" />,
            tag: 'Сбор',
            tagColor: 'bg-yellow-500/20 text-yellow-300 border-yellow-400/40',
            description: 'Инструмент пчеловода: собирает пыльцу с цветов для переработки в мёд в Улье.',
            boostText: `Сила: +${beeFarmState?.scooperPower || 2} пыльцы · ЛКМ`,
          },
        ]
      : []),
    {
      id: 'sword',
      label: 'Меч Blox',
      key: sessionConfig.gameId === 'bee_swarm' ? '2' : '1',
      category: 'gear',
      icon: <Sword size={22} className="text-amber-300" />,
      tag: 'Оружие',
      tagColor: 'bg-amber-500/20 text-amber-300 border-amber-400/40',
      description: 'Классический золотой меч Blox для боя и разрушения преград.',
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
      description: 'Праздничный танец Blox для празднования прохождения этапа!',
      boostText: 'Анимация танца',
    },
    {
      id: 'portal_gun',
      label: 'Портал-Пушка',
      key: '8',
      category: 'gear',
      icon: <span className="text-xl leading-none">🌀</span>,
      tag: 'ПОРТАЛЫ 3D',
      tagColor: 'bg-cyan-500/25 text-cyan-200 border-cyan-400/50',
      description:
        'Открывает два связанных 3D-портала на любых стенах, полах и в воздухе! ЛКМ = 🔵 Синий, ПКМ / [Q] = 🟠 Оранжевый. В VR: Курок R и Курок L!',
      boostText: 'Телепорт с сохранением импульса',
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
    <div className="fixed inset-0 pointer-events-none z-10 flex flex-col justify-between p-2 sm:p-4 pt-safe pb-safe text-white">
      {/* SPLIT-SCREEN DIVIDER & VIEWPORT BADGES FOR LOCAL CO-OP */}
      {sessionConfig.mode === 'local_coop' && (
        <>
          <div
            data-testid="split-screen-divider"
            className="fixed inset-y-0 left-1/2 -translate-x-1/2 w-1 bg-gradient-to-b from-sky-400 via-white/80 to-rose-500 shadow-[0_0_18px_rgba(255,255,255,0.5)] pointer-events-none z-10"
          />
          <div className="fixed bottom-20 left-3 sm:left-4 px-2.5 py-1 rounded-xl bg-sky-950/85 border border-sky-400/60 text-sky-200 text-[10px] sm:text-xs font-black shadow-lg pointer-events-none z-10">
            🎮 Игрок 1: WASD + Пробел
          </div>
          <div className="fixed bottom-20 right-3 sm:right-4 px-2.5 py-1 rounded-xl bg-rose-950/85 border border-rose-400/60 text-rose-200 text-[10px] sm:text-xs font-black shadow-lg pointer-events-none z-10">
            🎮 Игрок 2: Стрелки + Enter
          </div>
        </>
      )}

      {/* UNMISTAKABLE ALL-SCREEN DOORS RUSH WARNING OVERLAY */}
      {sessionConfig.gameId === 'doors' &&
        doorsState &&
        ((doorsState.rushWarningSeconds || 0) > 0 || doorsState.rushActive) && (
          <>
            {!doorsState.isHidingInCloset && (
              <div
                className="fixed inset-0 pointer-events-none z-30 border-[6px] sm:border-[10px] border-red-500/80 shadow-[inset_0_0_95px_rgba(239,68,68,0.65)] animate-pulse"
                aria-hidden="true"
              />
            )}
            <div
              data-testid="doors-rush-alert"
              className="fixed top-20 sm:top-24 left-1/2 -translate-x-1/2 z-40 w-[94%] max-w-md pointer-events-none flex flex-col items-center gap-2"
            >
              <div
                className={`w-full px-4 py-3 rounded-2xl border-2 shadow-[0_12px_36px_rgba(0,0,0,0.85)] text-center flex flex-col items-center gap-1.5 ${
                  doorsState.isHidingInCloset
                    ? 'bg-emerald-950/95 border-emerald-400 text-emerald-100'
                    : 'bg-red-950/95 border-red-400 text-white animate-pulse'
                }`}
              >
                {doorsState.isHidingInCloset ? (
                  <>
                    <div className="text-sm sm:text-base font-black tracking-wide text-emerald-300">
                      🛡️ ВЫ В ШКАФУ — БЕЗОПАСНО!
                    </div>
                    <div className="text-xs font-bold text-emerald-100">
                      {(doorsState.rushWarningSeconds || 0) > 0
                        ? `Раш ворвётся через ${doorsState.rushWarningSeconds?.toFixed(1)}с — сидите тихо!`
                        : `Раш пролетает мимо (${doorsState.rushDistanceMeters || 0}м)...`}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="text-sm sm:text-lg font-black tracking-wide text-amber-300">
                      {(doorsState.rushWarningSeconds || 0) > 0
                        ? `⚡ РАШ ЛЕТИТ ЧЕРЕЗ ${doorsState.rushWarningSeconds?.toFixed(1)}с!`
                        : `💀 РАШ ЛЕТИТ (${doorsState.rushDistanceMeters || 0}м)!`}
                    </div>
                    <div className="text-xs sm:text-sm font-black text-red-100">
                      БЕГОМ В ШКАФ У СТЕНЫ: [E] или Курок R!
                    </div>
                    {doorsState.nearInteractable?.type === 'closet' && onDoorsInteract && (
                      <button
                        type="button"
                        onClick={onDoorsInteract}
                        className="pointer-events-auto mt-1 px-4 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs shadow-lg border border-white cursor-pointer"
                      >
                        🚪 СПРЯТАТЬСЯ В ШКАФ [E]
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          </>
        )}

      {/* TOP BAR WRAPPER */}
      <div className="flex flex-col gap-1.5 w-full">
        <div className="flex items-start justify-between gap-2 w-full">
          {/* Top-Left: Player Profile HUD + Health & Stage */}
          <div className="flex flex-col gap-1.5 pointer-events-auto min-w-0">
            <PlayerProfileHUD
              skin={skin}
              username={cloudProfile?.username || skin.name}
              coins={stats.coins}
              gems={stats.gems}
              isCloudAccount={Boolean(cloudProfile)}
              isGuest={isGuestSession}
              variant="corner"
              onClick={() => {
                if (onOpenAuth) {
                  onOpenAuth();
                } else {
                  setIsMenuOpen(true);
                }
              }}
            />

            <div className="flex items-center gap-1.5 flex-wrap">
              {/* Health Bar */}
              <div className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-2xl bg-slate-950/95 border border-slate-700/70 shadow-lg">
                <Heart size={15} className="text-red-500 fill-red-500 shrink-0" />
                <div className="flex flex-col">
                  <div className="flex justify-between items-center text-[10px] sm:text-xs font-black tracking-wider text-slate-300 gap-1.5">
                    <span>HP</span>
                    <span className="font-mono-numbers">{Math.max(0, Math.round(stats.hp))}</span>
                  </div>
                  <div className="w-16 sm:w-32 h-1.5 sm:h-2 rounded-full bg-slate-800 overflow-hidden border border-slate-700 mt-0.5">
                    <div
                      className="h-full bg-gradient-to-r from-red-600 via-amber-500 to-emerald-500 transition-all duration-200"
                      style={{ width: `${Math.max(0, Math.min(100, stats.hp))}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Stage Checkpoint (relevant for Obby, Lava & Studio Playtest) */}
              {(sessionConfig.gameId === 'obby' || sessionConfig.gameId === 'lava_survival' || sessionConfig.gameId === 'studio') && (
                <div className="flex items-center gap-1 px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-xl bg-slate-900/85 border border-emerald-500/40 text-emerald-300 font-bold text-[11px] sm:text-sm shadow-md">
                  <Flag size={13} className="text-emerald-400 shrink-0" />
                  <span>
                    <span className="hidden sm:inline">Этап </span>
                    <span className="font-mono-numbers">{stats.currentCheckpoint}</span>/{Math.max(1, stats.totalCheckpoints - 1)}
                  </span>
                </div>
              )}

              {/* Desktop Game Badge */}
              <div className="hidden lg:flex items-center gap-1 px-2.5 py-1 rounded-xl bg-slate-900/85 border border-slate-700 text-slate-300 font-bold text-xs shadow-md">
                <span>
                  {sessionConfig.gameId === 'doors'
                    ? '🚪 DOORS: Отель [POV]'
                    : sessionConfig.gameId === 'bee_swarm'
                    ? '🐝 Симулятор Пасеки'
                    : sessionConfig.gameId === 'lava_survival'
                    ? '🌋 Лава 3D'
                    : sessionConfig.gameId === 'studio'
                    ? '🛠️ Студия 3D (Тест)'
                    : '🏃 Паркур Obby'}
                </span>
              </div>
            </div>

            {/* Active Voice Chat Speakers Overlay */}
            {voiceState && <VoiceActiveSpeakersOverlay voiceState={voiceState} />}
          </div>

          {/* Desktop Top-Center: DOORS HUD */}
          {sessionConfig.gameId === 'doors' && doorsState && (
            <div className="hidden md:flex flex-col items-center gap-1.5 pointer-events-auto px-2 z-30">
              <div className="flex flex-wrap items-center justify-center gap-2 px-3.5 py-2 rounded-2xl bg-stone-950/95 border-2 border-amber-500/80 shadow-[0_0_25px_rgba(245,158,11,0.3)]">
                <div className="flex items-center gap-2 pr-2 border-r border-amber-500/30">
                  <span className="text-lg">🚪</span>
                  <div className="flex flex-col">
                    <span className="text-[9px] font-extrabold uppercase tracking-widest text-amber-400">
                      {doorsState.currentRoomTitle || doorsState.phaseName || 'СТОЙКА АДМИНИСТРАТОРА'}
                    </span>
                    <span
                      data-testid="doors-counter"
                      className="font-mono-numbers font-black text-sm sm:text-base text-amber-200 leading-none"
                    >
                      ДВЕРЬ #{String(doorsState.currentDoorNumber).padStart(4, '0')} / 0100
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  data-testid="doors-rooms-atlas-btn"
                  onClick={() => setIsDoorsAtlasOpen(true)}
                  className="px-2.5 py-1 rounded-xl text-xs font-black border border-amber-400/60 bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 transition-all cursor-pointer flex items-center gap-1.5"
                  title="Открыть список всех 18 комнат DOORS и быстро переместиться"
                >
                  <span>🗺️ Комнаты (18)</span>
                </button>

                {!isTouchMode && (
                  <>
                    <button
                      type="button"
                      data-testid="doors-crouch-btn"
                      onClick={onDoorsToggleCrouch}
                      className={`px-2.5 py-1 rounded-xl text-xs font-black border transition-all cursor-pointer flex items-center gap-1.5 ${
                        doorsState.isCrouching
                          ? 'bg-emerald-500/25 border-emerald-400 text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.4)]'
                          : 'bg-stone-900 hover:bg-stone-800 border-stone-700 text-stone-300'
                      }`}
                      title="Присесть / Красться мимо слепой Фигуры [C / Ctrl]"
                    >
                      <span>{doorsState.isCrouching ? '🤫 ТИХИЙ ШАГ [C]' : '👣 ВСТАТЬ / КРАСТЬСЯ [C]'}</span>
                    </button>

                    <button
                      type="button"
                      data-testid="doors-flashlight-btn"
                      onClick={onDoorsToggleFlashlight}
                      className={`px-2.5 py-1 rounded-xl text-xs font-black border transition-all cursor-pointer flex items-center gap-1 ${
                        doorsState.flashlightOn
                          ? 'bg-amber-400 text-stone-950 border-amber-200 shadow-md'
                          : 'bg-stone-900 text-stone-400 border-stone-700'
                      }`}
                      title="Включить фонарик и отпугнуть Скрича [F]"
                    >
                      <span>🔦 [F]: {doorsState.flashlightOn ? 'ВКЛ' : 'ВЫКЛ'}</span>
                    </button>
                  </>
                )}
              </div>

              {(doorsState.entityWarningText || (doorsState.inDoor100Room && !doorsState.elevatorClosing)) && (
                <div
                  data-testid="doors-entity-warning"
                  className={`px-4 py-1.5 rounded-2xl font-black text-xs sm:text-sm tracking-wide shadow-2xl border-2 flex items-center gap-2 ${
                    doorsState.rushActive || doorsState.figureAlerted
                      ? 'bg-red-950/95 border-red-400 text-red-200 animate-bounce'
                      : doorsState.screechActive
                      ? 'bg-amber-950/95 border-amber-400 text-amber-200 animate-pulse'
                      : doorsState.eyesActive
                      ? 'bg-purple-950/95 border-purple-400 text-purple-200 animate-pulse'
                      : 'bg-stone-950/90 border-amber-500/60 text-amber-200'
                  }`}
                >
                  <span>
                    {doorsState.entityWarningText
                      ? doorsState.entityWarningText
                      : doorsState.figureAlerted
                      ? `👹 СЛЕПАЯ ФИГУРА УСЛЫШАЛА ВАС (${doorsState.figureDistance}м)! Нажмите [C] для тихого шага и бегите по лестнице на 2-й этаж к лифту!`
                      : `🤫 Дверь 100: Крадитесь на 2-й этаж [C] мимо слепой Фигуры (${doorsState.figureDistance}м) к открытому грузовому лифту!`}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Desktop Top-Center: Bee Farm HUD */}
          {sessionConfig.gameId === 'bee_swarm' && (
            <div className="hidden md:flex flex-col items-center gap-1.5 pointer-events-auto px-2">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-amber-950/95 border border-amber-500/70 shadow-xl">
                <span className="text-base animate-bounce">🐝</span>
                <div className="flex flex-col">
                  <div className="flex justify-between items-center text-[10px] sm:text-xs font-black tracking-wider text-amber-200 gap-3">
                    <span className="truncate max-w-[140px] sm:max-w-none">
                      {beeFarmState?.currentField ? `Поле: ${beeFarmState.currentField.name}` : 'Пасека (Вне поля)'}
                    </span>
                    <span className="font-mono-numbers text-amber-300">
                      {beeFarmState?.pollen || 0} / {beeFarmState?.maxPollen || 100} 🌸
                    </span>
                  </div>
                  <div className="w-36 sm:w-48 h-2.5 rounded-full bg-slate-900 overflow-hidden border border-amber-600/50 mt-0.5">
                    <div
                      className={`h-full transition-all duration-200 ${
                        (beeFarmState?.pollen || 0) >= (beeFarmState?.maxPollen || 100)
                          ? 'bg-gradient-to-r from-amber-400 to-red-500 animate-pulse'
                          : 'bg-gradient-to-r from-yellow-400 via-amber-400 to-orange-400'
                      }`}
                      style={{
                        width: `${Math.min(
                          100,
                          Math.round(((beeFarmState?.pollen || 0) / (beeFarmState?.maxPollen || 100)) * 100)
                        )}%`,
                      }}
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsBeeShopOpen(true)}
                  className="ml-1 px-2.5 py-1 rounded-xl bg-gradient-to-r from-amber-400 to-yellow-500 hover:from-amber-300 hover:to-yellow-400 text-slate-950 font-black text-[11px] shadow-md border border-amber-200 cursor-pointer transition-all flex items-center gap-1"
                  title="Открыть магазин пасеки и улучшений"
                >
                  <span>Улучшения</span>
                </button>
              </div>

              {(beeFarmState?.pollen || 0) >= (beeFarmState?.maxPollen || 100) && (
                <div className="px-3 py-0.5 rounded-full bg-amber-500 text-slate-950 font-black text-[10px] tracking-wide animate-bounce shadow-lg border border-white">
                  ⚠️ РЮКЗАК ПОЛОН! Идите на Золотой Круг Улья для переработки в Мёд! 🍯
                </div>
              )}
            </div>
          )}

          {/* Top-Right: Clean Touch-Friendly HUD Buttons */}
          <div className="flex items-center gap-1.5 sm:gap-2 pointer-events-auto shrink-0">
            {/* Mobile Chat Toggle (shown in touch mode) */}
            {isTouchMode && (
              <button
                type="button"
                onClick={() => setIsChatOpen((prev) => !prev)}
                aria-label="Чат игроков"
                className={`min-w-[42px] min-h-[42px] flex items-center justify-center rounded-xl border shadow-md cursor-pointer transition-all ${
                  isChatOpen
                    ? 'bg-sky-500 border-sky-300 text-slate-950'
                    : 'bg-slate-900/90 hover:bg-slate-800 border-slate-700/80 text-sky-300'
                }`}
              >
                <MessageSquare size={18} />
              </button>
            )}

            {/* Mobile / Compact Emotes Button (shown in touch mode or on narrow phones) */}
            {onTriggerEmote && (
              <button
                type="button"
                data-testid="mobile-emote-btn"
                onClick={() => {
                  setIsMenuOpen(false);
                  setIsBackpackOpen(false);
                  setIsEmoteMenuOpen((prev) => !prev);
                }}
                aria-label="Эмоции персонажа"
                title="Эмоции [G]"
                className={`${
                  isTouchMode ? 'flex' : 'flex sm:hidden'
                } min-w-[44px] min-h-[44px] items-center justify-center rounded-xl border shadow-md cursor-pointer transition-all ${
                  isEmoteMenuOpen
                    ? 'bg-sky-500 border-sky-300 text-slate-950'
                    : 'bg-slate-900/90 hover:bg-slate-800 border-sky-500/50 text-sky-300'
                }`}
              >
                <Smile size={19} />
              </button>
            )}

            {/* REAL-TIME WEBRTC VOICE CHAT WIDGET */}
            {voiceState && onVoiceJoin && onVoiceLeave && onVoiceToggleMute && onVoiceToggleDeafen && onVoiceSetInputMode && onVoiceSetPttActive && onVoiceSetSpatialMode && onVoiceSetMasterVolume && onVoiceSetPeerVolume && onVoiceTogglePeerMute && (
              <VoiceChatWidget
                voiceState={voiceState}
                isPanelOpen={isVoicePanelOpen}
                onTogglePanel={() => {
                  setIsMenuOpen(false);
                  setIsBackpackOpen(false);
                  setIsEmoteMenuOpen(false);
                  setIsControlsHelpOpen(false);
                  setIsVoicePanelOpen((prev) => !prev);
                }}
                onClosePanel={() => setIsVoicePanelOpen(false)}
                onJoinVoice={() => {
                  setIsMenuOpen(false);
                  setIsBackpackOpen(false);
                  setIsEmoteMenuOpen(false);
                  onVoiceJoin();
                }}
                onLeaveVoice={onVoiceLeave}
                onToggleMute={onVoiceToggleMute}
                onToggleDeafen={onVoiceToggleDeafen}
                onSetInputMode={onVoiceSetInputMode}
                onSetPttActive={onVoiceSetPttActive}
                onSetSpatialMode={onVoiceSetSpatialMode}
                onSetMasterVolume={onVoiceSetMasterVolume}
                onSetPeerVolume={onVoiceSetPeerVolume}
                onTogglePeerMute={onVoiceTogglePeerMute}
              />
            )}

            {/* 6DoF VR & CONTROLLER TRACKING BUTTON [V] */}
            {onOpenVRModal && (
              <button
                type="button"
                data-testid="hud-vr-btn"
                onClick={() => {
                  setIsMenuOpen(false);
                  setIsBackpackOpen(false);
                  setIsEmoteMenuOpen(false);
                  setIsVoicePanelOpen(false);
                  onOpenVRModal();
                }}
                title="Центр VR и 6DoF Контроллеров [V]"
                className={`min-h-[42px] min-w-[42px] flex items-center justify-center gap-1.5 px-2.5 sm:px-3 py-2 rounded-xl border shadow-lg cursor-pointer transition-all ${
                  vrEnabled
                    ? 'bg-cyan-500 border-cyan-300 text-slate-950 font-black shadow-cyan-500/30'
                    : 'bg-slate-900/90 hover:bg-slate-800 border-cyan-500/50 text-cyan-300 font-bold'
                }`}
              >
                <span className="text-base leading-none">🥽</span>
                <span className="hidden sm:inline text-xs sm:text-sm">
                  {vrEnabled ? '6DoF VR ВКЛ' : 'VR [V]'}
                </span>
                {vrEnabled && (
                  <span className="w-2 h-2 rounded-full bg-emerald-950 animate-ping" />
                )}
              </button>
            )}

            {/* ROBLOX BACKPACK BUTTON [B] */}
            <button
              type="button"
              data-testid="roblox-backpack-btn"
              onClick={() => {
                setIsMenuOpen(false);
                setIsEmoteMenuOpen(false);
                setIsVoicePanelOpen(false);
                setIsBackpackOpen((prev) => !prev);
              }}
              title="Открыть Рюкзак Blox [B]"
              className={`min-h-[42px] min-w-[42px] flex items-center justify-center gap-1.5 px-2.5 sm:px-3 py-2 rounded-xl border shadow-lg cursor-pointer transition-all ${
                isBackpackOpen
                  ? 'bg-amber-500 border-amber-300 text-slate-950 font-black'
                  : 'bg-slate-900/90 hover:bg-slate-800 border-amber-500/50 text-amber-300 font-bold'
              }`}
            >
              <Backpack size={18} className={isBackpackOpen ? 'text-slate-950' : 'text-amber-400'} />
              <span className="hidden sm:inline text-xs sm:text-sm">Рюкзак [B]</span>
            </button>

            {/* CONTROLS CHEAT-SHEET BUTTON */}
            <button
              type="button"
              data-testid="hud-controls-help-btn"
              onClick={() => {
                setIsMenuOpen(false);
                setIsBackpackOpen(false);
                setIsEmoteMenuOpen(false);
                setIsVoicePanelOpen(false);
                setIsControlsHelpOpen((prev) => !prev);
              }}
              title="Какие кнопки за что отвечают (ПК / VR / DOORS)"
              className={`min-h-[42px] min-w-[42px] flex items-center justify-center gap-1.5 px-2.5 sm:px-3 py-2 rounded-xl border shadow-lg cursor-pointer transition-all ${
                isControlsHelpOpen
                  ? 'bg-emerald-500 border-emerald-300 text-slate-950 font-black'
                  : 'bg-slate-950/95 hover:bg-slate-800 border-emerald-500/50 text-emerald-300 font-bold'
              }`}
            >
              <HelpCircle size={18} />
              <span className="hidden sm:inline text-xs sm:text-sm">Кнопки</span>
            </button>

            {/* Pause Button [Esc] */}
            <button
              type="button"
              onClick={onPause}
              aria-label="Пауза"
              title="Пауза [Esc]"
              className="min-h-[42px] min-w-[42px] flex items-center justify-center p-2 rounded-xl bg-slate-900/85 hover:bg-slate-800 border border-slate-700/70 text-slate-200 shadow-md cursor-pointer transition-all"
            >
              <Pause size={18} />
            </button>

            {/* MAIN ROBLOX QUICK MENU BUTTON */}
            <button
              type="button"
              data-testid="hud-quick-menu-btn"
              onClick={() => {
                setIsBackpackOpen(false);
                setIsVoicePanelOpen(false);
                setIsMenuOpen((prev) => !prev);
              }}
              title="Открыть меню игры"
              className={`min-h-[42px] flex items-center gap-1.5 px-2.5 sm:px-3 py-2 rounded-xl border shadow-xl cursor-pointer transition-all ${
                isMenuOpen
                  ? 'bg-gradient-to-r from-red-600 to-rose-600 border-red-300 text-white font-black'
                  : 'bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 hover:from-slate-800 hover:to-slate-850 border-slate-700 text-white font-bold'
              }`}
            >
              <Menu size={18} className="text-red-400" />
              <span className="text-xs sm:text-sm">Меню</span>
              {isUserAdmin(skin.name) && (
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              )}
            </button>
          </div>
        </div>

        {/* MOBILE ONLY (< md): Dedicated Clean Centered Sub-Row for DOORS / Bee Farm (Zero Overlap) */}
        {sessionConfig.gameId === 'doors' && doorsState && (
          <div className="flex md:hidden flex-col items-center gap-1 pointer-events-auto z-20">
            <div className="flex items-center gap-2 px-3 py-1 rounded-xl bg-stone-950/95 border border-amber-500/70 shadow-lg">
              <span className="text-sm">🚪</span>
              <span className="font-mono-numbers font-black text-xs text-amber-200">
                #{String(doorsState.currentDoorNumber).padStart(4, '0')} · {doorsState.currentRoomTitle || 'ОТЕЛЬ'}
              </span>
              <button
                type="button"
                onClick={() => setIsDoorsAtlasOpen(true)}
                className="px-2 py-0.5 rounded-lg bg-amber-500/25 border border-amber-400/60 text-[10px] font-black text-amber-200"
              >
                🗺️ 18 комнат
              </button>
              {doorsState.isCrouching && (
                <span className="text-[10px] font-black text-emerald-300">· 🤫</span>
              )}
            </div>

            {(doorsState.entityWarningText || (doorsState.inDoor100Room && !doorsState.elevatorClosing)) && (
              <div
                className={`px-3 py-1 rounded-xl font-black text-[11px] text-center shadow-xl border ${
                  doorsState.rushActive || doorsState.figureAlerted
                    ? 'bg-red-950/95 border-red-400 text-red-200 animate-bounce'
                    : doorsState.screechActive
                    ? 'bg-amber-950/95 border-amber-400 text-amber-200 animate-pulse'
                    : doorsState.eyesActive
                    ? 'bg-purple-950/95 border-purple-400 text-purple-200 animate-pulse'
                    : 'bg-stone-950/90 border-amber-500/60 text-amber-200'
                }`}
              >
                {doorsState.entityWarningText
                  ? doorsState.entityWarningText
                  : doorsState.figureAlerted
                  ? `👹 Фигура слышит (${doorsState.figureDistance}м)! Нажмите «Тихо» и к лифту!`
                  : `🤫 Дверь 100: Крадитесь к лифту (${doorsState.figureDistance}м)`}
              </div>
            )}
          </div>
        )}

        {sessionConfig.gameId === 'bee_swarm' && (
          <div className="flex md:hidden flex-col items-center gap-1 pointer-events-auto z-20">
            <div className="flex items-center gap-2 px-3 py-1 rounded-xl bg-amber-950/95 border border-amber-500/70 shadow-lg">
              <span className="text-sm">🐝</span>
              <div className="flex flex-col">
                <div className="flex items-center gap-2 text-[10px] font-black text-amber-200">
                  <span className="truncate max-w-[110px]">
                    {beeFarmState?.currentField ? beeFarmState.currentField.name : 'Пасека'}
                  </span>
                  <span className="font-mono-numbers text-amber-300">
                    {beeFarmState?.pollen || 0}/{beeFarmState?.maxPollen || 100} 🌸
                  </span>
                </div>
                <div className="w-28 h-1.5 rounded-full bg-slate-900 overflow-hidden border border-amber-600/50 mt-0.5">
                  <div
                    className="h-full bg-gradient-to-r from-yellow-400 to-amber-400 transition-all duration-200"
                    style={{
                      width: `${Math.min(
                        100,
                        Math.round(((beeFarmState?.pollen || 0) / (beeFarmState?.maxPollen || 100)) * 100)
                      )}%`,
                    }}
                  />
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsBeeShopOpen(true)}
                className="min-h-[34px] px-2.5 py-1 rounded-lg bg-amber-400 text-slate-950 font-black text-[11px] cursor-pointer"
              >
                Улучш.
              </button>
            </div>
          </div>
        )}
      </div>

      {/* QUICK ACTION MENU MODAL DRAWER (Bottom Sheet on Phone, Dropdown on Desktop) */}
      <AnimatePresence>
        {isMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMenuOpen(false)}
              className="sm:hidden fixed inset-0 bg-black/70 pointer-events-auto z-40"
            />
            <motion.div
              data-testid="hud-quick-menu-drawer"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 24 }}
              transition={{ type: 'spring', damping: 28, stiffness: 360 }}
              className="fixed bottom-0 inset-x-0 sm:bottom-auto sm:top-16 sm:inset-x-auto sm:right-4 sm:w-[370px] max-h-[84dvh] overflow-y-auto pointer-events-auto bg-slate-950/95 border-t-2 sm:border-2 border-red-500/60 rounded-t-3xl sm:rounded-2xl p-3.5 pb-safe sm:p-3.5 shadow-2xl z-50 text-slate-100 flex flex-col gap-2.5 text-xs"
            >
              {/* Mobile Sheet Grab Handle */}
              <div className="sm:hidden w-10 h-1 bg-slate-700 rounded-full mx-auto mb-0.5 shrink-0" />
            {/* Menu Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <AvatarPortraitIcon
                  skin={skin}
                  size="sm"
                  interactive={false}
                  onClick={onOpenCustomizer}
                  title="Нажмите, чтобы настроить скин"
                />
                <div className="min-w-0">
                  <h3 className="font-black text-sm text-white leading-tight truncate">
                    Меню Blox
                  </h3>
                  <span className="text-[10px] text-slate-400 font-medium truncate block">
                    Игрок: <span className="text-amber-300 font-bold">{skin.name}</span>
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsMenuOpen(false)}
                className="p-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white cursor-pointer transition-colors"
                title="Закрыть меню"
              >
                <X size={16} />
              </button>
            </div>

            {/* Return to Main Menu (always accessible in 1 click) */}
            {onReturnToTitle && (
              <button
                type="button"
                data-testid="hud-return-title-btn"
                onClick={() => {
                  setIsMenuOpen(false);
                  onReturnToTitle();
                }}
                className="w-full px-3 py-2 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white font-black text-xs flex items-center justify-between shadow-md border border-rose-300/60 cursor-pointer transition-all"
              >
                <span className="flex items-center gap-2">
                  <span>🏠</span>
                  <span>Выйти в главное меню</span>
                </span>
                <span className="px-2 py-0.5 rounded bg-black/25 text-[10px] font-bold">
                  Выбор игр
                </span>
              </button>
            )}

            {/* 3D VR Main Menu Trigger (when VR is active) */}
            {(vrEnabled || vrState?.enabled) && onToggleVRMainMenu && (
              <button
                type="button"
                data-testid="hud-vr-main-menu-btn"
                onClick={() => {
                  setIsMenuOpen(false);
                  onToggleVRMainMenu();
                }}
                className="w-full px-3 py-2 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/35 text-cyan-100 font-black text-xs flex items-center justify-between shadow-md border border-cyan-400/60 cursor-pointer transition-all"
              >
                <span className="flex items-center gap-2">
                  <span>🥽</span>
                  <span>3D Главное меню VR</span>
                </span>
                <span className="px-2 py-0.5 rounded bg-cyan-400/20 text-[10px] font-mono">
                  Кнопка X
                </span>
              </button>
            )}

            {/* Admin Panel Button (Password Protected 0808) */}
            <button
              type="button"
              onClick={() => {
                setIsMenuOpen(false);
                onOpenAdmin?.();
              }}
              className={`w-full px-2.5 py-1.5 rounded-xl font-black text-[11px] sm:text-xs flex items-center justify-between shadow-md border cursor-pointer transition-all ${
                isAdminUnlocked || isUserAdmin(skin.name)
                  ? 'bg-gradient-to-r from-amber-500 via-amber-600 to-yellow-500 text-slate-950 border-amber-300'
                  : 'bg-slate-900 hover:bg-slate-800 text-amber-300 border-amber-500/40'
              }`}
            >
              <div className="flex items-center gap-1.5">
                <Crown size={15} />
                <span>Админ Панель [F2]</span>
              </div>
              <span
                className={`px-1.5 py-0.5 rounded text-[10px] ${
                  isAdminUnlocked
                    ? 'bg-emerald-950/30 text-slate-950 font-black'
                    : 'bg-slate-950/60 text-amber-300'
                }`}
              >
                {isAdminUnlocked ? '🔓 Открыта' : '🔒 Пароль'}
              </span>
            </button>

            {/* Compact Quick Toggles Row (Звук, Сенсор, Экран, Хотбар) */}
            <div className="grid grid-cols-4 gap-1.5">
              {/* Sound Toggle */}
              <button
                type="button"
                onClick={onToggleMute}
                title={isMuted ? 'Включить звук' : 'Выключить звук'}
                className={`p-1.5 rounded-xl border flex flex-col items-center justify-center gap-1 cursor-pointer transition-all ${
                  !isMuted
                    ? 'bg-emerald-500/15 border-emerald-400/70 text-emerald-300'
                    : 'bg-slate-900/90 border-slate-800 text-slate-400'
                }`}
              >
                {isMuted ? <VolumeX size={15} /> : <Volume2 size={15} />}
                <span className="text-[9px] font-black leading-none">
                  {isMuted ? 'Без звука' : 'Звук ВКЛ'}
                </span>
              </button>

              {/* Touch Mode Toggle */}
              <button
                type="button"
                onClick={onToggleTouchMode}
                title="Вкл/Выкл экранные джойстики"
                className={`p-1.5 rounded-xl border flex flex-col items-center justify-center gap-1 cursor-pointer transition-all ${
                  isTouchMode
                    ? 'bg-emerald-500/15 border-emerald-400/70 text-emerald-300'
                    : 'bg-slate-900/90 border-slate-800 text-slate-400'
                }`}
              >
                <Smartphone size={15} />
                <span className="text-[9px] font-black leading-none">
                  {isTouchMode ? 'Сенсор ВКЛ' : 'Сенсор ВЫКЛ'}
                </span>
              </button>

              {/* Fullscreen Toggle */}
              <button
                type="button"
                onClick={onToggleFullscreen}
                title="Полноэкранный режим [F]"
                className={`p-1.5 rounded-xl border flex flex-col items-center justify-center gap-1 cursor-pointer transition-all ${
                  isFullscreen
                    ? 'bg-sky-500/15 border-sky-400/70 text-sky-300'
                    : 'bg-slate-900/90 border-slate-800 text-slate-400'
                }`}
              >
                {isFullscreen ? <Minimize size={15} /> : <Maximize size={15} />}
                <span className="text-[9px] font-black leading-none">
                  {isFullscreen ? 'Окно' : 'Фулскрин'}
                </span>
              </button>

              {/* Hotbar Visibility Toggle */}
              <button
                type="button"
                onClick={() => setIsHotbarVisible(!isHotbarVisible)}
                title="Скрыть/показать хотбар снизу [H]"
                className={`p-1.5 rounded-xl border flex flex-col items-center justify-center gap-1 cursor-pointer transition-all ${
                  isHotbarVisible
                    ? 'bg-slate-900/90 border-slate-800 text-slate-300'
                    : 'bg-amber-500/15 border-amber-400/70 text-amber-300'
                }`}
              >
                {isHotbarVisible ? <EyeOff size={15} /> : <Eye size={15} />}
                <span className="text-[9px] font-black leading-none">
                  {isHotbarVisible ? 'Хотбар ВКЛ' : 'Хотбар СКРЫТ'}
                </span>
              </button>
            </div>

            {/* Quick Controls Cheat-Sheet Trigger */}
            <button
              type="button"
              onClick={() => {
                setIsMenuOpen(false);
                setIsControlsHelpOpen(true);
              }}
              className="p-2 rounded-xl bg-emerald-950/80 hover:bg-emerald-900/80 border border-emerald-500/50 text-emerald-100 flex items-center justify-between cursor-pointer transition-all shadow-sm"
            >
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-300 shrink-0">
                  <HelpCircle size={15} />
                </div>
                <div className="text-left leading-tight">
                  <span className="text-xs font-black block">
                    ❓ Какие кнопки за что отвечают
                  </span>
                  <span className="text-[9px] text-emerald-300">
                    Шпаргалка по ПК, VR (PICO/Quest) и DOORS
                  </span>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded-md bg-emerald-400 text-slate-950 font-black text-[10px] shrink-0">
                Открыть
              </span>
            </button>

            {/* Mobile Touch & Keyboard Customizer Button */}
            <button
              type="button"
              data-testid="menu-controls-btn"
              onClick={() => {
                setIsMenuOpen(false);
                onOpenControls?.();
              }}
              className="p-2 rounded-xl bg-gradient-to-r from-sky-950/80 via-slate-900 to-emerald-950/80 hover:from-sky-900/80 hover:to-emerald-900/80 border border-sky-400/50 text-white flex items-center justify-between cursor-pointer transition-all shadow-sm"
            >
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-sky-500/20 text-sky-400 shrink-0">
                  <Sliders size={15} />
                </div>
                <div className="text-left leading-tight">
                  <span className="text-xs font-black block">
                    Джойстик &amp; управление
                  </span>
                  <span className="text-[9px] text-sky-300">
                    Настройка кнопок на экране и клавиш
                  </span>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded-md bg-sky-500 text-slate-950 font-black text-[10px] shrink-0">
                ⚙️ Настроить
              </span>
            </button>

            {/* Main Gameplay Actions Grid */}
            <div className="grid grid-cols-2 gap-1.5">
              {/* Shop Button */}
              <button
                type="button"
                onClick={() => {
                  setIsMenuOpen(false);
                  onOpenShop();
                }}
                className="p-2 rounded-xl bg-slate-900/90 hover:bg-slate-850 border border-amber-500/40 text-amber-300 flex items-center gap-2 cursor-pointer transition-all text-left"
              >
                <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-400 shrink-0">
                  <Sparkles size={15} />
                </div>
                <div className="min-w-0 leading-tight">
                  <span className="text-xs font-black block text-white truncate">Магазин</span>
                  <span className="text-[10px] text-amber-300 font-bold truncate block">{stats.coins} 🪙</span>
                </div>
              </button>

              {/* Skin Customizer */}
              <button
                type="button"
                onClick={() => {
                  setIsMenuOpen(false);
                  onOpenCustomizer();
                }}
                className="p-2 rounded-xl bg-slate-900/90 hover:bg-slate-850 border border-purple-500/40 text-purple-200 flex items-center gap-2 cursor-pointer transition-all text-left"
              >
                <div className="p-1.5 rounded-lg bg-purple-500/20 text-purple-400 shrink-0">
                  <Sparkles size={15} />
                </div>
                <div className="min-w-0 leading-tight">
                  <span className="text-xs font-black block text-white truncate">Гардероб</span>
                  <span className="text-[10px] text-slate-400 truncate block">Скин & Голова</span>
                </div>
              </button>

              {/* Leaderboard Toggle */}
              <button
                type="button"
                onClick={() => setShowLeaderboard(!showLeaderboard)}
                className={`p-2 rounded-xl border flex items-center gap-2 cursor-pointer transition-all text-left ${
                  showLeaderboard
                    ? 'bg-blue-600/30 border-blue-400 text-white'
                    : 'bg-slate-900/90 hover:bg-slate-850 border-slate-800 text-slate-200'
                }`}
              >
                <div className="p-1.5 rounded-lg bg-blue-500/20 text-blue-400 shrink-0">
                  <Users size={15} />
                </div>
                <div className="min-w-0 leading-tight">
                  <span className="text-xs font-black block text-white truncate">Игроки</span>
                  <span className="text-[10px] text-slate-400 truncate block">{totalPlayersInRoom} онлайн</span>
                </div>
              </button>

              {/* Respawn Character */}
              <button
                type="button"
                onClick={() => {
                  setIsMenuOpen(false);
                  onRespawn();
                }}
                className="p-2 rounded-xl bg-slate-900/90 hover:bg-rose-950/60 border border-rose-500/40 text-rose-300 flex items-center gap-2 cursor-pointer transition-all text-left"
              >
                <div className="p-1.5 rounded-lg bg-rose-500/20 text-rose-400 shrink-0">
                  <RotateCcw size={15} />
                </div>
                <div className="min-w-0 leading-tight">
                  <span className="text-xs font-black block text-rose-200 truncate">Респавн</span>
                  <span className="text-[10px] text-rose-400 truncate block">Чекпоинт</span>
                </div>
              </button>
            </div>

            {/* Special DOORS Mode Actions (if in DOORS) */}
            {sessionConfig.gameId === 'doors' && (
              <div className="p-2 rounded-xl bg-stone-950/90 border border-amber-500/40 space-y-1">
                <span className="text-[9px] font-black uppercase tracking-wider text-amber-400 block">
                  🚪 DOORS Отель
                </span>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setIsMenuOpen(false);
                      onDoorsTeleport100?.();
                    }}
                    className="p-1.5 rounded-lg bg-gradient-to-r from-rose-700 to-amber-700 hover:from-rose-600 hover:to-amber-600 text-white font-black text-[10px] border border-amber-300/40 shadow cursor-pointer text-left flex items-center gap-1.5 truncate"
                  >
                    <span>⚡</span>
                    <span className="leading-tight truncate">К Двери 250</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIsMenuOpen(false);
                      onDoorsTriggerRush?.();
                    }}
                    className="p-1.5 rounded-lg bg-purple-900/80 hover:bg-purple-800 text-purple-200 font-bold text-[10px] border border-purple-500/40 shadow cursor-pointer text-left flex items-center gap-1.5 truncate"
                  >
                    <span>👻</span>
                    <span className="leading-tight truncate">Вызвать Раша</span>
                  </button>
                </div>
              </div>
            )}

            {/* Room Code / Multiplayer Switcher */}
            {onOpenRoomCode && (
              <button
                type="button"
                onClick={() => {
                  setIsMenuOpen(false);
                  onOpenRoomCode();
                }}
                className="p-2 rounded-xl bg-gradient-to-r from-amber-950/80 via-slate-900 to-orange-950/80 hover:from-amber-900/80 hover:to-orange-900/80 border border-amber-400/50 text-white flex items-center justify-between cursor-pointer transition-all shadow-sm"
              >
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-400 shrink-0">
                    <KeyRound size={15} />
                  </div>
                  <div className="text-left leading-tight">
                    <span className="text-xs font-black block">
                      Комната по коду
                    </span>
                    <span className="text-[9px] text-amber-300">
                      {sessionConfig.mode === 'lan_room'
                        ? `Код: ${sessionConfig.roomId}`
                        : sessionConfig.mode === 'local_coop'
                        ? 'Раздельный экран (2 игрока)'
                        : 'Войти / создать комнату'}
                    </span>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded-md bg-amber-400 text-slate-950 font-black text-[10px] shrink-0">
                  🔑 Код
                </span>
              </button>
            )}

            {/* Footer Quick Links */}
            <div className="border-t border-slate-800 pt-2 flex items-center justify-between text-[11px]">
              <button
                type="button"
                onClick={() => {
                  setIsMenuOpen(false);
                  onOpenFeedback();
                }}
                className="min-h-[38px] px-2 flex items-center gap-1 text-blue-400 hover:text-blue-300 cursor-pointer font-bold text-xs"
              >
                <MessageSquare size={14} />
                <span>Отзыв</span>
              </button>
              <button
                type="button"
                onClick={() => setIsMenuOpen(false)}
                className="min-h-[38px] px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold cursor-pointer text-xs"
              >
                Закрыть
              </button>
            </div>
          </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ROBLOX BACKPACK / INVENTORY MODAL DRAWER (Bottom Sheet on Phone) */}
      <AnimatePresence>
        {isBackpackOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsBackpackOpen(false)}
              className="sm:hidden fixed inset-0 bg-black/70 pointer-events-auto z-40"
            />
            <motion.div
              data-testid="roblox-backpack-drawer"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 24 }}
              transition={{ type: 'spring', damping: 28, stiffness: 360 }}
              className="fixed bottom-0 inset-x-0 sm:bottom-auto sm:top-16 sm:inset-x-auto sm:right-6 sm:w-[460px] max-h-[82dvh] overflow-y-auto pointer-events-auto bg-slate-950/95 border-t-2 sm:border-2 border-amber-500/70 rounded-t-3xl sm:rounded-2xl p-3.5 pb-safe sm:p-4 shadow-2xl z-50 text-slate-100 flex flex-col gap-2.5 text-xs"
            >
              {/* Mobile Sheet Grab Handle */}
              <div className="sm:hidden w-10 h-1 bg-slate-700 rounded-full mx-auto mb-0.5 shrink-0" />
            {/* Backpack Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-amber-500/20 border border-amber-400/50 flex items-center justify-center text-amber-300 shadow shrink-0">
                  <Backpack size={16} />
                </div>
                <div className="min-w-0">
                  <h3 className="font-black text-sm text-white leading-tight truncate">
                    Рюкзак Blox (Инвентарь)
                  </h3>
                  <span className="text-[10px] text-slate-400 font-medium truncate block">
                    Выбор предмета / 1-7 на клавиатуре
                  </span>
                </div>
              </div>
              <button
                onClick={() => setIsBackpackOpen(false)}
                className="p-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white cursor-pointer transition-colors"
                title="Закрыть рюкзак"
              >
                <X size={16} />
              </button>
            </div>

            {/* Category Filter Pills (Scrollable on mobile) */}
            <div className="flex items-center gap-1 overflow-x-auto pb-0.5 text-[11px] font-bold">
              <button
                onClick={() => setBackpackFilter('all')}
                className={`px-2.5 py-1 rounded-lg whitespace-nowrap transition-all cursor-pointer ${
                  backpackFilter === 'all'
                    ? 'bg-amber-500 text-slate-950 font-black shadow-sm'
                    : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                Все (7)
              </button>
              <button
                onClick={() => setBackpackFilter('gear')}
                className={`px-2.5 py-1 rounded-lg whitespace-nowrap transition-all cursor-pointer ${
                  backpackFilter === 'gear'
                    ? 'bg-amber-500 text-slate-950 font-black shadow-sm'
                    : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                Снаряжение
              </button>
              <button
                onClick={() => setBackpackFilter('consumable')}
                className={`px-2.5 py-1 rounded-lg whitespace-nowrap transition-all cursor-pointer ${
                  backpackFilter === 'consumable'
                    ? 'bg-amber-500 text-slate-950 font-black shadow-sm'
                    : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                Еда & Напитки
              </button>
              <button
                onClick={() => setBackpackFilter('fun')}
                className={`px-2.5 py-1 rounded-lg whitespace-nowrap transition-all cursor-pointer ${
                  backpackFilter === 'fun'
                    ? 'bg-amber-500 text-slate-950 font-black shadow-sm'
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
              <span className="hidden sm:inline">Горячие клавиши: <strong>1-7</strong> выбор, <strong>B</strong> закрыть</span>
              <span className="sm:hidden">Нажмите на предмет, чтобы взять его в руки</span>
              <span className="text-amber-400 font-bold">Активен</span>
            </div>
          </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* BEE FARM TYCOON UPGRADES MODAL */}
      <AnimatePresence>
        {isBeeShopOpen && (
          <motion.div
            key="bee-farm-shop-modal"
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[94%] sm:w-[540px] max-h-[88dvh] bg-slate-950/95 border-2 border-amber-500/80 rounded-3xl p-4 sm:p-6 shadow-[0_20px_50px_rgba(0,0,0,0.8)] pointer-events-auto z-50 flex flex-col gap-3.5 text-white overflow-hidden"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-amber-500/30 pb-3">
              <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-400 to-yellow-600 flex items-center justify-center text-xl shadow-lg border border-amber-300 shrink-0">
                  🐝
                </div>
                <div className="min-w-0">
                  <h3 className="text-base sm:text-lg font-black text-amber-300 leading-tight truncate">
                    Пасека и Улучшения
                  </h3>
                  <p className="text-[11px] text-amber-200/80 truncate">
                    Улучшайте совок, рюкзак и выводите пчёл!
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsBeeShopOpen(false)}
                aria-label="Закрыть магазин пасеки"
                className="min-w-[40px] min-h-[40px] flex items-center justify-center p-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-400 hover:text-white cursor-pointer transition-colors shrink-0"
              >
                <X size={18} />
              </button>
            </div>

            {/* Honey Balance Banner */}
            <div className="flex items-center justify-between px-4 py-2.5 rounded-2xl bg-gradient-to-r from-amber-950/80 via-yellow-950/50 to-slate-900 border border-amber-500/40">
              <div className="flex items-center gap-2">
                <span className="text-xl">🍯</span>
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold uppercase text-amber-300 tracking-wider">Ваш Мёд и Монеты</span>
                  <span className="text-base sm:text-lg font-black text-white font-mono-numbers">
                    {stats.coins} <span className="text-amber-400 text-sm font-bold">🍯</span>
                  </span>
                </div>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-slate-400 block">Пыльцы в рюкзаке</span>
                <span className="text-xs sm:text-sm font-black text-amber-300">
                  {beeFarmState?.pollen || 0} / {beeFarmState?.maxPollen || 100} 🌸
                </span>
              </div>
            </div>

            {/* Upgrades Scrollable Area */}
            <div className="flex flex-col gap-3 overflow-y-auto max-h-[52dvh] pr-1">
              {/* Upgrade 1: Scooper Tool */}
              <div className="p-3 sm:p-3.5 rounded-2xl bg-slate-900/90 border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-2xl shrink-0">
                    🛠️
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-black text-sm text-white truncate">
                        {beeFarmState?.scooperName || 'Деревянный Совок'}
                      </span>
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                        Ур. {beeFarmState?.scooperLevel || 1}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Сила сбора: <strong className="text-amber-300">+{beeFarmState?.scooperPower || 2} пыльцы</strong> за взмах
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => onUpgradeScooper?.()}
                  className="min-h-[40px] w-full sm:w-auto px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-400 to-yellow-500 hover:from-amber-300 hover:to-yellow-400 text-slate-950 font-black text-xs shadow-md cursor-pointer transition-all shrink-0 flex items-center justify-center gap-1.5"
                >
                  <span>Улучшить</span>
                  <span className="font-mono-numbers text-[11px] bg-slate-950/20 px-1.5 py-0.5 rounded">
                    {beeFarmState?.scooperLevel === 1 ? '100' : beeFarmState?.scooperLevel === 2 ? '350' : beeFarmState?.scooperLevel === 3 ? '1000' : 'MAX'} 🍯
                  </span>
                </button>
              </div>

              {/* Upgrade 2: Backpack Capacity */}
              <div className="p-3 sm:p-3.5 rounded-2xl bg-slate-900/90 border border-emerald-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-2xl shrink-0">
                    🎒
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-black text-sm text-white truncate">Рюкзак для пыльцы</span>
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                        {beeFarmState?.maxPollen || 100} макс
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Вмещает больше пыльцы до похода к улью
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => onUpgradeBackpack?.()}
                  className="min-h-[40px] w-full sm:w-auto px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-400 to-teal-500 hover:from-emerald-300 hover:to-teal-400 text-slate-950 font-black text-xs shadow-md cursor-pointer transition-all shrink-0 flex items-center justify-center gap-1.5"
                >
                  <span>Увеличить</span>
                  <span className="font-mono-numbers text-[11px] bg-slate-950/20 px-1.5 py-0.5 rounded">
                    {beeFarmState?.maxPollen === 100 ? '120' : beeFarmState?.maxPollen === 250 ? '400' : beeFarmState?.maxPollen === 650 ? '1200' : 'MAX'} 🍯
                  </span>
                </button>
              </div>

              {/* Upgrade 3: Hatch Bee Egg */}
              <div className="p-3 sm:p-3.5 rounded-2xl bg-slate-900/90 border border-yellow-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-yellow-500/20 border border-yellow-400/40 flex items-center justify-center text-2xl shrink-0">
                    🐣
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-black text-sm text-white truncate">Яйцо Пчелы-Питомца</span>
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-yellow-500/20 text-yellow-300 border border-yellow-500/40">
                        Рой: {beeFarmState?.bees.length || 1}/10
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Высидеть новую пчелу: Базовая, Бомбер, Огненная или Медовая Королева!
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => onHatchBeeEgg?.()}
                  disabled={(beeFarmState?.bees.length || 1) >= 10}
                  className="min-h-[40px] w-full sm:w-auto px-3.5 py-2 rounded-xl bg-gradient-to-r from-yellow-400 to-amber-500 hover:from-yellow-300 hover:to-amber-400 disabled:opacity-50 text-slate-950 font-black text-xs shadow-md cursor-pointer transition-all shrink-0 flex items-center justify-center gap-1.5"
                >
                  <span>Высидеть</span>
                  <span className="font-mono-numbers text-[11px] bg-slate-950/20 px-1.5 py-0.5 rounded">
                    {180 + ((beeFarmState?.bees.length || 1) - 1) * 120} 🍯
                  </span>
                </button>
              </div>

              {/* Swarm Bees List */}
              <div className="p-3 rounded-2xl bg-slate-900/60 border border-slate-800">
                <span className="text-[11px] font-bold uppercase text-slate-400 tracking-wider block mb-2">
                  Ваши Пчёлы в рое ({beeFarmState?.bees.length || 1}):
                </span>
                <div className="grid grid-cols-2 gap-2">
                  {(beeFarmState?.bees || []).map((b, idx) => (
                    <div key={b.id || idx} className="flex items-center gap-2 p-2 rounded-xl bg-slate-950/70 border border-slate-800">
                      <div className="w-6 h-6 rounded-lg flex items-center justify-center text-xs" style={{ backgroundColor: b.color }}>
                        🐝
                      </div>
                      <div className="min-w-0">
                        <span className="text-xs font-bold text-white truncate block">{b.name}</span>
                        <span className="text-[10px] text-amber-300 block">+{b.gatherPower} пыльцы/сек</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Boris Tip */}
            <div className="p-2.5 rounded-2xl bg-amber-950/50 border border-amber-600/30 flex items-center gap-2.5 text-[11px] text-amber-200">
              <span className="text-lg">🧑‍🌾</span>
              <span>
                <strong>Пасечник Борис:</strong> «Собирайте пыльцу совком на полях, встаньте в золотой круг у Улья для переработки в Мёд, и покупайте новые яйца пчёл!»
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* LEADERBOARD OVERLAY */}
      {showLeaderboard && (
        <div
          data-testid="hud-room-players-list"
          className="fixed top-16 inset-x-3 sm:inset-x-auto sm:right-4 sm:w-72 pointer-events-auto bg-slate-950/95 border border-slate-700 rounded-2xl p-3 shadow-2xl z-40"
        >
          <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-2">
            <span className="font-black text-xs uppercase tracking-wider text-slate-300">
              Игроки в комнате
            </span>
            <span className="text-[10px] font-bold text-emerald-400">
              {totalPlayersInRoom} онлайн
            </span>
          </div>
          <div className="flex flex-col gap-1.5 max-h-56 overflow-y-auto">
            {/* Local Player */}
            <button
              type="button"
              onClick={() => onInspectSelfProfile?.()}
              className="w-full text-left flex items-center justify-between p-2 rounded-xl bg-sky-500/15 hover:bg-sky-500/25 border border-sky-400/40 text-xs cursor-pointer transition-colors"
              title="Открыть свою карточку профиля"
            >
              <span className="font-bold text-white flex items-center gap-2 min-w-0">
                <AvatarPortraitIcon skin={skin} size="xs" interactive={false} />
                <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                <span className="truncate">{skin.name} (Вы)</span>
              </span>
              <span className="text-amber-300 font-bold shrink-0 tabular-nums">{stats.coins} 🪙</span>
            </button>

            {/* Remote Players */}
            {remotePlayers.map((player) => (
              <button
                key={player.id}
                type="button"
                data-testid={`hud-player-row-${player.id}`}
                onClick={() =>
                  onInspectPlayer?.({
                    playerKey: player.playerKey,
                    username: player.skin?.name || player.id,
                    clientId: player.id,
                    remotePlayer: player,
                  })
                }
                title={`Открыть публичный профиль ${player.skin?.name || player.id}`}
                className="w-full text-left flex items-center justify-between p-2 rounded-xl bg-slate-900/70 hover:bg-slate-800/90 border border-slate-800 hover:border-sky-500/50 text-xs cursor-pointer transition-colors group"
              >
                <span className="font-semibold text-slate-200 group-hover:text-sky-300 flex items-center gap-2 truncate max-w-[165px]">
                  <AvatarPortraitIcon skin={player.skin} size="xs" interactive={false} />
                  <span
                    className={`w-2 h-2 rounded-full shrink-0 ${
                      player.voiceSpeaking
                        ? 'bg-emerald-400 animate-ping'
                        : player.voiceEnabled
                        ? 'bg-emerald-400'
                        : 'bg-sky-400'
                    }`}
                  />
                  <span className="truncate">{player.skin?.name || player.id}</span>
                  {player.voiceEnabled && (
                    <span
                      className={`text-[10px] shrink-0 ${
                        player.voiceMuted ? 'text-rose-400' : 'text-emerald-400'
                      }`}
                      title={player.voiceMuted ? 'В войс-чате (микрофон выкл)' : 'В войс-чате'}
                    >
                      {player.voiceMuted ? '🔇' : '🎙️'}
                    </span>
                  )}
                </span>
                <span className="text-slate-400 text-[11px] shrink-0 tabular-nums">
                  Этап {player.checkpoint + 1}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* DOORS FIRST-PERSON (POV) CENTER CROSSHAIR, VIGNETTES & INTERACTION PROMPT */}
      {sessionConfig.gameId === 'doors' && doorsState && (
        <>
          {/* Closet Hiding Wooden Slats Overlay */}
          {doorsState.isHidingInCloset && (
            <div className="fixed inset-0 pointer-events-none z-20 flex flex-col justify-between bg-black/65 border-[24px] border-amber-950/90">
              <div className="w-full h-full grid grid-cols-6 gap-6 opacity-45">
                <div className="bg-amber-950" />
                <div className="bg-amber-950" />
                <div className="bg-amber-950" />
                <div className="bg-amber-950" />
                <div className="bg-amber-950" />
                <div className="bg-amber-950" />
              </div>
              <div className="absolute top-1/3 left-1/2 -translate-x-1/2 px-5 py-2.5 rounded-2xl bg-amber-950/95 border-2 border-amber-400 text-amber-200 font-black text-sm shadow-2xl">
                🚪 ВЫ СПРЯТАЛИСЬ В ШКАФУ · Раш не тронет вас! Нажмите [E], чтобы выйти
              </div>
            </div>
          )}

          {/* Eyes Purple Glow Vignette */}
          {doorsState.eyesActive && (
            <div className="fixed inset-0 pointer-events-none z-10 shadow-[inset_0_0_110px_rgba(168,85,247,0.55)]" />
          )}

          {/* Rush Flicker Dark/Red Vignette */}
          {(doorsState.lightFlickerIntensity > 0 || doorsState.rushActive) && (
            <div className="fixed inset-0 pointer-events-none z-10 shadow-[inset_0_0_140px_rgba(220,38,38,0.65)] animate-pulse" />
          )}

          {/* Center-Screen POV Crosshair & Interactive Action Button [E] */}
          {sessionConfig.mode === 'local_coop' ? (
            <>
              <div className="fixed top-1/2 left-1/4 -translate-x-1/2 -translate-y-1/2 z-30 flex flex-col items-center gap-3 pointer-events-none">
                <div className="w-2.5 h-2.5 rounded-full bg-amber-200/90 border border-black shadow-[0_0_8px_rgba(251,191,36,0.9)]" />
                {doorsState.nearInteractable && (
                  <button
                    type="button"
                    data-testid="doors-interact-prompt"
                    onClick={onDoorsInteract}
                    className="pointer-events-auto px-4 py-2 rounded-2xl bg-stone-950/95 hover:bg-amber-950 border-2 border-amber-400 text-amber-200 font-black text-xs sm:text-sm shadow-[0_0_25px_rgba(245,158,11,0.5)] cursor-pointer transition-all flex items-center gap-2 animate-pulse"
                  >
                    <span className="px-2 py-0.5 rounded-lg bg-amber-400 text-stone-950 font-mono text-xs font-black">
                      E
                    </span>
                    <span>{doorsState.nearInteractable.label}</span>
                  </button>
                )}
              </div>
              <div className="fixed top-1/2 left-3/4 -translate-x-1/2 -translate-y-1/2 z-30 pointer-events-none">
                <div className="w-2.5 h-2.5 rounded-full bg-rose-200/90 border border-black shadow-[0_0_8px_rgba(244,63,94,0.9)]" />
              </div>
            </>
          ) : (
            <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-30 flex flex-col items-center gap-3 pointer-events-none">
              {/* Subtle POV Dot Reticle */}
              <div className="w-2.5 h-2.5 rounded-full bg-amber-200/90 border border-black shadow-[0_0_8px_rgba(251,191,36,0.9)]" />

              {/* Interactive Prompt Button (Door / Closet / Screech / Cargo Elevator Button) */}
              {doorsState.nearInteractable && (
                <button
                  type="button"
                  data-testid="doors-interact-prompt"
                  onClick={onDoorsInteract}
                  className="pointer-events-auto px-4 py-2 rounded-2xl bg-stone-950/95 hover:bg-amber-950 border-2 border-amber-400 text-amber-200 font-black text-xs sm:text-sm shadow-[0_0_25px_rgba(245,158,11,0.5)] cursor-pointer transition-all flex items-center gap-2 animate-pulse"
                >
                  <span className="px-2 py-0.5 rounded-lg bg-amber-400 text-stone-950 font-mono text-xs font-black">
                    E
                  </span>
                  <span>{doorsState.nearInteractable.label}</span>
                </button>
              )}
            </div>
          )}
        </>
      )}

      {/* MOBILE CONTROLS */}
      {isTouchMode && (
        <MobileControls
          onJoystickMove={onJoystickMove}
          onJump={onJump}
          onAction={onAction}
          activeTool={activeTool}
          layout={mobileLayout}
          gameId={sessionConfig.gameId}
          doorsState={doorsState}
          onDoorsInteract={onDoorsInteract}
          onDoorsToggleCrouch={onDoorsToggleCrouch}
          onDoorsToggleFlashlight={onDoorsToggleFlashlight}
        />
      )}

      {/* MOBILE CHAT DRAWER OVERLAY (Accessible via top-right Chat button in touch mode) */}
      <AnimatePresence>
        {isTouchMode && isChatOpen && (
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className="fixed top-16 inset-x-2 sm:inset-x-auto sm:right-4 sm:w-80 bg-slate-950/95 border-2 border-sky-500/60 rounded-2xl p-3 shadow-2xl pointer-events-auto z-50 flex flex-col gap-2"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
              <span className="text-xs font-black text-sky-300 flex items-center gap-1.5">
                <MessageSquare size={14} /> Чат комнаты
              </span>
              <button
                type="button"
                onClick={() => setIsChatOpen(false)}
                className="p-1.5 rounded-lg bg-slate-900 text-slate-400 hover:text-white cursor-pointer"
              >
                <X size={15} />
              </button>
            </div>
            <div className="flex flex-col gap-1 max-h-36 overflow-y-auto pr-1">
              {chatMessages.slice(-8).map((msg) => {
                const isPlayerAuthor = Boolean(msg.author && !SYSTEM_CHAT_AUTHORS.has(msg.author));
                const cleanAuthorName = msg.author ? msg.author.replace(/\s*👑$/, '').trim() : '';
                const matchedPeer = isPlayerAuthor
                  ? remotePlayers.find((p) => p.skin?.name?.toLowerCase() === cleanAuthorName.toLowerCase())
                  : undefined;
                const isSelfAuthor = isPlayerAuthor && cleanAuthorName.toLowerCase() === skin.name.toLowerCase();

                return (
                  <div
                    key={msg.id}
                    className="px-2.5 py-1.5 rounded-xl bg-slate-900/90 border border-slate-800 text-xs text-slate-200"
                  >
                    {msg.author &&
                      (isPlayerAuthor && (onInspectPlayer || onInspectSelfProfile) ? (
                        <button
                          type="button"
                          onClick={() => {
                            if (isSelfAuthor && onInspectSelfProfile) {
                              onInspectSelfProfile();
                            } else if (onInspectPlayer) {
                              onInspectPlayer({
                                playerKey: matchedPeer?.playerKey,
                                username: cleanAuthorName,
                                clientId: matchedPeer?.id,
                                remotePlayer: matchedPeer || null,
                              });
                            }
                          }}
                          className="font-bold text-sky-400 hover:text-sky-300 underline decoration-sky-400/40 mr-1.5 cursor-pointer"
                          title={`Открыть профиль игрока ${cleanAuthorName}`}
                        >
                          [{msg.author}]:
                        </button>
                      ) : (
                        <span className="font-bold text-sky-400 mr-1.5">[{msg.author}]:</span>
                      ))}
                    <span>{msg.text}</span>
                  </div>
                );
              })}
            </div>
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              <button
                type="button"
                onClick={() => onSendChatMessage('Всем привет! 👋')}
                className="min-h-[34px] px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700 text-[11px] font-bold text-slate-200 whitespace-nowrap cursor-pointer"
              >
                👋 Привет!
              </button>
              <button
                type="button"
                onClick={() => onSendChatMessage('Погнали дальше! 🔥')}
                className="min-h-[34px] px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700 text-[11px] font-bold text-slate-200 whitespace-nowrap cursor-pointer"
              >
                🔥 Погнали!
              </button>
              <button
                type="button"
                onClick={() => onSendChatMessage('Помогите! 🆘')}
                className="min-h-[34px] px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700 text-[11px] font-bold text-slate-200 whitespace-nowrap cursor-pointer"
              >
                🆘 Помощь!
              </button>
            </div>
            <form onSubmit={handleChatSubmit} className="flex gap-1.5">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Написать сообщение..."
                className="flex-1 min-h-[42px] px-3 py-1.5 text-sm rounded-xl bg-slate-900 border border-slate-700 text-white outline-none focus:border-sky-400"
              />
              <button
                type="submit"
                className="min-h-[42px] px-3.5 py-1.5 text-xs font-black rounded-xl bg-sky-600 hover:bg-sky-500 text-white cursor-pointer"
              >
                Ок
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* BOTTOM AREA */}
      <div className="flex items-end justify-between w-full">
        {/* Bottom-Left: Chat & Quick Phrases (Desktop) */}
        {!isTouchMode && (
          <div className="flex flex-col gap-2 max-w-xs sm:max-w-sm pointer-events-auto">
            {/* Recent Chat Messages */}
            <div className="flex flex-col gap-1 max-h-36 overflow-y-auto pr-1">
              {chatMessages.slice(-4).map((msg) => {
                const isPlayerAuthor = Boolean(msg.author && !SYSTEM_CHAT_AUTHORS.has(msg.author));
                const cleanAuthorName = msg.author ? msg.author.replace(/\s*👑$/, '').trim() : '';
                const matchedPeer = isPlayerAuthor
                  ? remotePlayers.find((p) => p.skin?.name?.toLowerCase() === cleanAuthorName.toLowerCase())
                  : undefined;
                const isSelfAuthor = isPlayerAuthor && cleanAuthorName.toLowerCase() === skin.name.toLowerCase();

                return (
                  <div
                    key={msg.id}
                    className="px-3 py-1.5 rounded-xl bg-slate-950/80 border border-slate-800 text-xs text-slate-200 shadow-md"
                  >
                    {msg.author &&
                      (isPlayerAuthor && (onInspectPlayer || onInspectSelfProfile) ? (
                        <button
                          type="button"
                          onClick={() => {
                            if (isSelfAuthor && onInspectSelfProfile) {
                              onInspectSelfProfile();
                            } else if (onInspectPlayer) {
                              onInspectPlayer({
                                playerKey: matchedPeer?.playerKey,
                                username: cleanAuthorName,
                                clientId: matchedPeer?.id,
                                remotePlayer: matchedPeer || null,
                              });
                            }
                          }}
                          className="font-bold text-sky-400 hover:text-sky-300 underline decoration-sky-400/40 mr-1.5 cursor-pointer"
                          title={`Открыть профиль игрока ${cleanAuthorName}`}
                        >
                          [{msg.author}]:
                        </button>
                      ) : (
                        <span className="font-bold text-sky-400 mr-1.5">[{msg.author}]:</span>
                      ))}
                    <span>{msg.text}</span>
                  </div>
                );
              })}
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

        {/* Bottom-Center: Compact Scrollable Roblox Hotbar + Toggle */}
        <div className="flex flex-col items-center gap-1 mx-auto pointer-events-auto max-w-full">
          <AnimatePresence mode="wait">
            {isHotbarVisible ? (
              <motion.div
                key="hotbar-expanded"
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 20, scale: 0.95 }}
                transition={{ duration: 0.2 }}
                className="flex flex-col items-center gap-1 max-w-full"
              >
                {/* Header Strip with Collapse Button (desktop only to keep phone thumb zone clean) */}
                <div className="hidden sm:flex items-center justify-between w-full px-2">
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

                {/* Spatial 3D Portal Gun Action Bar (when portal_gun selected) */}
                {activeTool === 'portal_gun' && (
                  <div
                    data-testid="portal-gun-hud"
                    className="flex flex-wrap items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-950/95 border border-cyan-400/70 shadow-[0_8px_24px_rgba(0,229,255,0.22)] text-xs"
                  >
                    <button
                      type="button"
                      data-testid="portal-fire-blue-btn"
                      onClick={() => onFirePortal?.('blue')}
                      className={`px-2.5 py-1 rounded-lg font-black border cursor-pointer transition-all ${
                        portalState?.blueActive
                          ? 'bg-cyan-500 text-slate-950 border-white shadow-md shadow-cyan-500/40'
                          : 'bg-cyan-500/20 hover:bg-cyan-500/35 text-cyan-200 border-cyan-400/60'
                      }`}
                      title="Выстрелить Синим порталом (ЛКМ или Курок R в VR)"
                    >
                      🔵 Портал A {vrEnabled ? '[Курок R]' : '[ЛКМ]'}
                    </button>
                    <button
                      type="button"
                      data-testid="portal-fire-orange-btn"
                      onClick={() => onFirePortal?.('orange')}
                      className={`px-2.5 py-1 rounded-lg font-black border cursor-pointer transition-all ${
                        portalState?.orangeActive
                          ? 'bg-orange-500 text-slate-950 border-white shadow-md shadow-orange-500/40'
                          : 'bg-orange-500/20 hover:bg-orange-500/35 text-orange-200 border-orange-400/60'
                      }`}
                      title="Выстрелить Оранжевым порталом (ПКМ / Q или Курок L в VR)"
                    >
                      🟠 Портал B {vrEnabled ? '[Курок L]' : '[ПКМ / Q]'}
                    </button>
                    <span
                      data-testid="portal-link-status"
                      className={`px-2 py-1 rounded-lg font-black border text-[11px] ${
                        portalState?.linked
                          ? 'bg-emerald-500/25 border-emerald-400 text-emerald-200'
                          : 'bg-slate-900 border-slate-700 text-slate-300'
                      }`}
                    >
                      {portalState?.linked
                        ? `🔗 Связаны! Шагните внутрь${portalState.transitCount > 0 ? ` (×${portalState.transitCount})` : ''}`
                        : portalState?.blueActive || portalState?.orangeActive
                        ? 'Откройте второй портал'
                        : 'Цельтесь и стреляйте!'}
                    </span>
                    {(portalState?.blueActive || portalState?.orangeActive) && (
                      <button
                        type="button"
                        data-testid="portal-clear-btn"
                        onClick={() => onClearPortals?.()}
                        className="px-2 py-1 rounded-lg bg-rose-600/30 hover:bg-rose-600/50 border border-rose-400/60 text-rose-100 font-black cursor-pointer"
                        title="Закрыть оба портала [Backspace]"
                      >
                        ✕ Сброс
                      </button>
                    )}
                  </div>
                )}

                {/* Block Palette Picker (when hammer selected) */}
                {activeTool === 'hammer' && (
                  <div className="flex items-center gap-1.5 p-1.5 rounded-xl bg-slate-900/90 border border-slate-700 shadow-xl">
                    <span className="hidden sm:inline text-[11px] font-bold text-slate-400 px-1">ЦВЕТ:</span>
                    {blockColors.map((col) => (
                      <button
                        key={col}
                        onClick={() => onSelectColor(col)}
                        style={{ backgroundColor: col }}
                        aria-label={`Цвет блока ${col}`}
                        className={`w-7 h-7 sm:w-6 sm:h-6 rounded-lg transition-transform cursor-pointer border ${
                          selectedColor === col ? 'scale-120 border-white shadow-lg' : 'border-black/40 hover:scale-110'
                        }`}
                      />
                    ))}
                  </div>
                )}

                {/* Hotbar Slots + Backpack Trigger (Horizontally scrollable on small phones) */}
                <div className="flex items-center gap-1 sm:gap-1.5 p-1 sm:p-2 rounded-2xl bg-slate-950/90 border-2 border-slate-700/80 shadow-[0_10px_25px_rgba(0,0,0,0.7)] max-w-[calc(100vw-16px)] overflow-x-auto no-scrollbar">
                  {/* Backpack Button inside Hotbar */}
                  <button
                    type="button"
                    onClick={() => setIsBackpackOpen((prev) => !prev)}
                    title="Рюкзак инвентаря [B / ~]"
                    className={`shrink-0 flex flex-col items-center justify-center w-11 sm:w-14 h-11 sm:h-14 rounded-xl border-2 transition-all cursor-pointer ${
                      isBackpackOpen
                        ? 'bg-amber-500 border-amber-300 text-slate-950 shadow-lg scale-105'
                        : 'bg-slate-900/90 hover:bg-slate-800 border-amber-500/60 text-amber-300 hover:border-amber-400'
                    }`}
                  >
                    <Backpack size={18} />
                    <span className="text-[8px] font-black uppercase tracking-tight mt-0.5">Рюкзак</span>
                  </button>

                  {/* 8 Item Slots (including 3D Portal Gun) */}
                  {inventoryItems.map((item) => {
                    const isEquipped = activeTool === item.id;
                    const isPortal = item.id === 'portal_gun';
                    return (
                      <button
                        key={item.id}
                        data-testid={`hotbar-tool-${item.id}`}
                        onClick={() => onSelectTool(item.id)}
                        title={`${item.label} [${item.key}]`}
                        className={`relative shrink-0 flex flex-col items-center justify-center w-11 sm:w-14 h-11 sm:h-14 rounded-xl border-2 transition-all cursor-pointer ${
                          isEquipped
                            ? isPortal
                              ? 'bg-gradient-to-b from-cyan-500/40 to-orange-500/35 border-cyan-300 shadow-[0_0_18px_rgba(0,229,255,0.65)] translate-y-[-2px]'
                              : 'bg-gradient-to-b from-sky-500/30 to-blue-600/40 border-sky-400 shadow-[0_0_15px_rgba(56,189,248,0.5)] translate-y-[-2px]'
                            : isPortal
                            ? 'bg-slate-900/95 hover:bg-slate-800 border-cyan-500/60 hover:border-orange-400'
                            : 'bg-slate-900/90 hover:bg-slate-800/90 border-slate-700/70 hover:border-slate-500'
                        }`}
                      >
                        <span className="hidden sm:block absolute top-0.5 left-1 text-[10px] font-mono font-bold text-slate-400">
                          {item.key}
                        </span>
                        <div className="sm:mt-1 scale-90 sm:scale-100">{item.icon}</div>
                        <span className="text-[7px] sm:text-[8px] font-semibold text-slate-300 truncate max-w-[38px] sm:max-w-[48px] mt-0.5">
                          {item.label}
                        </span>
                      </button>
                    );
                  })}

                  {/* Compact Mobile Collapse Button inline inside Hotbar */}
                  <button
                    type="button"
                    onClick={() => setIsHotbarVisible(false)}
                    aria-label="Скрыть панель слотов"
                    className="sm:hidden shrink-0 flex flex-col items-center justify-center w-9 h-11 rounded-xl bg-slate-900/80 border border-slate-700 text-slate-400 cursor-pointer"
                  >
                    <ChevronDown size={16} />
                  </button>
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
                className="min-h-[42px] flex items-center gap-2 px-4 py-2 rounded-2xl bg-slate-950/90 hover:bg-slate-900 border-2 border-slate-700/90 shadow-[0_10px_25px_rgba(0,0,0,0.7)] text-slate-200 hover:text-white text-xs font-bold cursor-pointer transition-colors"
                title="Развернуть панель инструментов [H]"
              >
                <Sparkles size={16} className="text-amber-400" />
                <span>Слоты</span>
                <ChevronUp size={15} className="text-slate-400" />
              </motion.button>
            )}
          </AnimatePresence>
        </div>

        {/* Bottom-Right: Emote Selection Menu (always mounted for [G] shortcut & mobile top-right button) */}
        {onTriggerEmote && (
          <div className="flex flex-col gap-1.5 pointer-events-none">
            <EmoteMenu
              isOpen={isEmoteMenuOpen}
              onToggle={() => {
                setIsBackpackOpen(false);
                setIsMenuOpen(false);
                setIsEmoteMenuOpen((prev) => !prev);
              }}
              onClose={() => setIsEmoteMenuOpen(false)}
              onSelectEmote={(emoteId) => onTriggerEmote(emoteId)}
              onCancelEmote={onCancelEmote}
              activeEmote={activeEmote}
              isTouchMode={isTouchMode}
              isDoorsPov={sessionConfig.gameId === 'doors'}
              hideTriggerButton={isTouchMode}
              disabled={isEmoteDisabled}
            />
          </div>
        )}
      </div>

      {/* DOORS 18-ROOMS ATLAS & TELEPORT MODAL */}
      <AnimatePresence>
        {isDoorsAtlasOpen && sessionConfig.gameId === 'doors' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 sm:p-6 pointer-events-auto"
            onClick={() => setIsDoorsAtlasOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.94, y: 12 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.94, y: 12 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-3xl max-h-[85vh] flex flex-col rounded-2xl bg-stone-950 border-2 border-amber-500/80 shadow-2xl overflow-hidden"
            >
              <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 bg-stone-900/90 border-b border-amber-500/30">
                <div>
                  <h2 className="text-base sm:text-lg font-black text-amber-300 uppercase tracking-wide flex items-center gap-2">
                    <span>🚪 Все 18 комнат отеля DOORS (Двери 0000 – 0100)</span>
                  </h2>
                  <p className="text-xs text-stone-400">
                    Проходите двери подряд пешком или нажмите на любую комнату для мгновенного перехода
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsDoorsAtlasOpen(false)}
                  className="p-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="p-3 sm:p-5 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                {DOORS_ROOMS_ATLAS.map((room) => {
                  const isCurrent = doorsState?.currentRoomId === room.id;
                  const doorRangeLabel =
                    room.startDoor === room.endDoor
                      ? `Дверь #${String(room.startDoor).padStart(4, '0')}`
                      : `Двери #${String(room.startDoor).padStart(4, '0')}–${String(room.endDoor).padStart(4, '0')}`;

                  return (
                    <button
                      key={room.id}
                      type="button"
                      data-testid={`doors-room-card-${room.id}`}
                      onClick={() => {
                        onDoorsSelectRoom?.(room.id);
                        setIsDoorsAtlasOpen(false);
                      }}
                      className={`text-left p-3 rounded-xl border transition-all cursor-pointer flex flex-col justify-between gap-1.5 ${
                        isCurrent
                          ? 'bg-amber-500/20 border-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.3)]'
                          : 'bg-stone-900/90 hover:bg-stone-800 border-stone-700/80 hover:border-amber-500/50'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-mono font-bold text-amber-400/90">{doorRangeLabel}</span>
                        <span className="text-base">{room.icon}</span>
                      </div>
                      <div className="font-black text-xs sm:text-sm text-amber-100 uppercase tracking-wide">
                        {room.title}
                      </div>
                      <div className="text-[11px] text-stone-400 leading-snug">{room.subtitle}</div>
                    </button>
                  );
                })}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* FLOATING QUICK CONTROLS CHEAT-SHEET CARD (MODE & VR AWARE) */}
      {isControlsHelpOpen && (
        <div
          data-testid="controls-cheatsheet-card"
          className="fixed top-16 inset-x-3 sm:inset-x-auto sm:right-4 sm:w-[410px] max-h-[82dvh] overflow-y-auto pointer-events-auto bg-slate-950/95 border-2 border-emerald-400/70 rounded-2xl p-3.5 shadow-2xl z-50 text-slate-100 flex flex-col gap-2.5 text-xs"
        >
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <div className="flex items-center gap-2">
              <HelpCircle size={16} className="text-emerald-400 shrink-0" />
              <div>
                <h3 className="font-black text-sm text-white leading-tight">
                  {vrEnabled || vrState?.enabled
                    ? 'Управление VR (PICO 4 / Quest)'
                    : sessionConfig.gameId === 'doors'
                    ? 'Кнопки в DOORS: Отель'
                    : 'Кнопки управления'}
                </h3>
                <span className="text-[10px] text-emerald-300 font-semibold block">
                  Быстрая шпаргалка прямо в игре
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsControlsHelpOpen(false)}
              className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
              title="Закрыть шпаргалку"
            >
              <X size={15} />
            </button>
          </div>

          {(vrEnabled || vrState?.enabled) ? (
            <div className="space-y-1.5">
              {[
                { key: 'Левый стик', desc: 'Ходьба туда, куда смотрите головой' },
                { key: 'Правый стик ◀/▶', desc: 'Поворот камеры (Snap-turn ±45°)' },
                { key: 'Правый Курок (Trigger)', desc: 'Открыть дверь / Шкаф / Клик по 3D VR Меню' },
                { key: 'Правая A', desc: 'Прыжок (Obby) / Присесть от Фигуры (DOORS)' },
                { key: 'Правая B', desc: 'Фонарик (DOORS) / Телепорт / Закрыть VR Меню' },
                { key: 'Левый Хват (Grip L)', desc: 'Мгновенный телепорт по лучу на пол' },
                { key: 'Левая кнопка [X]', desc: 'Открыть / закрыть 3D Главное меню VR' },
                { key: 'Левая кнопка [Y] / L3', desc: 'Скрыть / показать 3D памятку на руке' },
              ].map((row) => (
                <div
                  key={row.key}
                  className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl bg-slate-900/90 border border-slate-800"
                >
                  <span className="font-black text-cyan-300 shrink-0">{row.key}</span>
                  <span className="text-right text-slate-200">{row.desc}</span>
                </div>
              ))}

              <div className="grid grid-cols-2 gap-1.5 pt-1">
                {onToggleVRMainMenu && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsControlsHelpOpen(false);
                      onToggleVRMainMenu();
                    }}
                    className="col-span-2 px-2.5 py-2 rounded-xl bg-cyan-500/25 hover:bg-cyan-500/40 border border-cyan-400/70 text-cyan-100 font-black text-[11px] cursor-pointer"
                  >
                    🏠 Открыть 3D Главное меню VR [X]
                  </button>
                )}
                {onCalibrateVRHeight && (
                  <button
                    type="button"
                    onClick={onCalibrateVRHeight}
                    className="px-2.5 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/60 text-emerald-200 font-black text-[11px] cursor-pointer"
                  >
                    📏 Выровнять рост
                  </button>
                )}
                {onToggleVRControlsHint && (
                  <button
                    type="button"
                    onClick={onToggleVRControlsHint}
                    className="px-2.5 py-2 rounded-xl bg-sky-500/20 hover:bg-sky-500/30 border border-sky-400/60 text-sky-200 font-black text-[11px] cursor-pointer"
                  >
                    📋 3D памятка [Y]: {vrState?.controlsHintVisible ? 'ВКЛ' : 'ВЫКЛ'}
                  </button>
                )}
              </div>
            </div>
          ) : sessionConfig.gameId === 'doors' ? (
            <div className="space-y-1.5">
              {[
                { key: 'W A S D / Стрелки', desc: 'Ходьба по коридорам' },
                { key: 'E', desc: 'Открыть дверь / Спрятаться в шкаф от Раша' },
                { key: 'C / Ctrl', desc: 'Присесть (тихий шаг мимо слепой Фигуры)' },
                { key: 'F', desc: 'Включить фонарик (отпугнуть Скрича)' },
                { key: 'V', desc: 'Центр VR / 6DoF шлем PICO и Quest' },
                { key: 'Esc / P', desc: 'Пауза и настройки' },
              ].map((row) => (
                <div
                  key={row.key}
                  className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl bg-slate-900/90 border border-slate-800"
                >
                  <span className="font-black text-amber-300 shrink-0">{row.key}</span>
                  <span className="text-right text-slate-200">{row.desc}</span>
                </div>
              ))}
              <div className="p-2 rounded-xl bg-red-950/60 border border-red-500/40 text-red-200 text-[11px] font-bold">
                ⚡ Когда мигает свет и воет сирена — летит Раш! Срочно бегите к деревянному шкафу и жмите [E]!
              </div>
            </div>
          ) : (
            <div className="space-y-1.5">
              {[
                { key: 'W A S D / Стрелки', desc: 'Движение персонажа' },
                { key: 'Пробел', desc: 'Прыжок (или реактивный ранец)' },
                { key: 'Shift', desc: 'Ускорение / Спринт' },
                { key: '1 – 7', desc: 'Выбор инструмента в хотбаре' },
                { key: 'ЛКМ / E', desc: 'Атака мечом / Стройка / Взаимодействие' },
                { key: 'B', desc: 'Открыть рюкзак Blox' },
                { key: 'G', desc: 'Меню эмоций и танцев' },
                { key: 'V', desc: 'Центр VR / 6DoF шлем PICO и Quest' },
              ].map((row) => (
                <div
                  key={row.key}
                  className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl bg-slate-900/90 border border-slate-800"
                >
                  <span className="font-black text-sky-300 shrink-0">{row.key}</span>
                  <span className="text-right text-slate-200">{row.desc}</span>
                </div>
              ))}
            </div>
          )}

          {onOpenControls && (
            <button
              type="button"
              onClick={() => {
                setIsControlsHelpOpen(false);
                onOpenControls();
              }}
              className="w-full py-2 rounded-xl bg-gradient-to-r from-sky-500 to-emerald-500 hover:from-sky-400 hover:to-emerald-400 text-slate-950 font-black text-xs cursor-pointer shadow-md"
            >
              ⚙️ Все настройки / Переназначить клавиши
            </button>
          )}
        </div>
      )}
    </div>
  );
};
