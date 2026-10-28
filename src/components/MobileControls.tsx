import React, { useRef, useState } from 'react';
import { ArrowUp, Sword, Hammer, Trash2 } from 'lucide-react';
import { ToolType } from '../game/types';
import { normalizeJoystickVector } from '../game/rules';

interface MobileControlsProps {
  onJoystickMove: (x: number, y: number) => void;
  onJump: () => void;
  onAction: (removeBlock?: boolean) => void;
  activeTool: ToolType;
}

export const MobileControls: React.FC<MobileControlsProps> = ({
  onJoystickMove,
  onJump,
  onAction,
  activeTool,
}) => {
  const baseRef = useRef<HTMLDivElement>(null);
  const knobRef = useRef<HTMLDivElement>(null);
  const activePointerId = useRef<number | null>(null);
  const centerRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);

  const MAX_RADIUS = 42;

  const updateKnob = (clientX: number, clientY: number) => {
    const dx = clientX - centerRef.current.x;
    const dy = clientY - centerRef.current.y;
    const result = normalizeJoystickVector(dx, dy, MAX_RADIUS, 0.12);

    if (knobRef.current) {
      knobRef.current.style.transform = `translate3d(${result.clampedDx}px, ${result.clampedDy}px, 0)`;
    }
    onJoystickMove(result.x, result.y);
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (activePointerId.current !== null) return;

    activePointerId.current = e.pointerId;
    e.currentTarget.setPointerCapture(e.pointerId);
    setIsDragging(true);

    if (baseRef.current) {
      const rect = baseRef.current.getBoundingClientRect();
      centerRef.current = {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      };
    }
    updateKnob(e.clientX, e.clientY);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerId !== activePointerId.current) return;
    e.stopPropagation();
    updateKnob(e.clientX, e.clientY);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerId !== activePointerId.current) return;
    e.stopPropagation();
    activePointerId.current = null;
    setIsDragging(false);

    if (knobRef.current) {
      knobRef.current.style.transform = 'translate3d(0px, 0px, 0)';
    }
    onJoystickMove(0, 0);
  };

  const bottomOffsetClass = activeTool === 'hammer' ? 'bottom-34 sm:bottom-28' : 'bottom-24 sm:bottom-24';

  return (
    <>
      {/* Left Virtual Thumbstick */}
      <div
        ref={baseRef}
        data-testid="mobile-joystick"
        aria-label="Виртуальный джойстик движения"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className={`fixed ${bottomOffsetClass} left-3 sm:left-6 z-30 w-26 h-26 sm:w-28 sm:h-28 rounded-full bg-slate-950/65 border-2 flex items-center justify-center pointer-events-auto touch-none select-none shadow-xl transition-all ${
          isDragging ? 'border-sky-400/90 bg-slate-900/80' : 'border-slate-600/70'
        }`}
      >
        {/* Crosshair subtle guides */}
        <div className="absolute inset-3 rounded-full border border-slate-700/50 pointer-events-none" />
        {/* Thumb Knob */}
        <div
          ref={knobRef}
          className={`w-11 h-11 sm:w-12 sm:h-12 rounded-full shadow-lg pointer-events-none transition-colors ${
            isDragging
              ? 'bg-gradient-to-b from-sky-400 to-blue-600 border-2 border-white'
              : 'bg-slate-300/85 border-2 border-slate-100'
          }`}
        />
      </div>

      {/* Right Action Buttons Cluster */}
      <div className={`fixed ${bottomOffsetClass} right-3 sm:right-6 z-30 flex items-end gap-2.5 sm:gap-3 pointer-events-auto touch-none select-none transition-all`}>
        {/* Contextual Tool Buttons (Sword Attack or Hammer Place/Delete) */}
        {activeTool === 'sword' && (
          <button
            type="button"
            aria-label="Удар мечом"
            onPointerDown={(e) => {
              e.stopPropagation();
              onAction(false);
            }}
            className="w-15 h-15 rounded-full bg-amber-500/85 active:bg-amber-400 border-2 border-amber-200 text-slate-950 shadow-xl flex flex-col items-center justify-center active:scale-95 transition-transform cursor-pointer"
          >
            <Sword size={24} />
            <span className="text-[9px] font-black uppercase mt-0.5">Удар</span>
          </button>
        )}

        {activeTool === 'hammer' && (
          <div className="flex flex-col gap-2">
            <button
              type="button"
              aria-label="Удалить блок"
              onPointerDown={(e) => {
                e.stopPropagation();
                onAction(true);
              }}
              className="w-12 h-12 rounded-full bg-rose-600/85 active:bg-rose-500 border-2 border-rose-300 text-white shadow-lg flex flex-col items-center justify-center active:scale-95 transition-transform cursor-pointer self-end"
            >
              <Trash2 size={18} />
              <span className="text-[8px] font-bold uppercase">Снос</span>
            </button>

            <button
              type="button"
              aria-label="Поставить блок"
              onPointerDown={(e) => {
                e.stopPropagation();
                onAction(false);
              }}
              className="w-15 h-15 rounded-full bg-sky-500/85 active:bg-sky-400 border-2 border-sky-200 text-white shadow-xl flex flex-col items-center justify-center active:scale-95 transition-transform cursor-pointer"
            >
              <Hammer size={22} />
              <span className="text-[9px] font-black uppercase mt-0.5">Блок</span>
            </button>
          </div>
        )}

        {/* Primary Jump Button */}
        <button
          type="button"
          data-testid="mobile-jump-btn"
          aria-label="Прыжок"
          onPointerDown={(e) => {
            e.stopPropagation();
            onJump();
          }}
          className="w-20 h-20 rounded-full bg-emerald-500/85 active:bg-emerald-400 border-3 border-emerald-200 text-white shadow-[0_6px_20px_rgba(16,185,129,0.5)] flex flex-col items-center justify-center active:scale-95 transition-transform cursor-pointer"
        >
          <ArrowUp size={32} strokeWidth={3} />
          <span className="text-[10px] font-black uppercase tracking-wider">Прыжок</span>
        </button>
      </div>
    </>
  );
};
