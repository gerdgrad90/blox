import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  createInitialVRState,
  createVRControllerAndHandRig,
  createVRAlertHUD,
  createVRControlsCard3D,
  createVRMainMenu3D,
  VR_MAIN_MENU_ITEMS,
  computeVRMenuPlacement,
  calibrateVRHeightOffset,
  computeVRXROriginY,
  computeVRControllerPoseFromPointer,
  computeVRGazeMovementAxes,
  computeVRWorldGazeDirection,
  convertXRSpacePoseToCameraLocal,
  computeSnapTurnYaw,
  computeStereoEyeOffset,
  computeFloorTeleportTarget,
  computeComfortVignetteIntensity,
  detectVRHeadsetProfile,
  parseXRGamepadState,
  resolveVRHeadPoseInOrigin,
} from './vr';
import { VR_TUTORIAL_STEPS, formatBindingControlLabel } from './vrTutorial';
import {
  VRHandJointSample,
  VR_GESTURE_DEFINITIONS,
  classifyHandJointGesture,
  createVRGestureRecognizer,
  detectControllerGestureHint,
  mapEmoteIdToVRGesture,
} from './vrGestures';
import { isValidEmoteId } from './emotes';

test('createInitialVRState initializes valid default PICO 4 6DoF poses and settings', () => {
  const state = createInitialVRState();
  assert.equal(state.enabled, false);
  assert.equal(state.trackingMode, 'controllers');
  assert.equal(state.controllerProfile, 'pico4');
  assert.equal(state.picoGuardianVisible, true);
  assert.equal(state.displayMode, 'mono_6dof');
  assert.equal(state.snapTurnDegrees, 45);
  assert.equal(state.ipdMm, 64);
  assert.equal(state.heightOffset, 1.75);
  assert.equal(state.performanceMode, true);
  assert.equal(state.controlsHintVisible, true);
  assert.equal(state.activeGesture, null);
  assert.equal(state.activeGestureLabel, null);
  assert.equal(state.leftController.isPointing, true);
  assert.equal(state.rightController.isPointing, true);
  assert.ok(state.leftController.position[0] < 0, 'Left controller should be on negative X');
  assert.ok(state.rightController.position[0] > 0, 'Right controller should be on positive X');
});

test('detectVRHeadsetProfile detects PICO 4, PICO Neo 3, and Quest profiles accurately', () => {
  const pico4 = detectVRHeadsetProfile('Mozilla/5.0 (Linux; Android 12; PICO 4) PicoBrowser/3.4', ['pico-4']);
  assert.equal(pico4.profile, 'pico4');
  assert.ok(pico4.label.includes('PICO 4'));

  const picoNeo = detectVRHeadsetProfile('', ['pico-neo3', 'generic-trigger-squeeze-thumbstick']);
  assert.equal(picoNeo.profile, 'pico4');

  const quest = detectVRHeadsetProfile('Mozilla/5.0 (X11; Linux x86_64; Quest 3) OculusBrowser', ['meta-quest-touch-plus']);
  assert.equal(quest.profile, 'quest_touch');
});

test('parseXRGamepadState parses PICO 4 / WebXR xr-standard buttons and thumbstick axes with deadzone', () => {
  const parsed = parseXRGamepadState(
    [
      { value: 0.92, pressed: true }, // Trigger
      { value: 0.65, pressed: true }, // Grip
      { value: 0, pressed: false }, // Menu
      { value: 1, pressed: true }, // Stick press
      { value: 1, pressed: true }, // X / A
      { value: 0, pressed: false }, // Y / B
    ],
    [0, 0, -0.78, 0.05], // axes[2]=-0.78, axes[3]=0.05 (inside 0.12 deadzone -> 0)
    0.12
  );
  assert.equal(parsed.trigger, 0.92);
  assert.equal(parsed.grip, 0.65);
  assert.deepEqual(parsed.thumbstick, [-0.78, 0]);
  assert.equal(parsed.buttonPrimary, true);
  assert.equal(parsed.buttonSecondary, false);
  assert.equal(parsed.thumbstickPressed, true);
});

test('computeVRControllerPoseFromPointer computes responsive 6DoF pose for left and right controllers', () => {
  const leftPose = computeVRControllerPoseFromPointer(-0.5, 0.4, 'left', 1.0, 0.85, 0.5, 0.7);
  const rightPose = computeVRControllerPoseFromPointer(0.6, -0.3, 'right', 1.0, 0.9, 0.2, 0.8);

  assert.equal(leftPose.localPos.length, 3);
  assert.equal(leftPose.localRotRad.length, 3);
  assert.equal(leftPose.localRotDeg.length, 3);
  assert.ok(leftPose.localPos[0] < 0);
  assert.ok(leftPose.localPos[2] < -0.3);

  assert.ok(rightPose.localPos[0] > 0);
  assert.ok(rightPose.localPos[2] < -0.3);
});

