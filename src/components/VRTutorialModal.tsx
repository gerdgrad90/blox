import React, { useEffect, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, Gamepad2, Hand, RotateCw, Shield, Sparkles, Volume2, X, Zap } from 'lucide-react';
import { VRControllerProfile, VRDisplayMode, VRState, VRTrackingMode } from '../game/vr';
import {
  VR_TUTORIAL_STEPS,
  VRTutorialStepId,
  formatBindingControlLabel,
} from '../game/vrTutorial';

interface VRTutorialModalProps {
  isOpen: boolean;
  vrState: VRState;
  onClose: () => void;
  onComplete: () => void;
  onSetControllerProfile: (profile: VRControllerProfile) => void;
  onSetTrackingMode: (mode: VRTrackingMode) => void;
  onSetDisplayMode: (mode: VRDisplayMode) => void;
  onSnapTurn: (dir: -1 | 1) => void;
  onTeleport: () => void;
  onHapticPulse: () => void;
  onRecenter: () => void;
  onOpenVRSettings?: () => void;
}

const STEP_PRACTICE_ITEMS: Record<
  VRTutorialStepId,
  { id: string; label: string; actionHint: string }[]
> = {
  movement: [
    { id: 'snap', label: 'Проверить Snap-поворот', actionHint: 'Стик R или [Q] / [X]' },
    { id: 'teleport', label: 'Выполнить VR-телепорт', actionHint: 'Grip L / [B] или [T]' },
  ],
  interaction: [
    { id: 'hands_toggle', label: 'Проверить режим рук (Щипок)', actionHint: 'Контроллеры / Руки' },
    { id: 'haptic', label: 'Проверить отклик / курок', actionHint: 'Курок или Haptics' },
  ],
  menus: [
    { id: 'profile_check', label: 'Выбрать шлем PICO 4 или Quest', actionHint: 'Переключатель профиля' },
    { id: 'stereo_check', label: 'Проверить Стерео SBS и центровку', actionHint: 'Стерео SBS / Центрировать' },
  ],
};

