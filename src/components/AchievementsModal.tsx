import React, { useState } from 'react';
import { motion } from 'motion/react';
import { X, Trophy, Check, Lock, Sparkles, Filter } from 'lucide-react';
import { ALL_ACHIEVEMENTS } from '../game/achievements';
import { Achievement } from '../game/types';

interface AchievementsModalProps {
  unlockedMap: Record<string, number>;
  onClose: () => void;
}

export const AchievementsModal: React.FC<AchievementsModalProps> = ({ unlockedMap, onClose }) => {
  const [filter, setFilter] = useState<'all' | 'unlocked' | 'locked'>('all');

  const totalCount = ALL_ACHIEVEMENTS.length;
  const unlockedCount = Object.keys(unlockedMap).length;
  const totalCoinsEarned = ALL_ACHIEVEMENTS.reduce((sum, ach) => {
    return unlockedMap[ach.id] ? sum + ach.rewardCoins : sum;
  }, 0);

  const filteredAchievements = ALL_ACHIEVEMENTS.filter((ach) => {
    const isUnlocked = Boolean(unlockedMap[ach.id]);
    if (filter === 'unlocked') return isUnlocked;
    if (filter === 'locked') return !isUnlocked;
    return true;
  });

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 pointer-events-auto"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 24 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.93, y: 16 }}
        transition={{ type: 'spring', stiffness: 380, damping: 28, mass: 0.85 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl rounded-3xl bg-slate-900 border-2 border-slate-700 shadow-2xl flex flex-col max-h-[90vh] overflow-hidden text-white"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 pb-3.5 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400">
              <Trophy size={22} />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-white">Достижения (Blox Badges)</h2>
              <p className="text-xs text-slate-400">
                Разблокировано: <strong className="text-amber-300 font-bold">{unlockedCount} из {totalCount}</strong> · Получено <strong className="text-amber-300 font-bold">{totalCoinsEarned} 🪙</strong>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white cursor-pointer transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Progress Strip & Filter Tabs */}
        <div className="p-4 sm:p-5 py-3 border-b border-slate-800 bg-slate-950/50 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          {/* Progress Bar */}
          <div className="w-full sm:w-64 flex flex-col gap-1">
            <div className="flex justify-between items-center text-[11px] font-bold text-slate-300">
              <span>Прогресс бейджей:</span>
              <span className="text-amber-400">{Math.round((unlockedCount / totalCount) * 100)}%</span>
            </div>
            <div className="h-2 rounded-full bg-slate-800 overflow-hidden border border-slate-700">
              <div
                className="h-full bg-gradient-to-r from-amber-500 to-yellow-300 transition-all duration-300"
                style={{ width: `${(unlockedCount / totalCount) * 100}%` }}
              />
            </div>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 self-end sm:self-auto">
            <button
              onClick={() => setFilter('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                filter === 'all'
                  ? 'bg-amber-500 text-slate-950 shadow-md'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              Все ({totalCount})
            </button>
            <button
              onClick={() => setFilter('unlocked')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                filter === 'unlocked'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              Открытые ({unlockedCount})
            </button>
            <button
              onClick={() => setFilter('locked')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                filter === 'locked'
                  ? 'bg-slate-700 text-white shadow-md'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              Закрытые ({totalCount - unlockedCount})
            </button>
          </div>
        </div>

        {/* Achievements List */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 flex flex-col gap-2.5">
          {filteredAchievements.map((ach) => {
            const isUnlocked = Boolean(unlockedMap[ach.id]);
            const unlockedTime = unlockedMap[ach.id];

            return (
              <div
                key={ach.id}
                className={`p-3 sm:p-3.5 rounded-2xl border-2 transition-all flex items-center justify-between gap-3.5 ${
                  isUnlocked
                    ? 'bg-slate-900/90 border-amber-400/60 shadow-md'
                    : 'bg-slate-950/60 border-slate-800/80 opacity-75'
                }`}
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  {/* Badge Emblem */}
                  <div
                    className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0 shadow border ${
                      isUnlocked
                        ? 'bg-gradient-to-br from-amber-400/20 via-yellow-500/15 to-slate-900 border-amber-400/60 text-amber-300'
                        : 'bg-slate-900 border-slate-800 text-slate-500'
                    }`}
                  >
                    <span>{ach.icon}</span>
                  </div>

                  {/* Texts */}
                  <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-black text-sm text-white truncate">
                        {ach.title}
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-400/30 text-amber-300 text-[10px] font-black shrink-0">
                        +{ach.rewardCoins} 🪙
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 mt-0.5">
                      {ach.description}
                    </p>
                    {isUnlocked && unlockedTime && (
                      <span className="text-[10px] text-emerald-400 font-semibold mt-0.5">
                        Разблокировано: {new Date(unlockedTime).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>

                {/* Status Indicator */}
                <div className="shrink-0">
                  {isUnlocked ? (
                    <span className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 text-xs font-black">
                      <Check size={14} />
                      <span className="hidden sm:inline">Получено</span>
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-slate-800 border border-slate-700 text-slate-400 text-xs font-semibold">
                      <Lock size={13} />
                      <span className="hidden sm:inline">Закрыто</span>
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-5 py-3 border-t border-slate-800 bg-slate-900 flex items-center justify-between shrink-0">
          <span className="text-xs text-slate-400">
            Выполняйте испытания в игре для получения бейджей и монет!
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold cursor-pointer transition-colors"
          >
            Закрыть
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};
