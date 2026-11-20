import * as THREE from 'three';
import { VRHandGestureId } from './vrGestures';
import { createPortalGunModel3D, PortalKind } from './portals';

export type VRTrackingMode = 'controllers' | 'hands';
export type VRDisplayMode = 'mono_6dof' | 'stereo_sbs' | 'webxr_immersive';
export type VRControllerProfile = 'pico4' | 'quest_touch';

export interface VRControllerPose {
  position: [number, number, number];
  rotation: [number, number, number]; // pitch, yaw, roll in degrees
  trigger: number; // 0..1
  grip: number; // 0..1
  thumbstick: [number, number]; // [-1..1, -1..1]
  buttonPrimary: boolean; // PICO: X (Left) / A (Right)
  buttonSecondary: boolean; // PICO: Y (Left) / B (Right)
  thumbstickPressed: boolean;
  menuPressed: boolean;
  isPinching: boolean;
  isPointing: boolean;
  rayHitDistance: number | null;
  rayHitLabel: string | null;
}

export interface VRState {
  enabled: boolean;
  webxrSupported: boolean;
  immersiveSupported: boolean;
  inWebXRSession: boolean;
  trackingMode: VRTrackingMode;
  displayMode: VRDisplayMode;
  controllerProfile: VRControllerProfile;
  detectedHeadsetName: string;
  picoGuardianVisible: boolean;
  picoPassthroughGrid: boolean;
  snapTurnDegrees: number;
  smoothTurn: boolean;
  comfortVignette: boolean;
  vignetteIntensity: number;
  laserPointers: boolean;
  teleportEnabled: boolean;
  ipdMm: number;
  heightOffset: number;
  performanceMode: boolean;
  controlsHintVisible: boolean;
  vrMenuOpen: boolean;
  leftController: VRControllerPose;
  rightController: VRControllerPose;
  teleportTarget: [number, number, number] | null;
  hapticPulseCount: number;
  lastActionLabel: string;
  activeGesture: VRHandGestureId | null;
  activeGestureLabel: string | null;
  activeGestureExpiresAt: number;
}

export const VR_TARGET_STANDING_EYE_HEIGHT = 3.35;
export const VR_CROUCH_DROP = 1.1;
export const VR_DEFAULT_HEIGHT_OFFSET = 1.75;
export const VR_MIN_HEIGHT_OFFSET = 0.0;
export const VR_MAX_HEIGHT_OFFSET = 3.0;

/**
 * Detects PICO 4 / PICO 4 Ultra / PICO Neo 3 vs Quest / Generic WebXR headset from User-Agent and WebXR input profiles.
 */
export function detectVRHeadsetProfile(
  userAgent: string = '',
  xrProfiles: readonly string[] = []
): { profile: VRControllerProfile; label: string } {
  const profilesJoined = xrProfiles.join(' ').toLowerCase();
  const ua = userAgent.toLowerCase();

  if (
    profilesJoined.includes('pico-4') ||
    profilesJoined.includes('pico4') ||
    ua.includes('pico 4') ||
    ua.includes('pico4')
  ) {
    return { profile: 'pico4', label: 'PICO 4 / PICO 4 Ultra (HyperSense 6DoF)' };
  }
  if (
    profilesJoined.includes('pico-neo3') ||
    profilesJoined.includes('pico') ||
    ua.includes('picobrowser') ||
    ua.includes('pico')
  ) {
    return { profile: 'pico4', label: 'PICO Neo 3 / PICO OS WebXR (6DoF)' };
  }
  if (
    profilesJoined.includes('oculus-touch') ||
    profilesJoined.includes('meta-quest') ||
    ua.includes('quest') ||
    ua.includes('oculusbrowser')
  ) {
    return { profile: 'quest_touch', label: 'Meta Quest Touch Pro (6DoF)' };
  }
  return { profile: 'pico4', label: 'PICO 4 / Ultra 6DoF Tracking' };
}

/**
 * Parses a standard WebXR Gamepad (used by PICO 4, PICO Neo 3, and Quest controllers).
 * WebXR xr-standard mapping:
 * - buttons[0]: Trigger
 * - buttons[1]: Squeeze / Grip
 * - buttons[3]: Thumbstick click
 * - buttons[4]: Primary (X on Left PICO controller, A on Right PICO controller)
 * - buttons[5]: Secondary (Y on Left PICO controller, B on Right PICO controller)
 * - axes[2], axes[3] (or axes[0], axes[1]): Thumbstick X, Y
 */
export function parseXRGamepadState(
  buttons?: ArrayLike<{ value: number; pressed: boolean }>,
  axes?: ArrayLike<number>,
  deadzone: number = 0.12
): {
  trigger: number;
  grip: number;
  thumbstick: [number, number];
  buttonPrimary: boolean;
  buttonSecondary: boolean;
  thumbstickPressed: boolean;
  menuPressed: boolean;
} {
  const b0 = buttons && buttons.length > 0 ? buttons[0] : undefined;
  const b1 = buttons && buttons.length > 1 ? buttons[1] : undefined;
  const b2 = buttons && buttons.length > 2 ? buttons[2] : undefined;
  const b3 = buttons && buttons.length > 3 ? buttons[3] : undefined;
  const b4 = buttons && buttons.length > 4 ? buttons[4] : undefined;
  const b5 = buttons && buttons.length > 5 ? buttons[5] : undefined;

  const trigger = Number(Math.max(0, Math.min(1, b0?.value ?? (b0?.pressed ? 1 : 0))).toFixed(2));
  const grip = Number(Math.max(0, Math.min(1, b1?.value ?? (b1?.pressed ? 1 : 0))).toFixed(2));

  let rawX = 0;
  let rawY = 0;
  if (axes && axes.length >= 4) {
    rawX = axes[2] || 0;
    rawY = axes[3] || 0;
  } else if (axes && axes.length >= 2) {
    rawX = axes[0] || 0;
    rawY = axes[1] || 0;
  }

  const applyDeadzone = (v: number) => (Math.abs(v) < deadzone ? 0 : Number(Math.max(-1, Math.min(1, v)).toFixed(2)));

  return {
    trigger,
    grip,
    thumbstick: [applyDeadzone(rawX), applyDeadzone(rawY)],
    buttonPrimary: Boolean(b4?.pressed),
    buttonSecondary: Boolean(b5?.pressed),
    thumbstickPressed: Boolean(b3?.pressed),
    menuPressed: Boolean(b2?.pressed),
  };
}

export function createInitialVRState(): VRState {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const detected = detectVRHeadsetProfile(ua);
  return {
    enabled: false,
    webxrSupported: typeof navigator !== 'undefined' && 'xr' in navigator,
    immersiveSupported: false,
    inWebXRSession: false,
    trackingMode: 'controllers',
    displayMode: 'mono_6dof',
    controllerProfile: detected.profile,
    detectedHeadsetName: detected.label,
    picoGuardianVisible: true,
    picoPassthroughGrid: false,
    snapTurnDegrees: 45,
    smoothTurn: false,
    comfortVignette: true,
    vignetteIntensity: 0,
    laserPointers: true,
    teleportEnabled: true,
    ipdMm: 64,
    heightOffset: VR_DEFAULT_HEIGHT_OFFSET,
    performanceMode: true,
    controlsHintVisible: true,
    vrMenuOpen: false,
    leftController: {
      position: [-0.28, -0.26, -0.52],
      rotation: [12, -8, -6],
      trigger: 0,
      grip: 0,
      thumbstick: [0, 0],
      buttonPrimary: false,
      buttonSecondary: false,
      thumbstickPressed: false,
      menuPressed: false,
      isPinching: false,
      isPointing: true,
      rayHitDistance: null,
      rayHitLabel: null,
    },
    rightController: {
      position: [0.28, -0.26, -0.52],
      rotation: [14, 8, 6],
      trigger: 0,
      grip: 0,
      thumbstick: [0, 0],
      buttonPrimary: false,
      buttonSecondary: false,
      thumbstickPressed: false,
      menuPressed: false,
      isPinching: false,
      isPointing: true,
      rayHitDistance: null,
      rayHitLabel: null,
    },
    teleportTarget: null,
    hapticPulseCount: 0,
    lastActionLabel: 'PICO 4 6DoF Готов',
    activeGesture: null,
    activeGestureLabel: null,
    activeGestureExpiresAt: 0,
  };
}

export interface VRControllerPoseResult {
  localPos: [number, number, number];
  localQuat?: [number, number, number, number];
  localRotRad: [number, number, number];
  localRotDeg: [number, number, number];
}

const _xrPosePos = new THREE.Vector3();
const _xrHeadPos = new THREE.Vector3();
const _xrPoseQuat = new THREE.Quaternion();
const _xrInvHeadQuat = new THREE.Quaternion();
const _xrLocalQuat = new THREE.Quaternion();
const _xrEuler = new THREE.Euler(0, 0, 0, 'YXZ');
const _xrGazeVec = new THREE.Vector3();
const _xrGazeQuat = new THREE.Quaternion();
const _xrOriginQuat = new THREE.Quaternion();
const _xrUpAxis = new THREE.Vector3(0, 1, 0);

function disableRigFrustumCulling(root: THREE.Object3D) {
  root.frustumCulled = false;
  root.traverse((obj) => {
    obj.frustumCulled = false;
  });
}

/**
 * Pure 6DoF controller pose synthesis from normalized pointer [-1..1], movement speed, and button states.
 * Returns camera-local position [x, y, z] and Euler rotation [rx, ry, rz] in radians, plus degrees for telemetry.
 */
export function computeVRControllerPoseFromPointer(
  normX: number,
  normY: number,
  hand: 'left' | 'right',
  time: number,
  triggerValue: number,
  gripValue: number,
  walkSpeedMag: number
): VRControllerPoseResult {
  const clampedX = Math.max(-1, Math.min(1, normX));
  const clampedY = Math.max(-1, Math.min(1, normY));
  const isRight = hand === 'right';
  const sideSign = isRight ? 1 : -1;

  // Subtle idle breathing + walking arm swing
  const phaseOffset = isRight ? Math.PI : 0;
  const walkBobY = Math.sin(time * 7.5 + phaseOffset) * 0.025 * Math.min(1, walkSpeedMag);
  const walkSwingZ = Math.cos(time * 7.5 + phaseOffset) * 0.045 * Math.min(1, walkSpeedMag);
  const idleFloatY = Math.sin(time * 2.1 + sideSign) * 0.008;

  // Right hand tracks pointer aim more strongly; Left hand follows comfortably with wrist HUD visibility
  const influenceX = isRight ? 0.28 : 0.16;
  const influenceY = isRight ? 0.22 : 0.14;

  const baseX = sideSign * 0.29;
  const baseY = -0.25;
  const baseZ = -0.52;

  const recoilZ = triggerValue * 0.045;
  const lx = Number((baseX + clampedX * influenceX).toFixed(3));
  const ly = Number((baseY + clampedY * influenceY + walkBobY + idleFloatY).toFixed(3));
  const lz = Number((baseZ + walkSwingZ + recoilZ - Math.abs(clampedX) * 0.04).toFixed(3));

  const pitchRad = clampedY * 0.52 + 0.14 - triggerValue * 0.12;
  const yawRad = -clampedX * 0.55 - sideSign * 0.08;
  const rollRad = -clampedX * 0.22 + sideSign * (0.08 - gripValue * 0.15);

  const r2d = 180 / Math.PI;
  return {
    localPos: [lx, ly, lz],
    localRotRad: [pitchRad, yawRad, rollRad],
    localRotDeg: [
      Math.round(pitchRad * r2d),
      Math.round(yawRad * r2d),
      Math.round(rollRad * r2d),
    ],
  };
}

