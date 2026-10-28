import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, Award, X, Sparkles } from 'lucide-react';
import { Achievement } from '../game/types';

interface AchievementBannerProps {
  achievement: Achievement | null;
  onDismiss: () => void;
}

export const AchievementBanner: React.FC<AchievementBannerProps> = ({ achievement, onDismiss }) => {
  useEffect(() => {
    if (!achievement) return;
    const timer = setTimeout(() => {
      onDismiss();
    }, 5500);
    return () => clearTimeout(timer);
  }, [achievement, onDismiss]);

  return (
    <AnimatePresence>
      {achievement && (
        <motion.div
          key={achievement.id}
          initial={{ opacity: 0, y: -40, scale: 0.9, rotateX: 15 }}
          animate={{ opacity: 1, y: 0, scale: 1, rotateX: 0 }}
          exit={{ opacity: 0, y: -30, scale: 0.9 }}
          transition={{ type: 'spring', stiffness: 350, damping: 25 }}
          className="fixed top-5 right-4 sm:right-6 z-50 pointer-events-auto max-w-[360px] sm:max-w-[420px] w-full"
        >
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border-2 border-amber-400 shadow-[0_10px_35px_rgba(251,191,36,0.35)] p-3.5 sm:p-4 text-white backdrop-blur-xl">
            {/* Ambient Shimmer Light */}
            <div className="absolute -top-10 -right-10 w-28 h-28 bg-amber-400/20 rounded-full blur-2xl pointer-events-none" />

            <div className="flex items-start gap-3.5 relative z-10">
              {/* Badge Icon Emblem */}
              <div className="relative shrink-0 w-13 h-13 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-br from-amber-400 via-amber-500 to-yellow-600 p-0.5 shadow-lg flex items-center justify-center">
                <div className="w-full h-full rounded-[14px] bg-slate-950/90 flex flex-col items-center justify-center relative overflow-hidden">
                  <span className="text-2xl sm:text-3xl filter drop-shadow">{achievement.icon}</span>
                  <div className="absolute inset-0 bg-gradient-to-t from-amber-500/20 to-transparent pointer-events-none" />
                </div>
                {/* Sparkle badge in corner */}
                <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-amber-400 text-slate-950 flex items-center justify-center shadow">
                  <Sparkles size={11} className="fill-slate-950" />
                </span>
              </div>

              {/* Text Information */}
              <div className="flex-1 min-w-0 pr-6">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <Award size={13} className="text-amber-400" />
                  <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-amber-400">
                    Достижение Разблокировано!
                  </span>
                </div>
                <h4 className="text-sm sm:text-base font-black text-white leading-tight truncate">
                  {achievement.title}
                </h4>
                <p className="text-xs text-slate-300 mt-0.5 leading-snug line-clamp-2">
                  {achievement.description}
                </p>

                {/* Reward pill */}
                <div className="flex items-center gap-2 mt-2">
                  <span className="px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-400/40 text-[10px] font-black text-amber-300 flex items-center gap-1">
                    <Trophy size={10} />
                    <span>Награда: +{achievement.rewardCoins} 🪙</span>
                  </span>
                </div>
              </div>

              {/* Dismiss Button */}
              <button
                type="button"
                onClick={onDismiss}
                className="absolute top-2.5 right-2.5 p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                title="Закрыть"
              >
                <X size={16} />
              </button>
            </div>

            {/* Time progress bar */}
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-slate-800 overflow-hidden">
              <motion.div
                initial={{ width: '100%' }}
                animate={{ width: '0%' }}
                transition={{ duration: 5.5, ease: 'linear' }}
                className="h-full bg-gradient-to-r from-amber-500 to-yellow-300"
              />
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
