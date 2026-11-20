import React from 'react';
import {
  VRControllerProfile,
  VRDisplayMode,
  VRState,
  VRTrackingMode,
  VR_DEFAULT_HEIGHT_OFFSET,
  VR_MAX_HEIGHT_OFFSET,
  VR_MIN_HEIGHT_OFFSET,
} from '../game/vr';
import { VR_GESTURE_DEFINITIONS, VRHandGestureId } from '../game/vrGestures';
import type { DoorsGameState } from '../game/types';

interface VRControlModalProps {
  isOpen: boolean;
  vrState: VRState;
  onClose: () => void;
  onToggleVR: (force?: boolean) => void;
  onStartWebXR: () => void;
  onSetTrackingMode: (mode: VRTrackingMode) => void;
  onSetControllerProfile?: (profile: VRControllerProfile) => void;
  onSetDisplayMode: (mode: VRDisplayMode) => void;
  onSetOptions: (
    opts: Partial<
      Pick<
        VRState,
        | 'snapTurnDegrees'
        | 'smoothTurn'
        | 'comfortVignette'
        | 'laserPointers'
        | 'teleportEnabled'
        | 'ipdMm'
        | 'picoGuardianVisible'
        | 'picoPassthroughGrid'
        | 'controllerProfile'
        | 'heightOffset'
        | 'performanceMode'
        | 'controlsHintVisible'
      >
    >
  ) => void;
  onCalibrateHeight?: () => void;
  onSnapTurn: (dir: -1 | 1) => void;
  onTeleport: () => void;
  onHapticPulse: () => void;
  onRecenter: () => void;
  onTriggerGesture?: (gestureId: VRHandGestureId) => void;
  onOpenTutorial?: () => void;
}

