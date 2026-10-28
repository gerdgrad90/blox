import React from 'react';
import { motion } from 'motion/react';
import { Trophy, RotateCcw, Home, Clock, Award, Coins, Gem } from 'lucide-react';
import { PlayerStats } from '../game/types';
import { calculateFinalScore } from '../game/rules';

interface VictoryModalProps {
  stats: PlayerStats;
  onPlayAgain: () => void;
  onReturnToTitle: () => void;
}

export const VictoryModal: React.FC<VictoryModalProps> = ({
  stats,
  onPlayAgain,
  onReturnToTitle,
}) => {
  const finalScore = calculateFinalScore(
    stats.coins,
    stats.gems,
    stats.completionTime,
    stats.deaths
  );

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 pointer-events-auto"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.82, y: 32 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        transition={{ type: 'spring', stiffness: 360, damping: 25, mass: 0.9 }}
        className="w-full max-w-lg rounded-3xl bg-slate-900 border-2 border-amber-500/50 shadow-[0_0_50px_rgba(245,158,11,0.25)] p-6 sm:p-8 flex flex-col items-center text-center"
      >
        {/* Golden Trophy Icon Badge */}
        <motion.div
          initial={{ scale: 0, rotate: -25 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 420, damping: 16, delay: 0.08 }}
          className="p-4 rounded-3xl bg-gradient-to-b from-amber-400 to-yellow-600 text-slate-950 shadow-[0_8px_20px_rgba(245,158,11,0.4)] mb-4"
        >
          <Trophy size={48} className="drop-shadow-md" />
        </motion.div>

        <motion.h2
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12, duration: 0.22 }}
          className="text-3xl font-black text-amber-300 tracking-wide uppercase"
        >
          ПОБЕДА!
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.16, duration: 0.22 }}
          className="text-sm font-semibold text-slate-300 mt-1 mb-6"
        >
          Вы покорили вершину Blox World и забрали Золотой Кубок Чемпиона!
        </motion.p>

        {/* Big Score Readout */}
        <motion.div
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', stiffness: 350, damping: 24, delay: 0.2 }}
          className="w-full p-4 rounded-2xl bg-gradient-to-r from-amber-500/20 via-yellow-500/20 to-amber-500/20 border border-amber-500/40 mb-6"
        >
          <span className="block text-xs font-bold text-amber-300 tracking-wider uppercase mb-1">
            ИТОГОВЫЙ СЧЕТ BLOX POINTS
          </span>
          <span className="text-4xl sm:text-5xl font-black font-mono-numbers text-amber-400">
            {finalScore}
          </span>
        </motion.div>

        {/* Mastery Metric Tiles */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.25 }}
          className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 w-full mb-6 text-left"
        >
          <div className="p-3 rounded-2xl bg-slate-950/80 border border-slate-800">
            <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
              <Clock size={14} className="text-sky-400" />
              <span>Время</span>
            </div>
            <span className="text-lg font-bold font-mono-numbers text-white">
              {stats.completionTime}с
            </span>
          </div>

          <div className="p-3 rounded-2xl bg-slate-950/80 border border-slate-800">
            <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
              <Coins size={14} className="text-amber-400" />
              <span>Монеты</span>
            </div>
            <span className="text-lg font-bold font-mono-numbers text-amber-400">
              {stats.coins}
            </span>
          </div>

          <div className="p-3 rounded-2xl bg-slate-950/80 border border-slate-800">
            <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
              <Gem size={14} className="text-purple-400" />
              <span>Кристаллы</span>
            </div>
            <span className="text-lg font-bold font-mono-numbers text-purple-400">
              {stats.gems}
            </span>
          </div>

          <div className="p-3 rounded-2xl bg-slate-950/80 border border-slate-800">
            <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
              <Award size={14} className="text-emerald-400" />
              <span>Прыжки</span>
            </div>
            <span className="text-lg font-bold font-mono-numbers text-emerald-400">
              {stats.jumps}
            </span>
          </div>
        </motion.div>

        {/* Action Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.25 }}
          className="flex flex-col sm:flex-row gap-3 w-full"
        >
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            data-start="true"
            onClick={onPlayAgain}
            className="flex-1 py-3.5 rounded-2xl bg-gradient-to-b from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-base shadow-[0_6px_0_#92400e] hover:shadow-[0_3px_0_#92400e] active:translate-y-1 active:shadow-none transition-all flex items-center justify-center gap-2 cursor-pointer border border-amber-300"
          >
            <RotateCcw size={18} />
            <span>Играть еще раз</span>
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            onClick={onReturnToTitle}
            className="sm:w-auto px-6 py-3.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-sm shadow-[0_6px_0_#0f172a] hover:shadow-[0_3px_0_#0f172a] active:translate-y-1 active:shadow-none transition-all flex items-center justify-center gap-2 cursor-pointer border border-slate-700"
          >
            <Home size={18} />
            <span>В меню</span>
          </motion.button>
        </motion.div>
      </motion.div>
    </motion.div>
  );
};