export const VRTutorialModal: React.FC<VRTutorialModalProps> = ({
  isOpen,
  vrState,
  onClose,
  onComplete,
  onSetControllerProfile,
  onSetTrackingMode,
  onSetDisplayMode,
  onSnapTurn,
  onTeleport,
  onHapticPulse,
  onRecenter,
  onOpenVRSettings,
}) => {
  const [stepIdx, setStepIdx] = useState(0);
  const [completedDrills, setCompletedDrills] = useState<Record<string, boolean>>({});
  const [baselineHaptics, setBaselineHaptics] = useState<number>(vrState.hapticPulseCount);

  useEffect(() => {
    if (isOpen) {
      setBaselineHaptics(vrState.hapticPulseCount);
    }
  }, [isOpen]);

  // Detect live actions performed via keyboard, WebXR controllers, or UI drill buttons
  useEffect(() => {
    if (!isOpen) return;
    const label = (vrState.lastActionLabel || '').toLowerCase();

    setCompletedDrills((prev) => {
      const next = { ...prev };
      let changed = false;

      if (label.includes('snap') || label.includes('поворот')) {
        if (!next.snap) {
          next.snap = true;
          changed = true;
        }
      }
      if (label.includes('телепорт')) {
        if (!next.teleport) {
          next.teleport = true;
          changed = true;
        }
      }
      if (vrState.trackingMode === 'hands' || label.includes('рук') || label.includes('щип')) {
        if (!next.hands_toggle) {
          next.hands_toggle = true;
          changed = true;
        }
      }
      if (vrState.hapticPulseCount > baselineHaptics || label.includes('вибро')) {
        if (!next.haptic) {
          next.haptic = true;
          changed = true;
        }
      }
      if (vrState.displayMode === 'stereo_sbs' || label.includes('центрир')) {
        if (!next.stereo_check) {
          next.stereo_check = true;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [
    isOpen,
    vrState.lastActionLabel,
    vrState.trackingMode,
    vrState.displayMode,
    vrState.hapticPulseCount,
    baselineHaptics,
  ]);

  if (!isOpen) return null;

  const step = VR_TUTORIAL_STEPS[stepIdx] || VR_TUTORIAL_STEPS[0];
  const isPico = vrState.controllerProfile === 'pico4';
  const isHands = vrState.trackingMode === 'hands';
  const activeDrills = STEP_PRACTICE_ITEMS[step.id];
  const totalDrills = Object.values(STEP_PRACTICE_ITEMS).flat().length;
  const doneDrillsCount = Object.values(completedDrills).filter(Boolean).length;

  const markDrill = (id: string) => {
    setCompletedDrills((prev) => ({ ...prev, [id]: true }));
  };

  const handlePracticeAction = (drillId: string) => {
    if (drillId === 'snap') {
      onSnapTurn(1);
      markDrill('snap');
    } else if (drillId === 'teleport') {
      onTeleport();
      markDrill('teleport');
    } else if (drillId === 'hands_toggle') {
      onSetTrackingMode(isHands ? 'controllers' : 'hands');
      markDrill('hands_toggle');
    } else if (drillId === 'haptic') {
      onHapticPulse();
      markDrill('haptic');
    } else if (drillId === 'profile_check') {
      onSetControllerProfile(isPico ? 'quest_touch' : 'pico4');
      markDrill('profile_check');
    } else if (drillId === 'stereo_check') {
      onSetDisplayMode(vrState.displayMode === 'stereo_sbs' ? 'mono_6dof' : 'stereo_sbs');
      onRecenter();
      markDrill('stereo_check');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 p-3 sm:p-6 pointer-events-auto"
      data-testid="vr-tutorial-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="vr-tutorial-heading"
    >
      <div className="relative flex flex-col w-full max-w-5xl max-h-[92vh] overflow-hidden rounded-2xl border border-slate-700/80 bg-slate-900 text-slate-100 shadow-2xl">
        {/* Top Bar */}
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 px-5 py-4 bg-slate-950/60 shrink-0">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs text-cyan-300 font-medium">
              <span>Интерактивный гид VR</span>
              <span aria-hidden="true">·</span>
              <span className="tabular-nums">Шаг {step.index} из {VR_TUTORIAL_STEPS.length}</span>
              <span aria-hidden="true">·</span>
              <span className="tabular-nums text-slate-400">
                Практика: {doneDrillsCount}/{totalDrills}
              </span>
            </div>
            <h2
              id="vr-tutorial-heading"
              className="text-lg sm:text-xl font-bold tracking-tight text-white mt-0.5 text-balance"
            >
              {step.index}. {step.title}
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Segmented Controller / Hand Standard Selector */}
            <div
              className="flex items-center gap-1 p-1 rounded-xl bg-slate-950 border border-slate-800"
              role="group"
              aria-label="Стандарт управления VR"
            >
              <button
                type="button"
                data-testid="vr-tut-standard-pico"
                onClick={() => {
                  onSetControllerProfile('pico4');
                  onSetTrackingMode('controllers');
                  markDrill('profile_check');
                }}
                className={`min-h-[36px] px-3 py-1.5 rounded-lg text-xs font-semibold transition whitespace-nowrap shrink-0 cursor-pointer ${
                  !isHands && isPico
                    ? 'bg-cyan-500 text-slate-950'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
              >
                PICO 4 / Ultra
              </button>
              <button
                type="button"
                data-testid="vr-tut-standard-quest"
                onClick={() => {
                  onSetControllerProfile('quest_touch');
                  onSetTrackingMode('controllers');
                  markDrill('profile_check');
                }}
                className={`min-h-[36px] px-3 py-1.5 rounded-lg text-xs font-semibold transition whitespace-nowrap shrink-0 cursor-pointer ${
                  !isHands && !isPico
                    ? 'bg-amber-400 text-slate-950'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
              >
                Quest Touch
              </button>
              <button
                type="button"
                data-testid="vr-tut-standard-hands"
                onClick={() => {
                  onSetTrackingMode('hands');
                  markDrill('hands_toggle');
                }}
                className={`min-h-[36px] px-3 py-1.5 rounded-lg text-xs font-semibold transition whitespace-nowrap shrink-0 cursor-pointer ${
                  isHands
                    ? 'bg-emerald-400 text-slate-950'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
              >
                Жесты рук
              </button>
            </div>

            {onOpenVRSettings && (
              <button
                type="button"
                data-testid="vr-tut-open-settings-btn"
                onClick={() => {
                  onClose();
                  onOpenVRSettings();
                }}
                className="min-h-[40px] px-3.5 py-2 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 whitespace-nowrap shrink-0 cursor-pointer"
              >
                Датчики PICO
              </button>
            )}

            <button
              type="button"
              data-testid="vr-tut-skip-btn"
              onClick={onClose}
              aria-label="Закрыть обучение VR"
              className="min-h-[40px] px-3.5 py-2 rounded-xl border border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-xs font-semibold text-slate-300 hover:text-white flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <X size={15} />
              <span>Пропустить</span>
            </button>
          </div>
        </header>

        {/* Main 2-Column Interactive Body */}
        <div className="flex-1 overflow-y-auto p-5 grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Visual Spatial Diagram + Live Telemetry */}
          <div className="lg:col-span-5 flex flex-col justify-between gap-4 rounded-xl border border-slate-800 bg-slate-950/80 p-4">
            <div>
              <div className="flex items-center justify-between text-xs text-slate-400 mb-3">
                <span>
                  {isHands
                    ? 'Оптический трекинг 25 суставов'
                    : isPico
                    ? 'Контроллеры PICO HyperSense'
                    : 'Контроллеры Meta Quest Touch'}
                </span>
                <span className="font-mono tabular-nums text-cyan-300">
                  IPD {vrState.ipdMm} мм · {vrState.snapTurnDegrees}°
                </span>
              </div>

              {/* Custom SVG Diagram highlighting active zones for current step */}
              <div
                className="rounded-xl bg-slate-900/90 border border-slate-800 p-3 flex items-center justify-center"
                data-testid="vr-tutorial-diagram"
              >
                <svg
                  viewBox="0 0 420 230"
                  className="w-full h-auto max-h-[210px]"
                  role="img"
                  aria-label="Схема контроллеров и жестов PICO и Quest"
                >
                  {/* Guardian Floor Elliptical Ring */}
                  <ellipse
                    cx="210"
                    cy="202"
                    rx="172"
                    ry="20"
                    fill="none"
                    stroke={step.focusZone === 'lasers_menu' ? '#22d3ee' : '#1e293b'}
                    strokeWidth={step.focusZone === 'lasers_menu' ? '2.5' : '1.5'}
                    strokeDasharray="6 5"
                  />

                  {/* Laser Beams from Both Hands */}
                  <line
                    x1="122"
                    y1="72"
                    x2="90"
                    y2="16"
                    stroke={step.focusZone === 'sticks_teleport' || step.focusZone === 'lasers_menu' ? '#22d3ee' : '#334155'}
                    strokeWidth={step.focusZone === 'sticks_teleport' || step.focusZone === 'lasers_menu' ? '2.5' : '1.2'}
                    strokeDasharray="4 3"
                  />
                  <line
                    x1="298"
                    y1="72"
                    x2="332"
                    y2="16"
                    stroke={step.focusZone === 'lasers_menu' || step.focusZone === 'trigger_wrist' ? '#f59e0b' : '#334155'}
                    strokeWidth={step.focusZone === 'lasers_menu' || step.focusZone === 'trigger_wrist' ? '2.5' : '1.2'}
                    strokeDasharray="4 3"
                  />

                  {isHands ? (
                    <>
                      {/* Left Articulated Hand */}
                      <g transform="translate(88, 62)">
                        <rect
                          x="18"
                          y="46"
                          width="48"
                          height="56"
                          rx="16"
                          fill="#1e293b"
                          stroke="#38bdf8"
                          strokeWidth="2"
                        />
                        {/* Fingers */}
                        <rect x="20" y="14" width="9" height="36" rx="4.5" fill="#334155" stroke="#38bdf8" strokeWidth="1.2" />
                        <rect x="33" y="6" width="9" height="42" rx="4.5" fill="#334155" stroke="#38bdf8" strokeWidth="1.2" />
                        <rect x="46" y="10" width="9" height="38" rx="4.5" fill="#334155" stroke="#38bdf8" strokeWidth="1.2" />
                        <rect x="58" y="20" width="8" height="30" rx="4" fill="#334155" stroke="#38bdf8" strokeWidth="1.2" />
                        {/* Thumb Pinch Node */}
                        <circle
                          cx="14"
                          cy="52"
                          r="8"
                          fill={step.focusZone === 'sticks_teleport' ? '#22d3ee' : '#0f172a'}
                          stroke="#22d3ee"
                          strokeWidth="2"
                        />
                        {/* Left Wrist Watch HUD */}
                        <rect
                          x="14"
                          y="108"
                          width="56"
                          height="22"
                          rx="5"
                          fill="#090d16"
                          stroke={step.focusZone === 'trigger_wrist' ? '#22d3ee' : '#475569'}
                          strokeWidth={step.focusZone === 'trigger_wrist' ? '2.5' : '1.5'}
                        />
                        <text x="42" y="123" textAnchor="middle" fill="#67e8f9" fontSize="9" fontFamily="monospace">
                          HP 100
                        </text>
                      </g>

                      {/* Right Articulated Hand + Pinch Orb */}
                      <g transform="translate(262, 62)">
                        <rect
                          x="14"
                          y="46"
                          width="48"
                          height="56"
                          rx="16"
                          fill="#1e293b"
                          stroke="#f59e0b"
                          strokeWidth="2"
                        />
                        <rect x="16" y="20" width="8" height="30" rx="4" fill="#334155" stroke="#f59e0b" strokeWidth="1.2" />
                        <rect x="27" y="10" width="9" height="38" rx="4.5" fill="#334155" stroke="#f59e0b" strokeWidth="1.2" />
                        <rect x="40" y="6" width="9" height="42" rx="4.5" fill="#334155" stroke="#f59e0b" strokeWidth="1.2" />
                        <rect
                          x="53"
                          y="18"
                          width="9"
                          height="34"
                          rx="4.5"
                          fill={step.focusZone === 'trigger_wrist' ? '#f59e0b' : '#334155'}
                          stroke="#fde68a"
                          strokeWidth="1.4"
                        />
                        {/* Active Pinch Ring */}
                        <circle
                          cx="68"
                          cy="36"
                          r="9"
                          fill="rgba(245,158,11,0.28)"
                          stroke="#fbbf24"
                          strokeWidth="2"
                        />
                      </g>
                    </>
                  ) : (
                    <>
                      {/* LEFT CONTROLLER (PICO 4 white arc or Quest Touch top ring) */}
                      <g transform="translate(76, 48)">
                        {isPico ? (
                          <path
                            d="M 18 58 A 34 44 -18 1 1 78 62"
                            fill="none"
                            stroke="#f8fafc"
                            strokeWidth="7"
                            strokeLinecap="round"
                          />
                        ) : (
                          <ellipse
                            cx="48"
                            cy="30"
                            rx="32"
                            ry="16"
                            fill="none"
                            stroke="#475569"
                            strokeWidth="6"
                          />
                        )}
                        {/* Controller Handle */}
                        <rect
                          x="34"
                          y="84"
                          width="26"
                          height="66"
                          rx="11"
                          fill={isPico ? '#f1f5f9' : '#1e293b'}
                          stroke={step.focusZone === 'sticks_teleport' ? '#22d3ee' : '#475569'}
                          strokeWidth="2"
                        />
                        {/* Grip L highlight */}
                        <rect
                          x="58"
                          y="96"
                          width="7"
                          height="24"
                          rx="3.5"
                          fill={step.focusZone === 'sticks_teleport' ? '#22d3ee' : '#64748b'}
                        />
                        {/* Top Faceplate */}
                        <ellipse
                          cx="47"
                          cy="58"
                          rx="27"
                          ry="22"
                          fill="#0f172a"
                          stroke={isPico ? '#e2e8f0' : '#334155'}
                          strokeWidth="2.5"
                        />
                        {/* Thumbstick L */}
                        <circle
                          cx="54"
                          cy="52"
                          r="9"
                          fill={step.focusZone === 'sticks_teleport' ? '#06b6d4' : '#334155'}
                          stroke="#67e8f9"
                          strokeWidth="2"
                        />
                        {/* X & Y buttons */}
                        <circle
                          cx="37"
                          cy="52"
                          r="5"
                          fill={step.focusZone === 'sticks_teleport' ? '#38bdf8' : '#334155'}
                          stroke="#94a3b8"
                          strokeWidth="1.2"
                        />
                        <circle
                          cx="34"
                          cy="65"
                          r="5"
                          fill={step.focusZone === 'trigger_wrist' ? '#22d3ee' : '#334155'}
                          stroke="#94a3b8"
                          strokeWidth="1.2"
                        />
                        <text x="37" y="54.5" textAnchor="middle" fill="#fff" fontSize="6" fontWeight="bold">X</text>
                        <text x="34" y="67.5" textAnchor="middle" fill="#fff" fontSize="6" fontWeight="bold">Y</text>
                        {/* Left Wrist Watch HUD */}
                        <rect
                          x="18"
                          y="148"
                          width="58"
                          height="20"
                          rx="4"
                          fill="#090d16"
                          stroke={step.focusZone === 'trigger_wrist' ? '#22d3ee' : '#334155'}
                          strokeWidth={step.focusZone === 'trigger_wrist' ? '2' : '1.2'}
                        />
                        <text x="47" y="161" textAnchor="middle" fill="#67e8f9" fontSize="8.5" fontFamily="monospace">
                          3D ЧАСЫ HUD
                        </text>
                      </g>

                      {/* RIGHT CONTROLLER (PICO 4 white arc or Quest Touch top ring) */}
                      <g transform="translate(248, 48)">
                        {isPico ? (
                          <path
                            d="M 18 62 A 34 44 18 1 1 78 58"
                            fill="none"
                            stroke="#f8fafc"
                            strokeWidth="7"
                            strokeLinecap="round"
                          />
                        ) : (
                          <ellipse
                            cx="48"
                            cy="30"
                            rx="32"
                            ry="16"
                            fill="none"
                            stroke="#475569"
                            strokeWidth="6"
                          />
                        )}
                        {/* Handle */}
                        <rect
                          x="36"
                          y="84"
                          width="26"
                          height="66"
                          rx="11"
                          fill={isPico ? '#f1f5f9' : '#1e293b'}
                          stroke={step.focusZone === 'trigger_wrist' ? '#f59e0b' : '#475569'}
                          strokeWidth="2"
                        />
                        {/* Index Trigger R */}
                        <rect
                          x="42"
                          y="26"
                          width="14"
                          height="12"
                          rx="4"
                          fill={step.focusZone === 'trigger_wrist' || step.focusZone === 'lasers_menu' ? '#f59e0b' : '#475569'}
                        />
                        {/* Top Faceplate */}
                        <ellipse
                          cx="49"
                          cy="58"
                          rx="27"
                          ry="22"
                          fill="#0f172a"
                          stroke={isPico ? '#e2e8f0' : '#334155'}
                          strokeWidth="2.5"
                        />
                        {/* Thumbstick R */}
                        <circle
                          cx="42"
                          cy="52"
                          r="9"
                          fill={step.focusZone === 'sticks_teleport' ? '#f59e0b' : '#334155'}
                          stroke="#fcd34d"
                          strokeWidth="2"
                        />
                        {/* A & B buttons */}
                        <circle
                          cx="60"
                          cy="52"
                          r="5"
                          fill={step.focusZone === 'sticks_teleport' ? '#fbbf24' : '#334155'}
                          stroke="#94a3b8"
                          strokeWidth="1.2"
                        />
                        <circle
                          cx="63"
                          cy="65"
                          r="5"
                          fill={step.focusZone === 'sticks_teleport' || step.focusZone === 'trigger_wrist' ? '#38bdf8' : '#334155'}
                          stroke="#94a3b8"
                          strokeWidth="1.2"
                        />
                        <text x="60" y="54.5" textAnchor="middle" fill="#0f172a" fontSize="6" fontWeight="bold">A</text>
                        <text x="63" y="67.5" textAnchor="middle" fill="#fff" fontSize="6" fontWeight="bold">B</text>
                      </g>
                    </>
                  )}

                  {/* Labels */}
                  <text x="122" y="218" textAnchor="middle" fill="#94a3b8" fontSize="10" fontWeight="bold">
                    ЛЕВАЯ РУКА (ХОДЬБА / ТЕЛЕПОРТ)
                  </text>
                  <text x="298" y="218" textAnchor="middle" fill="#94a3b8" fontSize="10" fontWeight="bold">
                    ПРАВАЯ РУКА (ПОВОРОТ / КУРОК)
                  </text>
                </svg>
              </div>
            </div>

            {/* Interactive Live Practice Sandbox */}
            <div className="space-y-3 border-t border-slate-800 pt-3">
              <p className="text-xs text-slate-300 leading-relaxed">{step.practicePrompt}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {activeDrills.map((drill) => {
                  const isDone = Boolean(completedDrills[drill.id]);
                  return (
                    <button
                      key={drill.id}
                      type="button"
                      data-testid={`vr-tut-drill-${drill.id}`}
                      onClick={() => handlePracticeAction(drill.id)}
                      className={`min-h-[46px] flex items-center justify-between gap-2 px-3.5 py-2 rounded-xl border text-left transition cursor-pointer ${
                        isDone
                          ? 'bg-emerald-500/15 border-emerald-400/60 text-emerald-200'
                          : 'bg-slate-900 hover:bg-slate-800 border-slate-700 text-slate-100'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="text-xs font-semibold truncate">{drill.label}</div>
                        <div className="text-[11px] text-slate-400 truncate">{drill.actionHint}</div>
                      </div>
                      <span
                        className={`shrink-0 flex h-6 w-6 items-center justify-center rounded-lg border ${
                          isDone
                            ? 'bg-emerald-500 border-emerald-300 text-slate-950'
                            : 'bg-slate-800 border-slate-600 text-slate-400'
                        }`}
                      >
                        {isDone ? <Check size={14} /> : <Zap size={13} />}
                      </span>
                    </button>
                  );
                })}
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono tabular-nums pt-1">
                <span>Последнее событие: {vrState.lastActionLabel}</span>
                <span>Режим: {vrState.displayMode === 'stereo_sbs' ? 'Стерео SBS' : 'Моно 6DoF'}</span>
              </div>
            </div>
          </div>

          {/* Right Column: Clear Bindings Reference & Guidance */}
          <div className="lg:col-span-7 flex flex-col justify-between gap-4">
            <div className="space-y-3">
              <p className="text-sm text-slate-300 leading-relaxed">{step.subtitle}</p>

              <div className="divide-y divide-slate-800 rounded-xl border border-slate-800 bg-slate-950/50">
                {step.bindings.map((b) => {
                  const formattedControl = formatBindingControlLabel(
                    b,
                    vrState.controllerProfile,
                    vrState.trackingMode
                  );
                  return (
                    <div
                      key={b.id}
                      data-testid={`vr-tut-binding-${b.id}`}
                      className="p-3.5 sm:px-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
                    >
                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                          <span className="font-semibold text-white text-sm">{b.actionTitle}</span>
                          <span aria-hidden="true">·</span>
                          <span
                            className={
                              b.hand === 'left'
                                ? 'text-cyan-300 font-medium'
                                : b.hand === 'right'
                                ? 'text-amber-300 font-medium'
                                : 'text-emerald-300 font-medium'
                            }
                          >
                            {b.hand === 'left'
                              ? 'Левая рука'
                              : b.hand === 'right'
                              ? 'Правая рука'
                              : 'Обе руки'}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 leading-relaxed">{b.description}</p>
                      </div>

                      <div className="sm:text-right shrink-0 space-y-1">
                        <div className="text-xs font-mono font-semibold text-cyan-200 bg-slate-900 border border-slate-700/80 px-2.5 py-1 rounded-lg inline-block">
                          {formattedControl}
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono">
                          ПК: {b.keyboardFallback}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Quick Step Specific Controls Strip (No nested clutter) */}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950/60 px-4 py-3">
              <div className="flex items-center gap-2 text-xs text-slate-300">
                {step.id === 'movement' && <RotateCw size={16} className="text-cyan-400 shrink-0" />}
                {step.id === 'interaction' && (
                  isHands ? <Hand size={16} className="text-emerald-400 shrink-0" /> : <Gamepad2 size={16} className="text-amber-400 shrink-0" />
                )}
                {step.id === 'menus' && <Shield size={16} className="text-cyan-400 shrink-0" />}
                <span>
                  {step.id === 'movement'
                    ? 'Совет: в настройках VR можно менять угол Snap-поворота (30°, 45° или 90°).'
                    : step.id === 'interaction'
                    ? 'Совет: в PICO 4 руки отслеживаются без контроллеров — просто сведите большой и указательный пальцы.'
                    : 'Совет: для аппаратного 6DoF WebXR открывайте игру в PICO Browser или Meta Browser по HTTPS.'}
                </span>
              </div>

              <div className="flex items-center gap-2">
                {step.id === 'interaction' && (
                  <button
                    type="button"
                    onClick={() => handlePracticeAction('haptic')}
                    className="min-h-[38px] px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/50 text-xs font-semibold text-amber-200 flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Volume2 size={14} />
                    <span>Тест вибро</span>
                  </button>
                )}
                {step.id === 'menus' && (
                  <button
                    type="button"
                    onClick={() => onRecenter()}
                    className="min-h-[38px] px-3 py-1.5 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/50 text-xs font-semibold text-cyan-200 flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Sparkles size={14} />
                    <span>Центрировать взгляд</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer Stepper Bar */}
        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-800 px-5 py-3.5 bg-slate-950/80 shrink-0">
          {/* Interactive Step Tabs */}
          <nav className="flex items-center gap-1.5" aria-label="Шаги обучения VR">
            {VR_TUTORIAL_STEPS.map((s, idx) => {
              const active = idx === stepIdx;
              return (
                <button
                  key={s.id}
                  type="button"
                  data-testid={`vr-tut-step-${idx + 1}`}
                  onClick={() => setStepIdx(idx)}
                  className={`min-h-[38px] px-3 py-1.5 rounded-lg text-xs font-semibold transition whitespace-nowrap shrink-0 cursor-pointer ${
                    active
                      ? 'bg-slate-800 text-white border border-cyan-400/60'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900 border border-transparent'
                  }`}
                >
                  {s.index}. {s.id === 'movement' ? 'Движение' : s.id === 'interaction' ? 'Жесты и предметы' : 'Меню и шлем'}
                </button>
              );
            })}
          </nav>

          {/* Navigation CTA Buttons */}
          <div className="flex items-center gap-2 ml-auto">
            {stepIdx > 0 && (
              <button
                type="button"
                data-testid="vr-tut-prev-btn"
                onClick={() => setStepIdx((i) => Math.max(0, i - 1))}
                className="min-h-[42px] px-4 py-2 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <ChevronLeft size={15} />
                <span>Назад</span>
              </button>
            )}

            {stepIdx < VR_TUTORIAL_STEPS.length - 1 ? (
              <button
                type="button"
                data-testid="vr-tut-next-btn"
                onClick={() => setStepIdx((i) => Math.min(VR_TUTORIAL_STEPS.length - 1, i + 1))}
                className="min-h-[42px] px-5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <span>Далее</span>
                <ChevronRight size={15} />
              </button>
            ) : (
              <button
                type="button"
                data-testid="vr-tut-finish-btn"
                onClick={onComplete}
                className="min-h-[42px] px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Check size={15} />
                <span>Завершить обучение</span>
              </button>
            )}
          </div>
        </footer>
      </div>
    </div>
  );
};
