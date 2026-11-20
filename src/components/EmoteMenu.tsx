import React, { useEffect, useState } from 'react';
import { Smile, X, Square } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { EMOTE_CATALOG, EmoteId, getEmoteById } from '../game/emotes';

export interface ActiveEmoteState {
  id: EmoteId;
  endsAt: number;
  durationMs: number;
}

interface EmoteMenuProps {
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
  onSelectEmote: (emoteId: EmoteId) => void;
  onCancelEmote?: () => void;
  activeEmote?: ActiveEmoteState | null;
  isTouchMode: boolean;
  isDoorsPov?: boolean;
  hideTriggerButton?: boolean;
  disabled?: boolean;
}

export const EmoteMenu: React.FC<EmoteMenuProps> = ({
  isOpen,
  onToggle,
  onClose,
  onSelectEmote,
  onCancelEmote,
  activeEmote,
  isTouchMode,
  isDoorsPov = false,
  hideTriggerButton = false,
  disabled = false,
}) => {
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    if (disabled && isOpen) {
      onClose();
    }
  }, [disabled, isOpen, onClose]);

  // Progress bar ticker only while an emote is actively running
  useEffect(() => {
    if (!activeEmote) return;
    setNowMs(Date.now());
    const id = window.setInterval(() => {
      setNowMs(Date.now());
    }, 60);
    return () => clearInterval(id);
  }, [activeEmote]);

  // Capture-phase keyboard handling: [G] toggles menu, [1-6] triggers emote when open, [Esc] closes
  useEffect(() => {
    if (disabled) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      if (e.code === 'KeyG' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        e.stopPropagation();
        onToggle();
        return;
      }

      if (!isOpen) return;

      if (e.code === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
        return;
      }

      const digitMatch = /^Digit([1-8])$/.exec(e.code);
      if (digitMatch) {
        const index = Number(digitMatch[1]) - 1;
        const chosen = EMOTE_CATALOG[index];
        if (chosen) {
          e.preventDefault();
          e.stopPropagation();
          onSelectEmote(chosen.id);
          onClose();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true });
  }, [disabled, isOpen, onToggle, onClose, onSelectEmote]);

  const activeDef = activeEmote ? getEmoteById(activeEmote.id) : null;
  const remainingMs = activeEmote ? Math.max(0, activeEmote.endsAt - nowMs) : 0;
  const progressPct =
    activeEmote && activeEmote.durationMs > 0
      ? Math.max(0, Math.min(100, Math.round((remainingMs / activeEmote.durationMs) * 100)))
      : 0;
  const isPlaying = Boolean(activeEmote && remainingMs > 0);

  return (
    <div className="relative flex flex-col items-end gap-1.5 pointer-events-auto">
      {/* Click-outside catcher when picker is open */}
      {isOpen && (
        <div
          className="fixed inset-0 z-30 pointer-events-auto"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Emote Selection Popover */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            key="emote-picker-popover"
            data-testid="emote-selection-menu"
            initial={{ opacity: 0, scale: 0.92, y: isTouchMode ? -8 : 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: isTouchMode ? -8 : 10 }}
            transition={{ duration: 0.16 }}
            onClick={(e) => e.stopPropagation()}
            className={`${
              isTouchMode
                ? 'fixed top-16 right-2 sm:right-4 w-[min(92vw,320px)]'
                : 'fixed top-16 right-2 sm:top-auto sm:right-0 sm:bottom-full sm:mb-2 sm:absolute w-[min(92vw,310px)] sm:w-[310px]'
            } z-40 rounded-2xl bg-slate-950/95 border-2 border-slate-700/90 shadow-[0_18px_45px_rgba(0,0,0,0.8)] p-3 text-slate-100 pointer-events-auto`}
          >
            <div className="flex items-center justify-between gap-2 pb-2 mb-2 border-b border-slate-800">
              <div className="flex items-center gap-2 min-w-0">
                <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-sky-500/20 border border-sky-400/50 text-sky-300 shrink-0">
                  <Smile size={16} />
                </span>
                <div className="min-w-0">
                  <div className="text-xs font-black text-white uppercase tracking-wide flex items-center gap-1.5">
                    <span>Эмоции</span>
                    {!isTouchMode && (
                      <span className="hidden sm:inline-block px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-[10px] font-mono text-slate-300">
                        G
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-slate-400 truncate">
                    {isDoorsPov
                      ? 'Другие игроки увидят анимацию'
                      : 'Нажмите или выберите [1–8]'}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Закрыть меню эмоций"
                className="min-w-[34px] min-h-[34px] flex items-center justify-center rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 cursor-pointer transition-colors"
              >
                <X size={15} />
              </button>
            </div>

            <div className="grid grid-cols-4 gap-1.5">
              {EMOTE_CATALOG.map((emote) => {
                const isSelected = isPlaying && activeEmote?.id === emote.id;
                return (
                  <button
                    key={emote.id}
                    type="button"
                    data-testid={`emote-option-${emote.id}`}
                    onClick={() => {
                      onSelectEmote(emote.id);
                      onClose();
                    }}
                    title={`${emote.label} — ${emote.description} [${emote.shortcutKey}]`}
                    className={`relative min-h-[66px] flex flex-col items-center justify-center gap-1 p-2 rounded-xl border-2 transition-all cursor-pointer select-none active:scale-95 ${
                      isSelected
                        ? `bg-gradient-to-b ${emote.badgeBg} shadow-lg`
                        : 'bg-slate-900/90 hover:bg-slate-800 border-slate-800 hover:border-slate-600 text-slate-200'
                    }`}
                  >
                    {!isTouchMode && (
                      <span className="hidden sm:inline-block absolute top-1 left-1.5 text-[9px] font-mono font-bold text-slate-400">
                        {emote.shortcutKey}
                      </span>
                    )}
                    <span className="text-2xl leading-none">{emote.emoji}</span>
                    <span className="text-[11px] font-bold leading-tight truncate max-w-full">
                      {emote.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Active Emote Progress Chip */}
      <AnimatePresence>
        {isPlaying && activeDef && !isTouchMode && (
          <motion.div
            key="active-emote-chip"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="hidden sm:flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-slate-950/90 border border-slate-700/90 shadow-lg text-xs pointer-events-auto"
          >
            <span className="text-base leading-none">{activeDef.emoji}</span>
            <div className="flex flex-col min-w-[78px]">
              <div className="flex items-center justify-between gap-2 text-[10px] font-bold text-slate-200">
                <span>{activeDef.label}</span>
                <span className="font-mono-numbers text-slate-400">
                  {(remainingMs / 1000).toFixed(1)}с
                </span>
              </div>
              <div className="w-full h-1 rounded-full bg-slate-800 overflow-hidden mt-0.5">
                <div
                  className="h-full rounded-full transition-[width] duration-75"
                  style={{
                    width: `${progressPct}%`,
                    backgroundColor: activeDef.accentColor,
                  }}
                />
              </div>
            </div>
            {onCancelEmote && (
              <button
                type="button"
                onClick={onCancelEmote}
                title="Остановить эмоцию"
                aria-label="Остановить эмоцию"
                className="p-1 rounded-lg bg-slate-800 hover:bg-rose-600/80 text-slate-300 hover:text-white cursor-pointer transition-colors"
              >
                <Square size={11} />
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Desktop Trigger Button (Bottom-Right) */}
      {!hideTriggerButton && (
        <button
          type="button"
          data-testid="emote-menu-toggle-btn"
          onClick={onToggle}
          title="Открыть меню эмоций [G]"
          className={`hidden sm:flex min-h-[42px] items-center gap-2 px-3.5 py-2 rounded-xl border-2 text-xs font-black shadow-lg cursor-pointer transition-all pointer-events-auto ${
            isOpen
              ? 'bg-sky-500 border-sky-300 text-slate-950'
              : isPlaying && activeDef
              ? 'bg-slate-900/95 border-sky-400/80 text-sky-200'
              : 'bg-slate-900/90 hover:bg-slate-800 border-slate-700/90 hover:border-sky-400/60 text-slate-100'
          }`}
        >
          {isPlaying && activeDef ? (
            <span className="text-base leading-none">{activeDef.emoji}</span>
          ) : (
            <Smile size={17} className={isOpen ? 'text-slate-950' : 'text-sky-400'} />
          )}
          <span>Эмоции</span>
          {!isTouchMode && (
            <span
              className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${
                isOpen
                  ? 'bg-slate-950/20 text-slate-950'
                  : 'bg-slate-800 text-slate-300 border border-slate-700'
              }`}
            >
              G
            </span>
          )}
        </button>
      )}
    </div>
  );
};