test('convertXRSpacePoseToCameraLocal keeps PICO hands anchored to head and rejects untracked or outlier poses', () => {
  // 1. Standing user in local-floor space: HMD at y=1.6m facing forward (-Z), right hand at [0.25, 1.25, -0.45]
  const rightHand = convertXRSpacePoseToCameraLocal(
    [0.25, 1.25, -0.45],
    [0, 0, 0, 1],
    [0, 1.6, 0],
    [0, 0, 0, 1]
  );
  assert.notEqual(rightHand, null);
  assert.deepEqual(rightHand?.localPos, [0.25, -0.35, -0.45]);

  // 2. Head rotated 90 deg right (-PI/2 around Y), hand remains physically in world +X right of chest [0.45, 1.3, 0]
  // Relative to right-facing camera (+X is forward, +Z is right), [0.45, 1.3, 0] relative to [0, 1.6, 0] is directly in front (local Z = -0.45)
  const qHeadRight90 = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -Math.PI / 2);
  const handTurned = convertXRSpacePoseToCameraLocal(
    [0.45, 1.3, 0],
    [0, 0, 0, 1],
    [0, 1.6, 0],
    [qHeadRight90.x, qHeadRight90.y, qHeadRight90.z, qHeadRight90.w]
  );
  assert.notEqual(handTurned, null);
  assert.ok(Math.abs((handTurned?.localPos[0] ?? 99) - 0) < 0.01);
  assert.ok(Math.abs((handTurned?.localPos[1] ?? 99) + 0.3) < 0.01);
  assert.ok(Math.abs((handTurned?.localPos[2] ?? 99) + 0.45) < 0.01);

  // 3. Rejects untracked (0,0,0) origin glitch while standing
  assert.equal(
    convertXRSpacePoseToCameraLocal([0, 0, 0], [0, 0, 0, 1], [0, 1.6, 0], [0, 0, 0, 1]),
    null
  );

  // 4. Rejects flying-away outlier > 2.8m from HMD
  assert.equal(
    convertXRSpacePoseToCameraLocal([12, 1.4, -30], [0, 0, 0, 1], [0, 1.6, 0], [0, 0, 0, 1]),
    null
  );

  // 5. Rejects NaN / non-finite coordinates
  assert.equal(
    convertXRSpacePoseToCameraLocal([NaN, 1.2, -0.4], [0, 0, 0, 1], [0, 1.6, 0], [0, 0, 0, 1]),
    null
  );
});

test('resolveVRHeadPoseInOrigin prefers live XRViewerPose and guards against stale world coordinates', () => {
  const qHead = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 4);
  // Prefers live viewer pose over stale desktop world camera coordinates
  const live = resolveVRHeadPoseInOrigin(
    [0.12, 1.68, -0.05],
    [qHead.x, qHead.y, qHead.z, qHead.w],
    [120, 42, -80],
    [0, 0, 0, 1]
  );
  assert.deepEqual(live.position, [0.12, 1.68, -0.05]);
  assert.ok(Math.abs(live.quaternion[1] - qHead.y) < 1e-5);

  // Falls back safely to standing head height if viewer pose is null and fallback has stale world coords
  const safeFallback = resolveVRHeadPoseInOrigin(null, null, [120, 42, -80], [0, 0, 0, 1], 1.62);
  assert.deepEqual(safeFallback.position, [0, 1.62, 0]);
  assert.deepEqual(safeFallback.quaternion, [0, 0, 0, 1]);
});