/**
 * Converts a WebXR reference-space (local-floor) controller/wrist pose into camera-local coordinates
 * so vrLeftRig / vrRightRig stay locked to the physical PICO controllers/hands instead of flying away.
 * Rejects NaN/untracked (0,0,0) glitches and physically impossible outliers beyond maxHeadDistance.
 */
export function convertXRSpacePoseToCameraLocal(
  posePos: readonly [number, number, number],
  poseQuat: readonly [number, number, number, number],
  headPos: readonly [number, number, number],
  headQuat: readonly [number, number, number, number],
  maxHeadDistance: number = 2.8
): VRControllerPoseResult | null {
  if (
    !Number.isFinite(posePos[0]) ||
    !Number.isFinite(posePos[1]) ||
    !Number.isFinite(posePos[2]) ||
    !Number.isFinite(poseQuat[0]) ||
    !Number.isFinite(poseQuat[1]) ||
    !Number.isFinite(poseQuat[2]) ||
    !Number.isFinite(poseQuat[3]) ||
    !Number.isFinite(headPos[0]) ||
    !Number.isFinite(headPos[1]) ||
    !Number.isFinite(headPos[2]) ||
    !Number.isFinite(headQuat[0]) ||
    !Number.isFinite(headQuat[1]) ||
    !Number.isFinite(headQuat[2]) ||
    !Number.isFinite(headQuat[3])
  ) {
    return null;
  }

  _xrPosePos.set(posePos[0], posePos[1], posePos[2]);
  _xrHeadPos.set(headPos[0], headPos[1], headPos[2]);

  // Reject untracked (0, 0, 0) floor origin when HMD is standing above floor in local-floor space
  if (_xrPosePos.lengthSq() < 1e-6 && _xrHeadPos.lengthSq() > 0.12) {
    return null;
  }

  // Reject corrupted / runaway tracking outliers beyond arm reach + playspace margin
  if (_xrPosePos.distanceTo(_xrHeadPos) > maxHeadDistance) {
    return null;
  }

  _xrPoseQuat.set(poseQuat[0], poseQuat[1], poseQuat[2], poseQuat[3]);
  if (_xrPoseQuat.lengthSq() < 1e-6) {
    return null;
  }
  _xrPoseQuat.normalize();

  _xrInvHeadQuat.set(headQuat[0], headQuat[1], headQuat[2], headQuat[3]);
  if (_xrInvHeadQuat.lengthSq() < 1e-6) {
    _xrInvHeadQuat.identity();
  } else {
    _xrInvHeadQuat.normalize().invert();
  }

  _xrPosePos.sub(_xrHeadPos).applyQuaternion(_xrInvHeadQuat);
  _xrLocalQuat.copy(_xrInvHeadQuat).multiply(_xrPoseQuat).normalize();
  _xrEuler.setFromQuaternion(_xrLocalQuat, 'YXZ');

  const r2d = 180 / Math.PI;
  return {
    localPos: [
      Number(_xrPosePos.x.toFixed(3)),
      Number(_xrPosePos.y.toFixed(3)),
      Number(_xrPosePos.z.toFixed(3)),
    ],
    localQuat: [_xrLocalQuat.x, _xrLocalQuat.y, _xrLocalQuat.z, _xrLocalQuat.w],
    localRotRad: [_xrEuler.x, _xrEuler.y, _xrEuler.z],
    localRotDeg: [
      Math.round(_xrEuler.x * r2d),
      Math.round(_xrEuler.y * r2d),
      Math.round(_xrEuler.z * r2d),
    ],
  };
}

/**
 * Resolves the canonical HMD head position and orientation quaternion inside the VR character controller's
 * local-floor origin space. Prefers the live WebXR XRViewerPose transform when available and finite,
 * falling back cleanly to the Three.js camera local transform while guarding against stale world positions.
 */
export function resolveVRHeadPoseInOrigin(
  viewerPos: readonly [number, number, number] | null | undefined,
  viewerQuat: readonly [number, number, number, number] | null | undefined,
  fallbackPos: readonly [number, number, number],
  fallbackQuat: readonly [number, number, number, number],
  defaultStandingHeight: number = 1.6
): {
  position: [number, number, number];
  quaternion: [number, number, number, number];
} {
  const isFiniteVec3 = (v?: readonly [number, number, number] | null): v is readonly [number, number, number] =>
    Boolean(v && Number.isFinite(v[0]) && Number.isFinite(v[1]) && Number.isFinite(v[2]));
  const isFiniteQuat = (
    q?: readonly [number, number, number, number] | null
  ): q is readonly [number, number, number, number] =>
    Boolean(
      q &&
        Number.isFinite(q[0]) &&
        Number.isFinite(q[1]) &&
        Number.isFinite(q[2]) &&
        Number.isFinite(q[3]) &&
        q[0] * q[0] + q[1] * q[1] + q[2] * q[2] + q[3] * q[3] > 1e-6
    );

  let pos: [number, number, number];
  if (isFiniteVec3(viewerPos)) {
    pos = [viewerPos[0], viewerPos[1], viewerPos[2]];
  } else if (
    isFiniteVec3(fallbackPos) &&
    Math.hypot(fallbackPos[0], fallbackPos[2]) <= 6 &&
    fallbackPos[1] >= -0.5 &&
    fallbackPos[1] <= 3.5
  ) {
    pos = [fallbackPos[0], fallbackPos[1], fallbackPos[2]];
  } else {
    pos = [0, defaultStandingHeight, 0];
  }

  let quat: [number, number, number, number];
  if (isFiniteQuat(viewerQuat)) {
    _xrGazeQuat.set(viewerQuat[0], viewerQuat[1], viewerQuat[2], viewerQuat[3]).normalize();
    quat = [_xrGazeQuat.x, _xrGazeQuat.y, _xrGazeQuat.z, _xrGazeQuat.w];
  } else if (isFiniteQuat(fallbackQuat)) {
    _xrGazeQuat.set(fallbackQuat[0], fallbackQuat[1], fallbackQuat[2], fallbackQuat[3]).normalize();
    quat = [_xrGazeQuat.x, _xrGazeQuat.y, _xrGazeQuat.z, _xrGazeQuat.w];
  } else {
    quat = [0, 0, 0, 1];
  }

  return { position: pos, quaternion: quat };
}

/**
 * Computes the 3D world-space camera gaze forward vector by composing the VR origin's yaw rotation
 * with the live HMD head orientation quaternion.
 */
export function computeVRWorldGazeDirection(
  originYaw: number,
  headQuat: readonly [number, number, number, number]
): [number, number, number] {
  const safeYaw = Number.isFinite(originYaw) ? originYaw : 0;
  _xrOriginQuat.setFromAxisAngle(_xrUpAxis, safeYaw);

  if (
    Number.isFinite(headQuat[0]) &&
    Number.isFinite(headQuat[1]) &&
    Number.isFinite(headQuat[2]) &&
    Number.isFinite(headQuat[3]) &&
    headQuat[0] * headQuat[0] + headQuat[1] * headQuat[1] + headQuat[2] * headQuat[2] + headQuat[3] * headQuat[3] > 1e-6
  ) {
    _xrGazeQuat.set(headQuat[0], headQuat[1], headQuat[2], headQuat[3]).normalize();
  } else {
    _xrGazeQuat.identity();
  }

  _xrGazeVec.set(0, 0, -1).applyQuaternion(_xrGazeQuat).applyQuaternion(_xrOriginQuat).normalize();
  return [_xrGazeVec.x, _xrGazeVec.y, _xrGazeVec.z];
}

/**
 * Projects a VR headset/camera 3D world look direction onto the horizontal XZ plane
 * to produce orthonormal forward and right vectors for gaze-directed VR movement.
 */
export function computeVRGazeMovementAxes(
  lookDir: readonly [number, number, number],
  fallbackYaw: number = 0
): {
  forward: [number, number, number];
  right: [number, number, number];
} {
  let fx = lookDir[0];
  let fz = lookDir[2];
  const lenSq = Number.isFinite(fx) && Number.isFinite(fz) ? fx * fx + fz * fz : 0;

  if (lenSq > 1e-4) {
    const invLen = 1 / Math.sqrt(lenSq);
    fx *= invLen;
    fz *= invLen;
  } else {
    // Looking nearly straight up/down: fall back cleanly to horizontal yaw
    fx = -Math.sin(fallbackYaw);
    fz = -Math.cos(fallbackYaw);
  }

  // Right-handed Three.js basis: forward x (0, 1, 0) = (-fz, 0, fx)
  return {
    forward: [fx, 0, fz],
    right: [-fz, 0, fx],
  };
}

/**
 * Calibrates vertical VR origin offset so the player's eye level matches Roblox world scale (3.35 units)
 * regardless of standing height, seated play, or floor offset on PICO/Quest headsets.
 */
export function calibrateVRHeightOffset(
  currentViewerY: number,
  targetEyeHeight: number = VR_TARGET_STANDING_EYE_HEIGHT
): number {
  const safeViewerY = Number.isFinite(currentViewerY) && currentViewerY > 0.15 ? currentViewerY : 1.6;
  const rawOffset = targetEyeHeight - safeViewerY;
  const clamped = Math.max(VR_MIN_HEIGHT_OFFSET, Math.min(VR_MAX_HEIGHT_OFFSET, rawOffset));
  return Number(clamped.toFixed(2));
}

/**
 * Computes the world Y position of the WebXR vrXROrigin root given character floor Y,
 * calibrated VR height offset, and DOORS crouch state.
 */
export function computeVRXROriginY(
  playerY: number,
  heightOffset: number = VR_DEFAULT_HEIGHT_OFFSET,
  isCrouching: boolean = false
): number {
  const safePlayerY = Number.isFinite(playerY) ? playerY : 0;
  const safeOffset = Number.isFinite(heightOffset)
    ? Math.max(VR_MIN_HEIGHT_OFFSET, Math.min(VR_MAX_HEIGHT_OFFSET, heightOffset))
    : VR_DEFAULT_HEIGHT_OFFSET;
  return safePlayerY + safeOffset - (isCrouching ? VR_CROUCH_DROP : 0);
}

/**
 * Pure snap-turn yaw computation in radians.
 */
export function computeSnapTurnYaw(currentYaw: number, direction: -1 | 1, snapDegrees: number): number {
  const clampedDeg = Math.max(15, Math.min(90, snapDegrees || 45));
  const stepRad = (clampedDeg * Math.PI) / 180;
  return currentYaw - direction * stepRad;
}

/**
 * Converts Interpupillary Distance (IPD in mm, typically 56..72mm; PICO 4 motorized IPD is 58..72mm) into half-eye stereo offset in world units.
 */
export function computeStereoEyeOffset(ipdMm: number): number {
  const clampedMm = Math.max(50, Math.min(78, ipdMm || 64));
  return Number(((clampedMm / 1000) * 0.85).toFixed(4));
}

/**
 * Computes where a controller laser ray (origin, normalized direction) intersects a horizontal floor plane y = floorY,
 * clamped between minRange (1.2m) and maxRange (18m).
 */
