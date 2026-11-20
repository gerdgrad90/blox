import React, { useCallback, useEffect, useState } from 'react';
import { motion } from 'motion/react';
import {
  X,
  Shield,
  Rocket,
  Zap,
  Coins,
  Gem,
  MessageSquare,
  Sparkles,
  Lock,
  Unlock,
  Crown,
  Heart,
  Flame,
  Check,
  Mail,
  RefreshCw,
  Star,
  Eye,
  EyeOff,
  Server,
  DoorOpen,
  KeyRound,
  Users,
  Delete,
  Pin,
  CheckCheck,
  Search,
  BarChart3,
} from 'lucide-react';
import {
  computeClientFeedbackSummary,
  FEEDBACK_GAME_LABELS,
  FeedbackRecord,
  FeedbackSummary,
  mergeFeedbackRecords,
  readFeedbackArchive,
  saveFeedbackArchive,
} from '../game/feedback';
import {
  CharacterSkin,
  DOORS_ROOMS_ATLAS,
  DoorsRoomTypeId,
  GameId,
  PlayerStats,
  RemotePlayerInfo,
} from '../game/types';
import { isUserAdmin } from '../game/controls';
import type { PublicProfileLookupInput } from '../game/publicProfile';

interface AdminModalProps {
  currentSkin: CharacterSkin;
  isAdminUnlocked: boolean;
  adminPin?: string;
  onUnlockAdmin: (pin: string) => void;
  onLockAdmin: () => void;
  currentGameId: GameId;
  stats: PlayerStats;
  remotePlayers: RemotePlayerInfo[];
  onClose: () => void;
  onSetGodMode: (enabled: boolean) => void;
  isGodMode: boolean;
  onSetFlyMode: (enabled: boolean) => void;
  isFlying: boolean;
  onSetSpeedMultiplier: (mult: number) => void;
  speedMultiplier: number;
  onSetJumpMultiplier: (mult: number) => void;
  jumpMultiplier: number;
  onTeleportToCheckpoint: (id: number) => void;
  onAddCurrency: (coins: number, gems: number) => void;
  onBroadcastMessage: (msg: string) => void;
  onTriggerAdminBlast: () => void;
  onEquipAdminCrown: () => void;
  onHealPlayer: () => void;
  onChangeSkinName: (name: string) => void;
  onTeleportToDoorsRoom?: (target: DoorsRoomTypeId | number) => void;
  onTriggerDoorsRush?: () => void;
  onTriggerDoorsScreech?: () => void;
  onGrantBeeHoney?: (amount: number) => void;
  onInspectPlayer?: (lookup: PublicProfileLookupInput) => void;
}

type FeedbackItem = FeedbackRecord;

interface AdminServerOverview {
  onlinePlayers: number;
  activeRoomCount: number;
  accountsCount: number;
  leaderboardCount: number;
  feedbackCount: number;
  uptimeSeconds: number;
  rooms: {
    roomId: string;
    gameId: string;
    mode: string;
    playerCount: number;
    openedDoorsCount: number;
    elevatorClosed: boolean;
    players: {
      id: string;
      name: string;
      coins: number;
      checkpoint: number;
    }[];
  }[];
}

const GAME_NAMES: Record<GameId, string> = {
  obby: '🏃 Паркур Obby',
  lava_survival: '🌋 Пол — это Лава',
  bee_swarm: '🐝 Bee Swarm 3D',
  doors: '🚪 DOORS [POV]',
  studio: '🛠️ Студия 3D',
};