test('computeVRWorldGazeDirection composes VR origin yaw with live HMD orientation for gaze-relative movement', () => {
  // Origin yaw = 0, HMD turned 90 deg left (+PI/2 around Y) -> looking along -X
  const qLeft90 = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2);
  const gazeLeft = computeVRWorldGazeDirection(0, [qLeft90.x, qLeft90.y, qLeft90.z, qLeft90.w]);
  assert.ok(Math.abs(gazeLeft[0] + 1) < 1e-4);
  assert.ok(Math.abs(gazeLeft[1]) < 1e-4);
  assert.ok(Math.abs(gazeLeft[2]) < 1e-4);

  // Origin snap-turned 90 deg left (+PI/2), AND HMD turned 90 deg left -> looking along +Z
  const gazeBack = computeVRWorldGazeDirection(Math.PI / 2, [qLeft90.x, qLeft90.y, qLeft90.z, qLeft90.w]);
  assert.ok(Math.abs(gazeBack[0]) < 1e-4);
  assert.ok(Math.abs(gazeBack[2] - 1) < 1e-4);

  // Resulting horizontal movement axes match world gaze forward vector
  const axes = computeVRGazeMovementAxes(gazeBack, 0);
  assert.ok(Math.abs(axes.forward[0]) < 1e-4);
  assert.ok(Math.abs(axes.forward[2] - 1) < 1e-4);
  // Facing +Z, right vector is -X
  assert.ok(Math.abs(axes.right[0] + 1) < 1e-4);
});

test('createVRControllerAndHandRig disables frustum culling on all hand/controller meshes so hands stay visible', () => {
  const leftRig = createVRControllerAndHandRig('left');
  let checkedCount = 0;
  leftRig.root.traverse((obj) => {
    assert.equal(obj.frustumCulled, false);
    checkedCount++;
  });
  assert.ok(checkedCount > 10);
});

test('computeVRGazeMovementAxes projects headset look direction horizontally onto XZ plane for gaze locomotion', () => {
  // Looking straight forward (-Z)
  const straight = computeVRGazeMovementAxes([0, 0, -1], 0);
  assert.deepEqual(straight.forward, [0, 0, -1]);
  assert.deepEqual(straight.right, [1, 0, 0]);

  // Head physically turned 90 deg left (-X) and tilted downward 45 deg even though fallbackYaw is 0
  const turnedLeftDown = computeVRGazeMovementAxes([-0.7071, -0.7071, 0], 0);
  assert.ok(Math.abs(turnedLeftDown.forward[0] + 1) < 1e-4);
  assert.equal(turnedLeftDown.forward[1], 0);
  assert.ok(Math.abs(turnedLeftDown.forward[2]) < 1e-4);
  // Facing -X, right hand side points toward -Z
  assert.ok(Math.abs(turnedLeftDown.right[2] + 1) < 1e-4);

  // Looking straight down -> gracefully falls back to fallbackYaw = Math.PI (+Z forward)
  const straightDown = computeVRGazeMovementAxes([0, -1, 0], Math.PI);
  assert.ok(Math.abs(straightDown.forward[0]) < 1e-4);
  assert.ok(Math.abs(straightDown.forward[2] - 1) < 1e-4);
});

test('computeSnapTurnYaw snaps yaw cleanly in radians', () => {
  const yaw0 = 0;
  const snappedLeft45 = computeSnapTurnYaw(yaw0, -1, 45);
  const snappedRight45 = computeSnapTurnYaw(yaw0, 1, 45);

  assert.ok(Math.abs(snappedLeft45 - Math.PI / 4) < 1e-6);
  assert.ok(Math.abs(snappedRight45 + Math.PI / 4) < 1e-6);
});

test('computeStereoEyeOffset converts IPD mm to per-eye world offset', () => {
  const offset64 = computeStereoEyeOffset(64);
  assert.ok(offset64 > 0.04 && offset64 < 0.07);
  const offsetMin = computeStereoEyeOffset(40); // clamped to 50mm
  const offsetMax = computeStereoEyeOffset(90); // clamped to 78mm
  assert.ok(offsetMin < offset64);
  assert.ok(offsetMax > offset64);
});

test('computeFloorTeleportTarget intersects floor plane inside valid range', () => {
  const origin: [number, number, number] = [0, 1.6, 0];
  const dirDownForward: [number, number, number] = [0, -0.38, -0.92];
  const target = computeFloorTeleportTarget(origin, dirDownForward, 0, 18);
  assert.notEqual(target, null);
  assert.equal(target?.[1], 0);
  assert.ok((target?.[2] ?? 0) < -1.0);

  // Pointing up should return null
  const dirUp: [number, number, number] = [0, 0.5, -0.86];
  assert.equal(computeFloorTeleportTarget(origin, dirUp, 0, 18), null);
});

test('computeComfortVignetteIntensity responds to movement, angular velocity, and teleport flash', () => {
  assert.equal(computeComfortVignetteIntensity(0, 0, false, false), 0);
  const moving = computeComfortVignetteIntensity(12, 1.8, false, true);
  assert.ok(moving > 0.25 && moving <= 0.68);
  const flash = computeComfortVignetteIntensity(0, 0, true, true);
  assert.equal(flash, 0.68);
});