export function computeFloorTeleportTarget(
  origin: [number, number, number],
  direction: [number, number, number],
  floorY: number = 0,
  maxRange: number = 18
): [number, number, number] | null {
  const [ox, oy, oz] = origin;
  const [dx, dy, dz] = origin && direction ? direction : [0, -1, 0];

  if (dy >= -0.04 || oy <= floorY + 0.2) {
    return null;
  }

  const t = (floorY - oy) / dy;
  if (t < 1.0 || t > maxRange * 1.4) {
    return null;
  }

  const hitX = ox + dx * t;
  const hitZ = oz + dz * t;
  const horizDist = Math.hypot(hitX - ox, hitZ - oz);

  if (horizDist < 1.1) {
    return null;
  }

  if (horizDist > maxRange) {
    const scale = maxRange / horizDist;
    return [
      Number((ox + (hitX - ox) * scale).toFixed(2)),
      Number(floorY.toFixed(2)),
      Number((oz + (hitZ - oz) * scale).toFixed(2)),
    ];
  }

  return [Number(hitX.toFixed(2)), Number(floorY.toFixed(2)), Number(hitZ.toFixed(2))];
}

/**
 * Computes anti-motion-sickness comfort vignette intensity [0..0.72].
 */
export function computeComfortVignetteIntensity(
  speedMag: number,
  angularVelMag: number,
  isTeleporting: boolean,
  enabled: boolean
): number {
  if (!enabled) return 0;
  if (isTeleporting) return 0.68;
  const moveFactor = Math.min(1, Math.max(0, (speedMag - 1.5) / 14)) * 0.42;
  const turnFactor = Math.min(1, Math.max(0, angularVelMag / 3.0)) * 0.35;
  return Number(Math.min(0.68, moveFactor + turnFactor).toFixed(3));
}

export interface VRControllerMeshRig {
  root: THREE.Group;
  picoControllerVisual: THREE.Group;
  controllerVisual: THREE.Group;
  handVisual: THREE.Group;
  triggerMesh: THREE.Mesh;
  gripMesh: THREE.Mesh;
  thumbstickGroup: THREE.Group;
  ringGlowMesh: THREE.Mesh;
  thumbFinger: THREE.Group;
  indexFinger: THREE.Group;
  middleFinger: THREE.Group;
  ringFinger: THREE.Group;
  pinkyFinger: THREE.Group;
  pinchOrb: THREE.Mesh;
  laserLine: THREE.Line;
  laserTip: THREE.Mesh;
  setPoseState: (opts: {
    trackingMode: VRTrackingMode;
    controllerProfile?: VRControllerProfile;
    trigger: number;
    grip: number;
    thumbstick: [number, number];
    buttonPrimary?: boolean;
    buttonSecondary?: boolean;
    laserVisible: boolean;
    laserLength: number;
    hasHit: boolean;
    activeGesture?: VRHandGestureId | null;
    animTime?: number;
    rushAlert?: boolean;
  }) => void;
}

/**
 * Generates crisp procedural CanvasTexture for authentic PICO 4 button caps (X, Y, A, B, Menu ≡, Orange PICO Home O).
 * Safely returns null in non-DOM test environments.
 */
