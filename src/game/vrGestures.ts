import { EmoteId } from './emotes';

export type VRHandGestureId = 'thumbs_up' | 'wave' | 'peace' | 'salute' | 'cheer';

export interface VRGestureDefinition {
  id: VRHandGestureId;
  emoteId: EmoteId;
  label: string;
  emoji: string;
  handPoseHint: string;
  controllerComboHint: string;
  handPreference: 'right' | 'both';
  durationMs: number;
  accentColor: string;
}

export const VR_GESTURE_DEFINITIONS: readonly VRGestureDefinition[] = [
  {
    id: 'thumbs_up',
    emoteId: 'thumbs_up',
    label: 'Палец вверх',
    emoji: '👍',
    handPoseHint: 'Сожмите 4 пальца в кулак и поднимите большой палец вверх',
    controllerComboHint: 'Удерживайте правый хват (Grip) без курка',
    handPreference: 'right',
    durationMs: 2500,
    accentColor: '#10b981',
  },
  {
    id: 'wave',
    emoteId: 'wave',
    label: 'Помахать',
    emoji: '👋',
    handPoseHint: 'Раскройте ладонь и помашите рукой влево-вправо',
    controllerComboHint: 'Быстро помашите правым контроллером из стороны в сторону',
    handPreference: 'right',
    durationMs: 2600,
    accentColor: '#38bdf8',
  },
  {
    id: 'peace',
    emoteId: 'peace',
    label: 'Жест Мир',
    emoji: '✌️',
    handPoseHint: 'Вытяните указательный и средний пальцы буквой V',
    controllerComboHint: 'Быстрый выбор на панели жестов VR',
    handPreference: 'right',
    durationMs: 2600,
    accentColor: '#22d3ee',
  },
  {
    id: 'salute',
    emoteId: 'salute',
    label: 'Салют',
    emoji: '🫡',
    handPoseHint: 'Поднесите прямую раскрытую ладонь к уровню виска',
    controllerComboHint: 'Кнопка жеста VR или меню эмоций [G → 5]',
    handPreference: 'right',
    durationMs: 2400,
    accentColor: '#a855f7',
  },
  {
    id: 'cheer',
    emoteId: 'cheer',
    label: 'Ура!',
    emoji: '🙌',
    handPoseHint: 'Поднимите раскрытые ладони высоко над головой',
    controllerComboHint: 'Кнопка жеста VR или меню эмоций [G → 4]',
    handPreference: 'both',
    durationMs: 2800,
    accentColor: '#22c55e',
  },
];

export const VR_GESTURE_MAP: Record<VRHandGestureId, VRGestureDefinition> = VR_GESTURE_DEFINITIONS.reduce(
  (acc, def) => {
    acc[def.id] = def;
    return acc;
  },
  {} as Record<VRHandGestureId, VRGestureDefinition>
);

export function getVRGestureDefinition(id: VRHandGestureId): VRGestureDefinition {
  return VR_GESTURE_MAP[id] || VR_GESTURE_DEFINITIONS[0];
}

export function mapEmoteIdToVRGesture(emoteId: EmoteId): VRHandGestureId | null {
  const match = VR_GESTURE_DEFINITIONS.find((g) => g.emoteId === emoteId);
  return match ? match.id : null;
}

export type Vec3Tuple = [number, number, number];

export interface VRHandJointSample {
  wrist: Vec3Tuple;
  thumbTip: Vec3Tuple;
  thumbBase: Vec3Tuple;
  indexTip: Vec3Tuple;
  indexKnuckle: Vec3Tuple;
  middleTip: Vec3Tuple;
  middleKnuckle: Vec3Tuple;
  ringTip: Vec3Tuple;
  ringKnuckle: Vec3Tuple;
  pinkyTip: Vec3Tuple;
  pinkyKnuckle: Vec3Tuple;
}

function dist3(a: Vec3Tuple, b: Vec3Tuple): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

/**
 * Computes extension ratio of a finger relative to its wrist-to-knuckle baseline.
 * Extended finger tips lie noticeably farther from wrist than their proximal joint (> ~1.45),
 * while curled finger tips fold back close to the wrist distance (< ~1.28).
 */
export function computeFingerExtensionRatio(
  wrist: Vec3Tuple,
  knuckle: Vec3Tuple,
  tip: Vec3Tuple
): number {
  const baseLen = Math.max(0.015, dist3(wrist, knuckle));
  const tipLen = dist3(wrist, tip);
  return tipLen / baseLen;
}

export interface HandGestureClassifierOptions {
  lateralSpeed?: number; // m/s horizontal wave velocity
  handHeightRelativeToHead?: number; // meters above (+) or below (-) head/HMD Y
}

/**
 * Pure classifier for WebXR 25-joint optical hand poses (PICO 4 / Quest).
 */