test('VR_TUTORIAL_STEPS covers movement, interaction, and menus with valid PICO/Quest/Hand bindings', () => {
  assert.deepEqual(
    VR_TUTORIAL_STEPS.map((s) => s.id),
    ['movement', 'interaction', 'menus']
  );

  for (const step of VR_TUTORIAL_STEPS) {
    assert.ok(step.bindings.length >= 3, `Step ${step.id} should document at least 3 controls`);
    for (const b of step.bindings) {
      const picoText = formatBindingControlLabel(b, 'pico4', 'controllers');
      const questText = formatBindingControlLabel(b, 'quest_touch', 'controllers');
      const handText = formatBindingControlLabel(b, 'pico4', 'hands');
      assert.ok(picoText.trim().length > 0);
      assert.ok(questText.trim().length > 0);
      assert.ok(handText.trim().length > 0);
    }
  }
});

test('VR_GESTURE_DEFINITIONS map cleanly to valid multiplayer emote IDs', () => {
  assert.ok(VR_GESTURE_DEFINITIONS.length >= 4);
  for (const g of VR_GESTURE_DEFINITIONS) {
    assert.ok(isValidEmoteId(g.emoteId), `Expected ${g.emoteId} to be a valid EmoteId`);
    assert.equal(mapEmoteIdToVRGesture(g.emoteId), g.id);
  }
});

test('classifyHandJointGesture classifies thumbs_up, peace, wave, salute, cheer, and neutral hand poses', () => {
  const baseKnuckles: VRHandJointSample = {
    wrist: [0, 1.3, -0.4],
    thumbBase: [-0.03, 1.33, -0.4],
    thumbTip: [-0.05, 1.35, -0.43],
    indexKnuckle: [-0.02, 1.3, -0.47],
    indexTip: [-0.02, 1.3, -0.53],
    middleKnuckle: [0, 1.3, -0.47],
    middleTip: [0, 1.3, -0.54],
    ringKnuckle: [0.02, 1.3, -0.47],
    ringTip: [0.02, 1.3, -0.53],
    pinkyKnuckle: [0.04, 1.3, -0.46],
    pinkyTip: [0.04, 1.3, -0.52],
  };

  // Thumbs up: 4 fingers curled close to wrist, thumb tip pointing straight up
  const thumbsUpPose: VRHandJointSample = {
    ...baseKnuckles,
    thumbBase: [-0.02, 1.32, -0.42],
    thumbTip: [-0.02, 1.4, -0.42],
    indexTip: [-0.02, 1.3, -0.44],
    middleTip: [0, 1.3, -0.44],
    ringTip: [0.02, 1.3, -0.44],
    pinkyTip: [0.04, 1.3, -0.44],
  };
  assert.equal(classifyHandJointGesture(thumbsUpPose, { lateralSpeed: 0.05, handHeightRelativeToHead: -0.25 }), 'thumbs_up');

  // Peace sign: index and middle extended, ring and pinky curled
  const peacePose: VRHandJointSample = {
    ...baseKnuckles,
    thumbBase: [-0.02, 1.32, -0.42],
    thumbTip: [0, 1.31, -0.43],
    ringTip: [0.02, 1.3, -0.44],
    pinkyTip: [0.04, 1.3, -0.44],
  };
  assert.equal(classifyHandJointGesture(peacePose, { lateralSpeed: 0.05, handHeightRelativeToHead: -0.25 }), 'peace');

  // Wave: all 4 open + lateral motion
  assert.equal(classifyHandJointGesture(baseKnuckles, { lateralSpeed: 0.55, handHeightRelativeToHead: -0.2 }), 'wave');

  // Salute: all 4 open held steady at temple height
  assert.equal(classifyHandJointGesture(baseKnuckles, { lateralSpeed: 0.05, handHeightRelativeToHead: 0.08 }), 'salute');

  // Cheer: open palm raised high above head
  assert.equal(classifyHandJointGesture(baseKnuckles, { lateralSpeed: 0.1, handHeightRelativeToHead: 0.35 }), 'cheer');

  // Neutral idle open hand at waist height stays null
  assert.equal(classifyHandJointGesture(baseKnuckles, { lateralSpeed: 0.05, handHeightRelativeToHead: -0.35 }), null);
});