function createPicoButtonCapTexture(
  kind: 'letter' | 'menu' | 'capture' | 'home',
  label: string = ''
): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.clearRect(0, 0, 128, 128);

  if (kind === 'letter') {
    ctx.fillStyle = '#737a84';
    ctx.beginPath();
    ctx.arc(64, 64, 60, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#9aa1ab';
    ctx.lineWidth = 4;
    ctx.stroke();

    ctx.fillStyle = '#f8fafc';
    ctx.font = '700 66px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, 64, 68);
  } else if (kind === 'menu') {
    ctx.fillStyle = '#cfd4da';
    ctx.beginPath();
    ctx.arc(64, 64, 58, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 8;
    ctx.lineCap = 'round';
    for (const y of [44, 64, 84]) {
      ctx.beginPath();
      ctx.moveTo(40, y);
      ctx.lineTo(88, y);
      ctx.stroke();
    }
  } else if (kind === 'capture') {
    ctx.fillStyle = '#cfd4da';
    ctx.beginPath();
    ctx.arc(64, 64, 58, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 6;
    ctx.strokeRect(40, 46, 48, 36);
    ctx.beginPath();
    ctx.arc(64, 64, 10, 0, Math.PI * 2);
    ctx.stroke();
  } else if (kind === 'home') {
    ctx.fillStyle = '#dfe3e8';
    ctx.beginPath();
    ctx.arc(64, 64, 58, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#c5cbd3';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Signature PICO orange circular ring
    ctx.strokeStyle = '#f97316';
    ctx.lineWidth = 11;
    ctx.beginPath();
    ctx.arc(64, 64, 24, 0, Math.PI * 2);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Creates a composite 3D VR Controller (with authentic PICO 4 / PICO 4 Ultra white HyperSense model + Quest Touch Pro model)
 * + 5-Finger Articulated Hand rig with a 3D Laser Pointer ray & hit tip.
 */
export function createVRControllerAndHandRig(hand: 'left' | 'right'): VRControllerMeshRig {
  const root = new THREE.Group();
  root.name = `VRControllerRig_${hand}`;
  const isRight = hand === 'right';
  const accentColor = isRight ? 0xf59e0b : 0x38bdf8;
  const sideSign = isRight ? 1 : -1;

  // ==========================================================================
  // 1A. AUTHENTIC PICO 4 6DoF CONTROLLER VISUAL (Matches real Virtual Desktop / PICO 4 model)
  // Matte light-gray ergonomic teardrop body + wide flat-ribbon diagonal wrap-around tracking arch
  // + dark concave thumbstick + labeled X/Y (L) or A/B (R) buttons + Menu (≡) + Orange PICO Home (O)
  // ==========================================================================
  const picoControllerVisual = new THREE.Group();
  picoControllerVisual.name = `Pico4Controller_${hand}`;

  const picoMatteShellMat = new THREE.MeshStandardMaterial({
    color: 0xd8dce2,
    roughness: 0.48,
    metalness: 0.05,
  });
  const picoArchInnerMat = new THREE.MeshStandardMaterial({
    color: 0x9da4af,
    roughness: 0.74,
    metalness: 0.04,
  });
  const picoWellMat = new THREE.MeshStandardMaterial({
    color: 0xb4bbc4,
    roughness: 0.62,
    metalness: 0.04,
  });
  const picoStickRubberMat = new THREE.MeshStandardMaterial({
    color: 0x5c636e,
    roughness: 0.82,
    metalness: 0.05,
  });
  const picoStickCapInnerMat = new THREE.MeshStandardMaterial({
    color: 0x4b525c,
    roughness: 0.86,
    metalness: 0.04,
  });
  const picoTriggerMat = new THREE.MeshStandardMaterial({
    color: 0xc9ced6,
    roughness: 0.42,
    metalness: 0.08,
  });
  const picoActiveBtnMat = new THREE.MeshStandardMaterial({
    color: 0xfacc15,
    emissive: 0xfacc15,
    emissiveIntensity: 0.65,
    roughness: 0.3,
    metalness: 0.15,
  });

  const primaryLabel = isRight ? 'A' : 'X';
  const secondaryLabel = isRight ? 'B' : 'Y';
  const primaryTex = createPicoButtonCapTexture('letter', primaryLabel);
  const secondaryTex = createPicoButtonCapTexture('letter', secondaryLabel);
  const menuTex = createPicoButtonCapTexture(isRight ? 'capture' : 'menu');
  const homeTex = createPicoButtonCapTexture('home');

  const picoBtnSideMat = new THREE.MeshStandardMaterial({
    color: 0x6b7280,
    roughness: 0.45,
    metalness: 0.08,
  });
  const picoPrimaryTopMat = new THREE.MeshStandardMaterial({
    color: primaryTex ? 0xffffff : 0x737a84,
    ...(primaryTex ? { map: primaryTex } : {}),
    roughness: 0.38,
    metalness: 0.05,
  });
  const picoSecondaryTopMat = new THREE.MeshStandardMaterial({
    color: secondaryTex ? 0xffffff : 0x737a84,
    ...(secondaryTex ? { map: secondaryTex } : {}),
    roughness: 0.38,
    metalness: 0.05,
  });
  const picoMenuTopMat = new THREE.MeshStandardMaterial({
    color: menuTex ? 0xffffff : 0xcfd4da,
    ...(menuTex ? { map: menuTex } : {}),
    roughness: 0.4,
    metalness: 0.04,
  });
  const picoHomeTopMat = new THREE.MeshStandardMaterial({
    color: homeTex ? 0xffffff : 0xf97316,
    ...(homeTex ? { map: homeTex } : {}),
    emissive: 0x000000,
    emissiveIntensity: 0,
    roughness: 0.35,
    metalness: 0.05,
  });

  const picoPrimaryIdleMats: THREE.Material[] = [picoBtnSideMat, picoPrimaryTopMat, picoBtnSideMat];
  const picoSecondaryIdleMats: THREE.Material[] = [picoBtnSideMat, picoSecondaryTopMat, picoBtnSideMat];
  const picoActiveBtnMats: THREE.Material[] = [picoActiveBtnMat, picoActiveBtnMat, picoActiveBtnMat];

  // Ergonomic contoured light-gray handle stem (tapered smoothly downward & back)
  const picoHandleProfile = [
    new THREE.Vector2(0.0, -0.068),
    new THREE.Vector2(0.012, -0.065),
    new THREE.Vector2(0.0165, -0.045),
    new THREE.Vector2(0.0195, -0.01),
    new THREE.Vector2(0.0235, 0.032),
    new THREE.Vector2(0.027, 0.062),
    new THREE.Vector2(0.0, 0.068),
  ];
  const picoHandle = new THREE.Mesh(new THREE.LatheGeometry(picoHandleProfile, 20), picoMatteShellMat);
  picoHandle.rotation.x = Math.PI * 0.34;
  picoHandle.scale.set(0.96, 1.0, 1.12);
  picoHandle.position.set(0, -0.034, 0.036);
  picoControllerVisual.add(picoHandle);

  // Smooth matte light-gray teardrop faceplate deck (angled slightly toward the viewer's eyes)
  const picoFaceGroup = new THREE.Group();
  picoFaceGroup.name = `Pico4Faceplate_${hand}`;
  picoFaceGroup.position.set(0, 0.014, -0.012);
  picoFaceGroup.rotation.x = Math.PI * 0.16;

  // Teardrop silhouette shape lying on XZ plane (extruded along Y via rotation)
  const teardropShape = new THREE.Shape();
  teardropShape.moveTo(0, 0.044); // top front of disc
  teardropShape.bezierCurveTo(0.046, 0.044, 0.048, -0.008, 0.032, -0.034);
  teardropShape.bezierCurveTo(0.022, -0.052, 0.016, -0.062, 0, -0.064);
  teardropShape.bezierCurveTo(-0.016, -0.062, -0.022, -0.052, -0.032, -0.034);
  teardropShape.bezierCurveTo(-0.048, -0.008, -0.046, 0.044, 0, 0.044);

  const teardropGeo = new THREE.ExtrudeGeometry(teardropShape, {
    depth: 0.016,
    bevelEnabled: true,
    bevelThickness: 0.006,
    bevelSize: 0.005,
    bevelSegments: 4,
    curveSegments: 20,
  });
  teardropGeo.rotateX(-Math.PI / 2);
  teardropGeo.translate(0, -0.009, 0.004);
  const picoFaceplateMesh = new THREE.Mesh(teardropGeo, picoMatteShellMat);
  picoFaceGroup.add(picoFaceplateMesh);

  // Recessed thumbstick well & authentic dark concave PICO 4 thumbstick (upper-outer side of deck)
  const stickX = sideSign * 0.014;
  const stickZ = -0.013;
  const picoStickWell = new THREE.Mesh(new THREE.CylinderGeometry(0.0155, 0.0135, 0.004, 18), picoWellMat);
  picoStickWell.position.set(stickX, 0.0125, stickZ);
  picoFaceGroup.add(picoStickWell);

  const picoThumbstickGroup = new THREE.Group();
  picoThumbstickGroup.position.set(stickX, 0.013, stickZ);
  const picoStickStem = new THREE.Mesh(new THREE.CylinderGeometry(0.0045, 0.005, 0.014, 10), picoStickRubberMat);
  picoStickStem.position.y = 0.007;
  const picoStickCap = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.0105, 0.0055, 18), picoStickRubberMat);
  picoStickCap.position.y = 0.0145;
  const picoStickDimple = new THREE.Mesh(new THREE.CylinderGeometry(0.0095, 0.0095, 0.0015, 16), picoStickCapInnerMat);
  picoStickDimple.position.y = 0.0172;
  picoThumbstickGroup.add(picoStickStem, picoStickCap, picoStickDimple);
  picoFaceGroup.add(picoThumbstickGroup);

  // Action Buttons: Left = Y (upper-inner) & X (lower-inner); Right = B (upper-inner) & A (lower-inner)
  const picoBtnSecondary = new THREE.Mesh(
    new THREE.CylinderGeometry(0.0085, 0.0088, 0.0055, 18),
    picoSecondaryIdleMats
  );
  picoBtnSecondary.position.set(-sideSign * 0.018, 0.015, -0.012);
  picoBtnSecondary.rotation.y = Math.PI;

  const picoBtnPrimary = new THREE.Mesh(
    new THREE.CylinderGeometry(0.0085, 0.0088, 0.0055, 18),
    picoPrimaryIdleMats
  );
  picoBtnPrimary.position.set(-sideSign * 0.011, 0.015, 0.01);
  picoBtnPrimary.rotation.y = Math.PI;

  // Small Menu (≡) / Capture button + Iconic Orange-Ring PICO Home (O) button below thumbstick
  const picoBtnMenu = new THREE.Mesh(
    new THREE.CylinderGeometry(0.0062, 0.0065, 0.004, 16),
    [picoWellMat, picoMenuTopMat, picoWellMat]
  );
  picoBtnMenu.position.set(sideSign * 0.022, 0.0142, 0.009);
  picoBtnMenu.rotation.y = Math.PI;

  const picoBtnHome = new THREE.Mesh(
    new THREE.CylinderGeometry(0.0066, 0.0068, 0.004, 16),
    [picoWellMat, picoHomeTopMat, picoWellMat]
  );
  picoBtnHome.position.set(sideSign * 0.007, 0.0142, 0.02);
  picoBtnHome.rotation.y = Math.PI;

  picoFaceGroup.add(picoBtnSecondary, picoBtnPrimary, picoBtnMenu, picoBtnHome);
  picoControllerVisual.add(picoFaceGroup);

  // ==========================================================================
  // SIGNATURE PICO 4 WIDE FLAT-RIBBON DIAGONAL WRAP-AROUND TRACKING ARCH
  // Sweeps cleanly from top-front of faceplate -> wide outward curve -> down and under the bottom of the handle!
  // ==========================================================================
  const picoArchCurve = new THREE.CatmullRomCurve3(
    [
      new THREE.Vector3(-sideSign * 0.006, 0.024, -0.044), // top-front join near faceplate rim
      new THREE.Vector3(sideSign * 0.044, 0.042, -0.046), // sweeping up and outward
      new THREE.Vector3(sideSign * 0.072, 0.024, -0.008), // wide outer bow apex
      new THREE.Vector3(sideSign * 0.064, -0.028, 0.042), // sweeping diagonally back & down
      new THREE.Vector3(sideSign * 0.026, -0.088, 0.082), // wrapping underneath handle bottom
      new THREE.Vector3(-sideSign * 0.008, -0.082, 0.068), // rejoining bottom-inner handle tail
    ],
    false,
    'catmullrom',
    0.5
  );

  // Flat-ribbon cross-section (wide smooth outer face, slim profile — authentic PICO 4 band!)
  const archW = 0.0115; // half-width -> 23mm wide ribbon band
  const archT = 0.0042; // half-thickness -> ~8.4mm slim band
  const archCorner = 0.0026;
  const archBandShape = new THREE.Shape();
  archBandShape.moveTo(-archT + archCorner, -archW);
  archBandShape.lineTo(archT - archCorner, -archW);
  archBandShape.quadraticCurveTo(archT, -archW, archT, -archW + archCorner);
  archBandShape.lineTo(archT, archW - archCorner);
  archBandShape.quadraticCurveTo(archT, archW, archT - archCorner, archW);
  archBandShape.lineTo(-archT + archCorner, archW);
  archBandShape.quadraticCurveTo(-archT, archW, -archT, archW - archCorner);
  archBandShape.lineTo(-archT, -archW + archCorner);
  archBandShape.quadraticCurveTo(-archT, -archW, -archT + archCorner, -archW);

  const picoArchOuterGeo = new THREE.ExtrudeGeometry(archBandShape, {
    steps: 34,
    bevelEnabled: false,
    extrudePath: picoArchCurve,
  });
  const picoArchOuter = new THREE.Mesh(picoArchOuterGeo, picoMatteShellMat);
  picoArchOuter.name = `Pico4TrackingArch_${hand}`;
  picoControllerVisual.add(picoArchOuter);

  // Subtle recessed matte gray inner tracking-band core visible inside the arch
  const picoArchInnerCurve = new THREE.CatmullRomCurve3(
    [
      new THREE.Vector3(-sideSign * 0.004, 0.022, -0.04),
      new THREE.Vector3(sideSign * 0.04, 0.038, -0.041),
      new THREE.Vector3(sideSign * 0.066, 0.021, -0.007),
      new THREE.Vector3(sideSign * 0.058, -0.026, 0.039),
      new THREE.Vector3(sideSign * 0.023, -0.083, 0.077),
      new THREE.Vector3(-sideSign * 0.005, -0.078, 0.065),
    ],
    false,
    'catmullrom',
    0.5
  );
  const picoArchInner = new THREE.Mesh(
    new THREE.TubeGeometry(picoArchInnerCurve, 28, 0.0052, 8, false),
    picoArchInnerMat
  );
  picoControllerVisual.add(picoArchInner);

  // Contoured Light-Gray Front Index Trigger & Inner Side Grip Paddle (matches screenshot bulge!)
  const picoTriggerMesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.009, 0.018, 6, 10), picoTriggerMat);
  picoTriggerMesh.scale.set(0.95, 1.0, 0.72);
  picoTriggerMesh.position.set(0, -0.01, -0.034);
  picoTriggerMesh.rotation.x = 0.42;

  const picoGripMesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.0068, 0.024, 6, 10), picoTriggerMat);
  picoGripMesh.scale.set(0.65, 1.0, 1.05);
  picoGripMesh.rotation.x = Math.PI * 0.34;
  picoGripMesh.position.set(-sideSign * 0.022, -0.024, 0.026);
  picoControllerVisual.add(picoTriggerMesh, picoGripMesh);

  root.add(picoControllerVisual);

  // ==========================================================================
  // 1B. QUEST TOUCH PRO / INDEX STYLE 6DoF CONTROLLER VISUAL
  // ==========================================================================
  const controllerVisual = new THREE.Group();
  controllerVisual.visible = false;
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.45, metalness: 0.35 });
  const darkGripMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.78, metalness: 0.15 });
  const accentGlowMat = new THREE.MeshBasicMaterial({ color: accentColor });
  const buttonMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.3, metalness: 0.5 });

  const handleMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.018, 0.13, 12), bodyMat);
  handleMesh.rotation.x = Math.PI * 0.36;
  handleMesh.position.set(0, -0.03, 0.04);
  controllerVisual.add(handleMesh);

  const facePlate = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.036, 0.022, 16), darkGripMat);
  facePlate.rotation.x = Math.PI * 0.18;
  facePlate.position.set(0, 0.012, -0.015);
  controllerVisual.add(facePlate);

  const trackingRing = new THREE.Mesh(new THREE.TorusGeometry(0.052, 0.007, 10, 24), bodyMat);
  trackingRing.rotation.x = Math.PI * 0.35;
  trackingRing.position.set(0, 0.026, -0.025);
  controllerVisual.add(trackingRing);

  const ringGlowMesh = new THREE.Mesh(new THREE.TorusGeometry(0.053, 0.0035, 8, 24), accentGlowMat);
  ringGlowMesh.rotation.x = Math.PI * 0.35;
  ringGlowMesh.position.set(0, 0.028, -0.026);
  controllerVisual.add(ringGlowMesh);

  const thumbstickGroup = new THREE.Group();
  thumbstickGroup.position.set(isRight ? -0.012 : 0.012, 0.026, -0.018);
  const stickStem = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.018, 8), buttonMat);
  stickStem.position.y = 0.009;
  const stickCap = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.012, 0.006, 12), darkGripMat);
  stickCap.position.y = 0.018;
  thumbstickGroup.add(stickStem, stickCap);
  controllerVisual.add(thumbstickGroup);

  const btnA = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.006, 10), buttonMat);
  btnA.position.set(isRight ? 0.014 : -0.014, 0.024, -0.01);
  const btnB = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.006, 10), accentGlowMat);
  btnB.position.set(isRight ? 0.018 : -0.018, 0.026, -0.026);
  controllerVisual.add(btnA, btnB);

  const triggerMesh = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.032, 0.026), accentGlowMat);
  triggerMesh.position.set(0, -0.008, -0.038);
  triggerMesh.rotation.x = 0.35;
  controllerVisual.add(triggerMesh);

  const gripMesh = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.042, 0.022), buttonMat);
  gripMesh.position.set(isRight ? -0.022 : 0.022, -0.028, 0.035);
  controllerVisual.add(gripMesh);

  root.add(controllerVisual);

  // ==========================================================================
  // 2. ARTICULATED 5-FINGER VR HAND VISUAL (PICO OPTICAL 25-JOINT HAND TRACKING)
  // ==========================================================================
  const handVisual = new THREE.Group();
  handVisual.visible = false;
  const skinMat = new THREE.MeshStandardMaterial({
    color: 0xe5c298,
    roughness: 0.6,
    metalness: 0.05,
  });
  const cuffMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    roughness: 0.5,
    metalness: 0.4,
  });

  const palm = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.026, 0.085), skinMat);
  palm.position.set(0, 0, 0.01);
  const wristCuff = new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.036, 0.05, 12), cuffMat);
  wristCuff.rotation.x = Math.PI / 2;
  wristCuff.position.set(0, -0.005, 0.072);
  handVisual.add(palm, wristCuff);

  const makeFinger = (x: number, z: number, len: number, radius: number = 0.009) => {
    const fg = new THREE.Group();
    fg.position.set(x, 0, z);
    const seg1 = new THREE.Mesh(new THREE.CapsuleGeometry(radius, len * 0.55, 4, 8), skinMat);
    seg1.rotation.x = Math.PI / 2;
    seg1.position.z = -len * 0.32;
    const seg2 = new THREE.Mesh(new THREE.CapsuleGeometry(radius * 0.88, len * 0.45, 4, 8), skinMat);
    seg2.rotation.x = Math.PI / 2;
    seg2.position.z = -len * 0.82;
    fg.add(seg1, seg2);
    handVisual.add(fg);
    return fg;
  };

  const thumbFinger = makeFinger(-sideSign * 0.042, -0.005, 0.055, 0.011);
  thumbFinger.rotation.y = sideSign * 0.48;
  const indexFinger = makeFinger(-sideSign * 0.026, -0.036, 0.068, 0.0095);
  const middleFinger = makeFinger(-sideSign * 0.008, -0.038, 0.074, 0.0095);
  const ringFinger = makeFinger(sideSign * 0.011, -0.036, 0.066, 0.009);
  const pinkyFinger = makeFinger(sideSign * 0.028, -0.032, 0.054, 0.008);

  const pinchOrb = new THREE.Mesh(
    new THREE.SphereGeometry(0.014, 10, 10),
    new THREE.MeshBasicMaterial({ color: accentColor })
  );
  pinchOrb.position.set(-sideSign * 0.03, -0.012, -0.075);
  pinchOrb.visible = false;
  handVisual.add(pinchOrb);

  root.add(handVisual);

  // ==========================================================================
  // 3. 3D LASER POINTER BEAM & HIT RETICLE DOT
  // ==========================================================================
  const laserGeo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, 0.005, -0.05),
    new THREE.Vector3(0, 0.005, -8.0),
  ]);
  const laserMat = new THREE.LineBasicMaterial({
    color: accentColor,
    transparent: true,
    opacity: 0.85,
  });
  const laserLine = new THREE.Line(laserGeo, laserMat);
  root.add(laserLine);

  const laserTip = new THREE.Mesh(
    new THREE.SphereGeometry(0.045, 10, 10),
    new THREE.MeshBasicMaterial({ color: accentColor })
  );
  laserTip.position.set(0, 0.005, -6.0);
  root.add(laserTip);

  const setPoseState: VRControllerMeshRig['setPoseState'] = (opts) => {
    const isHands = opts.trackingMode === 'hands';
    const isPico = (opts.controllerProfile || 'pico4') === 'pico4';

    picoControllerVisual.visible = !isHands && isPico;
    controllerVisual.visible = !isHands && !isPico;
    handVisual.visible = isHands;

    // Animate PICO 4 controller trigger, grip, thumbstick, and X/Y/A/B buttons
    picoTriggerMesh.rotation.x = 0.42 - opts.trigger * 0.42;
    picoTriggerMesh.position.z = -0.034 + opts.trigger * 0.009;
    picoGripMesh.position.x = -sideSign * 0.022 + sideSign * opts.grip * 0.0045;
    picoThumbstickGroup.rotation.z = -opts.thumbstick[0] * 0.35;
    picoThumbstickGroup.rotation.x = opts.thumbstick[1] * 0.35;
    picoBtnPrimary.material = opts.buttonPrimary ? picoActiveBtnMats : picoPrimaryIdleMats;
    picoBtnSecondary.material = opts.buttonSecondary ? picoActiveBtnMats : picoSecondaryIdleMats;

    // Pulse red alert glow on PICO Home LED when DOORS Rush is approaching
    if (opts.rushAlert) {
      const flash = 0.45 + 0.55 * Math.sin((opts.animTime ?? 0) * 16);
      picoHomeTopMat.emissive.setHex(0xef4444);
      picoHomeTopMat.emissiveIntensity = 0.55 + flash * 1.1;
    } else if (picoHomeTopMat.emissiveIntensity !== 0) {
      picoHomeTopMat.emissive.setHex(0x000000);
      picoHomeTopMat.emissiveIntensity = 0;
    }

    // Animate Quest Touch controller buttons & stick
    triggerMesh.rotation.x = 0.35 - opts.trigger * 0.45;
    triggerMesh.position.z = -0.038 + opts.trigger * 0.01;
    gripMesh.position.x = (isRight ? -0.022 : 0.022) + (isRight ? 1 : -1) * opts.grip * 0.005;
    thumbstickGroup.rotation.z = -opts.thumbstick[0] * 0.35;
    thumbstickGroup.rotation.x = opts.thumbstick[1] * 0.35;

    // Animate articulated fingers in Hand-Tracking mode & unique gesture poses
    const t = opts.animTime ?? 0;
    const gesture = opts.activeGesture || null;
    const isGestureHandPose =
      gesture === 'thumbs_up' ||
      gesture === 'peace' ||
      gesture === 'salute' ||
      gesture === 'cheer' ||
      (gesture === 'wave' && isRight);

    // Show articulated hand visibly during an active right/both-hand gesture even in controller mode,
    // or apply tactile gesture sway directly on controller visual when non-hand-only mode is active
    if (isGestureHandPose && (isRight || gesture === 'cheer')) {
      handVisual.visible = true;
      picoControllerVisual.visible = false;
      controllerVisual.visible = false;
    }

    if (gesture === 'thumbs_up' && isRight) {
      handVisual.rotation.set(0.12, -sideSign * 0.25, sideSign * 1.15);
      thumbFinger.rotation.set(0.32, sideSign * 0.22, -sideSign * 0.95);
      indexFinger.rotation.set(-1.55, 0, 0);
      middleFinger.rotation.set(-1.6, 0, 0);
      ringFinger.rotation.set(-1.6, 0, 0);
      pinkyFinger.rotation.set(-1.55, 0, 0);
      pinchOrb.visible = false;
    } else if (gesture === 'peace' && isRight) {
      handVisual.rotation.set(0.85, sideSign * 0.14, Math.sin(t * 4.5) * 0.1);
      thumbFinger.rotation.set(-0.95, -sideSign * 0.38, 0);
      indexFinger.rotation.set(0.14, -sideSign * 0.22, 0);
      middleFinger.rotation.set(0.14, sideSign * 0.18, 0);
      ringFinger.rotation.set(-1.58, 0, 0);
      pinkyFinger.rotation.set(-1.58, 0, 0);
      pinchOrb.visible = false;
    } else if (gesture === 'wave' && isRight) {
      handVisual.rotation.set(0.95, 0, Math.sin(t * 11) * 0.4);
      thumbFinger.rotation.set(0.05, sideSign * 0.65, 0);
      indexFinger.rotation.set(0.06, -sideSign * 0.12, 0);
      middleFinger.rotation.set(0.06, 0, 0);
      ringFinger.rotation.set(0.06, sideSign * 0.08, 0);
      pinkyFinger.rotation.set(0.06, sideSign * 0.18, 0);
      pinchOrb.visible = false;
    } else if (gesture === 'salute' && isRight) {
      handVisual.rotation.set(0.38, -sideSign * 0.35, -sideSign * 0.42);
      thumbFinger.rotation.set(-0.25, sideSign * 0.15, 0);
      indexFinger.rotation.set(0.02, 0, 0);
      middleFinger.rotation.set(0.02, 0, 0);
      ringFinger.rotation.set(0.02, 0, 0);
      pinkyFinger.rotation.set(0.02, 0, 0);
      pinchOrb.visible = false;
    } else if (gesture === 'cheer') {
      handVisual.rotation.set(0.9, 0, Math.sin(t * 8) * 0.18);
      const pulseFlex = -0.15 + Math.sin(t * 10) * 0.2;
      thumbFinger.rotation.set(pulseFlex * 0.5, sideSign * 0.5, 0);
      indexFinger.rotation.set(pulseFlex, -sideSign * 0.08, 0);
      middleFinger.rotation.set(pulseFlex, 0, 0);
      ringFinger.rotation.set(pulseFlex, sideSign * 0.08, 0);
      pinkyFinger.rotation.set(pulseFlex, sideSign * 0.15, 0);
      pinchOrb.visible = false;
    } else {
      handVisual.rotation.set(0, 0, 0);
      const pinch = Math.max(opts.trigger, opts.grip * 0.6);
      indexFinger.rotation.set(-pinch * 0.65, 0, 0);
      thumbFinger.rotation.set(-pinch * 0.45, sideSign * 0.48, 0);
      middleFinger.rotation.set(-opts.grip * 0.85, 0, 0);
      ringFinger.rotation.set(-opts.grip * 0.9, 0, 0);
      pinkyFinger.rotation.set(-opts.grip * 0.95, 0, 0);
      pinchOrb.visible = isHands && pinch > 0.35;
      pinchOrb.scale.setScalar(0.8 + pinch * 0.6);
    }

    // Update laser line length & hit tip
    laserLine.visible = opts.laserVisible;
    laserTip.visible = opts.laserVisible && opts.hasHit;
    const len = Math.max(0.4, Math.min(20, opts.laserLength || 8));
    const posAttr = laserLine.geometry.getAttribute('position') as THREE.BufferAttribute;
    posAttr.setXYZ(1, 0, 0.005, -len);
    posAttr.needsUpdate = true;
    laserTip.position.set(0, 0.005, -len);
  };

  disableRigFrustumCulling(root);

  return {
    root,
    picoControllerVisual,
    controllerVisual,
    handVisual,
    triggerMesh,
    gripMesh,
    thumbstickGroup,
    ringGlowMesh,
    thumbFinger,
    indexFinger,
    middleFinger,
    ringFinger,
    pinkyFinger,
    pinchOrb,
    laserLine,
    laserTip,
    setPoseState,
  };
}

