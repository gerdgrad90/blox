import React, { useRef, useState } from 'react';
import {
  ArrowUp,
  Sword,
  Hammer,
  Trash2,
  Sparkles,
  Rocket,
  CupSoda,
  Flashlight,
  Footprints,
  Hand,
} from 'lucide-react';
import { DoorsGameState, GameId, ToolType } from '../game/types';
import { normalizeJoystickVector } from '../game/rules';
import { MobileLayoutConfig, DEFAULT_MOBILE_LAYOUT } from '../game/controls';

interface MobileControlsProps {
  onJoystickMove: (x: number, y: number) => void;
  onJump: () => void;
  onAction: (removeBlock?: boolean) => void;
  activeTool: ToolType;
  layout?: MobileLayoutConfig;
  gameId?: GameId;
  doorsState?: DoorsGameState;
  onDoorsInteract?: () => void;
  onDoorsToggleCrouch?: () => void;
  onDoorsToggleFlashlight?: () => void;
}

function triggerLightHaptic(ms = 10) {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(ms);
    }
  } catch {}
}

export const MobileControls: React.FC<MobileControlsProps> = ({
  onJoystickMove,
  onJump,
  onAction,
  activeTool,
  layout = DEFAULT_MOBILE_LAYOUT,
  gameId,
  doorsState,
  onDoorsInteract,
  onDoorsToggleCrouch,
  onDoorsToggleFlashlight,
}) => {
  const baseRef = useRef<HTMLDivElement>(null);
  const knobRef = useRef<HTMLDivElement>(null);
  const activePointerId = useRef<number | null>(null);
  const centerRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);

  const MAX_RADIUS = 44 * (layout.joystickScale || 1.0);

  const updateKnob = (clientX: number, clientY: number) => {
    const dx = clientX - centerRef.current.x;
    const dy = clientY - centerRef.current.y;
    const result = normalizeJoystickVector(dx, dy, MAX_RADIUS, 0.1);

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

  const joystickStyle: React.CSSProperties = {
    bottom: `calc(${layout.joystickY}px + env(safe-area-inset-bottom, 0px))`,
    ...(layout.joystickSide === 'left'
      ? { left: `${layout.joystickX}px` }
      : { right: `${layout.joystickX}px` }),
    transform: `scale(${layout.joystickScale})`,
    transformOrigin: layout.joystickSide === 'left' ? 'bottom left' : 'bottom right',
    opacity: layout.joystickOpacity,
  };

  const buttonsStyle: React.CSSProperties = {
    bottom: `calc(${layout.buttonsY}px + env(safe-area-inset-bottom, 0px))`,
    ...(layout.buttonsSide === 'left'
      ? { left: `${layout.buttonsX}px` }
      : { right: `${layout.buttonsX}px` }),
    transform: `scale(${layout.buttonsScale})`,
    transformOrigin: layout.buttonsSide === 'left' ? 'bottom left' : 'bottom right',
    opacity: layout.joystickOpacity,
  };

  const isDoors = gameId === 'doors';
  const isBeeSwarm = gameId === 'bee_swarm';

  return (
    <>
      {/* Virtual Thumbstick with expanded hit zone */}
      <div
        ref={baseRef}
        data-testid="mobile-joystick"
        aria-label="Виртуальный джойстик движения"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        style={joystickStyle}
        className={`fixed z-30 w-28 h-28 sm:w-30 sm:h-30 rounded-full bg-slate-950/65 backdrop-blur-sm border-2 flex items-center justify-center pointer-events-auto touch-none select-none shadow-2xl transition-[border-color,background-color] ${
          isDragging ? 'border-sky-400 bg-slate-900/90 ring-4 ring-sky-400/25' : 'border-slate-500/70'
        }`}
      >
        {/* Subtle directional reticle */}
        <div className="absolute inset-3 rounded-full border border-slate-500/35 pointer-events-none" />
        <span className="absolute top-1.5 text-[9px] text-slate-400/75 font-bold pointer-events-none">▲</span>
        <span className="absolute bottom-1.5 text-[9px] text-slate-400/75 font-bold pointer-events-none">▼</span>
        <span className="absolute left-2 text-[9px] text-slate-400/75 font-bold pointer-events-none">◀</span>
        <span className="absolute right-2 text-[9px] text-slate-400/75 font-bold pointer-events-none">▶</span>

        {/* Thumb Knob */}
        <div
          ref={knobRef}
          className={`w-12 h-12 rounded-full shadow-lg pointer-events-none transition-colors ${
            isDragging
              ? 'bg-gradient-to-b from-sky-400 to-blue-600 border-2 border-white'
              : 'bg-slate-200/90 border-2 border-slate-100'
          }`}
        />
      </div>

      {/* Right / Left Thumb Action Cluster */}
      <div
        style={buttonsStyle}
        className="fixed z-30 flex flex-col items-end gap-2.5 pointer-events-auto touch-none select-none"
      >
        {/* DOORS Thumb Controls Row (Interact + Crouch + Flashlight) */}
        {isDoors && doorsState && (
          <div className="flex items-end gap-2">
            {/* Crouch Toggle in easy thumb reach */}
            {onDoorsToggleCrouch && (
              <button
                type="button"
                aria-label="Присесть или встать"
                onPointerDown={(e) => {
                  e.stopPropagation();
                  triggerLightHaptic(8);
                  onDoorsToggleCrouch();
                }}
                className={`min-w-[50px] min-h-[50px] w-13 h-13 rounded-full border-2 shadow-lg flex flex-col items-center justify-center active:scale-95 transition-transform cursor-pointer ${
                  doorsState.isCrouching
                    ? 'bg-emerald-500/95 border-emerald-200 text-slate-950'
                    : 'bg-stone-900/90 border-stone-500 text-stone-200'
                }`}
              >
                <Footprints size={18} />
                <span className="text-[9px] font-black leading-none mt-0.5">
                  {doorsState.isCrouching ? 'Тихо' : 'Присесть'}
                </span>
              </button>
            )}

            {/* Flashlight Toggle in easy thumb reach */}
            {onDoorsToggleFlashlight && (
              <button
                type="button"
                aria-label="Фонарик"
                onPointerDown={(e) => {
                  e.stopPropagation();
                  triggerLightHaptic(8);
                  onDoorsToggleFlashlight();
                }}
                className={`min-w-[50px] min-h-[50px] w-13 h-13 rounded-full border-2 shadow-lg flex flex-col items-center justify-center active:scale-95 transition-transform cursor-pointer ${
                  doorsState.flashlightOn
                    ? 'bg-amber-400 border-amber-100 text-stone-950'
                    : 'bg-stone-900/90 border-stone-500 text-stone-300'
                }`}
              >
                <Flashlight size={18} />
                <span className="text-[9px] font-black leading-none mt-0.5">
                  {doorsState.flashlightOn ? 'Свет' : 'Фонарь'}
                </span>
              </button>
            )}

            {/* Contextual DOORS Interact / Hide / Repel Screech */}
            {(doorsState.nearInteractable || doorsState.screechActive || doorsState.isHidingInCloset) && (
              <button
                type="button"
                aria-label="Взаимодействовать"
                onPointerDown={(e) => {
                  e.stopPropagation();
                  triggerLightHaptic(14);
                  if (onDoorsInteract) {
                    onDoorsInteract();
                  } else {
                    onAction(false);
                  }
                }}
                className="min-w-[58px] min-h-[58px] w-15 h-15 rounded-full bg-amber-500 active:bg-amber-400 border-2 border-amber-100 text-stone-950 shadow-[0_0_20px_rgba(245,158,11,0.65)] flex flex-col items-center justify-center active:scale-95 transition-transform cursor-pointer animate-pulse"
              >
                <Hand size={22} />
                <span className="text-[9px] font-black uppercase leading-none mt-0.5">
                  {doorsState.isHidingInCloset
                    ? 'Выйти'
                    : doorsState.screechActive
                    ? 'Свет!'
                    : 'Взять'}
                </span>
              </button>
            )}
          </div>
        )}

        {/* Primary Action + Jump Row */}
        <div className="flex items-end gap-2.5 sm:gap-3">
          {/* Bee Swarm Scooper */}
          {!isDoors && (isBeeSwarm || activeTool === 'pollen_collector') && (
            <button
              type="button"
              aria-label="Собрать пыльцу"
              onPointerDown={(e) => {
                e.stopPropagation();
                triggerLightHaptic(10);
                onAction(false);
              }}
              className="min-w-[56px] min-h-[56px] w-14 h-14 sm:w-15 sm:h-15 rounded-full bg-amber-400/95 active:bg-amber-300 border-2 border-amber-100 text-slate-950 shadow-xl flex flex-col items-center justify-center active:scale-95 transition-transform cursor-pointer"
            >
              <Sparkles size={21} />
              <span className="text-[9px] font-black uppercase mt-0.5">Сбор</span>
            </button>
          )}

          {/* Sword Attack */}
          {!isDoors && !isBeeSwarm && activeTool === 'sword' && (
            <button
              type="button"
              aria-label="Удар мечом"
              onPointerDown={(e) => {
                e.stopPropagation();
                triggerLightHaptic(10);
                onAction(false);
              }}
              className="min-w-[56px] min-h-[56px] w-14 h-14 sm:w-15 sm:h-15 rounded-full bg-amber-500/95 active:bg-amber-400 border-2 border-amber-200 text-slate-950 shadow-xl flex flex-col items-center justify-center active:scale-95 transition-transform cursor-pointer"
            >
              <Sword size={22} />
              <span className="text-[9px] font-black uppercase mt-0.5">Удар</span>
            </button>
          )}

          {/* Hammer Build / Remove */}
          {!isDoors && !isBeeSwarm && activeTool === 'hammer' && (
            <div className="flex flex-col gap-2">
              <button
                type="button"
                aria-label="Удалить блок"
                onPointerDown={(e) => {
                  e.stopPropagation();
                  triggerLightHaptic(8);
                  onAction(true);
                }}
                className="min-w-[48px] min-h-[48px] w-12 h-12 rounded-full bg-rose-600/95 active:bg-rose-500 border-2 border-rose-300 text-white shadow-lg flex flex-col items-center justify-center active:scale-95 transition-transform cursor-pointer self-end"
              >
                <Trash2 size={18} />
                <span className="text-[8px] font-bold uppercase">Снос</span>
              </button>

              <button
                type="button"
                aria-label="Поставить блок"
                onPointerDown={(e) => {
                  e.stopPropagation();
                  triggerLightHaptic(10);
                  onAction(false);
                }}
                className="min-w-[56px] min-h-[56px] w-14 h-14 sm:w-15 sm:h-15 rounded-full bg-sky-500/95 active:bg-sky-400 border-2 border-sky-200 text-white shadow-xl flex flex-col items-center justify-center active:scale-95 transition-transform cursor-pointer"
              >
                <Hammer size={22} />
                <span className="text-[9px] font-black uppercase mt-0.5">Блок</span>
              </button>
            </div>
          )}

          {/* Jetpack Boost */}
          {!isDoors && !isBeeSwarm && activeTool === 'jetpack_boost' && (
            <button
              type="button"
              aria-label="Взлёт на джетпаке"
              onPointerDown={(e) => {
                e.stopPropagation();
                triggerLightHaptic(14);
                onAction(false);
              }}
              className="min-w-[56px] min-h-[56px] w-14 h-14 sm:w-15 sm:h-15 rounded-full bg-lime-500/95 active:bg-lime-400 border-2 border-lime-200 text-slate-950 shadow-xl flex flex-col items-center justify-center active:scale-95 transition-transform cursor-pointer"
            >
              <Rocket size={21} />
              <span className="text-[9px] font-black uppercase mt-0.5">Взлёт</span>
            </button>
          )}

          {/* Bloxy Cola Heal */}
          {!isDoors && !isBeeSwarm && activeTool === 'bloxy_cola' && (
            <button
              type="button"
              aria-label="Выпить Bloxy Cola"
              onPointerDown={(e) => {
                e.stopPropagation();
                triggerLightHaptic(10);
                onAction(false);
              }}
              className="min-w-[56px] min-h-[56px] w-14 h-14 sm:w-15 sm:h-15 rounded-full bg-amber-500/95 active:bg-amber-400 border-2 border-amber-200 text-slate-950 shadow-xl flex flex-col items-center justify-center active:scale-95 transition-transform cursor-pointer"
            >
              <CupSoda size={21} />
              <span className="text-[9px] font-black uppercase mt-0.5">Выпить</span>
            </button>
          )}

          {/* Primary Jump Button */}
          <button
            type="button"
            data-testid="mobile-jump-btn"
            aria-label="Прыжок"
            onPointerDown={(e) => {
              e.stopPropagation();
              triggerLightHaptic(10);
              onJump();
            }}
            style={{ transform: `scale(${layout.jumpScale || 1.0})`, transformOrigin: 'bottom center' }}
            className="min-w-[68px] min-h-[68px] w-18 h-18 sm:w-20 sm:h-20 rounded-full bg-emerald-500/95 active:bg-emerald-400 border-3 border-emerald-200 text-white shadow-[0_6px_20px_rgba(16,185,129,0.5)] flex flex-col items-center justify-center active:scale-95 transition-transform cursor-pointer"
          >
            <ArrowUp size={30} strokeWidth={3} />
            <span className="text-[10px] font-black uppercase tracking-wider">Прыжок</span>
          </button>
        </div>
      </div>
    </>
  );
};