test('detectControllerGestureHint & createVRGestureRecognizer debounce and cooldown correctly', () => {
  assert.equal(
    detectControllerGestureHint({
      rightGrip: 0.9,
      rightTrigger: 0,
      waveOscillationEnergy: 0,
    }),
    'thumbs_up'
  );
  assert.equal(
    detectControllerGestureHint({
      rightGrip: 0,
      rightTrigger: 0,
      waveOscillationEnergy: 1.2,
    }),
    'wave'
  );
  assert.equal(
    detectControllerGestureHint({
      rightGrip: 0.9,
      rightTrigger: 0.85,
      waveOscillationEnergy: 0,
    }),
    null
  );

  const recognizer = createVRGestureRecognizer(0.2, 1.5);
  assert.equal(recognizer.update(0.1, 'thumbs_up'), null);
  assert.equal(recognizer.update(0.12, 'thumbs_up'), 'thumbs_up');
  // Holding continuously stays latched until returning to neutral
  assert.equal(recognizer.update(0.25, 'thumbs_up'), null);
  assert.equal(recognizer.update(0.25, null), null);
  // Still inside 1.5s cooldown (1.0s remaining)
  assert.equal(recognizer.update(0.25, 'peace'), null);
  // Advance remaining cooldown (4 * 0.25s = 1.0s)
  for (let i = 0; i < 4; i++) {
    recognizer.update(0.25, null);
  }
  // After cooldown clears, holding peace for dwell time fires
  assert.equal(recognizer.update(0.1, 'peace'), null);
  assert.equal(recognizer.update(0.12, 'peace'), 'peace');
});

test('calibrateVRHeightOffset and computeVRXROriginY lift WebXR eyes to Roblox standing height and handle crouching', () => {
  // Real standing headset eye height 1.55m -> +1.8m offset to match 3.35 eye height
  assert.equal(calibrateVRHeightOffset(1.55), 1.8);
  // Seated play at 1.05m -> +2.3m offset
  assert.equal(calibrateVRHeightOffset(1.05), 2.3);
  // Clamping upper/lower bounds (0..3.0)
  assert.equal(calibrateVRHeightOffset(0.2), 3);
  assert.equal(calibrateVRHeightOffset(3.5), 0);

  // World Y for vrXROrigin standing vs crouched
  assert.ok(Math.abs(computeVRXROriginY(0, 1.8, false) - 1.8) < 1e-6);
  assert.ok(Math.abs(computeVRXROriginY(0, 1.8, true) - 0.7) < 1e-6);
  assert.ok(Math.abs(computeVRXROriginY(10, 1.75, false) - 11.75) < 1e-6);
});

test('PICO 4 3D controller rig builds teardrop faceplate, diagonal tracking arch, and handles rushAlert pulse', () => {
  const leftRig = createVRControllerAndHandRig('left');
  const rightRig = createVRControllerAndHandRig('right');

  assert.ok(leftRig.picoControllerVisual.getObjectByName('Pico4Faceplate_left'));
  assert.ok(leftRig.picoControllerVisual.getObjectByName('Pico4TrackingArch_left'));
  assert.ok(rightRig.picoControllerVisual.getObjectByName('Pico4Faceplate_right'));
  assert.ok(rightRig.picoControllerVisual.getObjectByName('Pico4TrackingArch_right'));

  // Exercising setPoseState with rushAlert true and false should never throw
  leftRig.setPoseState({
    trackingMode: 'controllers',
    controllerProfile: 'pico4',
    trigger: 0.5,
    grip: 0.3,
    thumbstick: [0.2, -0.4],
    buttonPrimary: true,
    buttonSecondary: false,
    laserVisible: true,
    laserLength: 4.5,
    hasHit: true,
    animTime: 1.25,
    rushAlert: true,
  });
  assert.equal(leftRig.picoControllerVisual.visible, true);
  leftRig.setPoseState({
    trackingMode: 'controllers',
    controllerProfile: 'pico4',
    trigger: 0,
    grip: 0,
    thumbstick: [0, 0],
    laserVisible: true,
    laserLength: 4.5,
    hasHit: false,
    animTime: 2.0,
    rushAlert: false,
  });
});