/**
 * Builds the 3D PICO Play-Space Chaperone / Guardian Boundary Ring around the player's feet.
 * Glows cyan in safe play-space and shifts to warning amber/red when approaching walls.
 */
export function createPicoGuardianBoundaryRing() {
  const root = new THREE.Group();
  root.name = 'PicoGuardianBoundary';
  root.visible = false;

  const ringMat = new THREE.MeshBasicMaterial({
    color: 0x22d3ee,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.45,
  });
  const gridWallMat = new THREE.MeshBasicMaterial({
    color: 0x38bdf8,
    wireframe: true,
    transparent: true,
    opacity: 0.16,
  });

  const outerBoundary = new THREE.Mesh(new THREE.RingGeometry(1.75, 1.85, 36), ringMat);
  outerBoundary.rotation.x = -Math.PI / 2;
  outerBoundary.position.y = 0.03;

  const innerCrossX = new THREE.Mesh(new THREE.PlaneGeometry(0.45, 0.04), ringMat);
  innerCrossX.rotation.x = -Math.PI / 2;
  innerCrossX.position.y = 0.032;

  const innerCrossZ = new THREE.Mesh(new THREE.PlaneGeometry(0.04, 0.45), ringMat);
  innerCrossZ.rotation.x = -Math.PI / 2;
  innerCrossZ.position.y = 0.032;

  const cageCylinder = new THREE.Mesh(new THREE.CylinderGeometry(1.82, 1.82, 1.4, 24, 2, true), gridWallMat);
  cageCylinder.position.y = 0.72;

  root.add(outerBoundary, innerCrossX, innerCrossZ, cageCylinder);

  const updateGuardian = (
    playerPos: THREE.Vector3,
    visible: boolean,
    passthroughGrid: boolean,
    nearWallWarning: boolean
  ) => {
    root.visible = visible;
    if (!visible) return;
    root.position.set(playerPos.x, playerPos.y, playerPos.z);
    cageCylinder.visible = passthroughGrid || nearWallWarning;
    ringMat.color.setHex(nearWallWarning ? 0xf43f5e : 0x22d3ee);
    gridWallMat.color.setHex(nearWallWarning ? 0xf43f5e : 0x38bdf8);
    gridWallMat.opacity = nearWallWarning ? 0.32 : passthroughGrid ? 0.22 : 0.1;
  };

  return { root, updateGuardian };
}