export const VRControlModal: React.FC<VRControlModalProps> = ({
  isOpen,
  vrState,
  onClose,
  onToggleVR,
  onStartWebXR,
  onSetTrackingMode,
  onSetControllerProfile,
  onSetDisplayMode,
  onSetOptions,
  onCalibrateHeight,
  onSnapTurn,
  onTeleport,
  onHapticPulse,
  onRecenter,
  onTriggerGesture,
  onOpenTutorial,
}) => {
  if (!isOpen) return null;

  const { leftController, rightController } = vrState;
  const isPico = vrState.controllerProfile === 'pico4';
  const leftPinchPct = Math.round(Math.max(leftController.trigger, leftController.grip * 0.6) * 100);
  const rightPinchPct = Math.round(Math.max(rightController.trigger, rightController.grip * 0.6) * 100);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 p-3 sm:p-5 select-none pointer-events-auto"
      data-testid="vr-control-modal"
    >
      <div className="relative w-full max-w-4xl max-h-[92vh] overflow-y-auto rounded-2xl border-2 border-cyan-500/50 bg-slate-900 text-slate-100 shadow-2xl p-4 sm:p-6">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-cyan-500/20 border border-cyan-400/50 text-2xl">
              🥽
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg sm:text-2xl font-black tracking-tight text-white">
                  VR ЦЕНТР: PICO 4 ULTRA &amp; WEBXR 6DoF
                </h2>
                <span
                  data-testid="vr-status-badge"
                  className={`rounded-md px-2.5 py-0.5 text-xs font-extrabold uppercase tracking-wider ${
                    vrState.enabled
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/50'
                      : 'bg-slate-800 text-slate-400 border border-slate-700'
                  }`}
                >
                  {vrState.enabled
                    ? vrState.inWebXRSession
                      ? '🟢 PICO / WebXR Шлем Активен'
                      : isPico
                      ? '🟢 PICO 4 6DoF Активен'
                      : '🟢 6DoF VR Активен'
                    : '⚪ Обычный Режим'}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-400 mt-0.5" data-testid="vr-detected-headset">
                Профиль: <b className="text-cyan-300">{vrState.detectedHeadsetName}</b> · 6DoF контроллеры, 25-суставной трекинг рук PICO, Guardian-зона и лазерные лучи
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {onOpenTutorial && (
              <button
                type="button"
                data-testid="vr-modal-tutorial-btn"
                onClick={() => {
                  onClose();
                  onOpenTutorial();
                }}
                className="rounded-xl bg-slate-800 hover:bg-slate-700 border border-cyan-500/40 px-3.5 py-2.5 text-sm font-bold text-cyan-200 cursor-pointer whitespace-nowrap shrink-0"
              >
                🎓 Обучение VR
              </button>
            )}
            <button
              type="button"
              data-testid="vr-modal-toggle-btn"
              onClick={() => onToggleVR()}
              className={`rounded-xl px-4 py-2.5 text-sm font-black transition cursor-pointer whitespace-nowrap shrink-0 ${
                vrState.enabled
                  ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-600/30'
                  : 'bg-cyan-500 hover:bg-cyan-400 text-slate-950 shadow-lg shadow-cyan-500/30'
              }`}
            >
              {vrState.enabled ? '⏹ Выключить VR [V]' : '🥽 Включить PICO 6DoF [V]'}
            </button>
            <button
              type="button"
              data-testid="vr-modal-close-btn"
              onClick={onClose}
              className="rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 px-3.5 py-2.5 text-sm font-bold text-slate-200 cursor-pointer whitespace-nowrap shrink-0"
            >
              ✕ Закрыть
            </button>
          </div>
        </div>

        {/* Mode Selectors: PICO vs Quest Profile + Tracking Mode + Display Mode + Native WebXR */}
        <div className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-3">
          {/* Controller Model Profile: PICO 4 / Ultra vs Quest Touch */}
          <div className="rounded-xl border border-cyan-500/40 bg-slate-950/80 p-3.5">
            <div className="text-xs font-extrabold uppercase tracking-wider text-cyan-300 mb-2">
              1. Шлем и Контроллеры
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                data-testid="vr-profile-pico4-btn"
                onClick={() =>
                  onSetControllerProfile
                    ? onSetControllerProfile('pico4')
                    : onSetOptions({ controllerProfile: 'pico4' })
                }
                className={`rounded-lg px-2.5 py-2 text-xs font-extrabold border transition cursor-pointer ${
                  isPico
                    ? 'bg-cyan-500/25 border-cyan-300 text-white shadow-md shadow-cyan-500/20'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                ⚪ PICO 4 / Ultra
                <div className="text-[10px] font-normal text-cyan-200/80 mt-0.5">HyperSense Дуга</div>
              </button>
              <button
                type="button"
                data-testid="vr-profile-quest-btn"
                onClick={() =>
                  onSetControllerProfile
                    ? onSetControllerProfile('quest_touch')
                    : onSetOptions({ controllerProfile: 'quest_touch' })
                }
                className={`rounded-lg px-2.5 py-2 text-xs font-extrabold border transition cursor-pointer ${
                  !isPico
                    ? 'bg-amber-500/25 border-amber-400 text-amber-100'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                ⚫ Quest Touch
                <div className="text-[10px] font-normal opacity-80 mt-0.5">Кольцо сверху</div>
              </button>
            </div>
          </div>

          {/* Tracking Mode */}
          <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3.5">
            <div className="text-xs font-extrabold uppercase tracking-wider text-cyan-400 mb-2">
              2. Режим Трекинга PICO
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                data-testid="vr-tracking-controllers-btn"
                onClick={() => onSetTrackingMode('controllers')}
                className={`rounded-lg px-2.5 py-2 text-xs font-extrabold border transition cursor-pointer ${
                  vrState.trackingMode === 'controllers'
                    ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                🎮 6DoF Контроллеры
                <div className="text-[10px] font-normal opacity-80 mt-0.5">
                  {isPico ? 'PICO HyperSense' : 'Touch 6DoF'}
                </div>
              </button>
              <button
                type="button"
                data-testid="vr-tracking-hands-btn"
                onClick={() => onSetTrackingMode('hands')}
                className={`rounded-lg px-2.5 py-2 text-xs font-extrabold border transition cursor-pointer ${
                  vrState.trackingMode === 'hands'
                    ? 'bg-amber-500/20 border-amber-400 text-amber-200'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                🖐️ PICO Руки
                <div className="text-[10px] font-normal opacity-80 mt-0.5">25 суставов + Щипок</div>
              </button>
            </div>
          </div>

          {/* Display Mode */}
          <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3.5">
            <div className="text-xs font-extrabold uppercase tracking-wider text-purple-400 mb-2">
              3. Pancake Линзы / Экран
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                data-testid="vr-display-mono-btn"
                onClick={() => onSetDisplayMode('mono_6dof')}
                className={`rounded-lg px-2.5 py-2 text-xs font-extrabold border transition cursor-pointer ${
                  vrState.displayMode === 'mono_6dof'
                    ? 'bg-purple-500/20 border-purple-400 text-purple-200'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                🖥️ Моно 6DoF
                <div className="text-[10px] font-normal opacity-80 mt-0.5">Полный экран</div>
              </button>
              <button
                type="button"
                data-testid="vr-display-stereo-btn"
                onClick={() => onSetDisplayMode('stereo_sbs')}
                className={`rounded-lg px-2.5 py-2 text-xs font-extrabold border transition cursor-pointer ${
                  vrState.displayMode === 'stereo_sbs'
                    ? 'bg-fuchsia-500/20 border-fuchsia-400 text-fuchsia-200'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                🥽 Стерео SBS
                <div className="text-[10px] font-normal opacity-80 mt-0.5">PICO 2 Глаза</div>
              </button>
            </div>
          </div>

          {/* Native PICO WebXR Headset Launch */}
          <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3.5 flex flex-col justify-between">
            <div>
              <div className="text-xs font-extrabold uppercase tracking-wider text-emerald-400 mb-1">
                4. PICO Browser / Connect
              </div>
              <p className="text-[11px] text-slate-400 leading-tight">
                {vrState.immersiveSupported
                  ? 'Обнаружен совместимый шлем PICO 4 / WebXR!'
                  : typeof window !== 'undefined' && window.location?.protocol === 'file:'
                  ? 'Запуск из file:// (APK WebView). Для аппаратного WebXR в PICO откройте по HTTPS (GitHub Pages / WebViewAssetLoader); сейчас доступен 6DoF + Стерео SBS.'
                  : typeof window !== 'undefined' && !window.isSecureContext
                  ? 'Для аппаратного PICO WebXR нужен HTTPS. Сейчас активен 6DoF + Стерео SBS.'
                  : 'Поддержка PICO Browser, PICO Connect и встроенного 6DoF симулятора.'}
              </p>
            </div>
            <button
              type="button"
              data-testid="vr-start-webxr-btn"
              onClick={onStartWebXR}
              className="mt-2 w-full rounded-lg bg-emerald-600/25 hover:bg-emerald-600/40 border border-emerald-400/50 px-3 py-2 text-xs font-extrabold text-emerald-200 transition cursor-pointer"
            >
              🚀 {vrState.immersiveSupported ? 'Запустить в Шлеме PICO' : 'Запустить PICO 6DoF'}
            </button>
          </div>
        </div>

        {/* Live 6DoF Controller Telemetry Cards */}
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Left Controller Telemetry */}
          <div
            data-testid="vr-left-telemetry"
            className="rounded-xl border border-cyan-500/40 bg-slate-950/90 p-4"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="inline-block h-2.5 w-2.5 rounded-full bg-cyan-400" />
                <span className="text-sm font-black text-cyan-300 uppercase">
                  ЛЕВЫЙ КОНТРОЛЛЕР ({isPico ? 'PICO 4 L' : 'TOUCH L'} + ЧАСЫ HUD)
                </span>
              </div>
              <span className="text-[11px] font-mono text-cyan-300 bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-500/30">
                {vrState.trackingMode === 'hands'
                  ? '🖐️ PICO 25-Joint Hand'
                  : isPico
                  ? '⚪ PICO HyperSense L'
                  : '🎮 Touch Pro L'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs font-mono">
              <div className="rounded-lg bg-slate-900 p-2 border border-slate-800">
                <div className="text-[10px] text-slate-400 uppercase">Позиция 6DoF (X, Y, Z м)</div>
                <div className="text-cyan-200 font-bold mt-0.5" data-testid="vr-left-pos">
                  {leftController.position[0].toFixed(2)}, {leftController.position[1].toFixed(2)},{' '}
                  {leftController.position[2].toFixed(2)}
                </div>
              </div>
              <div className="rounded-lg bg-slate-900 p-2 border border-slate-800">
                <div className="text-[10px] text-slate-400 uppercase">Ориентация (Pitch, Yaw, Roll)</div>
                <div className="text-cyan-200 font-bold mt-0.5" data-testid="vr-left-rot">
                  {leftController.rotation[0]}°, {leftController.rotation[1]}°, {leftController.rotation[2]}°
                </div>
              </div>
            </div>

            {/* PICO Left Buttons [X] [Y] [Stick L] & Trigger/Grip */}
            <div className="mt-2.5 flex items-center justify-between gap-2 rounded-lg bg-slate-900/90 px-3 py-1.5 border border-slate-800 text-[11px]">
              <span className="text-slate-400 font-bold">Кнопки PICO L:</span>
              <div className="flex items-center gap-1.5 font-mono">
                <span
                  className={`px-2 py-0.5 rounded font-black border ${
                    leftController.buttonPrimary
                      ? 'bg-amber-400 text-slate-950 border-amber-200'
                      : 'bg-slate-800 text-slate-400 border-slate-700'
                  }`}
                >
                  [X] 3D VR Меню
                </span>
                <span
                  className={`px-2 py-0.5 rounded font-black border ${
                    leftController.buttonSecondary
                      ? 'bg-cyan-400 text-slate-950 border-cyan-200'
                      : 'bg-slate-800 text-slate-400 border-slate-700'
                  }`}
                >
                  [Y] Памятка
                </span>
                <span className="px-2 py-0.5 rounded bg-slate-800 text-cyan-300 border border-slate-700">
                  Стик: {leftController.thumbstick[0].toFixed(1)}, {leftController.thumbstick[1].toFixed(1)}
                </span>
              </div>
            </div>

            {/* Trigger & Grip Progress Bars */}
            <div className="mt-2 grid grid-cols-3 gap-2 text-[11px]">
              <div className="rounded bg-slate-900 px-2.5 py-1.5 border border-slate-800">
                <div className="flex justify-between text-slate-400">
                  <span>Курок L</span>
                  <span className="font-mono text-cyan-300">{Math.round(leftController.trigger * 100)}%</span>
                </div>
                <div className="mt-1 h-1.5 w-full rounded bg-slate-800 overflow-hidden">
                  <div
                    className="h-full bg-cyan-400 transition-all duration-75"
                    style={{ width: `${Math.round(leftController.trigger * 100)}%` }}
                  />
                </div>
              </div>
              <div className="rounded bg-slate-900 px-2.5 py-1.5 border border-slate-800">
                <div className="flex justify-between text-slate-400">
                  <span>Хват (Grip)</span>
                  <span className="font-mono text-cyan-300">{Math.round(leftController.grip * 100)}%</span>
                </div>
                <div className="mt-1 h-1.5 w-full rounded bg-slate-800 overflow-hidden">
                  <div
                    className="h-full bg-emerald-400 transition-all duration-75"
                    style={{ width: `${Math.round(leftController.grip * 100)}%` }}
                  />
                </div>
              </div>
              <div className="rounded bg-slate-900 px-2.5 py-1.5 border border-slate-800">
                <div className="flex justify-between text-slate-400">
                  <span>Щипок руки</span>
                  <span className="font-mono text-amber-300">{leftPinchPct}%</span>
                </div>
                <div className="mt-1 h-1.5 w-full rounded bg-slate-800 overflow-hidden">
                  <div
                    className="h-full bg-amber-400 transition-all duration-75"
                    style={{ width: `${leftPinchPct}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="mt-2 flex items-center justify-between text-xs text-slate-400 bg-slate-900/80 px-2.5 py-1.5 rounded border border-slate-800/80">
              <span>🎯 Луч телепорта (L):</span>
              <span className="font-mono text-emerald-300 font-bold">
                {vrState.teleportTarget
                  ? `Пол [${vrState.teleportTarget[0].toFixed(1)}, ${vrState.teleportTarget[2].toFixed(1)}м]`
                  : leftController.rayHitLabel || 'Свободно'}
              </span>
            </div>
          </div>

          {/* Right Controller Telemetry */}
          <div
            data-testid="vr-right-telemetry"
            className="rounded-xl border border-amber-500/40 bg-slate-950/90 p-4"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="inline-block h-2.5 w-2.5 rounded-full bg-amber-400" />
                <span className="text-sm font-black text-amber-300 uppercase">
                  ПРАВЫЙ КОНТРОЛЛЕР ({isPico ? 'PICO 4 R' : 'TOUCH R'} + ПРЕДМЕТ)
                </span>
              </div>
              <span className="text-[11px] font-mono text-amber-300 bg-amber-950/60 px-2 py-0.5 rounded border border-amber-500/30">
                {vrState.trackingMode === 'hands'
                  ? '🖐️ PICO 25-Joint Hand'
                  : isPico
                  ? '⚪ PICO HyperSense R'
                  : '🎮 Touch Pro R'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs font-mono">
              <div className="rounded-lg bg-slate-900 p-2 border border-slate-800">
                <div className="text-[10px] text-slate-400 uppercase">Позиция 6DoF (X, Y, Z м)</div>
                <div className="text-amber-200 font-bold mt-0.5" data-testid="vr-right-pos">
                  {rightController.position[0].toFixed(2)}, {rightController.position[1].toFixed(2)},{' '}
                  {rightController.position[2].toFixed(2)}
                </div>
              </div>
              <div className="rounded-lg bg-slate-900 p-2 border border-slate-800">
                <div className="text-[10px] text-slate-400 uppercase">Ориентация (Pitch, Yaw, Roll)</div>
                <div className="text-amber-200 font-bold mt-0.5" data-testid="vr-right-rot">
                  {rightController.rotation[0]}°, {rightController.rotation[1]}°, {rightController.rotation[2]}°
                </div>
              </div>
            </div>

            {/* PICO Right Buttons [A] [B] [Stick R] */}
            <div className="mt-2.5 flex items-center justify-between gap-2 rounded-lg bg-slate-900/90 px-3 py-1.5 border border-slate-800 text-[11px]">
              <span className="text-slate-400 font-bold">Кнопки PICO R:</span>
              <div className="flex items-center gap-1.5 font-mono">
                <span
                  className={`px-2 py-0.5 rounded font-black border ${
                    rightController.buttonPrimary
                      ? 'bg-amber-400 text-slate-950 border-amber-200'
                      : 'bg-slate-800 text-slate-400 border-slate-700'
                  }`}
                >
                  [A] Действие
                </span>
                <span
                  className={`px-2 py-0.5 rounded font-black border ${
                    rightController.buttonSecondary
                      ? 'bg-cyan-400 text-slate-950 border-cyan-200'
                      : 'bg-slate-800 text-slate-400 border-slate-700'
                  }`}
                >
                  [B] Телепорт
                </span>
                <span className="px-2 py-0.5 rounded bg-slate-800 text-amber-300 border border-slate-700">
                  Стик: {rightController.thumbstick[0].toFixed(1)}, {rightController.thumbstick[1].toFixed(1)}
                </span>
              </div>
            </div>

            {/* Trigger & Grip Progress Bars */}
            <div className="mt-2 grid grid-cols-3 gap-2 text-[11px]">
              <div className="rounded bg-slate-900 px-2.5 py-1.5 border border-slate-800">
                <div className="flex justify-between text-slate-400">
                  <span>Курок (ЛКМ)</span>
                  <span className="font-mono text-amber-300">{Math.round(rightController.trigger * 100)}%</span>
                </div>
                <div className="mt-1 h-1.5 w-full rounded bg-slate-800 overflow-hidden">
                  <div
                    className="h-full bg-amber-400 transition-all duration-75"
                    style={{ width: `${Math.round(rightController.trigger * 100)}%` }}
                  />
                </div>
              </div>
              <div className="rounded bg-slate-900 px-2.5 py-1.5 border border-slate-800">
                <div className="flex justify-between text-slate-400">
                  <span>Хват (Grip)</span>
                  <span className="font-mono text-amber-300">{Math.round(rightController.grip * 100)}%</span>
                </div>
                <div className="mt-1 h-1.5 w-full rounded bg-slate-800 overflow-hidden">
                  <div
                    className="h-full bg-emerald-400 transition-all duration-75"
                    style={{ width: `${Math.round(rightController.grip * 100)}%` }}
                  />
                </div>
              </div>
              <div className="rounded bg-slate-900 px-2.5 py-1.5 border border-slate-800">
                <div className="flex justify-between text-slate-400">
                  <span>Щипок руки</span>
                  <span className="font-mono text-amber-300">{rightPinchPct}%</span>
                </div>
                <div className="mt-1 h-1.5 w-full rounded bg-slate-800 overflow-hidden">
                  <div
                    className="h-full bg-amber-400 transition-all duration-75"
                    style={{ width: `${rightPinchPct}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="mt-2 flex items-center justify-between text-xs text-slate-400 bg-slate-900/80 px-2.5 py-1.5 rounded border border-slate-800/80">
              <span>🔦 Лазерный прицел (R):</span>
              <span className="font-mono text-amber-300 font-bold" data-testid="vr-right-target">
                {rightController.rayHitLabel || 'Наведите курсор на объект'}
              </span>
            </div>
          </div>
        </div>

        {/* Locomotion, Snap-Turn, PICO Guardian, IPD & Haptics Controls */}
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3.5 space-y-2.5">
            <div className="text-xs font-extrabold uppercase tracking-wider text-slate-300">
              Настройки PICO OS: Guardian Зона, Pancake IPD и Поворот
            </div>

            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-slate-400">Угол Snap-поворота (Стик R / [Q] / [X]):</span>
              <div className="flex gap-1.5">
                {([30, 45, 90] as const).map((deg) => (
                  <button
                    key={deg}
                    type="button"
                    data-testid={`vr-snap-deg-${deg}`}
                    onClick={() => onSetOptions({ snapTurnDegrees: deg })}
                    className={`rounded-lg px-2.5 py-1 text-xs font-bold border cursor-pointer ${
                      vrState.snapTurnDegrees === deg
                        ? 'bg-cyan-500/25 border-cyan-400 text-cyan-200'
                        : 'bg-slate-900 border-slate-800 text-slate-400'
                    }`}
                  >
                    {deg}°
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-slate-400">Моторизованный IPD PICO 4 (58–72 мм):</span>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min={54}
                  max={74}
                  step={1}
                  value={vrState.ipdMm}
                  onChange={(e) => onSetOptions({ ipdMm: Number(e.target.value) })}
                  className="w-28 accent-cyan-400 cursor-pointer"
                />
                <span className="text-xs font-mono font-bold text-cyan-300 w-12 text-right">
                  {vrState.ipdMm} мм
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <span className="text-xs text-slate-300 font-bold block">
                  Рост в VR (Высота глаз: ≈ {(1.55 + vrState.heightOffset).toFixed(2)}м):
                </span>
                <span className="text-[10px] text-slate-400 block">
                  Чтобы не чувствовать себя коротышкой в масштабе Blox
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <input
                  type="range"
                  data-testid="vr-height-slider"
                  min={0}
                  max={2.8}
                  step={0.05}
                  value={vrState.heightOffset}
                  onChange={(e) => onSetOptions({ heightOffset: Number(e.target.value) })}
                  className="w-24 accent-emerald-400 cursor-pointer"
                />
                {onCalibrateHeight && (
                  <button
                    type="button"
                    data-testid="vr-calibrate-height-btn"
                    onClick={onCalibrateHeight}
                    className="rounded-lg bg-emerald-600/25 hover:bg-emerald-600/40 border border-emerald-400/50 px-2 py-1 text-[11px] font-extrabold text-emerald-200 cursor-pointer whitespace-nowrap"
                    title="Автоматически выровнять рост под стандартный уровень глаз"
                  >
                    📏 Выровнять
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                data-testid="vr-performance-mode-btn"
                onClick={() => onSetOptions({ performanceMode: !vrState.performanceMode })}
                className={`rounded-lg px-2.5 py-2 text-xs font-bold border cursor-pointer ${
                  vrState.performanceMode
                    ? 'bg-emerald-500/20 border-emerald-400/60 text-emerald-200'
                    : 'bg-slate-900 border-slate-800 text-slate-400'
                }`}
              >
                {vrState.performanceMode ? '⚡ Макс FPS (VR/PICO): ВКЛ' : '🎨 Качество: Обычное'}
              </button>
              <button
                type="button"
                data-testid="vr-controls-hint-btn"
                onClick={() => onSetOptions({ controlsHintVisible: !vrState.controlsHintVisible })}
                className={`rounded-lg px-2.5 py-2 text-xs font-bold border cursor-pointer ${
                  vrState.controlsHintVisible
                    ? 'bg-sky-500/20 border-sky-400/60 text-sky-200'
                    : 'bg-slate-900 border-slate-800 text-slate-400'
                }`}
              >
                {vrState.controlsHintVisible ? '📋 Памятка 3D [Y]: ВКЛ' : '⬜ Памятка 3D [Y]: ВЫКЛ'}
              </button>
              <button
                type="button"
                data-testid="vr-pico-guardian-btn"
                onClick={() => onSetOptions({ picoGuardianVisible: !vrState.picoGuardianVisible })}
                className={`rounded-lg px-2.5 py-2 text-xs font-bold border cursor-pointer ${
                  vrState.picoGuardianVisible
                    ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-200'
                    : 'bg-slate-900 border-slate-800 text-slate-400'
                }`}
              >
                {vrState.picoGuardianVisible ? '⭕ Зона PICO Guardian ВКЛ' : '⬜ Зона PICO Guardian ВЫКЛ'}
              </button>
              <button
                type="button"
                data-testid="vr-pico-passthrough-btn"
                onClick={() => onSetOptions({ picoPassthroughGrid: !vrState.picoPassthroughGrid })}
                className={`rounded-lg px-2.5 py-2 text-xs font-bold border cursor-pointer ${
                  vrState.picoPassthroughGrid
                    ? 'bg-purple-500/20 border-purple-400/50 text-purple-200'
                    : 'bg-slate-900 border-slate-800 text-slate-400'
                }`}
              >
                {vrState.picoPassthroughGrid ? '🌐 Сетка PICO Seethrough ВКЛ' : '⬜ Сетка PICO Seethrough ВЫКЛ'}
              </button>
            </div>
          </div>

          {/* Interactive Action Test Pad */}
          <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3.5 flex flex-col justify-between">
            <div>
              <div className="text-xs font-extrabold uppercase tracking-wider text-slate-300 mb-2">
                Быстрое Тестирование PICO 6DoF ({vrState.lastActionLabel})
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  data-testid="vr-snap-left-btn"
                  onClick={() => onSnapTurn(-1)}
                  className="rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 px-3 py-2 text-xs font-bold text-slate-200 cursor-pointer"
                >
                  ↺ Snap-Поворот -{vrState.snapTurnDegrees}° [Q]
                </button>
                <button
                  type="button"
                  data-testid="vr-snap-right-btn"
                  onClick={() => onSnapTurn(1)}
                  className="rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 px-3 py-2 text-xs font-bold text-slate-200 cursor-pointer"
                >
                  ↻ Snap-Поворот +{vrState.snapTurnDegrees}° [X]
                </button>
                <button
                  type="button"
                  data-testid="vr-teleport-test-btn"
                  onClick={onTeleport}
                  className="rounded-lg bg-cyan-600/30 hover:bg-cyan-600/45 border border-cyan-400/50 px-3 py-2 text-xs font-extrabold text-cyan-200 cursor-pointer"
                >
                  ⚡ VR Телепорт по Лучу [T]
                </button>
                <button
                  type="button"
                  data-testid="vr-haptic-test-btn"
                  onClick={onHapticPulse}
                  className="rounded-lg bg-amber-600/30 hover:bg-amber-600/45 border border-amber-400/50 px-3 py-2 text-xs font-extrabold text-amber-200 cursor-pointer"
                >
                  📳 PICO HyperSense ({vrState.hapticPulseCount})
                </button>
              </div>
            </div>

            <div className="mt-3 flex items-center justify-between rounded-lg bg-slate-900/90 px-3 py-2 border border-slate-800 text-[11px] text-slate-300">
              <span>
                💡 <b>PICO 4 / Ultra:</b> Левый стик = Ходьба · Правый стик = Поворот · <b>[X]</b> = 3D Главное меню VR · <b>[Y] / L3</b> = Скрыть памятку · Курок R = Действие / Выбор в меню · Хват L = Телепорт
              </span>
              <button
                type="button"
                onClick={onRecenter}
                className="ml-2 shrink-0 rounded bg-slate-800 hover:bg-slate-700 px-2.5 py-1 text-[11px] font-bold text-cyan-300 border border-slate-700 cursor-pointer"
              >
                🎯 Центрировать
              </button>
            </div>
          </div>
        </div>

        {/* VR Hand Gestures -> Unique Emote Animations */}
        {onTriggerGesture && (
          <div
            data-testid="vr-modal-gestures-panel"
            className="mt-4 rounded-xl border border-emerald-500/35 bg-slate-950/80 p-3.5"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
              <div>
                <div className="text-xs font-extrabold uppercase tracking-wider text-emerald-300">
                  5. Жесты рук VR (Уникальные 3D-эмоции)
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Автоматически распознаются по 25 суставам кисти WebXR или взмахом / зажатием правого хвата (Grip).
                </p>
              </div>
              {vrState.activeGestureLabel && (
                <span
                  data-testid="vr-modal-active-gesture"
                  className="rounded-lg bg-emerald-500/20 border border-emerald-400/60 px-2.5 py-1 text-xs font-extrabold text-emerald-200"
                >
                  Активен: {vrState.activeGestureLabel}
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
              {VR_GESTURE_DEFINITIONS.map((gesture) => {
                const isActive = vrState.activeGesture === gesture.id;
                return (
                  <button
                    key={gesture.id}
                    type="button"
                    data-testid={`vr-modal-gesture-${gesture.id}`}
                    onClick={() => onTriggerGesture(gesture.id)}
                    className={`flex flex-col items-start gap-1 rounded-xl border p-2.5 text-left transition cursor-pointer ${
                      isActive
                        ? 'bg-emerald-500/20 border-emerald-400 text-white shadow-md shadow-emerald-500/20'
                        : 'bg-slate-900 hover:bg-slate-800 border-slate-800 hover:border-cyan-500/50 text-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-extrabold text-xs">
                      <span className="text-lg leading-none">{gesture.emoji}</span>
                      <span>{gesture.label}</span>
                    </div>
                    <div className="text-[10px] text-slate-400 leading-snug">
                      {vrState.trackingMode === 'hands' ? gesture.handPoseHint : gesture.controllerComboHint}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

interface VRActiveHUDProps {
  vrState: VRState;
  doorsState?: DoorsGameState;
  isDoorsMode?: boolean;
  onDoorsInteract?: () => void;
  onOpenModal: () => void;
  onOpenTutorial?: () => void;
  onToggleTracking: () => void;
  onToggleProfile?: () => void;
  onToggleStereo: () => void;
  onSnapTurn: (dir: -1 | 1) => void;
  onTeleport: () => void;
  onCalibrateHeight?: () => void;
  onChangeHeightOffset?: (offset: number) => void;
  onToggleControlsHint?: () => void;
  onToggleVRMenu?: () => void;
  onReturnToTitle?: () => void;
  portalGunActive?: boolean;
  onTogglePortalGun?: () => void;
  onTriggerGesture?: (gestureId: VRHandGestureId) => void;
  onDisableVR: () => void;
}

export const VRActiveHUD: React.FC<VRActiveHUDProps> = ({
  vrState,
  doorsState,
  isDoorsMode = false,
  onDoorsInteract,
  onOpenModal,
  onOpenTutorial,
  onToggleTracking,
  onToggleProfile,
  onToggleStereo,
  onSnapTurn,
  onTeleport,
  onCalibrateHeight,
  onChangeHeightOffset,
  onToggleControlsHint,
  onToggleVRMenu,
  onReturnToTitle,
  portalGunActive,
  onTogglePortalGun,
  onTriggerGesture,
  onDisableVR,
}) => {
  if (!vrState.enabled) return null;

  const isPico = vrState.controllerProfile === 'pico4';
  const rushWarnSec = doorsState?.rushWarningSeconds || 0;
  const isRushEvent = Boolean(
    isDoorsMode && doorsState && (rushWarnSec > 0 || doorsState.rushActive)
  );
  const isHidingSafe = Boolean(doorsState?.isHidingInCloset);
  const isRushDanger = isRushEvent && !isHidingSafe;

  return (
    <>
      {/* Comfort Anti-Motion-Sickness Vignette */}
      {vrState.comfortVignette && vrState.vignetteIntensity > 0.02 && (
        <div
          className="fixed inset-0 pointer-events-none z-20 transition-opacity duration-75"
          style={{
            opacity: vrState.vignetteIntensity,
            background:
              'radial-gradient(circle at center, transparent 42%, rgba(2,6,23,0.88) 72%, rgba(2,6,23,0.98) 100%)',
          }}
        />
      )}

      {/* DOORS RUSH APPROACHING — FLASHING RED VR VISUAL THREAT CUE */}
      {isRushEvent && (
        <div
          data-testid="vr-rush-red-cue"
          data-rush-danger={isRushDanger ? 'true' : 'false'}
          className="fixed inset-0 pointer-events-none z-25"
          aria-live="assertive"
        >
          {isRushDanger ? (
            vrState.displayMode === 'stereo_sbs' ? (
              <div className="w-full h-full flex">
                <div
                  className="w-1/2 h-full border-[6px] border-red-500 animate-pulse"
                  style={{
                    background:
                      'radial-gradient(circle at center, transparent 46%, rgba(220,38,38,0.42) 82%, rgba(185,28,28,0.78) 100%)',
                  }}
                />
                <div
                  className="w-1/2 h-full border-[6px] border-red-500 animate-pulse"
                  style={{
                    background:
                      'radial-gradient(circle at center, transparent 46%, rgba(220,38,38,0.42) 82%, rgba(185,28,28,0.78) 100%)',
                  }}
                />
              </div>
            ) : (
              <div
                className="w-full h-full border-[8px] border-red-500 animate-pulse"
                style={{
                  background:
                    'radial-gradient(circle at center, transparent 48%, rgba(220,38,38,0.44) 84%, rgba(185,28,28,0.8) 100%)',
                }}
              />
            )
          ) : (
            <div className="w-full h-full border-[4px] border-emerald-400/70 shadow-[inset_0_0_55px_rgba(16,185,129,0.28)]" />
          )}
        </div>
      )}

      {/* Stereo Side-by-Side Center Divider & Eye Badges */}
      {vrState.displayMode === 'stereo_sbs' && (
        <div className="fixed inset-0 pointer-events-none z-20 flex" data-testid="vr-stereo-sbs-overlay">
          <div className="w-1/2 h-full border-r-2 border-cyan-400/40 relative">
            <span className="absolute top-14 left-4 rounded bg-slate-950/80 border border-cyan-500/40 px-2 py-0.5 text-[10px] font-mono font-bold text-cyan-300">
              👁️ PICO ЛЕВЫЙ ГЛАЗ (IPD {vrState.ipdMm}мм)
            </span>
          </div>
          <div className="w-1/2 h-full relative">
            <span className="absolute top-14 right-4 rounded bg-slate-950/80 border border-cyan-500/40 px-2 py-0.5 text-[10px] font-mono font-bold text-cyan-300">
              👁️ PICO ПРАВЫЙ ГЛАЗ (IPD {vrState.ipdMm}мм)
            </span>
          </div>
        </div>
      )}

      {/* Compact Bottom-Right PICO 6DoF Quick Strip */}
      <div
        data-testid="vr-active-strip"
        className={`fixed ${
          portalGunActive ? 'bottom-36' : 'bottom-20'
        } right-4 z-30 flex flex-wrap items-center gap-1.5 rounded-xl border-2 px-2.5 py-1.5 text-xs text-slate-100 shadow-xl pointer-events-auto max-w-[94vw] transition-all ${
          isRushDanger
            ? 'border-red-500 bg-red-950/95 shadow-[0_0_28px_rgba(239,68,68,0.85)] animate-pulse'
            : isRushEvent && isHidingSafe
            ? 'border-emerald-400 bg-emerald-950/95 shadow-[0_0_20px_rgba(16,185,129,0.5)]'
            : 'border-cyan-400/50 bg-slate-950/90'
        }`}
      >
        <span className="flex items-center gap-1.5 px-1.5 font-black text-cyan-300">
          <span
            className={`inline-block h-2 w-2 rounded-full ${
              isRushDanger ? 'bg-red-500' : 'bg-emerald-400'
            }`}
          />
          {isPico ? 'PICO 4 6DoF' : 'QUEST 6DoF'}
        </span>

        {isRushEvent && (
          <span
            data-testid="vr-strip-rush-alert"
            className={`rounded-lg border px-2 py-0.5 font-black whitespace-nowrap shrink-0 ${
              isHidingSafe
                ? 'bg-emerald-500/25 border-emerald-400 text-emerald-200'
                : 'bg-red-600 border-red-300 text-white animate-pulse'
            }`}
          >
            {isHidingSafe
              ? '🛡️ В ШКАФУ · РАШ МИМО'
              : rushWarnSec > 0
              ? `🚨 РАШ ${rushWarnSec.toFixed(1)}с! В ШКАФ!`
              : `💀 РАШ (${doorsState?.rushDistanceMeters || 0}м)!`}
          </span>
        )}

        {isRushDanger && doorsState?.nearInteractable?.type === 'closet' && onDoorsInteract && (
          <button
            type="button"
            data-testid="vr-strip-hide-closet-btn"
            onClick={onDoorsInteract}
            className="rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 border border-white px-2.5 py-1 font-black cursor-pointer whitespace-nowrap shrink-0"
          >
            🚪 В ШКАФ
          </button>
        )}

        {vrState.activeGestureLabel && (
          <span
            data-testid="vr-active-gesture-badge"
            className="rounded-lg bg-emerald-500/20 border border-emerald-400/60 px-2 py-0.5 font-extrabold text-emerald-200 whitespace-nowrap shrink-0"
          >
            {vrState.activeGestureLabel}
          </span>
        )}

        {onTriggerGesture && (
          <div
            data-testid="vr-strip-gestures"
            className="flex items-center gap-1 rounded-lg bg-slate-900/90 border border-slate-700/80 px-1 py-0.5"
            title="Жесты рук VR (показывают уникальную 3D-эмоцию)"
          >
            {VR_GESTURE_DEFINITIONS.map((gesture) => {
              const active = vrState.activeGesture === gesture.id;
              return (
                <button
                  key={gesture.id}
                  type="button"
                  data-testid={`vr-gesture-btn-${gesture.id}`}
                  onClick={() => onTriggerGesture(gesture.id)}
                  title={`${gesture.label}: ${gesture.handPoseHint}`}
                  aria-label={`VR жест: ${gesture.label}`}
                  className={`min-w-[28px] min-h-[26px] rounded px-1.5 py-0.5 text-sm leading-none transition cursor-pointer ${
                    active
                      ? 'bg-emerald-500/35 border border-emerald-400 text-white'
                      : 'hover:bg-slate-800 text-slate-200 border border-transparent'
                  }`}
                >
                  {gesture.emoji}
                </button>
              );
            })}
          </div>
        )}

        {onToggleProfile && (
          <button
            type="button"
            data-testid="vr-strip-profile-btn"
            onClick={onToggleProfile}
            className="rounded-lg bg-slate-800 hover:bg-slate-700 border border-cyan-500/40 px-2.5 py-1 font-bold text-white cursor-pointer"
            title="Переключить модель контроллеров PICO 4 / Quest Touch"
          >
            {isPico ? '⚪ PICO 4' : '⚫ Quest'}
          </button>
        )}

        <button
          type="button"
          data-testid="vr-strip-tracking-btn"
          onClick={onToggleTracking}
          className="rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 px-2.5 py-1 font-bold text-cyan-200 cursor-pointer"
          title="Переключить Контроллеры / Отслеживание Рук PICO"
        >
          {vrState.trackingMode === 'controllers' ? '🎮 Контроллеры' : '🖐️ PICO Руки'}
        </button>

        <button
          type="button"
          data-testid="vr-strip-stereo-btn"
          onClick={onToggleStereo}
          className="rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 px-2.5 py-1 font-bold text-purple-200 cursor-pointer"
          title="Переключить Моно 6DoF / Стерео SBS Очки"
        >
          {vrState.displayMode === 'stereo_sbs' ? '🥽 Стерео SBS' : '🖥️ Моно 6DoF'}
        </button>

        <button
          type="button"
          data-testid="vr-strip-snap-left"
          onClick={() => onSnapTurn(-1)}
          className="rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 px-2 py-1 font-bold text-slate-200 cursor-pointer"
          title="Snap-поворот влево [Q]"
        >
          ↺ -{vrState.snapTurnDegrees}°
        </button>

        <button
          type="button"
          data-testid="vr-strip-snap-right"
          onClick={() => onSnapTurn(1)}
          className="rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 px-2 py-1 font-bold text-slate-200 cursor-pointer"
          title="Snap-поворот вправо [X]"
        >
          ↻ +{vrState.snapTurnDegrees}°
        </button>

        <button
          type="button"
          data-testid="vr-strip-teleport-btn"
          onClick={onTeleport}
          className="rounded-lg bg-cyan-500/25 hover:bg-cyan-500/40 border border-cyan-400/50 px-2.5 py-1 font-extrabold text-cyan-200 cursor-pointer"
          title="VR Телепорт в точку на полу [T]"
        >
          ⚡ Телепорт [T]
        </button>

        {(onChangeHeightOffset || onCalibrateHeight) && (
          <div
            data-testid="vr-hud-height-control"
            className="flex items-center gap-1.5 rounded-lg bg-emerald-950/75 border border-emerald-400/50 px-2 py-0.5 whitespace-nowrap shrink-0"
            title={`Высота глаз в VR: смещение +${vrState.heightOffset.toFixed(2)}м (глаза ≈ ${(1.55 + vrState.heightOffset).toFixed(2)}м)`}
          >
            <span className="text-[11px] font-black text-emerald-300 select-none">📏 Рост</span>

            {onChangeHeightOffset && (
              <>
                <button
                  type="button"
                  data-testid="vr-hud-height-dec"
                  onClick={() =>
                    onChangeHeightOffset(
                      Math.max(VR_MIN_HEIGHT_OFFSET, Number((vrState.heightOffset - 0.1).toFixed(2)))
                    )
                  }
                  aria-label="Уменьшить высоту глаз в VR"
                  className="w-5 h-5 flex items-center justify-center rounded bg-slate-900 hover:bg-slate-800 border border-emerald-500/40 text-emerald-200 font-black leading-none cursor-pointer"
                >
                  −
                </button>
                <input
                  type="range"
                  data-testid="vr-hud-height-slider"
                  min={VR_MIN_HEIGHT_OFFSET}
                  max={VR_MAX_HEIGHT_OFFSET}
                  step={0.05}
                  value={vrState.heightOffset}
                  onChange={(e) => onChangeHeightOffset(parseFloat(e.target.value))}
                  aria-label="Ползунок высоты глаз в VR"
                  className="w-20 sm:w-24 accent-emerald-400 cursor-pointer"
                />
                <button
                  type="button"
                  data-testid="vr-hud-height-inc"
                  onClick={() =>
                    onChangeHeightOffset(
                      Math.min(VR_MAX_HEIGHT_OFFSET, Number((vrState.heightOffset + 0.1).toFixed(2)))
                    )
                  }
                  aria-label="Увеличить высоту глаз в VR"
                  className="w-5 h-5 flex items-center justify-center rounded bg-slate-900 hover:bg-slate-800 border border-emerald-500/40 text-emerald-200 font-black leading-none cursor-pointer"
                >
                  +
                </button>
                <span
                  data-testid="vr-hud-height-value"
                  className="font-mono text-[11px] font-black text-emerald-200 min-w-[44px] text-right tabular-nums"
                >
                  +{vrState.heightOffset.toFixed(2)}м
                </span>
              </>
            )}

            {onCalibrateHeight && (
              <button
                type="button"
                data-testid="vr-strip-height-btn"
                onClick={onCalibrateHeight}
                className="rounded bg-emerald-500/25 hover:bg-emerald-500/40 border border-emerald-400/60 px-1.5 py-0.5 text-[10px] font-black text-emerald-100 cursor-pointer"
                title={`Авто-выравнивание роста в VR (по умолчанию +${VR_DEFAULT_HEIGHT_OFFSET.toFixed(2)}м)`}
              >
                Авто
              </button>
            )}
          </div>
        )}

        {onToggleVRMenu && (
          <button
            type="button"
            data-testid="vr-strip-menu-btn"
            onClick={onToggleVRMenu}
            className={`rounded-lg border px-2.5 py-1 font-black cursor-pointer whitespace-nowrap shrink-0 ${
              vrState.vrMenuOpen
                ? 'bg-cyan-400 border-white text-slate-950 shadow-md shadow-cyan-500/40'
                : 'bg-cyan-500/25 hover:bg-cyan-500/40 border-cyan-400/70 text-cyan-100'
            }`}
            title="Открыть / закрыть 3D Главное меню VR (Левая кнопка [X] на PICO 4 или [M] на ПК)"
          >
            🏠 VR Меню [X]
          </button>
        )}

        {onTogglePortalGun && (
          <button
            type="button"
            data-testid="vr-strip-portal-btn"
            onClick={onTogglePortalGun}
            className={`rounded-lg border px-2.5 py-1 font-black cursor-pointer whitespace-nowrap shrink-0 ${
              portalGunActive
                ? 'bg-gradient-to-r from-cyan-400 to-orange-400 border-white text-slate-950 shadow-md'
                : 'bg-slate-800 hover:bg-slate-700 border-cyan-500/60 text-cyan-200'
            }`}
            title="Взять / убрать 3D Портал-Пушку (Курок R = 🔵, Курок L = 🟠)"
          >
            🌀 Порталы
          </button>
        )}

        {onToggleControlsHint && (
          <button
            type="button"
            data-testid="vr-strip-hint-btn"
            onClick={onToggleControlsHint}
            className={`rounded-lg border px-2.5 py-1 font-bold cursor-pointer whitespace-nowrap shrink-0 ${
              vrState.controlsHintVisible
                ? 'bg-sky-500/25 border-sky-400 text-sky-200'
                : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300'
            }`}
            title="Показать/скрыть 3D памятку кнопок (Левая кнопка [Y] или нажатие левого стика L3)"
          >
            📋 Кнопки [Y]
          </button>
        )}

        {onOpenTutorial && (
          <button
            type="button"
            data-testid="vr-strip-tutorial-btn"
            onClick={onOpenTutorial}
            className="rounded-lg bg-cyan-500/20 hover:bg-cyan-500/35 border border-cyan-400/50 px-2.5 py-1 font-bold text-cyan-200 cursor-pointer whitespace-nowrap shrink-0"
            title="Интерактивное обучение контроллерам и жестам VR"
          >
            🎓 Обучение
          </button>
        )}

        <button
          type="button"
          data-testid="vr-strip-settings-btn"
          onClick={onOpenModal}
          className="rounded-lg bg-amber-500/20 hover:bg-amber-500/35 border border-amber-400/50 px-2.5 py-1 font-bold text-amber-200 cursor-pointer whitespace-nowrap shrink-0"
        >
          📊 Датчики PICO
        </button>

        {onReturnToTitle && (
          <button
            type="button"
            data-testid="vr-strip-exit-title-btn"
            onClick={onReturnToTitle}
            className="rounded-lg bg-rose-500/25 hover:bg-rose-500/45 border border-rose-400/60 px-2.5 py-1 font-black text-rose-100 cursor-pointer whitespace-nowrap shrink-0"
            title="Выйти из игры в Главное меню (выбор миров)"
          >
            🚪 Главное меню
          </button>
        )}

        <button
          type="button"
          data-testid="vr-strip-disable-btn"
          onClick={onDisableVR}
          className="rounded-lg bg-rose-600/30 hover:bg-rose-600/50 border border-rose-500/50 px-2 py-1 font-bold text-rose-200 cursor-pointer"
          title="Выключить VR [V]"
        >
          ✕
        </button>
      </div>
    </>
  );
};