test('createVRAlertHUD and createVRControlsCard3D build safely with frustumCulled=false and visibility toggles', () => {
  const alertHud = createVRAlertHUD();
  assert.equal(alertHud.root.visible, false);
  alertHud.root.traverse((obj) => {
    assert.equal(obj.frustumCulled, false);
  });
  alertHud.updateAlert({
    visible: true,
    tone: 'danger',
    headline: 'РАШ ЧЕРЕЗ 3.5с!',
    subline: 'В ШКАФ!',
    pulsePhase: 1.0,
  });
  assert.equal(alertHud.root.visible, true);
  alertHud.updateAlert({ visible: false, tone: 'danger', headline: '', subline: '' });
  assert.equal(alertHud.root.visible, false);

  const controlsCard = createVRControlsCard3D();
  assert.equal(controlsCard.root.visible, false);
  controlsCard.root.traverse((obj) => {
    assert.equal(obj.frustumCulled, false);
  });
  controlsCard.updateCard({ visible: true, gameId: 'doors', profile: 'pico4' });
  assert.equal(controlsCard.root.visible, true);
  controlsCard.updateCard({ visible: false, gameId: 'doors', profile: 'pico4' });
  assert.equal(controlsCard.root.visible, false);
});

test('computeVRMenuPlacement spawns floating VR menu directly ahead of gaze facing the player', () => {
  // Looking straight along -Z from (0, 3.35, 0)
  const ahead = computeVRMenuPlacement([0, 3.35, 0], [0, -0.4, -1], 1.65);
  assert.ok(Math.abs(ahead.position[0] - 0) < 1e-4);
  assert.ok(Math.abs(ahead.position[1] - 3.27) < 1e-4);
  assert.ok(Math.abs(ahead.position[2] - -1.65) < 1e-4);
  // Facing back toward +Z -> yaw = 0
  assert.ok(Math.abs(ahead.yaw - 0) < 1e-4);

  // Looking straight along +X from (2, 3.0, 5)
  const right = computeVRMenuPlacement([2, 3.0, 5], [1, 0, 0], 2.0);
  assert.ok(Math.abs(right.position[0] - 4.0) < 1e-4);
  assert.ok(Math.abs(right.position[2] - 5.0) < 1e-4);
  // Front face (+Z) rotated by -PI/2 points toward -X (back to player)
  assert.ok(Math.abs(right.yaw - -Math.PI / 2) < 1e-4);
});

test('createVRMainMenu3D creates 14 raycastable 3D tiles with frustumCulled=false, hover pop, and game/nav/portal actions', () => {
  const initialState = createInitialVRState();
  assert.equal(initialState.vrMenuOpen, false);

  const menu = createVRMainMenu3D();
  assert.equal(menu.root.visible, false);
  assert.equal(menu.buttonMeshes.length, VR_MAIN_MENU_ITEMS.length);
  assert.equal(menu.buttonMeshes.length, 14);

  menu.root.traverse((obj) => {
    assert.equal(obj.frustumCulled, false);
  });

  const actionIds = new Set(menu.buttonMeshes.map((m) => m.userData.vrMenuActionId));
  assert.ok(actionIds.has('game:doors'));
  assert.ok(actionIds.has('game:obby'));
  assert.ok(actionIds.has('game:lava_survival'));
  assert.ok(actionIds.has('game:bee_swarm'));
  assert.ok(actionIds.has('game:studio'));
  assert.ok(actionIds.has('action:toggle_hint'));
  assert.ok(actionIds.has('action:toggle_portal_gun'));
  assert.ok(actionIds.has('action:height_up'));
  assert.ok(actionIds.has('action:height_down'));
  assert.ok(actionIds.has('action:height_auto'));
  assert.ok(actionIds.has('action:exit_main_menu'));
  assert.ok(actionIds.has('action:resume'));

  menu.placeInFrontOfHead([0, 3.35, 0], [0, 0, -1], 1.65);
  assert.ok(Math.abs(menu.root.position.z - -1.65) < 1e-4);

  menu.updateMenu({
    visible: true,
    currentGameId: 'doors',
    hp: 100,
    coins: 250,
    heightOffset: 1.75,
    controlsHintVisible: true,
    trackingMode: 'controllers',
    hoveredActionId: 'action:exit_main_menu',
  });
  assert.equal(menu.root.visible, true);

  const exitTile = menu.buttonMeshes.find((m) => m.userData.vrMenuActionId === 'action:exit_main_menu')!;
  const resumeTile = menu.buttonMeshes.find((m) => m.userData.vrMenuActionId === 'action:resume')!;
  assert.ok(exitTile.position.z > resumeTile.position.z, 'Hovered 3D VR menu tile must pop forward');

  menu.updateMenu({
    visible: false,
    currentGameId: 'doors',
    hp: 100,
    coins: 250,
    heightOffset: 1.75,
    controlsHintVisible: false,
    trackingMode: 'hands',
    hoveredActionId: null,
  });
  assert.equal(menu.root.visible, false);
});