/**
 * Builds a 3D Diegetic Holographic Wrist Watch HUD mounted on the Left VR Controller/Hand.
 * Displays live HP, Coins, Current Door / Checkpoint, and PICO / VR Tracking Mode right on the player's 3D wrist!
 */
export function createVRWristWatchHUD() {
  const root = new THREE.Group();
  root.name = 'VRWristWatchHUD';
  root.position.set(0.055, 0.042, 0.035);
  root.rotation.set(-0.45, -0.32, 0.18);

  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 144;
  const ctx = canvas.getContext('2d')!;

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;

  const bezelMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    roughness: 0.3,
    metalness: 0.75,
  });
  const screenMat = new THREE.MeshBasicMaterial({
    map: tex,
  });

  const bezel = new THREE.Mesh(new THREE.BoxGeometry(0.115, 0.068, 0.012), bezelMat);
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.105, 0.058), screenMat);
  screen.position.z = 0.007;
  root.add(bezel, screen);

  let lastSignature = '';

  const updateWatch = (data: {
    hp: number;
    coins: number;
    doorNum: number;
    roomTitle: string;
    gameId: string;
    trackingMode: VRTrackingMode;
    controllerProfile?: VRControllerProfile;
    rushWarningSeconds?: number;
    rushActive?: boolean;
    isHidingInCloset?: boolean;
  }) => {
    const hpInt = Math.max(0, Math.min(100, Math.round(data.hp)));
    const profile = data.controllerProfile || 'pico4';
    const rushSec = Math.max(0, Number((data.rushWarningSeconds || 0).toFixed(1)));
    const rushDanger = (rushSec > 0 || Boolean(data.rushActive)) && !data.isHidingInCloset;
    const sig = `${hpInt}|${data.coins}|${data.doorNum}|${data.roomTitle}|${data.gameId}|${data.trackingMode}|${profile}|${rushSec}|${Boolean(
      data.rushActive
    )}|${Boolean(data.isHidingInCloset)}`;
    if (sig === lastSignature) return;
    lastSignature = sig;

    ctx.fillStyle = rushDanger ? '#2b090d' : data.isHidingInCloset ? '#052e16' : '#090d16';
    ctx.fillRect(0, 0, 256, 144);

    ctx.strokeStyle = rushDanger
      ? '#ef4444'
      : data.isHidingInCloset
      ? '#10b981'
      : profile === 'pico4'
      ? '#22d3ee'
      : '#38bdf8';
    ctx.lineWidth = rushDanger ? 6 : 4;
    ctx.strokeRect(4, 4, 248, 136);

    if (rushDanger) {
      ctx.fillStyle = '#fecaca';
      ctx.font = '900 18px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(
        data.rushActive ? '⚡ РАШ ЛЕТИТ СЕЙЧАС!' : `⚡ РАШ ЧЕРЕЗ ${rushSec.toFixed(1)}с!`,
        128,
        38
      );
      ctx.fillStyle = '#fde047';
      ctx.font = '900 16px sans-serif';
      ctx.fillText('ПРЯЧЬТЕСЬ В ШКАФ!', 128, 68);
      ctx.fillStyle = '#f8fafc';
      ctx.font = '700 14px monospace';
      ctx.fillText('КУРОК R / [E] У ШКАФА', 128, 98);
      ctx.fillStyle = '#94a3b8';
      ctx.font = '700 12px monospace';
      ctx.fillText(`HP: ${hpInt} · ДВЕРЬ #${data.doorNum}`, 128, 126);
      tex.needsUpdate = true;
      return;
    }

    // Header
    ctx.fillStyle = '#22d3ee';
    ctx.font = '900 15px monospace';
    ctx.textAlign = 'left';
    const headerTitle =
      data.trackingMode === 'hands'
        ? 'PICO HAND 25J'
        : profile === 'pico4'
        ? 'PICO 4 6DoF'
        : 'QUEST 6DoF';
    ctx.fillText(headerTitle, 14, 24);

    ctx.fillStyle = '#fbbf24';
    ctx.textAlign = 'right';
    ctx.fillText(`🪙 ${data.coins}`, 242, 24);

    // HP Bar
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(14, 36, 228, 22);
    ctx.fillStyle = hpInt > 50 ? '#10b981' : hpInt > 25 ? '#f59e0b' : '#ef4444';
    ctx.fillRect(14, 36, Math.round((228 * hpInt) / 100), 22);

    ctx.fillStyle = '#ffffff';
    ctx.font = '900 15px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`HP: ${hpInt} / 100`, 128, 52);

    // Door / Location readout
    ctx.fillStyle = '#fde68a';
    ctx.font = '900 20px monospace';
    ctx.textAlign = 'left';
    if (data.gameId === 'doors') {
      ctx.fillText(`ДВЕРЬ #${String(data.doorNum).padStart(4, '0')}`, 14, 88);
    } else {
      ctx.fillText(`ЭТАП: ${data.doorNum} / 6`, 14, 88);
    }

    ctx.fillStyle = data.isHidingInCloset ? '#34d399' : '#94a3b8';
    ctx.font = '700 14px sans-serif';
    ctx.fillText(
      data.isHidingInCloset ? '🛡️ ВЫ В ШКАФУ (БЕЗОПАСНО)' : (data.roomTitle || 'ЛОКАЦИЯ').slice(0, 20),
      14,
      114
    );

    ctx.fillStyle = '#34d399';
    ctx.font = '700 11px monospace';
    ctx.fillText('СТИК L:ХОДЬБА · R:ПОВОРОТ · MENU:ГИД', 14, 132);

    tex.needsUpdate = true;
  };

  disableRigFrustumCulling(root);

  return { root, updateWatch };
}

/**
 * Builds the Right-Hand 3D Tool attachment (DOORS Tactical Flashlight, Sword, or Builder Hammer)
 */
export function createVRRightHandToolModel() {
  const root = new THREE.Group();
  root.name = 'VRRightHandTool';
  root.position.set(0, 0.015, -0.06);

  // 1. DOORS Tactical Brass/Steel Flashlight
  const flashlightGroup = new THREE.Group();
  const barrelMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.8, roughness: 0.3 });
  const brassRingMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.85, roughness: 0.25 });
  const lensOnMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });
  const lensOffMat = new THREE.MeshBasicMaterial({ color: 0x475569 });

  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.018, 0.16, 12), barrelMat);
  barrel.rotation.x = Math.PI / 2;
  const headBezel = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.024, 0.045, 14), brassRingMat);
  headBezel.rotation.x = Math.PI / 2;
  headBezel.position.z = -0.09;
  const lensMesh = new THREE.Mesh(new THREE.CircleGeometry(0.028, 12), lensOnMat);
  lensMesh.rotation.y = Math.PI;
  lensMesh.position.z = -0.114;
  flashlightGroup.add(barrel, headBezel, lensMesh);
  root.add(flashlightGroup);

  // 2. Classic Blox Linked Sword
  const swordGroup = new THREE.Group();
  swordGroup.visible = false;
  const bladeMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.85, roughness: 0.2 });
  const hiltMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.7, roughness: 0.3 });
  const guard = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.02, 0.03), hiltMat);
  guard.position.z = -0.05;
  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.008, 0.42), bladeMat);
  blade.position.z = -0.27;
  swordGroup.add(guard, blade);
  root.add(swordGroup);

  // 3. 3D Sci-Fi Spatial Portal Gun (Aperture-style cyan/orange plasma core)
  const portalGunHandle = createPortalGunModel3D(1.12);
  portalGunHandle.root.position.set(0, 0.02, -0.04);
  portalGunHandle.root.visible = false;
  root.add(portalGunHandle.root);

  const setTool = (
    gameId: string,
    tool: string,
    flashlightOn: boolean,
    portalColor: PortalKind = 'blue',
    animTime: number = 0
  ) => {
    if (tool === 'portal_gun') {
      flashlightGroup.visible = false;
      swordGroup.visible = false;
      portalGunHandle.root.visible = true;
      portalGunHandle.setMode(portalColor, animTime);
      return;
    }
    portalGunHandle.root.visible = false;
    if (gameId === 'doors') {
      flashlightGroup.visible = true;
      swordGroup.visible = false;
      lensMesh.material = flashlightOn ? lensOnMat : lensOffMat;
    } else {
      flashlightGroup.visible = false;
      swordGroup.visible = tool === 'sword';
    }
  };

  disableRigFrustumCulling(root);

  return { root, flashlightGroup, swordGroup, portalGunGroup: portalGunHandle.root, setTool };
}

/**
 * Builds the 3D Glowing VR Floor Teleport Target Reticle Ring
 */
export function createVRTeleportReticle() {
  const root = new THREE.Group();
  root.name = 'VRTeleportReticle';
  root.visible = false;

  const ringOuterMat = new THREE.MeshBasicMaterial({
    color: 0x38bdf8,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.85,
  });
  const ringInnerMat = new THREE.MeshBasicMaterial({
    color: 0x34d399,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.65,
  });
  const beaconMat = new THREE.MeshBasicMaterial({
    color: 0x38bdf8,
    transparent: true,
    opacity: 0.22,
    side: THREE.DoubleSide,
  });

  const outerRing = new THREE.Mesh(new THREE.RingGeometry(0.65, 0.82, 24), ringOuterMat);
  outerRing.rotation.x = -Math.PI / 2;
  outerRing.position.y = 0.04;

  const innerRing = new THREE.Mesh(new THREE.RingGeometry(0.28, 0.42, 20), ringInnerMat);
  innerRing.rotation.x = -Math.PI / 2;
  innerRing.position.y = 0.045;

  const beacon = new THREE.Mesh(new THREE.CylinderGeometry(0.68, 0.68, 1.1, 20, 1, true), beaconMat);
  beacon.position.y = 0.58;

  root.add(outerRing, innerRing, beacon);

  const updateReticle = (time: number, valid: boolean) => {
    root.visible = valid;
    if (!valid) return;
    const pulse = 1 + Math.sin(time * 6) * 0.08;
    outerRing.scale.setScalar(pulse);
    innerRing.rotation.z = time * 2.5;
  };

  return { root, updateReticle };
}

/**
 * Builds a 3D head-locked Hazard Alert Banner inside vrCameraRig so WebXR headset users
 * unmistakably see Rush incoming warnings, closet safety, and entity alerts directly in 3D VR.
 */
