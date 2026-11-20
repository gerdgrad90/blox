import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useDragControls, useMotionValue, animate } from 'motion/react';
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Coins,
  Gem,
  Sparkles,
  Trophy,
  RefreshCw,
  GripHorizontal,
  RotateCcw,
  Clock,
  Gift,
  X,
  Minimize2,
  Maximize2,
} from 'lucide-react';
import {
  DailyQuestsState,
  QUEST_REROLL_COST,
  QUESTS_UPDATED_EVENT,
  claimAllReadyQuestRewards,
  claimQuestReward,
  formatResetCountdown,
  getDailyQuestsState,
  rerollDailyQuest,
} from '../game/quests';
import { sound } from '../game/audio';

interface QuestsWidgetProps {
  onRewardClaimed: (coins: number, gems: number) => void;
  playerCoins: number;
}

const QUESTS_POS_STORAGE_KEY = 'blox_quests_widget_pos_v1';
const QUESTS_HIDDEN_STORAGE_KEY = 'blox_quests_widget_hidden_v1';
const QUESTS_MINI_STORAGE_KEY = 'blox_quests_widget_mini_v1';
const QUESTS_EXPANDED_STORAGE_KEY = 'blox_quests_widget_expanded_v1';

function loadSavedPosition(): { x: number; y: number } {
  try {
    const raw = localStorage.getItem(QUESTS_POS_STORAGE_KEY);
    if (!raw) return { x: 0, y: 0 };
    const parsed = JSON.parse(raw);
    if (typeof parsed?.x === 'number' && typeof parsed?.y === 'number') {
      return { x: parsed.x, y: parsed.y };
    }
  } catch {}
  return { x: 0, y: 0 };
}

function savePosition(x: number, y: number) {
  try {
    localStorage.setItem(QUESTS_POS_STORAGE_KEY, JSON.stringify({ x: Math.round(x), y: Math.round(y) }));
  } catch {}
}

function loadBoolPref(key: string, fallback: boolean): boolean {
  try {
    const raw = localStorage.getItem(key);
    if (raw === '1' || raw === 'true') return true;
    if (raw === '0' || raw === 'false') return false;
  } catch {}
  return fallback;
}

function saveBoolPref(key: string, value: boolean) {
  try {
    localStorage.setItem(key, value ? '1' : '0');
  } catch {}
}