export const AdminModal: React.FC<AdminModalProps> = ({
  currentSkin,
  isAdminUnlocked,
  adminPin = '',
  onUnlockAdmin,
  onLockAdmin,
  currentGameId,
  stats,
  remotePlayers,
  onClose,
  onSetGodMode,
  isGodMode,
  onSetFlyMode,
  isFlying,
  onSetSpeedMultiplier,
  speedMultiplier,
  onSetJumpMultiplier,
  jumpMultiplier,
  onTeleportToCheckpoint,
  onAddCurrency,
  onBroadcastMessage,
  onTriggerAdminBlast,
  onEquipAdminCrown,
  onHealPlayer,
  onChangeSkinName,
  onTeleportToDoorsRoom,
  onTriggerDoorsRush,
  onTriggerDoorsScreech,
  onGrantBeeHoney,
  onInspectPlayer,
}) => {
  const [adminTab, setAdminTab] = useState<'controls' | 'modes' | 'server' | 'inbox'>('controls');

  // Password gate state
  const [pinInput, setPinInput] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [pinError, setPinError] = useState('');
  const [verifyingPin, setVerifyingPin] = useState(false);
  const [shakeCount, setShakeCount] = useState(0);

  // Controls state
  const [broadcastInput, setBroadcastInput] = useState('');
  const [broadcastSent, setBroadcastSent] = useState(false);
  const [customCoinsInput, setCustomCoinsInput] = useState('5000');
  const [doorsDoorInput, setDoorsDoorInput] = useState(50);

  // Feedback Inbox state
  const [feedbackItems, setFeedbackItems] = useState<FeedbackItem[]>(() => readFeedbackArchive());
  const [feedbackSummary, setFeedbackSummary] = useState<FeedbackSummary>(() =>
    computeClientFeedbackSummary(readFeedbackArchive())
  );
  const [feedbackRecipient, setFeedbackRecipient] = useState('gerdgrad9@gmail.com');
  const [emailConfigured, setEmailConfigured] = useState(false);
  const [loadingFeedback, setLoadingFeedback] = useState(false);
  const [inboxFilter, setInboxFilter] = useState<'all' | 'unread' | 'pinned'>('all');
  const [starFilter, setStarFilter] = useState<number | null>(null);
  const [inboxSearch, setInboxSearch] = useState('');

  // Server Overview state
  const [overview, setOverview] = useState<AdminServerOverview | null>(null);
  const [loadingOverview, setLoadingOverview] = useState(false);

  const isNickAdmin = isUserAdmin(currentSkin.name);

  const loadFeedbackInbox = useCallback(async () => {
    setLoadingFeedback(true);
    try {
      const res = await fetch('/api/feedback', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setFeedbackRecipient(data.recipient || 'gerdgrad9@gmail.com');
        setEmailConfigured(Boolean(data.emailConfigured));
        const serverItems: FeedbackItem[] = Array.isArray(data.items) ? data.items : [];
        const merged = saveFeedbackArchive(serverItems);
        setFeedbackItems(merged);
        if (data.summary && serverItems.length >= merged.length) {
          setFeedbackSummary(data.summary);
        } else {
          setFeedbackSummary(computeClientFeedbackSummary(merged));
        }
      }
    } catch {
      const localItems = mergeFeedbackRecords([], readFeedbackArchive());
      setFeedbackItems(localItems);
      setFeedbackSummary(computeClientFeedbackSummary(localItems));
    } finally {
      setLoadingFeedback(false);
    }
  }, []);

  const loadServerOverview = useCallback(async () => {
    const activePin = adminPin || sessionStorage.getItem('blox_admin_pin_val') || '';
    if (!activePin) return;
    setLoadingOverview(true);
    try {
      const res = await fetch('/api/admin/overview', {
        cache: 'no-store',
        headers: { 'x-admin-pin': activePin },
      });
      if (res.ok) {
        const data = (await res.json()) as AdminServerOverview;
        setOverview(data);
      } else if (res.status === 401) {
        onLockAdmin();
      }
    } catch {
      // Ignore transient network error
    } finally {
      setLoadingOverview(false);
    }
  }, [adminPin, onLockAdmin]);

  useEffect(() => {
    if (!isAdminUnlocked) return;
    void loadFeedbackInbox();
    if (adminTab === 'server') {
      void loadServerOverview();
    }
  }, [isAdminUnlocked, adminTab, loadFeedbackInbox, loadServerOverview]);

  const triggerPinError = (msg: string) => {
    setPinError(msg);
    setShakeCount((c) => c + 1);
  };

  const handleVerifyPin = async (candidateRaw?: string) => {
    const candidate = (candidateRaw ?? pinInput).trim();
    if (!candidate) {
      triggerPinError('Введите пароль администратора.');
      return;
    }

    setVerifyingPin(true);
    setPinError('');
    try {
      const res = await fetch('/api/admin/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: candidate }),
      });

      if (res.ok) {
        setPinInput('');
        onUnlockAdmin(candidate);
        return;
      }

      const data = await res.json().catch(() => null);
      triggerPinError(data?.error || 'Неверный пароль! Доступ запрещён.');
    } catch {
      // Offline/local fallback check when server is temporarily unreachable
      if (candidate === '0808') {
        setPinInput('');
        onUnlockAdmin(candidate);
      } else {
        triggerPinError('Неверный пароль! Попробуйте снова.');
      }
    } finally {
      setVerifyingPin(false);
    }
  };

  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void handleVerifyPin();
  };

  const handleKeypadDigit = (digit: string) => {
    setPinError('');
    setPinInput((prev) => {
      if (prev.length >= 12) return prev;
      return `${prev}${digit}`;
    });
  };

  const handleSendBroadcast = (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastInput.trim()) return;
    onBroadcastMessage(broadcastInput.trim());
    setBroadcastInput('');
    setBroadcastSent(true);
    setTimeout(() => setBroadcastSent(false), 2000);
  };

  const handleUpdateFeedbackFlags = async (
    id: string,
    patch: { isRead?: boolean; pinned?: boolean }
  ) => {
    const activePin = adminPin || sessionStorage.getItem('blox_admin_pin_val') || '';
    setFeedbackItems((prev) => {
      const updated = prev.map((item) => (item.id === id ? { ...item, ...patch } : item));
      const saved = saveFeedbackArchive(updated);
      setFeedbackSummary(computeClientFeedbackSummary(saved));
      return saved;
    });
    try {
      const res = await fetch(`/api/admin/feedback/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-pin': activePin,
        },
        body: JSON.stringify(patch),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.summary) setFeedbackSummary(data.summary);
      }
    } catch {
      // Local archive already updated
    }
  };

  const filteredFeedbackItems = feedbackItems.filter((item) => {
    if (inboxFilter === 'unread' && item.isRead) return false;
    if (inboxFilter === 'pinned' && !item.pinned) return false;
    if (starFilter !== null && Math.round(item.rating || 0) !== starFilter) return false;
    const q = inboxSearch.trim().toLowerCase();
    if (q) {
      const hay = `${item.author} ${item.message} ${item.contactEmail || ''} ${item.gameId || ''}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const formatUptime = (sec: number) => {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    if (h > 0) return `${h}ч ${m}м`;
    if (m > 0) return `${m}м ${s}с`;
    return `${s}с`;
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md pointer-events-auto"
    >
      <motion.div
        initial={{ scale: 0.9, y: 24 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.92, y: 16 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-3xl rounded-3xl bg-slate-900 border-2 border-amber-500/70 shadow-[0_0_50px_rgba(245,158,11,0.25)] flex flex-col max-h-[92dvh] overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 p-4 sm:p-5 border-b border-amber-500/30 bg-gradient-to-r from-amber-950/60 via-slate-900 to-amber-950/60 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2.5 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-400/40 shadow-inner shrink-0">
              {isAdminUnlocked ? <Crown size={22} /> : <Lock size={22} />}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-xl font-black text-amber-300 tracking-wider truncate">
                  HD ADMIN PANEL
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-amber-400 text-slate-950 text-[10px] font-black uppercase tracking-wider shrink-0">
                  v3.0 PRO
                </span>
                {isAdminUnlocked ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/50 text-emerald-300 text-[10px] font-black">
                    <Unlock size={10} />
                    <span>Разблокировано</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-500/20 border border-rose-400/50 text-rose-300 text-[10px] font-black">
                    <Lock size={10} />
                    <span>Требуется пароль</span>
                  </span>
                )}
              </div>
              <p className="text-[11px] sm:text-xs text-slate-400 truncate">
                {isAdminUnlocked
                  ? `Активный режим: ${GAME_NAMES[currentGameId]} · Игрок: ${currentSkin.name}`
                  : 'Защищённый вход в панель управления Blox Hub'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {isAdminUnlocked && (
              <button
                type="button"
                onClick={onLockAdmin}
                title="Заблокировать админ-панель"
                className="px-2.5 py-2 rounded-xl bg-rose-950/70 hover:bg-rose-900/80 border border-rose-500/40 text-rose-300 hover:text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <Lock size={14} />
                <span className="hidden sm:inline">Заблокировать</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white cursor-pointer transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Password Verification Gate */}
        {!isAdminUnlocked ? (
          <div className="flex-1 overflow-y-auto p-5 sm:p-8 flex flex-col items-center justify-center">
            <motion.form
              key={shakeCount}
              initial={shakeCount > 0 ? { x: -10 } : false}
              animate={{ x: 0 }}
              transition={{ type: 'spring', stiffness: 700, damping: 18 }}
              onSubmit={handlePinSubmit}
              className="w-full max-w-sm bg-slate-950/90 border-2 border-slate-800 rounded-3xl p-5 sm:p-6 shadow-2xl space-y-4 text-center"
            >
              <div className="mx-auto w-14 h-14 rounded-2xl bg-amber-500/15 border border-amber-400/40 text-amber-400 flex items-center justify-center shadow-inner">
                <KeyRound size={28} />
              </div>

              <div className="space-y-1">
                <h3 className="text-lg font-black text-white tracking-wide">
                  ПРОВЕРКА ДОСТУПА
                </h3>
                <p className="text-xs text-slate-400">
                  Введите секретный пароль для входа в панель администратора.
                </p>
              </div>

              {/* Password Field */}
              <div className="relative">
                <input
                  type={showPin ? 'text' : 'password'}
                  inputMode="numeric"
                  autoFocus
                  value={pinInput}
                  onChange={(e) => {
                    setPinError('');
                    setPinInput(e.target.value.slice(0, 16));
                  }}
                  placeholder="Введите пароль..."
                  data-testid="admin-password-input"
                  className={`w-full px-4 py-3 pr-11 rounded-xl bg-slate-900 border-2 text-center font-mono text-lg tracking-[0.25em] text-white outline-none transition-colors ${
                    pinError
                      ? 'border-rose-500 focus:border-rose-400'
                      : 'border-slate-700 focus:border-amber-400'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPin((prev) => !prev)}
                  aria-label={showPin ? 'Скрыть пароль' : 'Показать пароль'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer p-1"
                >
                  {showPin ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>

              {pinError && (
                <div className="px-3 py-2 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-300 text-xs font-bold">
                  {pinError}
                </div>
              )}

              {/* Touch-friendly Numeric Keypad */}
              <div className="grid grid-cols-3 gap-2 pt-1">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                  <button
                    key={digit}
                    type="button"
                    onClick={() => handleKeypadDigit(digit)}
                    className="py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 active:scale-95 border border-slate-800 text-white font-black text-base cursor-pointer transition-all"
                  >
                    {digit}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    setPinInput('');
                    setPinError('');
                  }}
                  className="py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 active:scale-95 border border-slate-800 text-slate-400 hover:text-white font-bold text-xs cursor-pointer transition-all"
                >
                  Очистить
                </button>
                <button
                  type="button"
                  onClick={() => handleKeypadDigit('0')}
                  className="py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 active:scale-95 border border-slate-800 text-white font-black text-base cursor-pointer transition-all"
                >
                  0
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPinError('');
                    setPinInput((prev) => prev.slice(0, -1));
                  }}
                  aria-label="Удалить символ"
                  className="py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 active:scale-95 border border-slate-800 text-slate-300 hover:text-white flex items-center justify-center cursor-pointer transition-all"
                >
                  <Delete size={18} />
                </button>
              </div>

              <button
                type="submit"
                disabled={verifyingPin || !pinInput.trim()}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 disabled:opacity-50 text-slate-950 font-black text-sm shadow-lg flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-95"
              >
                <Unlock size={16} />
                <span>{verifyingPin ? 'Проверка...' : 'Открыть Админ Панель'}</span>
              </button>
            </motion.form>
          </div>
        ) : (
          /* Unlocked Admin Dashboard */
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5">
            {/* Live Player Stats + Navigation Tabs */}
            <div className="flex flex-col gap-3 p-3 rounded-2xl bg-amber-500/10 border border-amber-500/35">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2 flex-wrap">
                  <Crown size={15} className="text-amber-400" />
                  <span className="font-black text-amber-300">{currentSkin.name}</span>
                  {isNickAdmin && (
                    <span className="px-1.5 py-0.5 rounded bg-amber-400/20 text-amber-300 text-[10px] font-black">
                      OWNER
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2.5 font-mono text-[11px] font-bold">
                  <span className="text-rose-300">❤️ {Math.round(stats.hp)}/{stats.maxHp}</span>
                  <span className="text-amber-300">🪙 {stats.coins.toLocaleString()}</span>
                  <span className="text-purple-300">💎 {stats.gems.toLocaleString()}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 bg-slate-950/75 p-1 rounded-xl border border-slate-800">
                <button
                  type="button"
                  onClick={() => setAdminTab('controls')}
                  className={`px-3 py-1.5 rounded-lg font-black text-xs cursor-pointer transition-colors flex items-center justify-center gap-1.5 ${
                    adminTab === 'controls'
                      ? 'bg-amber-400 text-slate-950 shadow'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  <Zap size={13} />
                  <span>Игрок и Мир</span>
                </button>
                <button
                  type="button"
                  onClick={() => setAdminTab('modes')}
                  className={`px-3 py-1.5 rounded-lg font-black text-xs cursor-pointer transition-colors flex items-center justify-center gap-1.5 ${
                    adminTab === 'modes'
                      ? 'bg-amber-400 text-slate-950 shadow'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  <DoorOpen size={13} />
                  <span>DOORS / Пчёлы</span>
                </button>
                <button
                  type="button"
                  onClick={() => setAdminTab('server')}
                  className={`px-3 py-1.5 rounded-lg font-black text-xs cursor-pointer transition-colors flex items-center justify-center gap-1.5 ${
                    adminTab === 'server'
                      ? 'bg-amber-400 text-slate-950 shadow'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  <Server size={13} />
                  <span>Сервер</span>
                </button>
                <button
                  type="button"
                  onClick={() => setAdminTab('inbox')}
                  className={`px-3 py-1.5 rounded-lg font-black text-xs cursor-pointer transition-colors flex items-center justify-center gap-1.5 ${
                    adminTab === 'inbox'
                      ? 'bg-amber-400 text-slate-950 shadow'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  <Mail size={13} />
                  <span>Почта ({feedbackItems.length})</span>
                </button>
              </div>
            </div>

            {/* TAB 1: PLAYER & WORLD CONTROLS */}
            {adminTab === 'controls' && (
              <div className="space-y-5">
                {/* Main Toggles */}
                <div className="space-y-2">
                  <span className="text-xs font-black uppercase tracking-wider text-slate-400 block">
                    🛡️ Режимы Бессмертия и Полёта
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => onSetGodMode(!isGodMode)}
                      className={`p-3.5 rounded-2xl border-2 text-left cursor-pointer transition-all flex items-center justify-between gap-3 ${
                        isGodMode
                          ? 'bg-emerald-500/25 border-emerald-400 text-white shadow-lg'
                          : 'bg-slate-950/70 hover:bg-slate-800/80 border-slate-800 text-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400">
                          <Shield size={20} />
                        </div>
                        <div>
                          <span className="font-black text-sm block">God Mode (Бессмертие)</span>
                          <span className="text-[10px] text-slate-400 block">
                            Неуязвимость к лаве, монстрам и падениям
                          </span>
                        </div>
                      </div>
                      <span
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase shrink-0 ${
                          isGodMode ? 'bg-emerald-400 text-slate-950' : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {isGodMode ? 'ВКЛ' : 'ВЫКЛ'}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => onSetFlyMode(!isFlying)}
                      className={`p-3.5 rounded-2xl border-2 text-left cursor-pointer transition-all flex items-center justify-between gap-3 ${
                        isFlying
                          ? 'bg-sky-500/25 border-sky-400 text-white shadow-lg'
                          : 'bg-slate-950/70 hover:bg-slate-800/80 border-slate-800 text-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-sky-500/20 text-sky-400">
                          <Rocket size={20} />
                        </div>
                        <div>
                          <span className="font-black text-sm block">Fly Mode (Полёт)</span>
                          <span className="text-[10px] text-slate-400 block">
                            Пробел — вверх, Shift / Ctrl — вниз
                          </span>
                        </div>
                      </div>
                      <span
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase shrink-0 ${
                          isFlying ? 'bg-sky-400 text-slate-950' : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {isFlying ? 'ВКЛ' : 'ВЫКЛ'}
                      </span>
                    </button>
                  </div>
                </div>

                {/* Speed & Jump */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-2.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-300 flex items-center gap-1.5">
                        <Zap size={14} className="text-amber-400" />
                        <span>Скорость бега:</span>
                      </span>
                      <span className="font-mono font-black text-amber-300">{speedMultiplier}x</span>
                    </div>
                    <div className="grid grid-cols-5 gap-1.5">
                      {[1, 2, 5, 10, 15].map((val) => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => onSetSpeedMultiplier(val)}
                          className={`py-1.5 rounded-lg text-xs font-black cursor-pointer transition-colors border ${
                            speedMultiplier === val
                              ? 'bg-amber-400 text-slate-950 border-amber-300'
                              : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                          }`}
                        >
                          {val}x
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-2.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-300 flex items-center gap-1.5">
                        <Flame size={14} className="text-orange-400" />
                        <span>Сила прыжка:</span>
                      </span>
                      <span className="font-mono font-black text-orange-300">{jumpMultiplier}x</span>
                    </div>
                    <div className="grid grid-cols-5 gap-1.5">
                      {[1, 2, 4, 8, 12].map((val) => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => onSetJumpMultiplier(val)}
                          className={`py-1.5 rounded-lg text-xs font-black cursor-pointer transition-colors border ${
                            jumpMultiplier === val
                              ? 'bg-orange-400 text-slate-950 border-orange-300'
                              : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                          }`}
                        >
                          {val}x
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Give Currency */}
                <div className="space-y-2.5">
                  <span className="text-xs font-black uppercase tracking-wider text-slate-400 block">
                    💰 Выдача Монет и Гемов
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <button
                      type="button"
                      onClick={() => onAddCurrency(1000, 0)}
                      className="p-2.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/50 text-amber-300 text-xs font-black flex items-center justify-center gap-1.5 cursor-pointer transition-all active:scale-95"
                    >
                      <Coins size={14} />
                      <span>+1,000 🪙</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onAddCurrency(25000, 0)}
                      className="p-2.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/50 text-amber-300 text-xs font-black flex items-center justify-center gap-1.5 cursor-pointer transition-all active:scale-95"
                    >
                      <Coins size={14} />
                      <span>+25,000 🪙</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onAddCurrency(0, 100)}
                      className="p-2.5 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 border border-purple-400/50 text-purple-300 text-xs font-black flex items-center justify-center gap-1.5 cursor-pointer transition-all active:scale-95"
                    >
                      <Gem size={14} />
                      <span>+100 💎</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onAddCurrency(0, 1000)}
                      className="p-2.5 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 border border-purple-400/50 text-purple-300 text-xs font-black flex items-center justify-center gap-1.5 cursor-pointer transition-all active:scale-95"
                    >
                      <Gem size={14} />
                      <span>+1,000 💎</span>
                    </button>
                  </div>

                  {/* Custom coin grant */}
                  <div className="flex gap-2">
                    <input
                      type="number"
                      min={1}
                      max={1000000}
                      value={customCoinsInput}
                      onChange={(e) => setCustomCoinsInput(e.target.value)}
                      className="w-36 px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono text-xs outline-none focus:border-amber-400"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const amount = Math.max(0, Math.min(1000000, Math.floor(Number(customCoinsInput) || 0)));
                        if (amount > 0) onAddCurrency(amount, 0);
                      }}
                      className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-amber-300 text-xs font-black cursor-pointer"
                    >
                      Выдать монеты 🪙
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const amount = Math.max(0, Math.min(100000, Math.floor(Number(customCoinsInput) || 0)));
                        if (amount > 0) onAddCurrency(0, amount);
                      }}
                      className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-purple-300 text-xs font-black cursor-pointer"
                    >
                      Выдать гемы 💎
                    </button>
                  </div>
                </div>

                {/* Obby Checkpoints Teleports */}
                <div className="space-y-2">
                  <span className="text-xs font-black uppercase tracking-wider text-slate-400 block">
                    📍 Телепорт по этапам (Obby / Мир)
                  </span>
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                    {[
                      { id: 0, label: '🏁 Старт' },
                      { id: 1, label: '🚩 Этап 1' },
                      { id: 2, label: '🚩 Этап 2' },
                      { id: 3, label: '🚩 Этап 3' },
                      { id: 4, label: '🚩 Этап 4' },
                      { id: 5, label: '🏆 Финиш' },
                    ].map((cp) => (
                      <button
                        key={cp.id}
                        type="button"
                        onClick={() => onTeleportToCheckpoint(cp.id)}
                        className={`p-2 rounded-xl text-xs font-bold cursor-pointer transition-colors border ${
                          cp.id === 5
                            ? 'bg-amber-500/20 hover:bg-amber-500/30 border-amber-400 text-amber-300 font-black'
                            : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200'
                        }`}
                      >
                        {cp.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Admin Perks */}
                <div className="space-y-2">
                  <span className="text-xs font-black uppercase tracking-wider text-slate-400 block">
                    👑 Админские Способности
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <button
                      type="button"
                      onClick={onHealPlayer}
                      className="p-2.5 rounded-xl bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 text-red-300 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                    >
                      <Heart size={14} className="fill-red-400" />
                      <span>+100 HP</span>
                    </button>
                    <button
                      type="button"
                      onClick={onTriggerAdminBlast}
                      className="p-2.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                    >
                      <Sparkles size={14} />
                      <span>Салют 🎆</span>
                    </button>
                    <button
                      type="button"
                      onClick={onEquipAdminCrown}
                      className="p-2.5 rounded-xl bg-yellow-500/20 hover:bg-yellow-500/30 border border-yellow-500/40 text-yellow-300 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                    >
                      <Crown size={14} />
                      <span>Корона 👑</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onChangeSkinName('gerdgrad92')}
                      disabled={isNickAdmin}
                      className="p-2.5 rounded-xl bg-indigo-500/20 hover:bg-indigo-500/30 disabled:opacity-50 border border-indigo-500/40 text-indigo-300 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                    >
                      <Crown size={14} />
                      <span>{isNickAdmin ? 'Ник: gerdgrad92' : 'Ник gerdgrad92'}</span>
                    </button>
                  </div>
                </div>

                {/* Server Chat Broadcast */}
                <div className="space-y-2">
                  <span className="text-xs font-black uppercase tracking-wider text-slate-400 block">
                    📢 Серверное объявление в чат
                  </span>
                  <form onSubmit={handleSendBroadcast} className="flex gap-2">
                    <input
                      type="text"
                      value={broadcastInput}
                      onChange={(e) => setBroadcastInput(e.target.value)}
                      placeholder="Текст объявления для всех игроков в комнате..."
                      className="flex-1 px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:border-amber-400 outline-none"
                    />
                    <button
                      type="submit"
                      className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black flex items-center gap-1.5 cursor-pointer shadow-md transition-colors shrink-0"
                    >
                      {broadcastSent ? <Check size={14} /> : <MessageSquare size={14} />}
                      <span>{broadcastSent ? 'Отправлено!' : 'В чат'}</span>
                    </button>
                  </form>
                </div>
              </div>
            )}

            {/* TAB 2: GAME-SPECIFIC TOOLS (DOORS & BEE SWARM) */}
            {adminTab === 'modes' && (
              <div className="space-y-5">
                {/* DOORS Admin Controls */}
                <div className="p-4 rounded-2xl bg-slate-950/80 border border-amber-500/30 space-y-3.5">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">🚪</span>
                      <div>
                        <h3 className="text-sm font-black text-amber-300">DOORS: Управление комнатами и монстрами</h3>
                        <p className="text-[11px] text-slate-400">
                          {currentGameId === 'doors'
                            ? 'Вы сейчас в DOORS — команды сработают мгновенно!'
                            : 'Переключитесь в режим DOORS, чтобы использовать телепорт и спавн монстров.'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Door number teleport */}
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-bold text-slate-300">Дверь №:</span>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={doorsDoorInput}
                      onChange={(e) => setDoorsDoorInput(Math.max(0, Math.min(100, Number(e.target.value) || 0)))}
                      className="w-20 px-2.5 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-amber-300 font-mono text-sm font-black outline-none focus:border-amber-400"
                    />
                    <button
                      type="button"
                      disabled={currentGameId !== 'doors'}
                      onClick={() => onTeleportToDoorsRoom?.(doorsDoorInput)}
                      className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-slate-950 font-black text-xs cursor-pointer transition-colors"
                    >
                      Телепорт на дверь #{String(doorsDoorInput).padStart(4, '0')}
                    </button>
                  </div>

                  {/* Quick Famous Rooms */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {DOORS_ROOMS_ATLAS.filter((r) =>
                      ['elevator', 'library', 'jeff_shop', 'infirmary', 'courtyard', 'electrical_room'].includes(r.id)
                    ).map((room) => (
                      <button
                        key={room.id}
                        type="button"
                        disabled={currentGameId !== 'doors'}
                        onClick={() => onTeleportToDoorsRoom?.(room.id)}
                        className="p-2.5 rounded-xl bg-slate-900 hover:bg-amber-500/20 disabled:opacity-40 border border-slate-800 hover:border-amber-400/60 text-left cursor-pointer transition-all"
                      >
                        <div className="flex items-center justify-between text-xs font-black text-white">
                          <span className="truncate">{room.icon} {room.title}</span>
                        </div>
                        <span className="text-[10px] font-mono text-amber-400 block mt-0.5">
                          Дверь #{String(room.startDoor).padStart(4, '0')}
                        </span>
                      </button>
                    ))}
                  </div>

                  {/* Entity Spawners */}
                  <div className="flex flex-wrap gap-2 pt-1 border-t border-slate-800">
                    <button
                      type="button"
                      disabled={currentGameId !== 'doors'}
                      onClick={() => onTriggerDoorsRush?.()}
                      className="px-3.5 py-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 disabled:opacity-40 border border-rose-400/50 text-rose-200 text-xs font-black cursor-pointer"
                    >
                      ⚡ Призвать Раша (Rush)
                    </button>
                    <button
                      type="button"
                      disabled={currentGameId !== 'doors'}
                      onClick={() => onTriggerDoorsScreech?.()}
                      className="px-3.5 py-2 rounded-xl bg-indigo-500/20 hover:bg-indigo-500/30 disabled:opacity-40 border border-indigo-400/50 text-indigo-200 text-xs font-black cursor-pointer"
                    >
                      🌑 Призвать Скрича (Screech)
                    </button>
                  </div>
                </div>

                {/* Bee Swarm Admin Controls */}
                <div className="p-4 rounded-2xl bg-slate-950/80 border border-yellow-500/30 space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">🐝</span>
                    <div>
                      <h3 className="text-sm font-black text-yellow-300">Bee Swarm Simulator 3D</h3>
                      <p className="text-[11px] text-slate-400">
                        Быстрая выдача мёда и ускорение прокачки улья
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => onGrantBeeHoney?.(2500)}
                      className="px-3.5 py-2 rounded-xl bg-yellow-500/20 hover:bg-yellow-500/30 border border-yellow-400/50 text-yellow-200 text-xs font-black cursor-pointer"
                    >
                      🍯 +2,500 Мёда
                    </button>
                    <button
                      type="button"
                      onClick={() => onGrantBeeHoney?.(15000)}
                      className="px-3.5 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/50 text-amber-200 text-xs font-black cursor-pointer"
                    >
                      🍯 +15,000 Мёда
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: LIVE SERVER MONITOR & ROOM PLAYERS */}
            {adminTab === 'server' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-black uppercase tracking-wider text-slate-400">
                    🌐 Мониторинг сервера в реальном времени
                  </span>
                  <button
                    type="button"
                    onClick={() => void loadServerOverview()}
                    className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <RefreshCw size={13} className={loadingOverview ? 'animate-spin' : ''} />
                    <span>Обновить</span>
                  </button>
                </div>

                {overview && (
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                    <div className="p-3 rounded-2xl bg-slate-950/80 border border-slate-800">
                      <span className="text-[10px] text-slate-400 block">Онлайн</span>
                      <span className="text-lg font-black text-emerald-400 font-mono">{overview.onlinePlayers}</span>
                    </div>
                    <div className="p-3 rounded-2xl bg-slate-950/80 border border-slate-800">
                      <span className="text-[10px] text-slate-400 block">Комнат</span>
                      <span className="text-lg font-black text-sky-400 font-mono">{overview.activeRoomCount}</span>
                    </div>
                    <div className="p-3 rounded-2xl bg-slate-950/80 border border-slate-800">
                      <span className="text-[10px] text-slate-400 block">Аккаунтов</span>
                      <span className="text-lg font-black text-amber-300 font-mono">{overview.accountsCount}</span>
                    </div>
                    <div className="p-3 rounded-2xl bg-slate-950/80 border border-slate-800">
                      <span className="text-[10px] text-slate-400 block">Лидерборд</span>
                      <span className="text-lg font-black text-purple-300 font-mono">{overview.leaderboardCount}</span>
                    </div>
                    <div className="p-3 rounded-2xl bg-slate-950/80 border border-slate-800 col-span-2 sm:col-span-1">
                      <span className="text-[10px] text-slate-400 block">Аптайм</span>
                      <span className="text-lg font-black text-white font-mono">{formatUptime(overview.uptimeSeconds)}</span>
                    </div>
                  </div>
                )}

                {/* Active Server Rooms */}
                <div className="space-y-2">
                  <span className="text-xs font-bold text-slate-300 block">
                    Активные комнаты на сервере ({overview?.rooms.length || 0}):
                  </span>
                  {loadingOverview && !overview ? (
                    <div className="py-6 text-center text-xs text-slate-400">Загрузка данных сервера...</div>
                  ) : !overview || overview.rooms.length === 0 ? (
                    <div className="py-6 text-center text-xs text-slate-400 bg-slate-950/50 rounded-2xl border border-slate-800">
                      Сейчас нет активных сетевых комнат с игроками.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {overview.rooms.map((room) => (
                        <div
                          key={room.roomId}
                          className="p-3 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-2"
                        >
                          <div className="flex items-center justify-between gap-2 text-xs">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="font-mono font-black text-amber-300 truncate">{room.roomId}</span>
                              <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px] font-bold">
                                {room.gameId}
                              </span>
                            </div>
                            <span className="text-emerald-400 font-black shrink-0">
                              {room.playerCount} игр.
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {room.players.map((p) => (
                              <button
                                key={p.id}
                                type="button"
                                onClick={() => onInspectPlayer?.({ username: p.name, clientId: p.id })}
                                className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-[11px] text-slate-200 font-bold cursor-pointer"
                              >
                                {p.name} · 🪙{p.coins}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Peers in Current Client Room */}
                {remotePlayers.length > 0 && (
                  <div className="space-y-2 pt-2 border-t border-slate-800">
                    <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                      <Users size={13} className="text-emerald-400" />
                      <span>Игроки рядом с вами ({remotePlayers.length}):</span>
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {remotePlayers.map((rp) => (
                        <button
                          key={rp.id}
                          type="button"
                          onClick={() =>
                            onInspectPlayer?.({
                              playerKey: rp.playerKey,
                              username: rp.skin.name,
                              clientId: rp.id,
                              remotePlayer: rp,
                            })
                          }
                          className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-sky-500/60 text-xs font-bold text-white cursor-pointer"
                        >
                          {rp.skin.name} (Профиль →)
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB 4: FEEDBACK INBOX (PERMANENT ARCHIVE + OVERALL RATING) */}
            {adminTab === 'inbox' && (
              <div className="space-y-4">
                {/* Header & Permanent Storage Notice */}
                <div className="flex flex-wrap items-center justify-between gap-2 p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800">
                  <div className="space-y-0.5">
                    <div className="text-xs font-black text-white flex items-center gap-2 flex-wrap">
                      <Mail size={15} className="text-sky-400" />
                      <span>Получатель писем: {feedbackRecipient}</span>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-500/35 text-emerald-300 text-[10px] font-black">
                        <Lock size={10} />
                        <span>Письма хранятся навсегда</span>
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400">
                      {emailConfigured
                        ? '✅ Авто-отправка на Gmail/Resend активна · Все письма сохраняются в Почте без удаления.'
                        : 'ℹ️ Каждое письмо навсегда сохраняется в этой вкладке (для дубляжа на Gmail укажите SMTP_USER/SMTP_PASS в Secrets).'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void loadFeedbackInbox()}
                    className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <RefreshCw size={13} className={loadingFeedback ? 'animate-spin' : ''} />
                    <span>Обновить</span>
                  </button>
                </div>

                {/* Overall Rating by Reviews Card */}
                <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-950/40 via-slate-950 to-slate-900 border border-amber-500/35 space-y-3">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <BarChart3 size={16} className="text-amber-400" />
                      <h3 className="text-sm font-black text-amber-300 uppercase tracking-wide">
                        Общая оценка по отзывам
                      </h3>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] font-bold">
                      <span className="px-2 py-0.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-200">
                        Писем всего: <strong className="text-white">{feedbackSummary.totalLetters}</strong>
                      </span>
                      <span className="px-2 py-0.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-200">
                        С оценкой: <strong className="text-amber-300">{feedbackSummary.ratedCount}</strong>
                      </span>
                      {feedbackSummary.ratedCount > 0 && (
                        <span className="px-2 py-0.5 rounded-lg bg-emerald-500/15 border border-emerald-500/35 text-emerald-300">
                          {feedbackSummary.positivePercent}% довольны
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-center">
                    {/* Big Score */}
                    <div className="sm:col-span-4 flex flex-col items-center justify-center p-3 rounded-2xl bg-slate-950/90 border border-slate-800 text-center">
                      <div className="flex items-baseline gap-1">
                        <span className="text-3xl sm:text-4xl font-black text-amber-300 font-mono">
                          {feedbackSummary.ratedCount > 0 ? feedbackSummary.averageRating.toFixed(1) : '0.0'}
                        </span>
                        <span className="text-xs font-bold text-slate-500">/ 5.0</span>
                      </div>
                      <div className="flex items-center gap-1 my-1.5">
                        {[1, 2, 3, 4, 5].map((n) => (
                          <Star
                            key={n}
                            size={16}
                            className={
                              feedbackSummary.averageRating >= n - 0.35
                                ? 'text-amber-400 fill-amber-400'
                                : 'text-slate-700 fill-none'
                            }
                          />
                        ))}
                      </div>
                      <span className="text-[11px] text-slate-400">
                        {feedbackSummary.ratedCount > 0
                          ? `На основе ${feedbackSummary.ratedCount} оценок`
                          : 'Пока нет оценок звёздами'}
                      </span>
                    </div>

                    {/* 5..1 Star Distribution Bars (clickable filters) */}
                    <div className="sm:col-span-8 space-y-1.5">
                      {([5, 4, 3, 2, 1] as const).map((star) => {
                        const count = feedbackSummary.breakdown[String(star) as '1' | '2' | '3' | '4' | '5'] || 0;
                        const pct =
                          feedbackSummary.ratedCount > 0
                            ? Math.round((count / feedbackSummary.ratedCount) * 100)
                            : 0;
                        const isSelected = starFilter === star;
                        return (
                          <button
                            key={star}
                            type="button"
                            onClick={() => setStarFilter((prev) => (prev === star ? null : star))}
                            title={`Показать только отзывы на ${star}★`}
                            className={`w-full flex items-center gap-2 text-xs px-2 py-1 rounded-lg transition-colors cursor-pointer ${
                              isSelected
                                ? 'bg-amber-500/20 border border-amber-400/60'
                                : 'hover:bg-slate-800/70 border border-transparent'
                            }`}
                          >
                            <span className="w-8 text-left font-black text-amber-300 flex items-center gap-0.5 shrink-0">
                              {star}
                              <Star size={11} className="fill-amber-400 text-amber-400" />
                            </span>
                            <div className="flex-1 h-2.5 rounded-full bg-slate-800 overflow-hidden">
                              <div
                                className="h-full rounded-full bg-gradient-to-r from-amber-500 to-yellow-300 transition-all duration-300"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className="w-16 text-right font-mono text-[11px] text-slate-300 shrink-0">
                              {count} ({pct}%)
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Per-Game Rating Breakdown */}
                  {Object.keys(feedbackSummary.byGame).length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-2 border-t border-slate-800/80">
                      {Object.entries(feedbackSummary.byGame).map(([gId, gStats]) => (
                        <span
                          key={gId}
                          className="px-2.5 py-1 rounded-lg bg-slate-900/90 border border-slate-800 text-[11px] text-slate-300 flex items-center gap-1.5"
                        >
                          <span className="font-bold">{FEEDBACK_GAME_LABELS[gId] || gId}</span>
                          <span className="text-amber-300 font-black">
                            {gStats.ratedCount > 0 ? `★ ${gStats.averageRating.toFixed(1)}` : 'без оценок'}
                          </span>
                          <span className="text-slate-500">({gStats.totalLetters})</span>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Filters & Search */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {(
                      [
                        { id: 'all', label: `Все (${feedbackItems.length})` },
                        { id: 'unread', label: `Новые (${feedbackSummary.unreadCount})` },
                        { id: 'pinned', label: `Закреплённые (${feedbackItems.filter((i) => i.pinned).length})` },
                      ] as const
                    ).map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => setInboxFilter(f.id)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold cursor-pointer transition-colors border ${
                          inboxFilter === f.id
                            ? 'bg-amber-400 text-slate-950 border-amber-300'
                            : 'bg-slate-900 text-slate-300 border-slate-800 hover:bg-slate-800'
                        }`}
                      >
                        {f.label}
                      </button>
                    ))}
                    {starFilter !== null && (
                      <button
                        type="button"
                        onClick={() => setStarFilter(null)}
                        className="px-2.5 py-1 rounded-lg text-xs font-bold cursor-pointer bg-amber-500/20 text-amber-300 border border-amber-400/50"
                      >
                        Фильтр: {starFilter}★ ×
                      </button>
                    )}
                  </div>

                  <div className="relative flex-1 min-w-[180px] max-w-xs">
                    <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                      type="text"
                      value={inboxSearch}
                      onChange={(e) => setInboxSearch(e.target.value)}
                      placeholder="Поиск по письмам..."
                      className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 outline-none focus:border-amber-400"
                    />
                  </div>
                </div>

                {loadingFeedback && feedbackItems.length === 0 ? (
                  <div className="py-10 text-center text-xs text-slate-400">Загрузка писем...</div>
                ) : filteredFeedbackItems.length === 0 ? (
                  <div className="py-10 text-center text-xs text-slate-400 bg-slate-950/50 rounded-2xl border border-slate-800">
                    {feedbackItems.length === 0
                      ? 'Пока нет ни одного письма из формы обратной связи.'
                      : 'По выбранному фильтру писем не найдено.'}
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {filteredFeedbackItems.map((item) => (
                      <div
                        key={item.id}
                        className={`p-3.5 rounded-2xl border space-y-2 transition-colors ${
                          item.pinned
                            ? 'bg-amber-950/20 border-amber-500/50'
                            : !item.isRead
                            ? 'bg-slate-900/90 border-sky-500/40'
                            : 'bg-slate-950/80 border-slate-800'
                        }`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            {item.pinned && (
                              <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px] font-black">
                                📌 Закреплено
                              </span>
                            )}
                            {!item.isRead && (
                              <span className="px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-300 text-[10px] font-black">
                                Новое
                              </span>
                            )}
                            <span className="font-black text-sm text-white">{item.author}</span>
                            {item.rating > 0 && (
                              <span className="flex items-center gap-0.5 text-amber-400 text-xs font-bold">
                                <Star size={12} className="fill-amber-400" />
                                {item.rating}/5
                              </span>
                            )}
                            {item.gameId && (
                              <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px] font-mono">
                                {FEEDBACK_GAME_LABELS[item.gameId] || item.gameId}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`px-2 py-0.5 rounded-md text-[10px] font-black ${
                                item.emailDelivered
                                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                  : 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                              }`}
                            >
                              {item.emailDelivered ? 'Отправлено на Gmail' : 'Сохранено навсегда'}
                            </span>
                            <span className="text-[10px] text-slate-500">
                              {new Date(item.createdAt).toLocaleString('ru-RU')}
                            </span>
                            <button
                              type="button"
                              onClick={() => void handleUpdateFeedbackFlags(item.id, { pinned: !item.pinned })}
                              title={item.pinned ? 'Открепить письмо' : 'Закрепить письмо'}
                              className={`p-1.5 rounded-lg border cursor-pointer transition-colors ${
                                item.pinned
                                  ? 'bg-amber-500/20 border-amber-400/50 text-amber-300'
                                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-amber-300'
                              }`}
                            >
                              <Pin size={13} />
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleUpdateFeedbackFlags(item.id, { isRead: !item.isRead })}
                              title={item.isRead ? 'Отметить как непрочитанное' : 'Отметить как прочитанное'}
                              className={`p-1.5 rounded-lg border cursor-pointer transition-colors ${
                                item.isRead
                                  ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-emerald-300'
                              }`}
                            >
                              {item.isRead ? <CheckCheck size={13} /> : <Check size={13} />}
                            </button>
                          </div>
                        </div>

                        {item.contactEmail && (
                          <div className="text-[11px] text-sky-300">
                            Контакт: <span className="font-mono">{item.contactEmail}</span>
                          </div>
                        )}

                        <p className="text-xs sm:text-sm text-slate-200 whitespace-pre-wrap bg-slate-900/70 p-2.5 rounded-xl border border-slate-800/80">
                          {item.message || '(только оценка звёздами)'}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/70 flex items-center justify-between gap-2 shrink-0">
          <span className="text-[11px] text-slate-500">
            {isAdminUnlocked ? 'Горячая клавиша: [F2]' : 'Защищено паролем'}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-black cursor-pointer transition-colors"
          >
            Закрыть
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};