export function createVRAlertHUD() {
  const root = new THREE.Group();
  root.name = 'VRAlertHUD';
  root.position.set(0, 0.3, -1.25);
  root.visible = false;

  const hasDoc = typeof document !== 'undefined';
  const canvas = hasDoc ? document.createElement('canvas') : null;
  if (canvas) {
    canvas.width = 512;
    canvas.height = 128;
  }
  const ctx = canvas ? canvas.getContext('2d') : null;
  const tex = canvas ? new THREE.CanvasTexture(canvas) : null;
  if (tex) {
    tex.colorSpace = THREE.SRGBColorSpace;
  }

  const mat = new THREE.MeshBasicMaterial({
    map: tex ?? undefined,
    color: tex ? 0xffffff : 0xef4444,
    transparent: true,
    opacity: 0.96,
    depthTest: false,
  });
  const panel = new THREE.Mesh(new THREE.PlaneGeometry(0.76, 0.19), mat);
  panel.renderOrder = 999;
  root.add(panel);

  let lastSig = '';

  const updateAlert = (opts: {
    visible: boolean;
    tone: 'danger' | 'safe' | 'warn';
    headline: string;
    subline: string;
    pulsePhase?: number;
  }) => {
    root.visible = opts.visible;
    if (!opts.visible) {
      lastSig = '';
      return;
    }

    const blink = opts.tone === 'danger' ? Math.sin((opts.pulsePhase || 0) * 14) > 0 : false;
    const sig = `${opts.tone}|${opts.headline}|${opts.subline}|${blink ? 1 : 0}`;
    if (sig === lastSig) return;
    lastSig = sig;

    if (!ctx || !tex) return;

    ctx.clearRect(0, 0, 512, 128);
    ctx.fillStyle =
      opts.tone === 'danger'
        ? blink
          ? 'rgba(153, 27, 27, 0.94)'
          : 'rgba(69, 10, 10, 0.94)'
        : opts.tone === 'safe'
        ? 'rgba(6, 78, 59, 0.92)'
        : 'rgba(120, 53, 15, 0.92)';
    ctx.fillRect(4, 4, 504, 120);

    ctx.strokeStyle =
      opts.tone === 'danger' ? (blink ? '#fef08a' : '#f87171') : opts.tone === 'safe' ? '#34d399' : '#fbbf24';
    ctx.lineWidth = 6;
    ctx.strokeRect(4, 4, 504, 120);

    ctx.fillStyle = '#ffffff';
    ctx.font = '900 28px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(opts.headline.slice(0, 34), 256, 54);

    ctx.fillStyle = opts.tone === 'safe' ? '#a7f3d0' : '#fde047';
    ctx.font = '800 20px sans-serif';
    ctx.fillText(opts.subline.slice(0, 42), 256, 94);

    tex.needsUpdate = true;
  };

  disableRigFrustumCulling(root);

  return { root, updateAlert };
}

/**
 * Builds a crisp, toggleable 3D Controller Legend Card mounted near the Left VR hand
 * so PICO/Quest headset players can read every button assignment directly inside VR.
 */
export function createVRControlsCard3D() {
  const root = new THREE.Group();
  root.name = 'VRControlsCard3D';
  root.position.set(0.06, 0.16, 0.02);
  root.rotation.set(-0.36, -0.3, 0.12);
  root.visible = false;

  const hasDoc = typeof document !== 'undefined';
  const canvas = hasDoc ? document.createElement('canvas') : null;
  if (canvas) {
    canvas.width = 512;
    canvas.height = 360;
  }
  const ctx = canvas ? canvas.getContext('2d') : null;
  const tex = canvas ? new THREE.CanvasTexture(canvas) : null;
  if (tex) {
    tex.colorSpace = THREE.SRGBColorSpace;
  }

  const cardMat = new THREE.MeshBasicMaterial({
    map: tex ?? undefined,
    color: tex ? 0xffffff : 0x0f172a,
    transparent: true,
    opacity: 0.96,
  });
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(0.28, 0.195), cardMat);
  plane.position.z = 0.004;
  root.add(plane);

  let lastSig = '';

  const updateCard = (opts: { visible: boolean; gameId: string; profile: VRControllerProfile }) => {
    root.visible = opts.visible;
    if (!opts.visible) return;
    const sig = `${opts.gameId}|${opts.profile}`;
    if (sig === lastSig) return;
    lastSig = sig;

    if (!ctx || !tex) return;

    ctx.fillStyle = '#070b14';
    ctx.fillRect(0, 0, 512, 360);
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 6;
    ctx.strokeRect(4, 4, 504, 352);

    ctx.fillStyle = '#38bdf8';
    ctx.font = '900 22px sans-serif';
    ctx.textAlign = 'left';
    const title = opts.profile === 'pico4' ? '🎮 КНОПКИ PICO 4 / ULTRA' : '🎮 КНОПКИ VR КОНТРОЛЛЕРОВ';
    ctx.fillText(title, 18, 36);

    const rows: [string, string][] =
      opts.gameId === 'doors'
        ? [
            ['Левый стик', 'Ходьба (куда смотришь)'],
            ['Правый стик', 'Поворот камеры (±45°)'],
            ['Курок R (Trigger)', 'Открыть дверь / В шкаф / Меню'],
            ['Кнопка A / B (R)', 'Присесть (A) · Фонарик (B)'],
            ['Хват L (Grip L)', 'Телепорт по лучу на пол'],
            ['Кнопка X (левый)', '3D Главное меню VR'],
            ['Кнопка Y / L3 (L)', 'Скрыть / показать памятку'],
          ]
        : [
            ['Левый стик', 'Ходьба (куда смотришь)'],
            ['Правый стик', 'Поворот камеры (±45°)'],
            ['Кнопка A (правый)', 'Прыжок'],
            ['Курок R (Trigger)', 'Меч / Совок / Блок / Меню'],
            ['Хват L / B', 'Телепорт по лучу на пол'],
            ['Кнопка X (левый)', '3D Главное меню VR'],
            ['Кнопка Y / L3 (L)', 'Скрыть / показать памятку'],
          ];

    let y = 76;
    for (const [btn, action] of rows) {
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(16, y - 24, 480, 36);
      ctx.fillStyle = '#fbbf24';
      ctx.font = '900 17px monospace';
      ctx.fillText(btn, 22, y);
      ctx.fillStyle = '#e2e8f0';
      ctx.font = '700 17px sans-serif';
      ctx.fillText(action, 212, y);
      y += 42;
    }

    tex.needsUpdate = true;
  };

  disableRigFrustumCulling(root);

  return { root, updateCard };
}

export type VRMenuActionId =
  | 'game:doors'
  | 'game:obby'
  | 'game:lava_survival'
  | 'game:bee_swarm'
  | 'game:studio'
  | 'action:height_down'
  | 'action:height_auto'
  | 'action:height_up'
  | 'action:toggle_hint'
  | 'action:toggle_portal_gun'
  | 'action:resume'
  | 'action:respawn'
  | 'action:toggle_tracking'
  | 'action:exit_main_menu';

export interface VRMainMenuItemDef {
  id: VRMenuActionId;
  row: 0 | 1 | 2;
  col: number;
  colsInRow: number;
  icon: string;
  title: string;
  subtitle: string;
  accentHex: string;
  gameId?: 'doors' | 'obby' | 'lava_survival' | 'bee_swarm' | 'studio';
}

export const VR_MAIN_MENU_ITEMS: readonly VRMainMenuItemDef[] = [
  // Row 0: 5 Worlds / Games directly switchable inside 3D VR
  {
    id: 'game:doors',
    row: 0,
    col: 0,
    colsInRow: 5,
    icon: '🚪',
    title: 'DOORS',
    subtitle: 'Отель 100 дв.',
    accentHex: '#f59e0b',
    gameId: 'doors',
  },
  {
    id: 'game:obby',
    row: 0,
    col: 1,
    colsInRow: 5,
    icon: '🏃',
    title: 'Паркур',
    subtitle: 'Obby 3D',
    accentHex: '#38bdf8',
    gameId: 'obby',
  },
  {
    id: 'game:lava_survival',
    row: 0,
    col: 2,
    colsInRow: 5,
    icon: '🌋',
    title: 'Лава 3D',
    subtitle: 'Выживание',
    accentHex: '#ef4444',
    gameId: 'lava_survival',
  },
  {
    id: 'game:bee_swarm',
    row: 0,
    col: 3,
    colsInRow: 5,
    icon: '🐝',
    title: 'Пасека',
    subtitle: 'Симулятор',
    accentHex: '#facc15',
    gameId: 'bee_swarm',
  },
  {
    id: 'game:studio',
    row: 0,
    col: 4,
    colsInRow: 5,
    icon: '🛠️',
    title: 'Студия',
    subtitle: 'Редактор 3D',
    accentHex: '#a855f7',
    gameId: 'studio',
  },

  // Row 1: 5 VR Comfort, Portal Gun & Quick Settings
  {
    id: 'action:height_down',
    row: 1,
    col: 0,
    colsInRow: 5,
    icon: '🔽',
    title: 'Рост −0.15м',
    subtitle: 'Ниже глаза',
    accentHex: '#10b981',
  },
  {
    id: 'action:height_auto',
    row: 1,
    col: 1,
    colsInRow: 5,
    icon: '📏',
    title: 'Авто рост',
    subtitle: 'Выровнять VR',
    accentHex: '#34d399',
  },
  {
    id: 'action:height_up',
    row: 1,
    col: 2,
    colsInRow: 5,
    icon: '🔼',
    title: 'Рост +0.15м',
    subtitle: 'Выше глаза',
    accentHex: '#10b981',
  },
  {
    id: 'action:toggle_hint',
    row: 1,
    col: 3,
    colsInRow: 5,
    icon: '📋',
    title: 'Памятка [Y]',
    subtitle: 'Вкл / Выкл 3D',
    accentHex: '#38bdf8',
  },
  {
    id: 'action:toggle_portal_gun',
    row: 1,
    col: 4,
    colsInRow: 5,
    icon: '🌀',
    title: 'Портал-Пушка',
    subtitle: 'Курок R/L 🔵🟠',
    accentHex: '#00e5ff',
  },

  // Row 2: 4 Session & Navigation Actions
  {
    id: 'action:resume',
    row: 2,
    col: 0,
    colsInRow: 4,
    icon: '▶️',
    title: 'Продолжить',
    subtitle: 'Закрыть [X]',
    accentHex: '#22c55e',
  },
  {
    id: 'action:respawn',
    row: 2,
    col: 1,
    colsInRow: 4,
    icon: '🔄',
    title: 'Респавн',
    subtitle: 'На чекпоинт',
    accentHex: '#fb923c',
  },
  {
    id: 'action:toggle_tracking',
    row: 2,
    col: 2,
    colsInRow: 4,
    icon: '🖐️',
    title: 'Руки / Пульты',
    subtitle: 'Трекинг PICO',
    accentHex: '#c084fc',
  },
  {
    id: 'action:exit_main_menu',
    row: 2,
    col: 3,
    colsInRow: 4,
    icon: '🏠',
    title: 'Главное меню',
    subtitle: 'Выйти в 2D хаб',
    accentHex: '#f43f5e',
  },
];

/**
 * Pure helper computing world-space position and Y-axis yaw for spawning the floating 3D VR Main Menu
 * comfortably in front of the player's eyes, facing back toward them without tilting awkwardly.
 */
export function computeVRMenuPlacement(
  headWorldPos: readonly [number, number, number],
  lookWorldDir: readonly [number, number, number],
  distance: number = 1.65
): { position: [number, number, number]; yaw: number } {
  let fx = lookWorldDir[0];
  let fz = lookWorldDir[2];
  const horizLen = Math.hypot(fx, fz);
  if (horizLen < 1e-4) {
    fx = 0;
    fz = -1;
  } else {
    fx /= horizLen;
    fz /= horizLen;
  }

  const clampedDist = Math.max(0.9, Math.min(3.5, distance));
  const posX = headWorldPos[0] + fx * clampedDist;
  const posY = headWorldPos[1] - 0.08;
  const posZ = headWorldPos[2] + fz * clampedDist;

  // Panel front face is +Z in local space, so yaw points +Z back toward the head (-fx, -fz)
  const yaw = Math.atan2(-fx, -fz);

  return {
    position: [Number(posX.toFixed(4)), Number(posY.toFixed(4)), Number(posZ.toFixed(4))],
    yaw,
  };
}