export const QuestsWidget: React.FC<QuestsWidgetProps> = ({ onRewardClaimed, playerCoins }) => {
  const [questState, setQuestState] = useState<DailyQuestsState>(() => getDailyQuestsState());
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const [claimBanner, setClaimBanner] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState<boolean>(() =>
    loadBoolPref(QUESTS_EXPANDED_STORAGE_KEY, false)
  );
  const [isHidden, setIsHidden] = useState<boolean>(() => loadBoolPref(QUESTS_HIDDEN_STORAGE_KEY, false));
  const [isMini, setIsMini] = useState<boolean>(() => loadBoolPref(QUESTS_MINI_STORAGE_KEY, true));
  const constraintsRef = useRef<HTMLDivElement>(null);
  const widgetRef = useRef<HTMLDivElement>(null);
  const dragControls = useDragControls();

  const initialPos = loadSavedPosition();
  const x = useMotionValue(initialPos.x);
  const y = useMotionValue(initialPos.y);
  const [hasMoved, setHasMoved] = useState<boolean>(
    Math.abs(initialPos.x) > 4 || Math.abs(initialPos.y) > 4
  );

  useEffect(() => {
    const syncState = () => {
      const currentNow = Date.now();
      setNowMs(currentNow);
      setQuestState(getDailyQuestsState(currentNow));
    };

    syncState();
    window.addEventListener(QUESTS_UPDATED_EVENT, syncState);
    const interval = setInterval(syncState, 1000);
    return () => {
      window.removeEventListener(QUESTS_UPDATED_EVENT, syncState);
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (!claimBanner) return;
    const t = setTimeout(() => setClaimBanner(null), 2400);
    return () => clearTimeout(t);
  }, [claimBanner]);

  const clampToViewport = () => {
    if (!widgetRef.current) return;
    const rect = widgetRef.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let dx = 0;
    let dy = 0;
    if (rect.left < 8) dx = 8 - rect.left;
    else if (rect.right > vw - 8) dx = vw - 8 - rect.right;
    if (rect.top < 8) dy = 8 - rect.top;
    else if (rect.bottom > vh - 8) dy = vh - 8 - rect.bottom;

    if (dx !== 0 || dy !== 0) {
      const nextX = x.get() + dx;
      const nextY = y.get() + dy;
      x.set(nextX);
      y.set(nextY);
      savePosition(nextX, nextY);
    }
  };

  useEffect(() => {
    if (isHidden) return;
    clampToViewport();
    window.addEventListener('resize', clampToViewport);
    return () => window.removeEventListener('resize', clampToViewport);
  }, [isExpanded, isMini, isHidden]);

  const handleDragEnd = () => {
    clampToViewport();
    const curX = x.get();
    const curY = y.get();
    savePosition(curX, curY);
    setHasMoved(Math.abs(curX) > 4 || Math.abs(curY) > 4);
  };

  const handleResetPosition = () => {
    animate(x, 0, { type: 'spring', stiffness: 320, damping: 26 });
    animate(y, 0, { type: 'spring', stiffness: 320, damping: 26 });
    savePosition(0, 0);
    setHasMoved(false);
  };

  const handleToggleExpanded = () => {
    setIsExpanded((prev) => {
      const next = !prev;
      saveBoolPref(QUESTS_EXPANDED_STORAGE_KEY, next);
      return next;
    });
  };

  const handleCollapsePanel = () => {
    setIsExpanded(false);
    saveBoolPref(QUESTS_EXPANDED_STORAGE_KEY, false);
  };

  const handleHideWidget = () => {
    setIsExpanded(false);
    saveBoolPref(QUESTS_EXPANDED_STORAGE_KEY, false);
    setIsHidden(true);
    saveBoolPref(QUESTS_HIDDEN_STORAGE_KEY, true);
  };

  const handleShowWidget = () => {
    setIsHidden(false);
    saveBoolPref(QUESTS_HIDDEN_STORAGE_KEY, false);
  };

  const handleToggleMini = () => {
    const next = !isMini;
    setIsMini(next);
    saveBoolPref(QUESTS_MINI_STORAGE_KEY, next);
  };

  const handleClaim = (id: string) => {
    const { state, claimedQuest } = claimQuestReward(id);
    setQuestState(state);
    if (claimedQuest) {
      onRewardClaimed(claimedQuest.rewardCoins, claimedQuest.rewardGems);
      sound.playAchievement();
      setClaimBanner(
        claimedQuest.rewardGems > 0
          ? `+${claimedQuest.rewardCoins} 🪙 и +${claimedQuest.rewardGems} 💎 (ГИПЕР РЕДКИЙ!) получено!`
          : `+${claimedQuest.rewardCoins} 🪙 получено!`
      );
    }
  };

  const handleClaimAll = () => {
    const { state, claimedQuests, totalCoins, totalGems } = claimAllReadyQuestRewards();
    setQuestState(state);
    if (claimedQuests.length > 0) {
      onRewardClaimed(totalCoins, totalGems);
      sound.playVictory();
      setClaimBanner(
        totalGems > 0
          ? `Награда за ${claimedQuests.length} квеста: +${totalCoins} 🪙 +${totalGems} 💎 (РЕДКИЙ!)`
          : `Награда за ${claimedQuests.length} квеста: +${totalCoins} 🪙`
      );
    }
  };

  const handleReroll = (id: string) => {
    if (playerCoins < QUEST_REROLL_COST) {
      sound.playPlaceBlock();
      return;
    }
    onRewardClaimed(-QUEST_REROLL_COST, 0);
    sound.playCoin();
    const nextState = rerollDailyQuest(id);
    setQuestState(nextState);
  };

  const quests = questState.quests;
  const completedCount = quests.filter((q) => q.completed).length;
  const readyToClaimCount = quests.filter((q) => q.completed && !q.claimed).length;
  const countdownText = formatResetCountdown(questState.expiresAt, nowMs);

  // Hidden state: only a tiny unobtrusive edge button to restore if needed
  if (isHidden) {
    return (
      <div className="pointer-events-none fixed right-2 top-16 sm:top-20 z-[45]">
        <button
          type="button"
          onClick={(e) => {
            e.currentTarget.blur();
            handleShowWidget();
          }}
          data-testid="quests-restore-button"
          aria-label={`Показать квесты (${completedCount}/${quests.length})`}
          title={`Показать квесты (${completedCount}/${quests.length})`}
          className="pointer-events-auto relative w-7 h-7 rounded-lg bg-slate-900/90 hover:bg-slate-900 border border-amber-500/40 hover:border-amber-400/80 text-amber-300/80 hover:text-amber-300 flex items-center justify-center shadow-md cursor-pointer transition-all opacity-65 hover:opacity-100"
        >
          <Trophy size={13} />
          {readyToClaimCount > 0 && (
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-amber-400 border border-slate-950" />
          )}
        </button>
      </div>
    );
  }

  return (
    <div
      ref={constraintsRef}
      className="pointer-events-none fixed inset-0 z-[45] p-2 sm:p-3 pt-16 sm:pt-20 flex items-start justify-end overflow-hidden"
    >
      <motion.div
        ref={widgetRef}
        data-testid="quests-widget-draggable"
        drag
        dragControls={dragControls}
        dragListener={false}
        dragMomentum={false}
        dragElastic={0.04}
        dragConstraints={constraintsRef}
        onDragEnd={handleDragEnd}
        style={{ x, y }}
        className="pointer-events-auto flex flex-col items-end"
      >
        {/* Compact Top Bar: Drag + Toggle + Reset + Hide */}
        <div className="flex items-center gap-1 mb-1.5">
          <div className="flex items-center rounded-xl bg-slate-900/95 border border-amber-500/45 shadow-lg overflow-hidden">
            <div
              onPointerDown={(e) => dragControls.start(e)}
              title="Перетащить панель квестов"
              data-testid="quests-drag-handle"
              className="hidden sm:flex touch-none cursor-grab active:cursor-grabbing items-center justify-center px-1.5 h-7 text-amber-400/70 hover:text-amber-300 hover:bg-slate-800/80 border-r border-slate-800 transition-colors"
            >
              <GripHorizontal size={12} />
            </div>

            <button
              type="button"
              onClick={(e) => {
                e.currentTarget.blur();
                handleToggleExpanded();
              }}
              data-testid="quests-toggle-button"
              aria-expanded={isExpanded}
              aria-controls="quests-list-panel"
              aria-label={isExpanded ? 'Свернуть список квестов' : 'Развернуть список квестов'}
              title={isExpanded ? 'Свернуть список квестов' : 'Развернуть список квестов'}
              className="h-7 flex items-center gap-1.5 px-2.5 text-amber-300 hover:bg-slate-800/80 font-extrabold text-[11px] cursor-pointer transition-colors"
            >
              <Trophy size={12} className="text-amber-400 shrink-0" />
              <span className="font-mono-numbers">
                Квесты {completedCount}/{quests.length}
              </span>
              {readyToClaimCount > 0 && (
                <span className="px-1 py-0.5 rounded bg-amber-400 text-slate-950 text-[9px] font-black leading-none">
                  +{readyToClaimCount}
                </span>
              )}
              {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>

            <button
              type="button"
              onClick={(e) => {
                e.currentTarget.blur();
                handleHideWidget();
              }}
              data-testid="quests-hide-button"
              aria-label="Убрать меню квестов"
              title="Убрать меню квестов"
              className="h-7 w-7 flex items-center justify-center text-slate-400 hover:text-rose-300 hover:bg-slate-800/80 border-l border-slate-800 cursor-pointer transition-colors"
            >
              <X size={12} />
            </button>
          </div>

          {hasMoved && (
            <button
              type="button"
              onClick={handleResetPosition}
              title="Вернуть панель заданий на исходное место"
              className="h-7 w-7 flex items-center justify-center rounded-xl bg-slate-900/95 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white shadow-lg cursor-pointer transition-colors"
            >
              <RotateCcw size={11} />
            </button>
          )}
        </div>

        {/* Compact / Mini Quests Panel */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              id="quests-list-panel"
              data-testid="quests-list-panel"
              initial={{ opacity: 0, y: -6, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.96 }}
              transition={{ duration: 0.16 }}
              className={`${
                isMini ? 'w-[228px] p-2 gap-1.5' : 'w-[calc(100vw-24px)] max-w-[280px] p-2.5 gap-2'
              } bg-slate-950/95 border border-slate-700/80 rounded-2xl shadow-2xl flex flex-col text-white`}
            >
              {/* Draggable Card Header */}
              <div
                onPointerDown={(e) => dragControls.start(e)}
                title="Потяните за заголовок, чтобы переместить окно"
                className="touch-none cursor-grab active:cursor-grabbing flex items-center justify-between border-b border-slate-800 pb-1.5 select-none gap-1.5"
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  <Sparkles size={13} className="text-amber-400 shrink-0" />
                  <span className="font-black text-xs tracking-wide truncate">
                    {isMini ? 'Квесты' : 'Задания дня'}
                  </span>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <span
                    data-testid="quests-reset-countdown"
                    title="Автоматическое обновление 3 случайных заданий каждые 24 часа"
                    className="inline-flex items-center gap-1 text-[9px] text-amber-300/90 font-bold bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800 font-mono-numbers"
                  >
                    <Clock size={9} className="text-amber-400" />
                    <span>{countdownText}</span>
                  </span>

                  <button
                    type="button"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.currentTarget.blur();
                      handleToggleMini();
                    }}
                    data-testid="quests-size-toggle"
                    aria-label={isMini ? 'Увеличить список квестов' : 'Уменьшить список квестов'}
                    title={isMini ? 'Увеличить список квестов' : 'Уменьшить список квестов'}
                    className="w-5 h-5 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-slate-300 hover:text-white flex items-center justify-center cursor-pointer transition-colors"
                  >
                    {isMini ? <Maximize2 size={10} /> : <Minimize2 size={10} />}
                  </button>

                  <button
                    type="button"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.currentTarget.blur();
                      handleCollapsePanel();
                    }}
                    data-testid="quests-collapse-button"
                    aria-label="Свернуть список квестов"
                    title="Свернуть список квестов"
                    className="w-5 h-5 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-slate-300 hover:text-amber-300 flex items-center justify-center cursor-pointer transition-colors"
                  >
                    <ChevronUp size={11} />
                  </button>

                  <button
                    type="button"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.currentTarget.blur();
                      handleHideWidget();
                    }}
                    data-testid="quests-panel-hide-button"
                    aria-label="Убрать меню квестов"
                    title="Убрать меню квестов"
                    className="w-5 h-5 rounded bg-slate-900 hover:bg-rose-500/20 border border-slate-700/80 text-slate-400 hover:text-rose-300 flex items-center justify-center cursor-pointer transition-colors"
                  >
                    <X size={10} />
                  </button>
                </div>
              </div>

              {claimBanner && (
                <div
                  data-testid="quests-claim-banner"
                  className="px-2 py-1 rounded-lg bg-emerald-500/20 border border-emerald-400/50 text-emerald-200 text-[10px] font-bold flex items-center gap-1"
                >
                  <Gift size={11} className="text-emerald-300 shrink-0" />
                  <span className="truncate">{claimBanner}</span>
                </div>
              )}

              {readyToClaimCount >= 2 && (
                <button
                  type="button"
                  onClick={handleClaimAll}
                  data-testid="quests-claim-all"
                  className="w-full py-1.5 px-2.5 rounded-lg bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-slate-950 text-[11px] font-black shadow flex items-center justify-center gap-1 cursor-pointer transition-all"
                >
                  <Gift size={12} />
                  <span>Забрать все ({readyToClaimCount})</span>
                </button>
              )}

              <div className={`flex flex-col ${isMini ? 'gap-1.5 max-h-[220px]' : 'gap-2 max-h-[280px]'} overflow-y-auto pr-0.5`}>
                {quests.map((q) => {
                  const percent = Math.min(100, Math.round((q.progress / q.target) * 100));
                  const canClaim = q.completed && !q.claimed;

                  if (isMini) {
                    return (
                      <div
                        key={q.id}
                        data-testid={`quest-card-${q.id}`}
                        className={`px-2 py-1.5 rounded-xl border transition-all flex flex-col gap-1 ${
                          q.claimed
                            ? 'bg-slate-900/45 border-slate-800/80 opacity-60'
                            : canClaim
                            ? 'bg-amber-500/15 border-amber-400/90'
                            : 'bg-slate-900/75 border-slate-800'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1.5">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="text-sm leading-none shrink-0">{q.icon}</span>
                            <span className="font-bold text-[11px] text-white truncate">{q.title}</span>
                          </div>
                          {q.claimed ? (
                            <span
                              data-testid={`quest-claimed-${q.id}`}
                              className="flex items-center gap-0.5 text-[9px] font-bold text-emerald-400 shrink-0"
                            >
                              <CheckCircle2 size={11} />
                            </span>
                          ) : canClaim ? (
                            <button
                              type="button"
                              onClick={() => handleClaim(q.id)}
                              data-testid={`quest-claim-${q.id}`}
                              className="px-2 py-0.5 rounded-md bg-amber-500 hover:bg-amber-400 text-slate-950 text-[10px] font-black cursor-pointer shrink-0"
                            >
                              Забрать
                            </button>
                          ) : (
                            <span className="text-[10px] text-slate-400 font-bold font-mono-numbers shrink-0">
                              {Math.min(q.progress, q.target)}/{q.target}
                            </span>
                          )}
                        </div>
                        <div className="w-full h-1 rounded-full bg-slate-800 overflow-hidden">
                          <div
                            className={`h-full transition-all duration-300 ${
                              q.completed
                                ? 'bg-gradient-to-r from-emerald-400 to-lime-300'
                                : 'bg-gradient-to-r from-amber-500 to-yellow-300'
                            }`}
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={q.id}
                      data-testid={`quest-card-${q.id}`}
                      className={`p-2 rounded-xl border transition-all flex flex-col gap-1.5 ${
                        q.claimed
                          ? 'bg-slate-900/50 border-slate-800 opacity-65'
                          : canClaim
                          ? 'bg-amber-500/15 border-amber-400 shadow ring-1 ring-amber-400/35'
                          : 'bg-slate-900/80 border-slate-800'
                      }`}
                    >
                      <div className="flex items-start gap-2 min-w-0">
                        <span className="text-base shrink-0 leading-none mt-0.5">{q.icon}</span>
                        <div className="min-w-0">
                          <h4 className="font-bold text-[11px] text-white truncate">{q.title}</h4>
                          <p className="text-[10px] text-slate-300 leading-tight mt-0.5">{q.description}</p>
                        </div>
                      </div>

                      {/* Progress Bar */}
                      <div className="flex flex-col gap-0.5">
                        <div className="flex justify-between items-center text-[9px] font-bold text-slate-400">
                          <span>Прогресс</span>
                          <span className="font-mono-numbers">{Math.min(q.progress, q.target)} / {q.target}</span>
                        </div>
                        <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                          <div
                            className={`h-full transition-all duration-300 ${
                              q.completed
                                ? 'bg-gradient-to-r from-emerald-400 to-lime-300'
                                : 'bg-gradient-to-r from-amber-500 to-yellow-300'
                            }`}
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                      </div>

                      {/* Rewards & Action */}
                      <div className="flex items-center justify-between pt-1 border-t border-slate-800/60">
                        <div className="flex items-center gap-1.5 text-[10px] font-bold text-amber-300">
                          <span className="flex items-center gap-0.5">
                            <Coins size={10} className="text-amber-400 fill-amber-400" /> +{q.rewardCoins}
                          </span>
                          {q.rewardGems > 0 && (
                            <span
                              title="Гипер редкий кристалл — нужен для смены ника (10 💎)"
                              className="flex items-center gap-0.5 px-1.5 py-0.2 rounded bg-cyan-500/20 border border-cyan-400/45 text-cyan-200 font-black"
                            >
                              <Gem size={10} className="text-cyan-300 fill-cyan-300" /> +{q.rewardGems} РЕДКИЙ
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5">
                          {!q.claimed && !canClaim && (
                            <button
                              type="button"
                              onClick={() => handleReroll(q.id)}
                              title={`Заменить задание за ${QUEST_REROLL_COST} монет`}
                              className={`flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer border ${
                                playerCoins >= QUEST_REROLL_COST
                                  ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                                  : 'bg-slate-900/50 text-slate-500 border-slate-800 cursor-not-allowed'
                              }`}
                            >
                              <RefreshCw size={9} className="text-amber-400" />
                              <span>{QUEST_REROLL_COST} 🪙</span>
                            </button>
                          )}

                          {q.claimed ? (
                            <span
                              data-testid={`quest-claimed-${q.id}`}
                              className="flex items-center gap-0.5 text-[10px] font-bold text-emerald-400"
                            >
                              <CheckCircle2 size={11} /> Получено
                            </span>
                          ) : canClaim ? (
                            <button
                              type="button"
                              onClick={() => handleClaim(q.id)}
                              data-testid={`quest-claim-${q.id}`}
                              className="px-2.5 py-0.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-[11px] font-black shadow transition-all cursor-pointer flex items-center gap-1"
                            >
                              <Gift size={10} />
                              <span>Забрать!</span>
                            </button>
                          ) : (
                            <span className="text-[10px] text-slate-500 font-bold">{percent}%</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};