export function classifyHandJointGesture(
  sample: VRHandJointSample,
  opts: HandGestureClassifierOptions = {}
): VRHandGestureId | null {
  const lateralSpeed = opts.lateralSpeed ?? 0;
  const relHeight = opts.handHeightRelativeToHead ?? -0.25;

  const indexRatio = computeFingerExtensionRatio(sample.wrist, sample.indexKnuckle, sample.indexTip);
  const middleRatio = computeFingerExtensionRatio(sample.wrist, sample.middleKnuckle, sample.middleTip);
  const ringRatio = computeFingerExtensionRatio(sample.wrist, sample.ringKnuckle, sample.ringTip);
  const pinkyRatio = computeFingerExtensionRatio(sample.wrist, sample.pinkyKnuckle, sample.pinkyTip);
  const thumbRatio = computeFingerExtensionRatio(sample.wrist, sample.thumbBase, sample.thumbTip);

  const indexExtended = indexRatio >= 1.48;
  const middleExtended = middleRatio >= 1.48;
  const ringExtended = ringRatio >= 1.44;
  const pinkyExtended = pinkyRatio >= 1.42;

  const indexCurled = indexRatio <= 1.28;
  const middleCurled = middleRatio <= 1.28;
  const ringCurled = ringRatio <= 1.28;
  const pinkyCurled = pinkyRatio <= 1.28;

  const allFourOpen = indexExtended && middleExtended && ringExtended && pinkyExtended;

  // 1. Thumbs-up: 4 fingers curled tightly, thumb extended & pointing upward relative to wrist/base
  const thumbDeltaY = sample.thumbTip[1] - sample.thumbBase[1];
  const thumbAboveWristY = sample.thumbTip[1] - sample.wrist[1];
  if (
    indexCurled &&
    middleCurled &&
    ringCurled &&
    pinkyCurled &&
    thumbRatio >= 1.32 &&
    thumbDeltaY >= 0.024 &&
    thumbAboveWristY >= 0.035
  ) {
    return 'thumbs_up';
  }

  // 2. Peace (Victory V-sign): index & middle extended, ring & pinky curled
  if (indexExtended && middleExtended && ringCurled && pinkyCurled) {
    return 'peace';
  }

  // 3. Cheer: open palm raised well above head level
  if (allFourOpen && relHeight >= 0.2) {
    return 'cheer';
  }

  // 4. Wave: open palm moving briskly side-to-side
  if (allFourOpen && lateralSpeed >= 0.38) {
    return 'wave';
  }

  // 5. Salute: open palm held steady near brow / temple height
  if (allFourOpen && relHeight >= -0.02 && relHeight < 0.2 && lateralSpeed < 0.28) {
    return 'salute';
  }

  return null;
}

/**
 * Fallback gesture hint detector for 6DoF controller-only mode (PICO HyperSense / Quest Touch):
 * - Rapid lateral hand/controller wave oscillation with trigger released -> 'wave'
 * - Holding Right Grip cleanly without pressing Trigger -> 'thumbs_up'
 */
export function detectControllerGestureHint(params: {
  rightGrip: number;
  rightTrigger: number;
  rightButtonPrimary?: boolean;
  rightButtonSecondary?: boolean;
  waveOscillationEnergy: number;
}): VRHandGestureId | null {
  if (params.waveOscillationEnergy >= 1.0) {
    return 'wave';
  }
  if (
    params.rightGrip >= 0.78 &&
    params.rightTrigger < 0.2 &&
    !params.rightButtonPrimary &&
    !params.rightButtonSecondary
  ) {
    return 'thumbs_up';
  }
  return null;
}

export interface VRGestureRecognizer {
  update: (dt: number, candidate: VRHandGestureId | null) => VRHandGestureId | null;
  reset: () => void;
  getState: () => {
    candidate: VRHandGestureId | null;
    holdProgress: number;
    cooldownRemaining: number;
  };
}

/**
 * Dwell + cooldown debouncer so naturally held gestures trigger once cleanly
 * without firing every frame.
 */
export function createVRGestureRecognizer(
  dwellSeconds: number = 0.24,
  cooldownSeconds: number = 1.8
): VRGestureRecognizer {
  let candidate: VRHandGestureId | null = null;
  let holdElapsed = 0;
  let cooldownRemaining = 0;
  let latchedUntilNeutral: VRHandGestureId | null = null;

  return {
    update(dt: number, nextCandidate: VRHandGestureId | null): VRHandGestureId | null {
      const safeDt = Math.max(0, Math.min(0.25, dt));
      if (cooldownRemaining > 0) {
        cooldownRemaining = Math.max(0, cooldownRemaining - safeDt);
      }

      if (!nextCandidate) {
        candidate = null;
        holdElapsed = 0;
        latchedUntilNeutral = null;
        return null;
      }

      if (latchedUntilNeutral === nextCandidate) {
        return null;
      }

      if (candidate !== nextCandidate) {
        candidate = nextCandidate;
        holdElapsed = 0;
        latchedUntilNeutral = null;
      }

      holdElapsed += safeDt;
      if (holdElapsed >= dwellSeconds && cooldownRemaining <= 0) {
        const triggered = candidate;
        cooldownRemaining = cooldownSeconds;
        latchedUntilNeutral = triggered;
        holdElapsed = 0;
        return triggered;
      }
      return null;
    },
    reset() {
      candidate = null;
      holdElapsed = 0;
      cooldownRemaining = 0;
      latchedUntilNeutral = null;
    },
    getState() {
      return {
        candidate,
        holdProgress: dwellSeconds > 0 ? Math.min(1, holdElapsed / dwellSeconds) : 0,
        cooldownRemaining,
      };
    },
  };
}