export interface VRMainMenuUpdateOptions {
  visible: boolean;
  currentGameId: string;
  hp: number;
  coins: number;
  heightOffset: number;
  controlsHintVisible: boolean;
  trackingMode: VRTrackingMode;
  portalGunActive?: boolean;
  hoveredActionId: VRMenuActionId | null;
}

/**
 * Builds an interactive 3D Spatial Floating VR Main Menu in world space for PICO 4 / Quest WebXR.
 * Players point their controller laser at any 3D tile and pull Trigger to switch worlds,
 * adjust VR eye height, toggle the 3D button hint card, respawn, or return to the 2D Title Screen.
 */
export function createVRMainMenu3D() {
  const root = new THREE.Group();
  root.name = 'VRMainMenu3D';
  root.visible = false;

  const panelW = 1.56;
  const panelH = 0.98;
  const hasDoc = typeof document !== 'undefined';

  // Outer glowing border backing + dark slate chassis
  const rimMat = new THREE.MeshBasicMaterial({
    color: 0x38bdf8,
    transparent: true,
    opacity: 0.9,
  });
  const rimMesh = new THREE.Mesh(new THREE.BoxGeometry(panelW + 0.04, panelH + 0.04, 0.018), rimMat);
  rimMesh.position.z = -0.014;
  root.add(rimMesh);

  const bgMat = new THREE.MeshBasicMaterial({
    color: 0x070d1c,
    transparent: true,
    opacity: 0.95,
  });
  const bgMesh = new THREE.Mesh(new THREE.BoxGeometry(panelW, panelH, 0.022), bgMat);
  bgMesh.position.z = -0.005;
  root.add(bgMesh);

  // Header Canvas Banner
  const headerCanvas = hasDoc ? document.createElement('canvas') : null;
  if (headerCanvas) {
    headerCanvas.width = 1024;
    headerCanvas.height = 160;
  }
  const headerCtx = headerCanvas ? headerCanvas.getContext('2d') : null;
  const headerTex = headerCanvas ? new THREE.CanvasTexture(headerCanvas) : null;
  if (headerTex) {
    headerTex.colorSpace = THREE.SRGBColorSpace;
  }
  const headerMatOpts: THREE.MeshBasicMaterialParameters = {
    color: headerTex ? 0xffffff : 0x0f172a,
    transparent: true,
    opacity: 0.98,
  };
  if (headerTex) {
    headerMatOpts.map = headerTex;
  }
  const headerMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(panelW - 0.08, 0.2),
    new THREE.MeshBasicMaterial(headerMatOpts)
  );
  headerMesh.position.set(0, panelH / 2 - 0.125, 0.014);
  headerMesh.renderOrder = 20;
  root.add(headerMesh);

  // Build 13 interactive raycastable 3D button tiles across 3 rows
  interface TileHandle {
    def: VRMainMenuItemDef;
    mesh: THREE.Mesh;
    canvas: HTMLCanvasElement | null;
    ctx: CanvasRenderingContext2D | null;
    tex: THREE.CanvasTexture | null;
    mat: THREE.MeshBasicMaterial;
    lastSig: string;
  }

  const buttonMeshes: THREE.Mesh[] = [];
  const tiles: TileHandle[] = [];

  const innerW = panelW - 0.1;
  const rowCentersY = [0.175, -0.075, -0.325];
  const rowHeights = [0.21, 0.195, 0.195];
  const gapX = 0.028;

  for (const def of VR_MAIN_MENU_ITEMS) {
    const cols = def.colsInRow;
    const tileW = (innerW - gapX * (cols - 1)) / cols;
    const tileH = rowHeights[def.row];
    const startX = -innerW / 2 + tileW / 2;
    const tileX = startX + def.col * (tileW + gapX);
    const tileY = rowCentersY[def.row];

    const c = hasDoc ? document.createElement('canvas') : null;
    if (c) {
      c.width = 256;
      c.height = 160;
    }
    const ctx = c ? c.getContext('2d') : null;
    const tex = c ? new THREE.CanvasTexture(c) : null;
    if (tex) {
      tex.colorSpace = THREE.SRGBColorSpace;
    }

    const tileMatOpts: THREE.MeshBasicMaterialParameters = {
      color: tex ? 0xffffff : 0x1e293b,
      transparent: true,
      opacity: 0.98,
    };
    if (tex) {
      tileMatOpts.map = tex;
    }
    const mat = new THREE.MeshBasicMaterial(tileMatOpts);
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(tileW, tileH, 0.018), mat);
    mesh.position.set(tileX, tileY, 0.016);
    mesh.name = `VRMenuTile_${def.id}`;
    mesh.userData.vrMenuActionId = def.id;
    mesh.userData.vrMenuLabel = `${def.icon} ${def.title}`;
    mesh.renderOrder = 21;

    root.add(mesh);
    buttonMeshes.push(mesh);
    tiles.push({ def, mesh, canvas: c, ctx, tex, mat, lastSig: '' });
  }

  let lastHeaderSig = '';

  const redrawHeader = (opts: VRMainMenuUpdateOptions) => {
    const gameName =
      opts.currentGameId === 'doors'
        ? 'DOORS: ОТЕЛЬ'
        : opts.currentGameId === 'bee_swarm'
        ? 'ПАСЕКА 3D'
        : opts.currentGameId === 'lava_survival'
        ? 'ЛАВА 3D'
        : opts.currentGameId === 'studio'
        ? 'СТУДИЯ 3D'
        : 'ПАРКУР OBBY';
    const sig = `${gameName}|${Math.round(opts.hp)}|${Math.round(opts.coins)}|${opts.heightOffset.toFixed(2)}`;
    if (sig === lastHeaderSig) return;
    lastHeaderSig = sig;

    if (!headerCtx || !headerTex) return;
    headerCtx.clearRect(0, 0, 1024, 160);
    headerCtx.fillStyle = '#0c162d';
    headerCtx.fillRect(0, 0, 1024, 160);
    headerCtx.strokeStyle = 'rgba(56, 189, 248, 0.55)';
    headerCtx.lineWidth = 4;
    headerCtx.strokeRect(2, 2, 1020, 156);

    headerCtx.fillStyle = '#38bdf8';
    headerCtx.font = '900 36px sans-serif';
    headerCtx.textAlign = 'left';
    headerCtx.fillText('🥽 BLOX WORLD VR — ГЛАВНОЕ МЕНЮ', 28, 56, 968);

    headerCtx.fillStyle = '#cbd5e1';
    headerCtx.font = '700 21px sans-serif';
    headerCtx.fillText(
      'Луч + Курок (Trigger) — выбор · [X] закрыть меню · [Y] скрыть памятку',
      28,
      100,
      968
    );

    headerCtx.fillStyle = '#fbbf24';
    headerCtx.font = '900 23px monospace';
    headerCtx.textAlign = 'right';
    headerCtx.fillText(
      `МИР: ${gameName}  ·  ❤️ ${Math.round(opts.hp)}  ·  🪙 ${Math.round(opts.coins)}  ·  📏 +${opts.heightOffset.toFixed(2)}м`,
      996,
      142,
      968
    );

    headerTex.needsUpdate = true;
  };

  const redrawTile = (tile: TileHandle, opts: VRMainMenuUpdateOptions) => {
    const isHovered = opts.hoveredActionId === tile.def.id;
    const isActiveGame = Boolean(tile.def.gameId && tile.def.gameId === opts.currentGameId);

    // Pop tile forward smoothly toward viewer on hover
    tile.mesh.position.z = isHovered ? 0.036 : isActiveGame ? 0.022 : 0.016;
    tile.mesh.scale.setScalar(isHovered ? 1.045 : 1.0);

    let dynamicSub = tile.def.subtitle;
    if (tile.def.id === 'action:toggle_hint') {
      dynamicSub = opts.controlsHintVisible ? 'Сейчас: ВКЛ' : 'Сейчас: ВЫКЛ';
    } else if (tile.def.id === 'action:toggle_portal_gun') {
      dynamicSub = opts.portalGunActive ? '✓ В РУКЕ (R🔵/L🟠)' : 'Взять пушку!';
    } else if (tile.def.id === 'action:toggle_tracking') {
      dynamicSub = opts.trackingMode === 'hands' ? 'Сейчас: Руки' : 'Сейчас: Пульты';
    } else if (tile.def.id === 'action:height_auto') {
      dynamicSub = `Рост +${opts.heightOffset.toFixed(2)}м`;
    } else if (isActiveGame) {
      dynamicSub = '✓ СЕЙЧАС ТУТ';
    }

    const sig = `${isHovered ? 1 : 0}|${isActiveGame ? 1 : 0}|${opts.portalGunActive ? 1 : 0}|${dynamicSub}`;
    if (sig === tile.lastSig) return;
    tile.lastSig = sig;

    if (!tile.ctx || !tile.tex) return;
    const ctx = tile.ctx;
    ctx.clearRect(0, 0, 256, 160);

    if (isHovered) {
      ctx.fillStyle = '#1d4ed8';
    } else if (isActiveGame || (tile.def.id === 'action:toggle_portal_gun' && opts.portalGunActive)) {
      ctx.fillStyle = '#064e3b';
    } else if (tile.def.id === 'action:exit_main_menu') {
      ctx.fillStyle = '#4c0519';
    } else if (tile.def.id === 'action:resume') {
      ctx.fillStyle = '#052e16';
    } else {
      ctx.fillStyle = '#0f172a';
    }
    ctx.fillRect(0, 0, 256, 160);

    ctx.strokeStyle = isHovered ? '#ffffff' : isActiveGame ? '#34d399' : tile.def.accentHex;
    ctx.lineWidth = isHovered ? 10 : 6;
    ctx.strokeRect(5, 5, 246, 150);

    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 44px sans-serif';
    ctx.fillText(tile.def.icon, 128, 60);

    ctx.font = '900 26px sans-serif';
    ctx.fillStyle = isHovered ? '#fef08a' : '#ffffff';
    ctx.fillText(tile.def.title.slice(0, 15), 128, 104);

    ctx.font = '800 20px sans-serif';
    ctx.fillStyle = isHovered ? '#e0f2fe' : isActiveGame ? '#6ee7b7' : '#cbd5e1';
    ctx.fillText(dynamicSub.slice(0, 18), 128, 138);

    tile.tex.needsUpdate = true;
  };

  const updateMenu = (opts: VRMainMenuUpdateOptions) => {
    root.visible = opts.visible;
    if (!opts.visible) return;
    redrawHeader(opts);
    for (let i = 0; i < tiles.length; i++) {
      redrawTile(tiles[i], opts);
    }
  };

  const placeInFrontOfHead = (
    headWorldPos: readonly [number, number, number],
    lookWorldDir: readonly [number, number, number],
    distance: number = 1.65
  ) => {
    const placement = computeVRMenuPlacement(headWorldPos, lookWorldDir, distance);
    root.position.set(placement.position[0], placement.position[1], placement.position[2]);
    root.rotation.set(0, placement.yaw, 0);
    root.updateMatrixWorld(true);
  };

  disableRigFrustumCulling(root);

  return { root, buttonMeshes, updateMenu, placeInFrontOfHead };
}

