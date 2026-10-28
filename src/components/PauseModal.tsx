import React from 'react';
import { motion } from 'motion/react';
import { Play, RotateCcw, Home, Sparkles, Volume2, VolumeX, Maximize, Minimize } from 'lucide-react';
import { PlayerStats } from '../game/types';

interface PauseModalProps {
  stats: PlayerStats;
  onResume: () => void;
  onRestart: () => void;
  onReturnToTitle: () => void;
  onOpenCustomizer: () => void;
  isMuted: boolean;
  onToggleMute: () => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
}

export const PauseModal: React.FC<PauseModalProps> = ({
  stats,
  onResume,
  onRestart,
  onReturnToTitle,
  onOpenCustomizer,
  isMuted,
  onToggleMute,
  isFullscreen,
  onToggleFullscreen,
}) => {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      onClick={onResume}
      className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-slate-950/80 pointer-events-auto"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.88, y: 24 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.92, y: 18 }}
        transition={{ type: 'spring', stiffness: 400, damping: 28, mass: 0.85 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-3xl bg-slate-900 border-2 border-slate-700 shadow-2xl p-6 flex flex-col items-center text-center"
      >
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05, duration: 0.2 }}
        >
          <h2 className="text-2xl font-black text-white mb-1 tracking-wide">ИГРА НА ПАУЗЕ</h2>
          <p className="text-xs text-slate-400 mb-6">Нажмите [Esc] или Продолжить, чтобы вернуться в мир</p>
        </motion.div>

        {/* Current Run Metrics */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08, duration: 0.22 }}
          className="grid grid-cols-3 gap-2 w-full mb-6"
        >
          <div className="p-3 rounded-2xl bg-slate-950/70 border border-slate-800">
            <span className="block text-[11px] font-bold text-slate-400 mb-0.5">МОНЕТЫ</span>
            <span className="text-lg font-bold font-mono-numbers text-amber-400">{stats.coins} 🪙</span>
          </div>
          <div className="p-3 rounded-2xl bg-slate-950/70 border border-slate-800">
            <span className="block text-[11px] font-bold text-slate-400 mb-0.5">ЭТАП OBBY</span>
            <span className="text-lg font-bold font-mono-numbers text-emerald-400">{stats.currentCheckpoint}/6</span>
          </div>
          <div className="p-3 rounded-2xl bg-slate-950/70 border border-slate-800">
            <span className="block text-[11px] font-bold text-slate-400 mb-0.5">ПАДЕНИЯ</span>
            <span className="text-lg font-bold font-mono-numbers text-rose-400">{stats.deaths}</span>
          </div>
        </motion.div>

        {/* Menu Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12, duration: 0.22 }}
          className="flex flex-col gap-3 w-full"
        >
          <motion.button
            whileHover={{ scale: 1.015 }}
            whileTap={{ scale: 0.97 }}
            onClick={onResume}
            className="w-full py-3.5 rounded-2xl bg-gradient-to-b from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white font-bold text-base shadow-[0_6px_0_#065f46] hover:shadow-[0_3px_0_#065f46] active:translate-y-1 active:shadow-none transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <Play size={20} className="fill-white" />
            <span>Продолжить</span>
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.015 }}
            whileTap={{ scale: 0.97 }}
            onClick={onRestart}
            className="w-full py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-sm shadow-[0_4px_0_#0f172a] hover:shadow-[0_2px_0_#0f172a] active:translate-y-1 active:shadow-none transition-all flex items-center justify-center gap-2 cursor-pointer border border-slate-700"
          >
            <RotateCcw size={18} />
            <span>Начать заново с этапа 0</span>
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.015 }}
            whileTap={{ scale: 0.97 }}
            onClick={onOpenCustomizer}
            className="w-full py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-sm shadow-[0_4px_0_#0f172a] hover:shadow-[0_2px_0_#0f172a] active:translate-y-1 active:shadow-none transition-all flex items-center justify-center gap-2 cursor-pointer border border-slate-700"
          >
            <Sparkles size={18} className="text-amber-400" />
            <span>Гардероб / Скин</span>
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.015 }}
            whileTap={{ scale: 0.97 }}
            onClick={onToggleFullscreen}
            className="w-full py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-sm shadow-[0_4px_0_#0f172a] hover:shadow-[0_2px_0_#0f172a] active:translate-y-1 active:shadow-none transition-all flex items-center justify-center gap-2 cursor-pointer border border-slate-700"
          >
            {isFullscreen ? <Minimize size={18} className="text-sky-400" /> : <Maximize size={18} className="text-sky-400" />}
            <span>{isFullscreen ? 'Выйти из полного экрана [F]' : 'Полный экран [F]'}</span>
          </motion.button>

          <div className="flex gap-2 w-full mt-1">
            <motion.button
              whileTap={{ scale: 0.96 }}
              onClick={onToggleMute}
              className="flex-1 py-2.5 rounded-xl bg-slate-950 hover:bg-slate-800 text-slate-300 font-semibold text-xs border border-slate-800 flex items-center justify-center gap-1.5 cursor-pointer"
            >
              {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
              <span>{isMuted ? 'Звук: Выкл' : 'Звук: Вкл'}</span>
            </motion.button>

            <motion.button
              whileTap={{ scale: 0.96 }}
              onClick={onReturnToTitle}
              className="flex-1 py-2.5 rounded-xl bg-slate-950 hover:bg-slate-800 text-slate-300 font-semibold text-xs border border-slate-800 flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Home size={16} />
              <span>В главное меню</span>
            </motion.button>
          </div>
        </motion.div>
      </motion.div>
    </motion.div>
  );
};


