import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { CharacterSkin, Checkpoint, CollectibleItem, GameId, ObstacleHazard, PlacedBlock, PlayerStats, RemotePlayerInfo, SurfaceType, ToolType, Achievement, BeePet, BeeFarmState, FlowerFieldZone, DoorsGameState, DoorsRoomTypeId, DOORS_ROOMS_ATLAS } from './types';
import { RobloxAvatar } from './avatar';
import { buildGameWorld, createBloxWorld, rebuildStudioWorldObjects, WorldBuildResult } from './world';
import {
  STUDIO_MAX_OBJECTS,
  StudioMaterialKind,
  StudioObject,
  StudioObjectKind,
  StudioProject,
  StudioRuntimeState,
  StudioSkyPreset,
  StudioTemplateId,
  StudioToolMode,
  cloneStudioObjects,
  computeStudioSnapPosition,
  createStudioObjectId,
  createTemplateProject,
  exportStudioProjectJson,
  getRotatedStudioFootprint,
  importStudioProjectJson,
  loadStudioProject,
  normalizeStudioRotationY,
  saveStudioProject,
} from './studio';
import { getDoorsRoomDefByDoorNumber, getDoorsRoomDefByZ } from './doorsRooms';
import { sound } from './audio';
import {
  checkAABBIntersection,
  getPlayerGravity,
  getPlayerJumpForce,
  getPlayerSpeed,
  hasFallenIntoVoid,
  isItemCollected,
  snapToGrid,
} from './rules';
import { ACHIEVEMENTS_REGISTRY, getStoredUnlockedAchievements, saveUnlockedAchievement } from './achievements';
import { getPlayerTitleById } from './titles';
import { KeybindsConfig, getKeybinds, isUserAdmin } from './controls';
import { EmoteId, getEmoteById, isValidEmoteId } from './emotes';
import { advanceQuestProgress, QuestCategory } from './quests';
import {
  VRControllerMeshRig,
  VRControllerPoseResult,
  VRControllerProfile,
  VRDisplayMode,
  VRMenuActionId,
  VRState,
  VRTrackingMode,
  computeComfortVignetteIntensity,
  VR_DEFAULT_HEIGHT_OFFSET,
  VR_MAX_HEIGHT_OFFSET,
  VR_MIN_HEIGHT_OFFSET,
  calibrateVRHeightOffset,
  computeFloorTeleportTarget,
  computeSnapTurnYaw,
  computeStereoEyeOffset,
  computeVRControllerPoseFromPointer,
  computeVRGazeMovementAxes,
  computeVRWorldGazeDirection,
  computeVRXROriginY,
  convertXRSpacePoseToCameraLocal,
  createInitialVRState,
  createPicoGuardianBoundaryRing,
  createVRAlertHUD,
  createVRControllerAndHandRig,
  createVRControlsCard3D,
  createVRMainMenu3D,
  createVRRightHandToolModel,
  createVRTeleportReticle,
  createVRWristWatchHUD,
  detectVRHeadsetProfile,
  parseXRGamepadState,
  resolveVRHeadPoseInOrigin,
} from './vr';
import {
  PortalAnchorState,
  PortalKind,
  PortalRuntimeState,
  computePortalSurfaceTransform,
  createInitialPortalState,
  createPortalMesh3D,
  createPortalShotBeam3D,
  evaluatePortalTransit,
} from './portals';
import {
  VRHandGestureId,
  classifyHandJointGesture,
  createVRGestureRecognizer,
  detectControllerGestureHint,
  getVRGestureDefinition,
  mapEmoteIdToVRGesture,
} from './vrGestures';

export interface GameEngineCallbacks {
  onStatsUpdate: (stats: PlayerStats) => void;
  onCheckpointReached: (checkpoint: Checkpoint) => void;
  onChatMessage: (message: string, author?: string) => void;
  onVictory: (finalStats: PlayerStats) => void;
  onToolChanged: (tool: ToolType) => void;
  onBeeFarmUpdate?: (state: BeeFarmState) => void;
  onDoorsStateUpdate?: (state: DoorsGameState) => void;
  onAchievementUnlocked?: (achievementId: string, achievement: Achievement) => void;
  onLocalMove?: (state: {
    position: [number, number, number];
    rotationY: number;
    isMoving: boolean;
    isGrounded: boolean;
    activeTool: ToolType;
    checkpoint: number;
    coins: number;
  }) => void;
  onLocalAttack?: () => void;
  onLocalBlockPlace?: (key: string, position: [number, number, number], color: string) => void;
  onLocalBlockRemove?: (key: string) => void;
  onLocalDoorOpen?: (doorIndex: number, doorNumber: number) => void;
  onLocalElevatorClose?: () => void;
  onVRStateUpdate?: (state: VRState) => void;
  onVRGestureEmote?: (emoteId: EmoteId, durationMs: number, gestureId: VRHandGestureId) => void;
  onVRSwitchGame?: (gameId: GameId) => void;
  onVRReturnToTitle?: () => void;
  onPortalStateUpdate?: (state: PortalRuntimeState) => void;
  onStudioStateChange?: (state: StudioRuntimeState) => void;
}

export class GameEngine {
  private mountEl: HTMLElement;
  private callbacks: GameEngineCallbacks;

  // Three.js Core
  public renderer: THREE.WebGLRenderer;
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;
  public camera2: THREE.PerspectiveCamera;
  private sunLight: THREE.DirectionalLight;
  private hemiLight: THREE.HemisphereLight;
  private isSoftwareGl: boolean = false;
  private frameId: number = 0;
  private isDestroyed: boolean = false;

  // World elements
  private worldData: WorldBuildResult;
  public currentGameId: GameId = 'obby';
  public avatar: RobloxAvatar;
  private playerSkin: CharacterSkin;

  // Player Physics & State
  public playerPos: THREE.Vector3 = new THREE.Vector3(0, 1.5, 0);
  public playerVel: THREE.Vector3 = new THREE.Vector3(0, 0, 0);
  public isGrounded: boolean = false;
  public coyoteTimer: number = 0;
  public jumpBufferTimer: number = 0;
  public activeTool: ToolType = 'sword';
  public currentCheckpointId: number = 0;
  public selectedBlockColor: string = '#ef4444';

  // Bee Farm Tycoon State & Companion Swarm
  public beeFarmState: BeeFarmState = {
    pollen: 0,
    maxPollen: 100,
    honey: 0,
    bees: [
      { id: 'bee_basic_1', name: 'Базовая Пчёлка', type: 'basic', level: 1, color: '#facc15', speed: 1.0, gatherPower: 1 },
    ],
    scooperLevel: 1,
    scooperName: 'Деревянный Совок',
    scooperPower: 2,
    hiveLevel: 1,
    currentField: null,
  };
  private beeGroup: THREE.Group = new THREE.Group();
  private beeMeshes: THREE.Group[] = [];
  private beeAutoGatherTimer: number = 0;

  // Roblox DOORS (First-Person Horror Hotel) State
  public doorsState: DoorsGameState = {
    currentDoorNumber: 1,
    isCrouching: false,
    isHidingInCloset: false,
    flashlightOn: true,
    lightFlickerIntensity: 0,
    activeEntity: 'none',
    entityWarningText: null,
    screechActive: false,
    eyesActive: false,
    rushActive: false,
    silenceActive: false,
    gloomActive: false,
    inDoor100Room: false,
    figureDistance: 99,
    figureAlerted: false,
    nearInteractable: null,
    elevatorClosing: false,
    phaseName: 'СТОЙКА АДМИНИСТРАТОРА',
    currentRoomId: 'reception',
    currentRoomTitle: 'СТОЙКА АДМИНИСТРАТОРА',
    rushWarningSeconds: 0,
    rushDistanceMeters: 0,
  };
  private flashlightSpot: THREE.SpotLight | null = null;
  private flashlightTarget: THREE.Object3D = new THREE.Object3D();
  private rushWarningTimer: number = 0;
  private rushApproachStage: number = 0;
  private rushZ: number = -100;
  private rushTargetZ: number = -100;
  private rushHitPlayer: boolean = false;
  private screechTimer: number = 0;
  private eyesDamageCooldown: number = 0;
  private lastDoorsEmitSig: string = '';
  private doorsHudEmitTimer: number = 0;
  private figureStepTimer: number = 0;
  private elevatorCloseTimer: number = 0;
  private closetSavedPos: THREE.Vector3 | null = null;
  private floorCreakCooldown: number = 0;
  private currentSurface: SurfaceType = 'wood';
  private footstepTimer: number = 0;

  // Custom Keybinds & Admin Powers
  public keybinds: KeybindsConfig = getKeybinds();
  public isGodMode: boolean = false;
  public isFlying: boolean = false;
  public speedMultiplier: number = 1.0;
  public jumpMultiplier: number = 1.0;

  public stats: PlayerStats = {
    hp: 100,
    maxHp: 100,
    coins: 0,
    gems: 0,
    currentCheckpoint: 0,
    totalCheckpoints: 6,
    jumps: 0,
    deaths: 0,
    startTime: Date.now(),
    completionTime: 0,
  };

  // Camera Orbit Controls
  private cameraDistance: number = 10;
  private cameraYaw: number = 0; // Horizontal orbit angle (radians)
  private cameraPitch: number = 0.35; // Vertical orbit angle (radians)
  private isDraggingMouse: boolean = false;
  private lastMouseX: number = 0;
  private lastMouseY: number = 0;

  // Touch Camera & Pinch Zoom State
  private cameraTouchId: number | null = null;
  private lastTouchX: number = 0;
  private lastTouchY: number = 0;
  private lastPinchDist: number = 0;
  private resizeObserver: ResizeObserver | null = null;

  // Input states
  private keysHeld = new Set<string>();
  private justPressedKeys = new Set<string>();
  private joystickX: number = 0;
  private joystickY: number = 0;

  // Particle System
  private particlePool: THREE.InstancedMesh;
  private particleCount: number = 150;
  private particleData: { pos: THREE.Vector3; vel: THREE.Vector3; life: number; maxLife: number; color: THREE.Color }[] = [];
  private dummyShakeTimer: number = 0;
  private screenShakeTimer: number = 0;

  // Remote Multiplayer Avatars
  private remoteAvatars = new Map<
    string,
    {
      avatar: RobloxAvatar;
      info: RemotePlayerInfo;
      targetPos: THREE.Vector3;
      targetRotY: number;
    }
  >();

  // Local Co-op Player 2 (2 Players on 1 PC: WASD vs Arrows)
  public localCoopEnabled: boolean = false;
  public player2Avatar: RobloxAvatar | null = null;
  public p2Pos: THREE.Vector3 = new THREE.Vector3(2.5, 1.5, 0);
  public p2Vel: THREE.Vector3 = new THREE.Vector3(0, 0, 0);
  public p2Grounded: boolean = false;
  public p2JumpBuffer: number = 0;
  public p2CheckpointId: number = 0;
  private p2CameraYaw: number = Math.PI;
  private p2CameraPitch: number = 0.02;
  private p2Surface: SurfaceType = 'wood';
  private p2FootstepTimer: number = 0;

  // Achievement Tracking
  public consecutiveJumpsWithoutDeath: number = 0;
  private placedBlocksCount: number = 0;
  private speedSprintTime: number = 0;
  private lavaSurvivalTimer: number = 0;
  public unlockedAchievements: Set<string> = new Set();

  // VR & 6DoF Controller / Hand Tracking State & 3D Rigs
  public vrState: VRState = createInitialVRState();
  private vrCameraRig: THREE.Group = new THREE.Group();
  private vrLeftRig: VRControllerMeshRig;
  private vrRightRig: VRControllerMeshRig;
  private vrWristWatch: ReturnType<typeof createVRWristWatchHUD>;
  private vrRightTool: ReturnType<typeof createVRRightHandToolModel>;
  private vrTeleportReticle: ReturnType<typeof createVRTeleportReticle>;
  private vrPicoGuardian: ReturnType<typeof createPicoGuardianBoundaryRing>;
  private vrAlertHUD: ReturnType<typeof createVRAlertHUD>;
  private vrControlsCard: ReturnType<typeof createVRControlsCard3D>;
  private vrMainMenu: ReturnType<typeof createVRMainMenu3D>;
  // Spatial 3D Portal Gun system (Blue & Orange GLSL Wormhole Portals)
  public portalState: PortalRuntimeState = createInitialPortalState();
  private bluePortalAnchor: PortalAnchorState | null = null;
  private orangePortalAnchor: PortalAnchorState | null = null;
  private bluePortalMesh: ReturnType<typeof createPortalMesh3D>;
  private orangePortalMesh: ReturnType<typeof createPortalMesh3D>;
  private portalShotBeam: ReturnType<typeof createPortalShotBeam3D>;
  private portalCooldown: number = 0;
  private portalRaycaster = new THREE.Raycaster();
  private portalRightMouseDownPos: { x: number; y: number } | null = null;
  private portalLastEmitTime: number = 0;
  private vrPointerNormX: number = 0;
  private vrPointerNormY: number = 0;
  private vrTriggerDecay: number = 0;
  private vrGripDecay: number = 0;
  private vrTeleportFlashTimer: number = 0;
  private vrTelemetrySyncTimer: number = 0;
  private vrSnapTurnCooldown: number = 0;
  private vrPrevXrRightTrig: boolean = false;
  private vrPrevXrLeftTrig: boolean = false;
  private vrPrevXrLeftGrip: boolean = false;
  private vrPrevXrLeftPrimary: boolean = false;
  private vrPrevXrLeftSecondary: boolean = false;
  private vrPrevXrLeftThumb: boolean = false;
  private vrPrevXrPrimaryR: boolean = false;
  private vrPrevXrSecondaryR: boolean = false;
  private vrPrevXrLeftMenu: boolean = false;
  private vrMenuHoveredAction: VRMenuActionId | null = null;
  private vrNeedsHeightAutoCalibrate: boolean = false;
  private vrRaycastTimer: number = 0;
  private vrLastHitDist: number = 9.0;
  private vrLastHitLabel: string | null = null;
  private vrNearbyPlatformsCache: THREE.Mesh[] = [];
  private vrPrevCameraYaw: number = 0;
  private vrGestureRecognizer = createVRGestureRecognizer(0.24, 1.8);
  private vrActiveGestureTimer: number = 0;
  private vrPrevRightNormX: number = 0;
  private vrWaveOscillationEnergy: number = 0;
  private vrPrevXrRightHandX: number | null = null;
  private vrRaycaster: THREE.Raycaster = new THREE.Raycaster();
  private vrScratchOrigin: THREE.Vector3 = new THREE.Vector3();
  private vrScratchDir: THREE.Vector3 = new THREE.Vector3();
  private vrScratchQuat: THREE.Quaternion = new THREE.Quaternion();
  private vrScratchInvCamQuat: THREE.Quaternion = new THREE.Quaternion();
  private vrScratchEuler: THREE.Euler = new THREE.Euler(0, 0, 0, 'YXZ');
  private vrScratchRight: THREE.Vector3 = new THREE.Vector3();
  private vrScratchForward: THREE.Vector3 = new THREE.Vector3();
  private vrSavedCamPos: THREE.Vector3 = new THREE.Vector3();
  private vrHeadLocalPos: [number, number, number] = [0, 1.6, 0];
  private vrHeadLocalQuat: [number, number, number, number] = [0, 0, 0, 1];
  private vrHeadWorldPos: THREE.Vector3 = new THREE.Vector3();
  private vrHeadWorldQuat: THREE.Quaternion = new THREE.Quaternion();
  private vrMoveStickX: number = 0;
  private vrMoveStickY: number = 0;
  private vrLastXrLeftPose: { pose: VRControllerPoseResult; capturedAt: number } | null = null;
  private vrLastXrRightPose: { pose: VRControllerPoseResult; capturedAt: number } | null = null;
  private vrXROrigin: THREE.Group = new THREE.Group();
  private renderTickFn: (() => void) | null = null;
  private particlesDirtyFlag: boolean = false;
  private scratchParticleMat: THREE.Matrix4 = new THREE.Matrix4();
  private scratchParticleVec: THREE.Vector3 = new THREE.Vector3();
  private scratchParticleQuat: THREE.Quaternion = new THREE.Quaternion();
  private scratchCamTarget: THREE.Vector3 = new THREE.Vector3();
  private scratchCamDesired: THREE.Vector3 = new THREE.Vector3();
  private scratchCamLook: THREE.Vector3 = new THREE.Vector3();
  private scratchCamDir: THREE.Vector3 = new THREE.Vector3();
  private scratchShakeVec: THREE.Vector3 = new THREE.Vector3();
  private scratchP2Target: THREE.Vector3 = new THREE.Vector3();
  private scratchP2Desired: THREE.Vector3 = new THREE.Vector3();
  private scratchP2Dir: THREE.Vector3 = new THREE.Vector3();
  private scratchEyesDir: THREE.Vector3 = new THREE.Vector3();
  private scratchEyesToTarget: THREE.Vector3 = new THREE.Vector3();

  // Blox Studio 3D Editor & Playtest State
  public studioMode: 'edit' | 'play' = 'edit';
  private studioProject: StudioProject = loadStudioProject();
  private studioTool: StudioToolMode = 'place';
  private studioActiveKind: StudioObjectKind = 'block';
  private studioActiveColor: string = '#38bdf8';
  private studioActiveMaterial: StudioMaterialKind = 'plastic';
  private studioActiveSize: [number, number, number] = [2, 2, 2];
  private studioActiveRotationY: number = 0;
  private studioSelectedId: string | null = null;
  private studioUndoStack: StudioObject[][] = [];
  private studioRedoStack: StudioObject[][] = [];
  private studioCamTarget: THREE.Vector3 = new THREE.Vector3(0, 6, 16);
  private studioRaycaster: THREE.Raycaster = new THREE.Raycaster();
  private studioPreviewMesh: THREE.Mesh | null = null;
  private studioSelectionBox: THREE.BoxHelper | null = null;
  private studioMouseDownX: number = 0;
  private studioMouseDownY: number = 0;
  private studioMouseDownButton: number = -1;
  private studioMouseMovedDist: number = 0;

  // Clock
  private lastTime: number = performance.now();

  constructor(mountEl: HTMLElement, skin: CharacterSkin, callbacks: GameEngineCallbacks) {
    this.mountEl = mountEl;
    this.playerSkin = skin;
    this.callbacks = callbacks;
    this.unlockedAchievements = new Set(Object.keys(getStoredUnlockedAchievements()));

    // 1. Software WebGL Detection
    this.isSoftwareGl = (() => {
      try {
        const gl = document.createElement('canvas').getContext('webgl2');
        if (!gl) return true;
        const ext = gl.getExtension('WEBGL_debug_renderer_info');
        const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
        const gpu = String(gl.getParameter(param));
        gl.getExtension('WEBGL_lose_context')?.loseContext();
        return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
      } catch {
        return true;
      }
    })();

    // 2. Renderer setup
    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
      alpha: false,
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.setPixelRatio(this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setSize(this.mountEl.clientWidth || window.innerWidth, this.mountEl.clientHeight || window.innerHeight);

    this.mountEl.appendChild(this.renderer.domElement);

    // 3. Scene, Camera, Lighting & Horizon Fog
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x38bdf8); // Sky blue
    this.scene.fog = new THREE.FogExp2(0x38bdf8, 0.0036);

    this.camera = new THREE.PerspectiveCamera(
      65,
      (this.mountEl.clientWidth || window.innerWidth) / (this.mountEl.clientHeight || window.innerHeight),
      0.1,
      600
    );

    this.camera2 = new THREE.PerspectiveCamera(
      65,
      (this.mountEl.clientWidth || window.innerWidth) / (this.mountEl.clientHeight || window.innerHeight),
      0.1,
      600
    );

    // Procedural Studio Environment Reflection
    try {
      const pmrem = new THREE.PMREMGenerator(this.renderer);
      this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
      pmrem.dispose();
    } catch {
      // Fallback
    }

    // Warm Key Light & Cool Hemisphere Fill
    this.sunLight = new THREE.DirectionalLight(0xfff7ed, 1.8);
    this.sunLight.position.set(40, 70, 30);
    if (!this.isSoftwareGl) {
      this.sunLight.castShadow = true;
      this.sunLight.shadow.mapSize.width = 1024;
      this.sunLight.shadow.mapSize.height = 1024;
      this.sunLight.shadow.camera.near = 10;
      this.sunLight.shadow.camera.far = 160;
      const d = 45;
      this.sunLight.shadow.camera.left = -d;
      this.sunLight.shadow.camera.right = d;
      this.sunLight.shadow.camera.top = d;
      this.sunLight.shadow.camera.bottom = -d;
      this.sunLight.shadow.bias = -0.0005;
    }
    this.scene.add(this.sunLight);

    this.hemiLight = new THREE.HemisphereLight(0xbae6fd, 0x475569, 1.0);
    this.scene.add(this.hemiLight);

    // First-Person POV Flashlight for DOORS horror mode
    this.flashlightSpot = new THREE.SpotLight(0xfffbeb, 0, 38, Math.PI / 3.8, 0.5, 1.2);
    this.flashlightSpot.target = this.flashlightTarget;
    this.scene.add(this.flashlightSpot);
    this.scene.add(this.flashlightTarget);

    // 4. Build Blox World
    this.worldData = buildGameWorld(this.scene, this.currentGameId);
    this.stats.totalCheckpoints = this.worldData.checkpoints.length;

    // 5. Initialize Avatar
    this.avatar = new RobloxAvatar(this.playerSkin);
    this.scene.add(this.avatar.root);

    // 6. Pre-allocated Particle Pool
    const pGeo = new THREE.BoxGeometry(0.35, 0.35, 0.35);
    const pMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    this.particlePool = new THREE.InstancedMesh(pGeo, pMat, this.particleCount);
    this.particlePool.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.scene.add(this.particlePool);

    for (let i = 0; i < this.particleCount; i++) {
      this.particleData.push({
        pos: new THREE.Vector3(0, -999, 0),
        vel: new THREE.Vector3(0, 0, 0),
        life: 0,
        maxLife: 1,
        color: new THREE.Color(1, 1, 1),
      });
    }

    // 6b. Initialize 3D VR 6DoF Controller & Hand Tracking Rigs + Diegetic Wrist HUD + Teleport Reticle
    this.renderer.xr.enabled = true;
    this.vrLeftRig = createVRControllerAndHandRig('left');
    this.vrRightRig = createVRControllerAndHandRig('right');
    this.vrWristWatch = createVRWristWatchHUD();
    this.vrControlsCard = createVRControlsCard3D();
    this.vrLeftRig.root.add(this.vrWristWatch.root, this.vrControlsCard.root);
    this.vrRightTool = createVRRightHandToolModel();
    this.vrRightRig.root.add(this.vrRightTool.root);
    this.vrTeleportReticle = createVRTeleportReticle();
    this.scene.add(this.vrTeleportReticle.root);
    this.vrPicoGuardian = createPicoGuardianBoundaryRing();
    this.scene.add(this.vrPicoGuardian.root);
    this.vrMainMenu = createVRMainMenu3D();
    this.scene.add(this.vrMainMenu.root);
    this.bluePortalMesh = createPortalMesh3D('blue');
    this.orangePortalMesh = createPortalMesh3D('orange');
    this.portalShotBeam = createPortalShotBeam3D();
    this.scene.add(this.bluePortalMesh.root, this.orangePortalMesh.root, this.portalShotBeam.root);
    this.vrAlertHUD = createVRAlertHUD();

    this.vrCameraRig.name = 'VRCameraRig6DoF';
    this.vrCameraRig.visible = false;
    this.vrCameraRig.add(this.vrLeftRig.root, this.vrRightRig.root, this.vrAlertHUD.root);
    this.scene.add(this.vrCameraRig);
    this.applyPerformanceProfile();

    const navXr = (navigator as unknown as { xr?: { isSessionSupported?: (m: string) => Promise<boolean> } })?.xr;
    if (navXr && typeof navXr.isSessionSupported === 'function') {
      navXr
        .isSessionSupported('immersive-vr')
        .then((supported) => {
          this.vrState.immersiveSupported = Boolean(supported);
          this.callbacks.onVRStateUpdate?.({
            ...this.vrState,
            leftController: { ...this.vrState.leftController },
            rightController: { ...this.vrState.rightController },
          });
        })
        .catch(() => {});
    }

    // 7. Bind Input Listeners
    this.bindInputs();

    // 8. Pre-warm shaders
    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }

    // 9. Start Game Loop
    this.startLoop();

    this.callbacks.onChatMessage('Добро пожаловать в Blox World! [WASD] бег, [Пробел] прыжок, [V] — 6DoF VR режим.');
  }

  private bindInputs() {
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    window.addEventListener('blur', this.handleWindowBlur);

    const dom = this.renderer.domElement;
    dom.style.touchAction = 'none';
    dom.addEventListener('mousedown', this.handleMouseDown);
    window.addEventListener('mousemove', this.handleMouseMove);
    window.addEventListener('mouseup', this.handleMouseUp);
    dom.addEventListener('wheel', this.handleWheel, { passive: true });

    // Mobile Touch Camera Orbit & Pinch Zoom
    dom.addEventListener('touchstart', this.handleTouchStart, { passive: false });
    dom.addEventListener('touchmove', this.handleTouchMove, { passive: false });
    dom.addEventListener('touchend', this.handleTouchEnd);
    dom.addEventListener('touchcancel', this.handleTouchEnd);

    window.addEventListener('resize', this.handleResize);
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => this.handleResize());
      this.resizeObserver.observe(this.mountEl);
    }

    // Right click menu prevent
    dom.addEventListener('contextmenu', this.handleContextMenu);
  }

  private handleContextMenu = (e: MouseEvent) => {
    e.preventDefault();
  };

  private handleKeyDown = (e: KeyboardEvent) => {
    // Ignore shortcuts when typing in an input
    const tag = (e.target as HTMLElement)?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    if (e.defaultPrevented) return;

    const code = e.code;
    if (!this.keysHeld.has(code)) {
      this.justPressedKeys.add(code);
    }
    this.keysHeld.add(code);

    // Blox Studio 3D Edit Mode Shortcuts (Undo/Redo/Rotate/Delete/Tool switch)
    if (this.currentGameId === 'studio' && this.studioMode === 'edit') {
      if ((e.ctrlKey || e.metaKey) && code === 'KeyZ') {
        e.preventDefault();
        if (e.shiftKey) this.redoStudio();
        else this.undoStudio();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && code === 'KeyY') {
        e.preventDefault();
        this.redoStudio();
        return;
      }
      if (code === 'Delete' || code === 'Backspace') {
        e.preventDefault();
        this.deleteSelectedStudioObject();
        return;
      }
      if (code === 'KeyR') {
        e.preventDefault();
        this.rotateStudioSelectionOrBrush();
        return;
      }
      if (code === 'Digit1') {
        this.setStudioTool('place');
        return;
      }
      if (code === 'Digit2') {
        this.setStudioTool('select');
        return;
      }
      if (code === 'Digit3') {
        this.setStudioTool('erase');
        return;
      }
      if (code === 'Digit4') {
        this.setStudioTool('camera');
        return;
      }
      if (code === this.keybinds.mute || code === 'KeyM') {
        const isMuted = sound.toggleMute();
        this.callbacks.onChatMessage(isMuted ? 'Звук выключен 🔇' : 'Звук включен 🔊');
      }
      return;
    }

    // VR 6DoF Mode toggle [V] and VR Locomotion / Teleport / Snap-Turn shortcuts
    if (code === 'KeyV') {
      if (!this.vrFeatureEnabled) return;
      e.preventDefault();
      this.toggleVRMode();
      return;
    }
    if (this.vrState.enabled) {
      if (code === 'KeyT') {
        e.preventDefault();
        this.triggerVRTeleport();
        return;
      }
      if (code === 'KeyQ' || code === 'BracketLeft') {
        e.preventDefault();
        this.triggerVRSnapTurn(-1);
        return;
      }
      if (code === 'KeyX' || code === 'BracketRight') {
        e.preventDefault();
        this.triggerVRSnapTurn(1);
        return;
      }
      if (code === 'KeyM') {
        e.preventDefault();
        this.toggleVRMainMenu();
        return;
      }
      if (code === 'KeyN') {
        e.preventDefault();
        this.toggleVRControlsHint();
        return;
      }
    }

    // DOORS Horror Mode specific shortcuts: [E] Interact/Hide/Open, [C] Crouch, [F] Flashlight/Screech
    if (this.currentGameId === 'doors') {
      if (code === 'KeyE') {
        e.preventDefault();
        this.vrTriggerDecay = 1.0;
        this.interactInDoors();
        return;
      }
      if (code === 'KeyC' || code === 'ControlLeft') {
        e.preventDefault();
        this.vrGripDecay = 1.0;
        this.toggleDoorsCrouch();
        return;
      }
      if (code === 'KeyF') {
        e.preventDefault();
        this.vrTriggerDecay = 0.85;
        this.toggleDoorsFlashlight();
        return;
      }
    }

    // Hotbar selection 1-8
    if (code === this.keybinds.tool1 || code === 'Digit1') this.selectTool('sword');
    if (code === this.keybinds.tool2 || code === 'Digit2') this.selectTool('speed_coil');
    if (code === this.keybinds.tool3 || code === 'Digit3') this.selectTool('gravity_coil');
    if (code === this.keybinds.tool4 || code === 'Digit4') this.selectTool('hammer');
    if (code === this.keybinds.tool5 || code === 'Digit5') this.selectTool('jetpack_boost');
    if (code === this.keybinds.tool6 || code === 'Digit6') this.selectTool('bloxy_cola');
    if (code === this.keybinds.tool7 || code === 'Digit7') this.selectTool('dance');
    if (code === 'Digit8') this.selectTool('portal_gun');

    // Portal Gun quick shortcuts when equipped: [Q]/[P] Orange Portal, [Backspace] Clear Portals
    if (this.activeTool === 'portal_gun') {
      if (code === 'KeyP' || (!this.vrState.enabled && code === 'KeyQ')) {
        e.preventDefault();
        this.firePortal('orange');
        return;
      }
      if (code === 'Backspace') {
        e.preventDefault();
        this.clearPortals();
        return;
      }
    }

    // Reset character
    if (code === this.keybinds.reset || code === 'KeyR') {
      this.respawnPlayer(true);
    }

    // Jump buffer (Player 1)
    if (code === this.keybinds.jump || code === 'Space') {
      this.jumpBufferTimer = 0.14; // 140ms buffer
    }

    // Jump buffer (Player 2 in Local Co-op mode)
    if (this.localCoopEnabled && (code === 'Enter' || code === 'ShiftRight' || code === 'Numpad0')) {
      this.p2JumpBuffer = 0.14;
    }

    // Sound toggle shortcut
    if (code === this.keybinds.mute || code === 'KeyM') {
      const isMuted = sound.toggleMute();
      this.callbacks.onChatMessage(isMuted ? 'Звук выключен 🔇' : 'Звук включен 🔊');
    }
  };

  private handleKeyUp = (e: KeyboardEvent) => {
    this.keysHeld.delete(e.code);
  };

  private handleWindowBlur = () => {
    this.keysHeld.clear();
    this.justPressedKeys.clear();
    this.isDraggingMouse = false;
    this.joystickX = 0;
    this.joystickY = 0;
    this.cameraTouchId = null;
  };

  private handleTouchStart = (e: TouchEvent) => {
    e.preventDefault();
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      this.lastPinchDist = Math.hypot(dx, dy);
      return;
    }

    if (this.cameraTouchId === null && e.changedTouches.length > 0) {
      const t = e.changedTouches[0];
      this.cameraTouchId = t.identifier;
      this.lastTouchX = t.clientX;
      this.lastTouchY = t.clientY;
    }
  };

  private handleTouchMove = (e: TouchEvent) => {
    e.preventDefault();
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.hypot(dx, dy);
      if (this.lastPinchDist > 0) {
        const delta = this.lastPinchDist - dist;
        this.cameraDistance = Math.max(4, Math.min(26, this.cameraDistance + delta * 0.04));
      }
      this.lastPinchDist = dist;
      return;
    }

    if (this.cameraTouchId !== null) {
      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        if (t.identifier === this.cameraTouchId) {
          const dx = t.clientX - this.lastTouchX;
          const dy = t.clientY - this.lastTouchY;
          this.lastTouchX = t.clientX;
          this.lastTouchY = t.clientY;

          this.cameraYaw -= dx * 0.007;
          const minPitch = this.currentGameId === 'doors' ? -0.75 : 0.08;
          const maxPitch = this.currentGameId === 'doors' ? 0.8 : 1.4;
          this.cameraPitch = Math.max(minPitch, Math.min(maxPitch, this.cameraPitch + dy * 0.006));
          break;
        }
      }
    }
  };

  private handleTouchEnd = (e: TouchEvent) => {
    if (e.touches.length < 2) {
      this.lastPinchDist = 0;
    }
    if (this.cameraTouchId !== null) {
      for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === this.cameraTouchId) {
          this.cameraTouchId = null;
          break;
        }
      }
    }
  };

  private requestCanvasPointerLock(dom: HTMLCanvasElement) {
    if (this.isDestroyed || typeof document === 'undefined') return;
    if (!dom.isConnected || document.pointerLockElement === dom) return;
    if (typeof dom.requestPointerLock !== 'function') return;

    try {
      const result = dom.requestPointerLock() as unknown;
      if (result && typeof (result as Promise<unknown>).catch === 'function') {
        (result as Promise<unknown>).catch(() => {
          // Fallback to click-drag orbit if pointer lock is rejected (e.g. iframe sandbox or cooldown)
        });
      }
    } catch {
      // Fallback silently to drag orbit if browser throws synchronously (e.g. Firefox SecurityError)
    }
  }

  private handleMouseDown = (e: MouseEvent) => {
    if (this.isDestroyed) return;

    // Blox Studio 3D Edit Mode: never capture Pointer Lock; allow accurate click placement/selection & right-drag orbit
    if (this.currentGameId === 'studio' && this.studioMode === 'edit') {
      this.studioMouseDownX = e.clientX;
      this.studioMouseDownY = e.clientY;
      this.studioMouseDownButton = e.button;
      this.studioMouseMovedDist = 0;
      this.lastMouseX = e.clientX;
      this.lastMouseY = e.clientY;
      this.isDraggingMouse =
        e.button === 2 ||
        e.button === 1 ||
        (e.button === 0 && this.studioTool === 'camera');
      return;
    }

    // Request Pointer Lock safely on click (falls back cleanly to drag-orbit if blocked)
    const dom = this.renderer?.domElement;
    if (dom) {
      this.requestCanvasPointerLock(dom);
    }

    // Orbit drag on right click or left click drag
    this.isDraggingMouse = true;
    this.lastMouseX = e.clientX;
    this.lastMouseY = e.clientY;

    if (this.vrState.enabled) {
      if (e.button === 0) {
        this.vrTriggerDecay = 1.0;
        if (this.vrState.vrMenuOpen && this.vrMenuHoveredAction) {
          this.executeVRMenuAction(this.vrMenuHoveredAction);
          return;
        }
        if (this.activeTool === 'portal_gun') {
          this.firePortal('blue', false);
          return;
        }
        this.triggerVRHapticPulse(0.65, 45);
      } else if (e.button === 2) {
        this.vrGripDecay = 1.0;
        if (this.activeTool === 'portal_gun' && !this.vrState.vrMenuOpen) {
          this.firePortal('orange', true);
          return;
        }
        if (!this.vrState.vrMenuOpen) {
          this.triggerVRTeleport();
        }
        return;
      }
    }

    if (e.button === 2 && this.activeTool === 'portal_gun') {
      this.portalRightMouseDownPos = { x: e.clientX, y: e.clientY };
      if (document.pointerLockElement === this.renderer.domElement) {
        this.firePortal('orange');
        this.portalRightMouseDownPos = null;
      }
    }

    // If left click on canvas
    if (e.button === 0) {
      if (this.activeTool === 'portal_gun') {
        this.firePortal('blue');
      } else if (this.currentGameId === 'doors') {
        if (this.doorsState.screechActive) {
          this.repelScreech();
        } else if (this.doorsState.nearInteractable) {
          this.interactInDoors();
        }
      } else if (this.currentGameId === 'bee_swarm' || this.activeTool === 'pollen_collector') {
        this.gatherPollen();
      } else if (this.activeTool === 'sword') {
        this.performSwordAttack();
      } else if (this.activeTool === 'hammer') {
        this.placeOrRemoveBlock(e.shiftKey);
      } else if (this.activeTool === 'jetpack_boost') {
        this.triggerJetpackBoost();
      } else if (this.activeTool === 'bloxy_cola') {
        this.drinkBloxyCola();
      }
    }
  };

  private handleMouseMove = (e: MouseEvent) => {
    if (this.currentGameId === 'studio' && this.studioMode === 'edit') {
      const dx = e.clientX - this.lastMouseX;
      const dy = e.clientY - this.lastMouseY;
      this.lastMouseX = e.clientX;
      this.lastMouseY = e.clientY;
      if (this.studioMouseDownButton !== -1) {
        this.studioMouseMovedDist += Math.hypot(dx, dy);
      }
      if (this.isDraggingMouse) {
        this.cameraYaw -= dx * 0.006;
        this.cameraPitch = Math.max(0.08, Math.min(1.48, this.cameraPitch + dy * 0.005));
      } else {
        this.updateStudioHoverPreview(e.clientX, e.clientY);
      }
      return;
    }

    const width = this.mountEl.clientWidth || window.innerWidth || 1;
    const height = this.mountEl.clientHeight || window.innerHeight || 1;
    const isLocked = document.pointerLockElement === this.renderer.domElement;

    if (isLocked) {
      this.vrPointerNormX = Math.max(-1, Math.min(1, this.vrPointerNormX + e.movementX * 0.0022));
      this.vrPointerNormY = Math.max(-1, Math.min(1, this.vrPointerNormY - e.movementY * 0.0022));
    } else {
      this.vrPointerNormX = Math.max(-1, Math.min(1, (e.clientX / width) * 2 - 1));
      this.vrPointerNormY = Math.max(-1, Math.min(1, -((e.clientY / height) * 2 - 1)));
    }

    if (this.vrState.enabled && !this.renderer.xr.isPresenting) {
      this.vrTelemetrySyncTimer = 0;
      this.updateVRSimulation(0.016, performance.now() / 1000);
    }

    if (!this.isDraggingMouse && !isLocked) return;

    const dx = isLocked ? e.movementX : (e.clientX - this.lastMouseX);
    const dy = isLocked ? e.movementY : (e.clientY - this.lastMouseY);

    if (!isLocked) {
      this.lastMouseX = e.clientX;
      this.lastMouseY = e.clientY;
    }

    this.cameraYaw -= dx * 0.005;
    const minPitch = this.currentGameId === 'doors' || this.vrState.enabled ? -0.75 : 0.08;
    const maxPitch = this.currentGameId === 'doors' || this.vrState.enabled ? 0.8 : 1.4;
    this.cameraPitch = Math.max(minPitch, Math.min(maxPitch, this.cameraPitch + dy * 0.004));
  };

  private handleMouseUp = (e: MouseEvent) => {
    const downBtn = this.studioMouseDownButton;
    const moved = this.studioMouseMovedDist;
    this.studioMouseDownButton = -1;
    this.isDraggingMouse = false;

    if (e.button === 2 && this.portalRightMouseDownPos) {
      const dist = Math.hypot(
        e.clientX - this.portalRightMouseDownPos.x,
        e.clientY - this.portalRightMouseDownPos.y
      );
      this.portalRightMouseDownPos = null;
      if (dist < 7 && this.activeTool === 'portal_gun') {
        this.firePortal('orange');
      }
    }

    if (this.currentGameId === 'studio' && this.studioMode === 'edit') {
      if (downBtn === 0 && moved < 8) {
        this.handleStudioViewportClick(e.clientX, e.clientY);
      }
    }
  };

  private handleWheel = (e: WheelEvent) => {
    if (this.currentGameId === 'studio' && this.studioMode === 'edit') {
      this.cameraDistance = Math.max(6, Math.min(110, this.cameraDistance + e.deltaY * 0.04));
      return;
    }
    this.cameraDistance = Math.max(4, Math.min(26, this.cameraDistance + e.deltaY * 0.02));
  };

  private handleResize = () => {
    if (!this.mountEl || this.isDestroyed) return;
    const width = this.mountEl.clientWidth || window.innerWidth;
    const height = this.mountEl.clientHeight || window.innerHeight;
    if (this.localCoopEnabled) {
      const halfW = Math.max(1, Math.floor(width / 2));
      const rightW = Math.max(1, width - halfW);
      this.camera.aspect = halfW / Math.max(1, height);
      this.camera.updateProjectionMatrix();
      this.camera2.aspect = rightW / Math.max(1, height);
      this.camera2.updateProjectionMatrix();
    } else {
      this.camera.aspect = width / Math.max(1, height);
      this.camera.updateProjectionMatrix();
    }
    this.renderer.setSize(width, height);
  };

  /**
   * Sets analog virtual joystick input from mobile touch UI.
   * x in [-1, 1] (left/right), y in [-1, 1] (up is negative, down is positive)
   */
  public setJoystickInput(x: number, y: number) {
    this.joystickX = x;
    this.joystickY = y;
  }

  /**
   * Triggers jump buffer from mobile jump button.
   */
  public triggerJump() {
    this.jumpBufferTimer = 0.14;
  }

  /**
   * Triggers active tool action (Sword slash or Block place/delete) from mobile UI.
   */
  public triggerAction(removeBlock: boolean = false) {
    if (this.activeTool === 'portal_gun') {
      this.firePortal(removeBlock ? 'orange' : 'blue');
      return;
    }
    if (this.currentGameId === 'doors') {
      if (this.doorsState.screechActive) {
        this.repelScreech();
      } else {
        this.interactInDoors();
      }
      return;
    }
    if (this.currentGameId === 'bee_swarm' || this.activeTool === 'pollen_collector') {
      this.gatherPollen();
    } else if (this.activeTool === 'sword') {
      this.performSwordAttack();
    } else if (this.activeTool === 'hammer') {
      this.placeOrRemoveBlock(removeBlock);
    } else if (this.activeTool === 'jetpack_boost') {
      this.triggerJetpackBoost();
    } else if (this.activeTool === 'bloxy_cola') {
      this.drinkBloxyCola();
    } else if (this.activeTool === 'speed_coil') {
      sound.playSpeedCoil();
    } else if (this.activeTool === 'gravity_coil') {
      sound.playGravityCoil();
    }
  }

  public triggerJetpackBoost() {
    this.playerVel.y = 22.0;
    this.isGrounded = false;
    sound.playSuperJump();
    this.avatar.targetSquashY = 1.3;
    this.spawnParticleBurst(this.playerPos.x, this.playerPos.y + 1.2, this.playerPos.z, 0xf97316, 22);
    this.spawnParticleBurst(this.playerPos.x, this.playerPos.y + 0.6, this.playerPos.z, 0xef4444, 14);
  }

  public drinkBloxyCola() {
    this.avatar.triggerAttack();
    sound.playCoin();
    this.stats.hp = Math.min(this.stats.maxHp, this.stats.hp + 35);
    this.playerVel.y = Math.max(this.playerVel.y, 12.0);
    this.spawnParticleBurst(this.playerPos.x, this.playerPos.y + 3.5, this.playerPos.z, 0xfbbf24, 16);
    this.unlockAchievement('bloxy_cola_lover');
    this.callbacks.onStatsUpdate({ ...this.stats });
    this.callbacks.onChatMessage('Вы выпили Bloxy Cola! 🥤 Здоровье +35 HP и бодрость!', 'Рюкзак');
  }

  public loadGameWorld(gameId: GameId) {
    this.currentGameId = gameId;
    this.clearPortals(true);

    // Remove any placed blocks from previous world
    this.worldData?.placedBlockMeshes.forEach((m) => {
      this.scene.remove(m);
    });

    this.worldData = buildGameWorld(this.scene, gameId, this.worldData?.worldRoot);
    this.applyPerformanceProfile();
    const defaultSurface: SurfaceType = gameId === 'doors' ? 'wood' : gameId === 'bee_swarm' ? 'grass' : 'stone';
    this.currentSurface = defaultSurface;
    this.p2Surface = defaultSurface;
    this.footstepTimer = 0;
    this.p2FootstepTimer = 0;
    this.currentCheckpointId = 0;
    this.stats.currentCheckpoint = 0;
    this.stats.totalCheckpoints = this.worldData.checkpoints.length;
    this.respawnPlayer(true);

    if (this.localCoopEnabled && this.player2Avatar) {
      if (gameId === 'doors') {
        this.p2Pos.set(1.8, 0.2, 2.0);
        this.p2CameraYaw = Math.PI;
        this.p2CameraPitch = 0.02;
      } else {
        this.p2Pos.set(2.5, 2.2, 0);
        this.p2CameraYaw = 0;
        this.p2CameraPitch = 0.35;
      }
      this.p2Vel.set(0, 0, 0);
      this.p2CheckpointId = 0;
      this.player2Avatar.root.position.copy(this.p2Pos);
    }

    // Hide Studio helpers when switching worlds
    if (this.studioPreviewMesh) this.studioPreviewMesh.visible = false;
    if (this.studioSelectionBox) this.studioSelectionBox.visible = false;

    if (gameId === 'studio') {
      this.clearBeeSwarmMeshes();
      if (this.flashlightSpot) this.flashlightSpot.intensity = 0;
      this.studioProject = loadStudioProject();
      rebuildStudioWorldObjects(this.worldData, this.studioProject);
      this.stats.totalCheckpoints = this.worldData.checkpoints.length;
      this.studioMode = 'edit';
      this.studioSelectedId = null;
      this.studioUndoStack = [];
      this.studioRedoStack = [];
      this.avatar.root.visible = false;
      if (typeof document !== 'undefined' && document.pointerLockElement === this.renderer?.domElement) {
        try {
          document.exitPointerLock?.();
        } catch {}
      }
      this.studioCamTarget.set(0, 6, 16);
      this.cameraDistance = 34;
      this.cameraYaw = 0.45;
      this.cameraPitch = 0.55;
      this.applyStudioSkyPreset(this.studioProject.skyPreset);
      this.ensureStudioVisualHelpers();
      this.emitStudioState();
      this.callbacks.onChatMessage(
        '🛠️ Запущена «Blox Студия 3D»! Выбирайте детали на панели снизу, кликайте по сцене для стройки и нажмите «Тест» для игры!',
        'Студия'
      );
    } else if (gameId === 'doors') {
      this.clearBeeSwarmMeshes();
      this.avatar.root.visible = false; // First-Person POV!
      this.cameraYaw = Math.PI; // Face forward down the +Z hotel corridor
      this.cameraPitch = 0.02;
      this.scene.background = new THREE.Color(0x09060a);
      this.scene.fog = new THREE.FogExp2(0x09060a, 0.011);
      this.sunLight.color.setHex(0x93c5fd);
      this.sunLight.intensity = 0.55;
      this.hemiLight.color.setHex(0x64748b);
      this.hemiLight.groundColor.setHex(0x1c1917);
      this.hemiLight.intensity = 0.65;

      this.doorsState = {
        currentDoorNumber: 1,
        isCrouching: false,
        isHidingInCloset: false,
        flashlightOn: true,
        lightFlickerIntensity: 0,
        activeEntity: 'none',
        entityWarningText: null,
        screechActive: false,
        eyesActive: false,
        rushActive: false,
        silenceActive: false,
        gloomActive: false,
        inDoor100Room: false,
        figureDistance: 99,
        figureAlerted: false,
        nearInteractable: null,
        elevatorClosing: false,
        phaseName: 'СТОЙКА АДМИНИСТРАТОРА',
        currentRoomId: 'reception',
        currentRoomTitle: 'СТОЙКА АДМИНИСТРАТОРА',
        rushWarningSeconds: 0,
        rushDistanceMeters: 0,
      };
      this.rushWarningTimer = 0;
      this.rushApproachStage = 0;
      this.rushZ = -100;
      this.screechTimer = 0;
      this.elevatorCloseTimer = 0;
      this.closetSavedPos = null;
      this.lastDoorsEmitSig = '';
      if (this.flashlightSpot) {
        this.flashlightSpot.intensity = 3.2;
      }
      this.emitDoorsStateIfChanged(true);
      this.callbacks.onChatMessage(
        '🚪 Запущен хоррор «DOORS: Отель Ужасов [100 Дверей и 18 Комнат]»! Позади вас — стартовый ЛИФТ, впереди — СТОЙКА АДМИНИСТРАТОРА и Дверь #0001!'
      );
    } else if (gameId === 'lava_survival') {
      this.avatar.root.visible = true;
      if (this.flashlightSpot) this.flashlightSpot.intensity = 0;
      this.sunLight.color.setHex(0xfff7ed);
      this.sunLight.intensity = 1.8;
      this.hemiLight.color.setHex(0xbae6fd);
      this.hemiLight.groundColor.setHex(0x475569);
      this.hemiLight.intensity = 1.0;
      this.clearBeeSwarmMeshes();
      this.scene.background = new THREE.Color(0x1e1b4b);
      this.scene.fog = new THREE.FogExp2(0x31102f, 0.008);
      this.callbacks.onChatMessage('Запущен режим «Пол — это лава: Выживание 3D»! Поднимайтесь на крыши до вертолёта! 🌋🚁');
    } else if (gameId === 'bee_swarm') {
      this.avatar.root.visible = true;
      if (this.flashlightSpot) this.flashlightSpot.intensity = 0;
      this.sunLight.color.setHex(0xfff7ed);
      this.sunLight.intensity = 1.8;
      this.hemiLight.color.setHex(0xbae6fd);
      this.hemiLight.groundColor.setHex(0x475569);
      this.hemiLight.intensity = 1.0;
      this.scene.background = new THREE.Color(0xbbf7d0);
      this.scene.fog = new THREE.FogExp2(0xdcfce7, 0.005);
      this.initBeeSwarmMeshes();
      this.selectTool('pollen_collector');
      this.callbacks.onChatMessage('🐝 Запущен «Bee Farm Simulator 3D» (НЕ паркур!) Собирайте пыльцу совком, водите пчёл и делайте мёд в Улье!');
    } else {
      this.avatar.root.visible = true;
      if (this.flashlightSpot) this.flashlightSpot.intensity = 0;
      this.sunLight.color.setHex(0xfff7ed);
      this.sunLight.intensity = 1.8;
      this.hemiLight.color.setHex(0xbae6fd);
      this.hemiLight.groundColor.setHex(0x475569);
      this.hemiLight.intensity = 1.0;
      this.clearBeeSwarmMeshes();
      this.scene.background = new THREE.Color(0x38bdf8);
      this.scene.fog = new THREE.FogExp2(0x38bdf8, 0.0036);
      this.callbacks.onChatMessage('Запущен просторный «Паркур: Blox Obby 3D»! Пройдите 6 полос препятствий! 🏃🏆');
    }
  }

  public selectTool(tool: ToolType) {
    this.activeTool = tool;
    this.avatar.setEquippedTool(tool);
    if (tool === 'dance') {
      this.avatar.clearEmote();
    }
    this.avatar.isEmoting = tool === 'dance';
    this.callbacks.onToolChanged(tool);

    if (tool === 'pollen_collector') {
      this.callbacks.onChatMessage('Экипирован Совок для пыльцы! Клик — собрать пыльцу с цветов 🌸');
    } else if (tool === 'speed_coil') {
      sound.playSpeedCoil();
      this.callbacks.onChatMessage('Экипирован Speed Coil! (+85% к скорости бега)');
    } else if (tool === 'gravity_coil') {
      sound.playGravityCoil();
      this.callbacks.onChatMessage('Экипирован Gravity Coil! (Высокие прыжки и плавная гравитация)');
    } else if (tool === 'hammer') {
      this.callbacks.onChatMessage('Экипирован Молот Строителя! Клик - поставить блок, Shift+Клик - удалить.');
    } else if (tool === 'sword') {
      this.callbacks.onChatMessage('Экипирован Меч Blox! Клик - атаковать.');
    } else if (tool === 'jetpack_boost') {
      sound.playGravityCoil();
      this.callbacks.onChatMessage('Экипирован Пульт Джетпака FUEL! Клик — реактивный взлёт вверх! 🚀');
    } else if (tool === 'bloxy_cola') {
      this.callbacks.onChatMessage('Экипирована Bloxy Cola! Клик — выпить газировку (+35 HP и ускорение)! 🥤');
    } else if (tool === 'portal_gun') {
      sound.playPortalShoot('blue');
      this.callbacks.onChatMessage(
        this.vrState.enabled
          ? '🌀 Портал-Пушка в руке! Курок R = 🔵 Синий портал, Курок L = 🟠 Оранжевый портал! Шагните внутрь!'
          : '🌀 Портал-Пушка экипирована! ЛКМ = 🔵 Синий портал, ПКМ / [Q] = 🟠 Оранжевый портал! Прыгайте в портал с разгону!',
        'Портал-Пушка'
      );
    }
  }

  private emitPortalState() {
    this.callbacks.onPortalStateUpdate?.({ ...this.portalState });
  }

  public clearPortals(silent: boolean = false) {
    this.bluePortalAnchor = null;
    this.orangePortalAnchor = null;
    this.bluePortalMesh.hide();
    this.orangePortalMesh.hide();
    this.portalState.blueActive = false;
    this.portalState.orangeActive = false;
    this.portalState.linked = false;
    this.portalState.warpFlash = 0;
    this.emitPortalState();
    if (!silent) {
      sound.playJump();
      this.callbacks.onChatMessage('🌀 Оба пространственных портала закрыты.', 'Портал-Пушка');
    }
  }

  public firePortal(kind: PortalKind, useLeftVRHand: boolean = false) {
    const rayOrigin = new THREE.Vector3();
    const rayDir = new THREE.Vector3();
    const beamStart = new THREE.Vector3();

    if (this.vrState.enabled) {
      const rigRoot = useLeftVRHand ? this.vrLeftRig.root : this.vrRightRig.root;
      rigRoot.getWorldPosition(rayOrigin);
      const q = new THREE.Quaternion();
      rigRoot.getWorldQuaternion(q);
      rayDir.set(0, 0, -1).applyQuaternion(q).normalize();
      beamStart.copy(rayOrigin).addScaledVector(rayDir, 0.22);
    } else if (this.currentGameId === 'doors') {
      this.camera.getWorldPosition(rayOrigin);
      this.camera.getWorldDirection(rayDir).normalize();
      const rightVec = new THREE.Vector3().crossVectors(rayDir, new THREE.Vector3(0, 1, 0)).normalize();
      beamStart.copy(rayOrigin).addScaledVector(rightVec, 0.35).add(new THREE.Vector3(0, -0.22, 0));
    } else {
      // Third-person camera sits behind the avatar — fire from shoulder/head level forward along view direction
      this.camera.getWorldDirection(rayDir).normalize();
      // Gently level downward third-person orbit pitch so firing straight ahead hits walls/platforms ahead cleanly
      if (rayDir.y < -0.22) {
        rayDir.y = Math.max(-0.22, rayDir.y * 0.45);
        rayDir.normalize();
      }
      const rightVec = new THREE.Vector3().crossVectors(rayDir, new THREE.Vector3(0, 1, 0)).normalize();
      rayOrigin.set(this.playerPos.x, this.playerPos.y + 3.35, this.playerPos.z).addScaledVector(rayDir, 0.6);
      beamStart
        .set(this.playerPos.x, this.playerPos.y + 2.55, this.playerPos.z)
        .addScaledVector(rightVec, 0.85);
    }

    this.portalRaycaster.near = 1.6;
    this.portalRaycaster.far = 75.0;
    this.portalRaycaster.set(rayOrigin, rayDir);

    let hitPoint: [number, number, number] | null = null;
    let hitNormal: [number, number, number] = [-rayDir.x, 0, -rayDir.z];

    const worldRoot = this.worldData?.worldRoot;
    if (worldRoot) {
      const hits = this.portalRaycaster.intersectObjects(worldRoot.children, true);
      for (let i = 0; i < hits.length; i++) {
        const hit = hits[i];
        if (!hit.object.visible) continue;
        if (hit.distance < 2.8) continue;
        if (hit.object.type !== 'Mesh') continue;
        // Skip tiny decorative items or invisible triggers
        const mat = (hit.object as THREE.Mesh).material;
        if (mat && !Array.isArray(mat) && (mat as THREE.Material).opacity < 0.15) continue;

        // Keep newly opened portals safely outside immediate player torso so firing doesn't insta-trigger
        const distToPlayer = Math.hypot(
          hit.point.x - this.playerPos.x,
          hit.point.y - (this.playerPos.y + 1.5),
          hit.point.z - this.playerPos.z
        );
        if (distToPlayer < 3.4) continue;

        hitPoint = [hit.point.x, hit.point.y, hit.point.z];
        if (hit.face) {
          const nWorld = hit.face.normal
            .clone()
            .transformDirection(hit.object.matrixWorld)
            .normalize();
          if (nWorld.dot(rayDir) > 0) {
            nWorld.negate();
          }
          hitNormal = [nWorld.x, nWorld.y, nWorld.z];
        }
        break;
      }
    }

    // If aimed at open sky/void, conjure a floating interdimensional rift 11.5m ahead so it ALWAYS works!
    if (!hitPoint) {
      const dist = 11.5;
      const fx = rayOrigin.x + rayDir.x * dist;
      const fy = Math.max(this.playerPos.y + 3.2, rayOrigin.y + rayDir.y * dist);
      const fz = rayOrigin.z + rayDir.z * dist;
      hitPoint = [fx, fy, fz];
      hitNormal = [-rayDir.x, 0, -rayDir.z];
    }

    // Prevent Blue and Orange portals from overlapping on the exact same spot
    const otherAnchor = kind === 'blue' ? this.orangePortalAnchor : this.bluePortalAnchor;
    if (otherAnchor && hitPoint) {
      const siblingDist = Math.hypot(
        hitPoint[0] - otherAnchor.position[0],
        hitPoint[1] - otherAnchor.position[1],
        hitPoint[2] - otherAnchor.position[2]
      );
      if (siblingDist < 3.1) {
        const rightSide = new THREE.Vector3()
          .crossVectors(rayDir, new THREE.Vector3(0, 1, 0))
          .normalize();
        if (rightSide.lengthSq() < 0.01) rightSide.set(1, 0, 0);
        const sideSign = kind === 'orange' ? 1 : -1;
        hitPoint = [
          hitPoint[0] + rightSide.x * 3.6 * sideSign,
          hitPoint[1],
          hitPoint[2] + rightSide.z * 3.6 * sideSign,
        ];
      }
    }

    const transform = computePortalSurfaceTransform(hitPoint, hitNormal, [rayDir.x, rayDir.y, rayDir.z]);
    const anchor: PortalAnchorState = {
      kind,
      position: transform.position,
      normal: transform.normal,
      isHorizontal: transform.isHorizontal,
      createdAt: performance.now(),
    };

    if (kind === 'blue') {
      this.bluePortalAnchor = anchor;
      this.bluePortalMesh.setPlacement(transform);
      this.portalState.blueActive = true;
    } else {
      this.orangePortalAnchor = anchor;
      this.orangePortalMesh.setPlacement(transform);
      this.portalState.orangeActive = true;
    }

    this.portalState.lastColor = kind;
    this.portalState.linked = Boolean(this.bluePortalAnchor && this.orangePortalAnchor);
    this.avatar.setPortalGunColor(kind, performance.now() / 1000);
    this.avatar.triggerAttack();

    this.portalShotBeam.trigger([beamStart.x, beamStart.y, beamStart.z], transform.position, kind);
    this.spawnParticleBurst(
      transform.position[0],
      transform.position[1],
      transform.position[2],
      kind === 'blue' ? 0x00e5ff : 0xff7300,
      20
    );
    sound.playPortalShoot(kind);
    if (this.vrState.enabled) {
      this.triggerVRHapticPulse(0.72, 42);
      this.vrState.lastActionLabel =
        kind === 'blue' ? '🔵 Открыт Синий портал!' : '🟠 Открыт Оранжевый портал!';
      this.emitVRState();
    }
    this.emitPortalState();
  }

  private updatePortals(dt: number, time: number) {
    if (this.portalCooldown > 0) {
      this.portalCooldown = Math.max(0, this.portalCooldown - dt);
    }

    if (this.portalState.warpFlash > 0) {
      this.portalState.warpFlash = Math.max(0, this.portalState.warpFlash - dt * 2.8);
      if (time - this.portalLastEmitTime > 0.05 || this.portalState.warpFlash === 0) {
        this.portalLastEmitTime = time;
        this.emitPortalState();
      }
    }

    const linked = Boolean(this.bluePortalAnchor && this.orangePortalAnchor);
    this.bluePortalMesh.update(time, dt, linked);
    this.orangePortalMesh.update(time, dt, linked);
    this.portalShotBeam.update(dt);

    if (this.activeTool === 'portal_gun') {
      this.avatar.setPortalGunColor(this.portalState.lastColor, time);
    }

    if (!linked || this.portalCooldown > 0) return;

    const transit = evaluatePortalTransit(
      [this.playerPos.x, this.playerPos.y, this.playerPos.z],
      [this.playerVel.x, this.playerVel.y, this.playerVel.z],
      this.bluePortalAnchor,
      this.orangePortalAnchor,
      this.portalCooldown
    );

    if (!transit) return;

    const entryAnchor = transit.from === 'blue' ? this.bluePortalAnchor! : this.orangePortalAnchor!;
    this.spawnParticleBurst(
      entryAnchor.position[0],
      entryAnchor.position[1],
      entryAnchor.position[2],
      transit.from === 'blue' ? 0x00e5ff : 0xff7300,
      24
    );

    this.playerPos.set(transit.exitPos[0], transit.exitPos[1], transit.exitPos[2]);
    this.playerVel.set(transit.exitVel[0], transit.exitVel[1], transit.exitVel[2]);
    this.isGrounded = false;
    this.portalCooldown = 0.52;

    if (transit.exitYaw !== null) {
      this.cameraYaw = transit.exitYaw;
    }

    this.spawnParticleBurst(
      transit.exitPos[0],
      transit.exitPos[1] + 1.4,
      transit.exitPos[2],
      transit.to === 'blue' ? 0x00e5ff : 0xff7300,
      28
    );

    sound.playPortalWarp();
    this.screenShakeTimer = Math.max(this.screenShakeTimer, 0.14);
    this.portalState.transitCount += 1;
    this.portalState.warpFlash = 1.0;
    this.portalState.warpColor = transit.to;
    this.portalLastEmitTime = time;
    if (this.vrState.enabled) {
      this.vrTeleportFlashTimer = Math.max(this.vrTeleportFlashTimer, 0.24);
      this.triggerVRHapticPulse(0.95, 75);
      this.vrState.lastActionLabel =
        transit.to === 'orange' ? '🌀 Телепорт 🔵 → 🟠!' : '🌀 Телепорт 🟠 → 🔵!';
      this.emitVRState();
    }
    this.emitPortalState();
  }

  public setBlockColor(color: string) {
    this.selectedBlockColor = color;
  }

  private performSwordAttack() {
    this.avatar.triggerAttack();
    sound.playSwordSlash();
    this.callbacks.onLocalAttack?.();

    // Check hit against Target Dummy NPC
    const dummy = this.worldData?.dummyMesh;
    if (dummy) {
      const distToDummy = this.playerPos.distanceTo(dummy.position);
      if (distToDummy < 4.0) {
        sound.playOof();
        this.dummyShakeTimer = 0.4;
        this.spawnParticleBurst(dummy.position.x, dummy.position.y + 3, dummy.position.z, 0xfed000, 16);
        this.callbacks.onChatMessage('Вы ударили Noob Bob! "OOF!"', 'Noob Bob');
      }
    }
  }

  private placeOrRemoveBlock(isShift: boolean) {
    // Raycast forward from player position to place block in front
    const forward = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.avatar.root.rotation.y);
    const placeX = snapToGrid(this.playerPos.x + forward.x * 3.5, 2.0);
    const placeY = snapToGrid(Math.max(1.0, this.playerPos.y), 2.0);
    const placeZ = snapToGrid(this.playerPos.z + forward.z * 3.5, 2.0);
    const blockKey = `${placeX}_${placeY}_${placeZ}`;

    if (isShift) {
      this.applyRemoteBlockRemove(blockKey);
      this.callbacks.onLocalBlockRemove?.(blockKey);
    } else {
      if (this.worldData.placedBlockMeshes.size >= 50) {
        this.callbacks.onChatMessage('Достигнут лимит блоков (50)! Удалите часть через Shift+Клик.');
        return;
      }
      if (!this.worldData.placedBlockMeshes.has(blockKey)) {
        const pos: [number, number, number] = [placeX, placeY, placeZ];
        this.applyRemoteBlockPlace(blockKey, pos, this.selectedBlockColor);
        this.callbacks.onLocalBlockPlace?.(blockKey, pos, this.selectedBlockColor);
      }
    }
  }

  public applyRemoteBlockPlace(blockKey: string, pos: [number, number, number], color: string) {
    if (this.worldData.placedBlockMeshes.has(blockKey)) return;
    const bGeo = new THREE.BoxGeometry(2, 2, 2);
    const bMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(color),
      roughness: 0.4,
      metalness: 0.1,
    });
    const mesh = new THREE.Mesh(bGeo, bMat);
    mesh.position.set(pos[0], pos[1], pos[2]);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData = { width: 2, height: 2, depth: 2, surfaceType: 'stone' as SurfaceType };

    this.scene.add(mesh);
    this.worldData.placedBlockMeshes.set(blockKey, mesh);
    this.worldData.platforms.push(mesh);

    sound.playPlaceBlock();
    this.updateQuestProgress('place_blocks', 1);
    this.spawnParticleBurst(pos[0], pos[1], pos[2], new THREE.Color(color).getHex(), 12);
  }

  public applyRemoteBlockRemove(blockKey: string) {
    const existing = this.worldData.placedBlockMeshes.get(blockKey);
    if (existing) {
      const pos = existing.position.clone();
      this.scene.remove(existing);
      this.worldData.placedBlockMeshes.delete(blockKey);
      const pIdx = this.worldData.platforms.indexOf(existing);
      if (pIdx >= 0) this.worldData.platforms.splice(pIdx, 1);
      sound.playPlaceBlock();
      this.spawnParticleBurst(pos.x, pos.y, pos.z, 0x64748b, 10);
    }
  }

  public setLocalCoopMode(enabled: boolean, player2Name: string = 'Игрок 2') {
    this.localCoopEnabled = enabled;
    if (enabled) {
      if (!this.player2Avatar) {
        const p2Skin: CharacterSkin = {
          skinColor: '#f5d0a9',
          torsoColor: '#dc2626',
          legsColor: '#1e3a8a',
          hat: 'headphones',
          face: 'cool',
          name: player2Name,
        };
        this.player2Avatar = new RobloxAvatar(p2Skin);
        this.player2Avatar.setNameplate(`${player2Name} (Локалка)`, '#f43f5e');
        this.scene.add(this.player2Avatar.root);
      }
      if (this.currentGameId === 'doors') {
        this.p2Pos.set(1.8, 0.2, 2.0);
        this.p2CameraYaw = Math.PI;
        this.p2CameraPitch = 0.02;
      } else {
        this.p2Pos.set(2.5, 2.2, 0);
        this.p2CameraYaw = 0;
        this.p2CameraPitch = 0.35;
      }
      this.p2Vel.set(0, 0, 0);
      this.p2CheckpointId = 0;
      this.player2Avatar.root.position.copy(this.p2Pos);
    } else {
      if (this.player2Avatar) {
        this.scene.remove(this.player2Avatar.root);
        this.player2Avatar.dispose();
        this.player2Avatar = null;
      }
      this.renderer.setScissorTest(false);
    }
    this.handleResize();
  }

  public clearRemotePlayers() {
    this.remoteAvatars.forEach((entry) => {
      this.scene.remove(entry.avatar.root);
      entry.avatar.dispose();
    });
    this.remoteAvatars.clear();
  }

  public upsertRemotePlayer(player: RemotePlayerInfo) {
    let entry = this.remoteAvatars.get(player.id);
    if (!entry) {
      const av = new RobloxAvatar(player.skin);
      av.setNameplate(player.skin.name, '#38bdf8', getPlayerTitleById(player.skin.playerTitleId));
      av.setEquippedTool(player.activeTool || 'sword');
      av.root.position.set(player.position[0], player.position[1], player.position[2]);
      av.root.rotation.y = player.rotationY || 0;
      if (
        player.activeEmote &&
        isValidEmoteId(player.activeEmote.id) &&
        player.activeEmote.expiresAt > Date.now()
      ) {
        av.triggerEmote(player.activeEmote.id, player.activeEmote.expiresAt - Date.now());
      }
      this.scene.add(av.root);

      entry = {
        avatar: av,
        info: { ...player },
        targetPos: new THREE.Vector3(player.position[0], player.position[1], player.position[2]),
        targetRotY: player.rotationY || 0,
      };
      this.remoteAvatars.set(player.id, entry);
    } else {
      entry.info = { ...entry.info, ...player };
      entry.targetPos.set(player.position[0], player.position[1], player.position[2]);
      entry.targetRotY = player.rotationY;
      entry.avatar.setEquippedTool(player.activeTool || 'sword');
      entry.avatar.isEmoting = player.activeTool === 'dance';
    }
  }

  public updateRemotePlayer(update: Partial<RemotePlayerInfo> & { id: string }) {
    let entry = this.remoteAvatars.get(update.id);
    if (!entry) {
      const fallbackSkin: CharacterSkin = update.skin || {
        skinColor: '#e5c298',
        torsoColor: '#141619',
        legsColor: '#18181b',
        headShape: 'round',
        hat: 'rocker_hair',
        face: 'squiggly',
        outfit: 'rock_jacket',
        shirt: 'rock_jacket',
        pants: 'rock_jeans',
        backpack: 'fuel_jetpack',
        name: 'Игрок',
      };
      this.upsertRemotePlayer({
        id: update.id,
        skin: fallbackSkin,
        position: update.position || [0, 1.5, 0],
        rotationY: typeof update.rotationY === 'number' ? update.rotationY : 0,
        isMoving: Boolean(update.isMoving),
        isGrounded: update.isGrounded !== false,
        activeTool: update.activeTool || 'sword',
        checkpoint: typeof update.checkpoint === 'number' ? update.checkpoint : 0,
        coins: typeof update.coins === 'number' ? update.coins : 0,
      });
      return;
    }

    if (update.skin && update.skin.name) {
      const prevSkin = entry.info.skin;
      if (
        prevSkin.name !== update.skin.name ||
        prevSkin.torsoColor !== update.skin.torsoColor ||
        prevSkin.hat !== update.skin.hat ||
        prevSkin.face !== update.skin.face ||
        prevSkin.outfit !== update.skin.outfit ||
        prevSkin.backpack !== update.skin.backpack ||
        (prevSkin.playerTitleId || null) !== (update.skin.playerTitleId || null)
      ) {
        entry.info.skin = update.skin;
        entry.avatar.updateSkin(update.skin);
        entry.avatar.setNameplate(
          update.skin.name,
          '#38bdf8',
          getPlayerTitleById(update.skin.playerTitleId)
        );
      }
    }

    if (update.position) {
      entry.targetPos.set(update.position[0], update.position[1], update.position[2]);
      entry.info.position = update.position;
    }
    if (typeof update.rotationY === 'number') {
      entry.targetRotY = update.rotationY;
      entry.info.rotationY = update.rotationY;
    }
    if (typeof update.isMoving === 'boolean') {
      entry.avatar.isMoving = update.isMoving;
      entry.info.isMoving = update.isMoving;
    }
    if (typeof update.isGrounded === 'boolean') {
      entry.avatar.isGrounded = update.isGrounded;
      entry.info.isGrounded = update.isGrounded;
    }
    if (update.activeTool) {
      entry.avatar.setEquippedTool(update.activeTool);
      entry.avatar.isEmoting = update.activeTool === 'dance';
      entry.info.activeTool = update.activeTool;
    }
    if (typeof update.checkpoint === 'number') {
      entry.info.checkpoint = update.checkpoint;
    }
    if (typeof update.coins === 'number') {
      entry.info.coins = update.coins;
    }
  }

  public updateRemotePlayerSkin(id: string, skin: CharacterSkin) {
    const entry = this.remoteAvatars.get(id);
    if (entry) {
      entry.info.skin = skin;
      entry.avatar.updateSkin(skin);
      entry.avatar.setNameplate(skin.name, '#38bdf8', getPlayerTitleById(skin.playerTitleId));
    }
  }

  public triggerRemotePlayerAttack(id: string) {
    const entry = this.remoteAvatars.get(id);
    if (entry) {
      entry.avatar.triggerAttack();
    }
  }

  public triggerLocalEmote(emoteId: EmoteId): { emoteId: EmoteId; durationMs: number } {
    const def = getEmoteById(emoteId);
    this.avatar.triggerEmote(def.id, def.durationMs);
    sound.playEmoteSound(def.id);
    this.updateQuestProgress('emotes', 1);
    if (this.vrState.enabled) {
      const mappedGesture = mapEmoteIdToVRGesture(def.id);
      if (mappedGesture) {
        const gestureDef = getVRGestureDefinition(mappedGesture);
        this.vrState.activeGesture = gestureDef.id;
        this.vrState.activeGestureLabel = `${gestureDef.emoji} ${gestureDef.label}`;
        this.vrState.activeGestureExpiresAt = Date.now() + def.durationMs;
        this.vrActiveGestureTimer = def.durationMs / 1000;
        this.emitVRState();
      }
    }
    return { emoteId: def.id, durationMs: def.durationMs };
  }

  public cancelLocalEmote() {
    this.avatar.clearEmote();
    if (this.vrState.activeGesture !== null) {
      this.vrState.activeGesture = null;
      this.vrState.activeGestureLabel = null;
      this.vrState.activeGestureExpiresAt = 0;
      this.vrActiveGestureTimer = 0;
      this.emitVRState();
    }
  }

  public triggerRemotePlayerEmote(id: string, emoteId: EmoteId, durationMs?: number) {
    const entry = this.remoteAvatars.get(id);
    if (entry && isValidEmoteId(emoteId)) {
      entry.avatar.triggerEmote(emoteId, durationMs);
    }
  }

  public removeRemotePlayer(id: string) {
    const entry = this.remoteAvatars.get(id);
    if (entry) {
      this.scene.remove(entry.avatar.root);
      entry.avatar.dispose();
      this.remoteAvatars.delete(id);
    }
  }

  public getCurrentSurface(): SurfaceType {
    return this.currentSurface;
  }

  public respawnPlayer(manual: boolean = false) {
    const cp = this.worldData.checkpoints[this.currentCheckpointId] || this.worldData.checkpoints[0];
    this.playerPos.set(cp.position[0], cp.position[1] + 1.2, cp.position[2]);
    this.playerVel.set(0, 0, 0);
    this.footstepTimer = 0;
    this.currentSurface = this.currentGameId === 'doors' ? 'wood' : this.currentGameId === 'bee_swarm' ? 'grass' : 'stone';
    this.stats.hp = this.stats.maxHp;
    if (manual) {
      this.callbacks.onChatMessage('Персонаж перезагружен.');
    } else {
      this.stats.deaths += 1;
      this.callbacks.onChatMessage('Вы упали или обожглись! Возрождение на чекпоинте.', 'Система');
    }
    sound.playOof();
    this.consecutiveJumpsWithoutDeath = 0;
    this.lavaSurvivalTimer = 0;
    this.avatar.targetSquashY = 0.7; // landing squash
    this.callbacks.onStatsUpdate({ ...this.stats });
  }

  public unlockAchievement(id: string) {
    if (this.unlockedAchievements.has(id)) return;
    this.unlockedAchievements.add(id);
    saveUnlockedAchievement(id);

    const meta = ACHIEVEMENTS_REGISTRY[id];
    if (meta) {
      sound.playAchievement();
      this.spawnParticleBurst(this.playerPos.x, this.playerPos.y + 2, this.playerPos.z, 0xfacc15, 25);
      this.callbacks.onAchievementUnlocked?.(id, meta);
      this.callbacks.onChatMessage(`🏆 [ДОСТИЖЕНИЕ]: «${meta.title}» разблокировано (+${meta.rewardCoins} 🪙)!`, 'Достижения');
      this.stats.coins += meta.rewardCoins;
      this.callbacks.onStatsUpdate({ ...this.stats });
    }
  }

  public updateQuestProgress(questCategoryOrId: QuestCategory | string, amount: number = 1) {
    try {
      const { newlyCompleted } = advanceQuestProgress(questCategoryOrId, amount);
      for (const q of newlyCompleted) {
        this.callbacks.onChatMessage(`🎉 Квест выполнен: "${q.title}"! Заберите награду в виджете.`, 'Задания');
        sound.playAchievement();
      }
    } catch {}
  }

  public updateSkin(skin: CharacterSkin) {
    this.playerSkin = skin;
    this.avatar.updateSkin(skin);
  }

  public setKeybinds(cfg: KeybindsConfig) {
    this.keybinds = { ...cfg };
  }

  public setGodMode(enabled: boolean) {
    this.isGodMode = enabled;
    this.callbacks.onChatMessage(
      enabled ? '👑 [ADMIN]: Бессмертие (God Mode) АКТИВИРОВАНО!' : '👑 [ADMIN]: Бессмертие выключено.'
    );
    if (enabled) {
      this.spawnParticleBurst(this.playerPos.x, this.playerPos.y + 2, this.playerPos.z, 0x10b981, 25);
      sound.playSuperJump();
    }
  }

  public setFlyMode(enabled: boolean) {
    this.isFlying = enabled;
    this.callbacks.onChatMessage(
      enabled
        ? '👑 [ADMIN]: Режим полёта (Fly Mode) АКТИВИРОВАН! [Пробел] вверх, [Shift/Ctrl] вниз.'
        : '👑 [ADMIN]: Режим полёта выключен.'
    );
    if (enabled) {
      this.spawnParticleBurst(this.playerPos.x, this.playerPos.y + 2, this.playerPos.z, 0x38bdf8, 25);
      sound.playSuperJump();
    }
  }

  public setSpeedMultiplier(val: number) {
    this.speedMultiplier = val;
    this.callbacks.onChatMessage(`👑 [ADMIN]: Множитель скорости установлен на ${val}x!`);
  }

  public setJumpMultiplier(val: number) {
    this.jumpMultiplier = val;
    this.callbacks.onChatMessage(`👑 [ADMIN]: Множитель прыжка установлен на ${val}x!`);
  }

  public teleportToCheckpoint(cpId: number) {
    const cp = this.worldData.checkpoints[cpId] || this.worldData.checkpoints[0];
    if (cp) {
      this.playerPos.set(cp.position[0], cp.position[1] + 1.2, cp.position[2]);
      this.playerVel.set(0, 0, 0);
      this.currentCheckpointId = Math.max(this.currentCheckpointId, cpId);
      this.stats.currentCheckpoint = this.currentCheckpointId;
      this.spawnParticleBurst(cp.position[0], cp.position[1] + 2, cp.position[2], 0xfacc15, 30);
      sound.playSuperJump();
      this.callbacks.onChatMessage(`👑 [ADMIN]: Телепортация на «${cp.name}» (Чекпоинт ${cpId}) выполнена!`);
      this.callbacks.onStatsUpdate({ ...this.stats });
    }
  }

  public triggerAdminBlast() {
    sound.playVictory();
    for (let i = 0; i < 4; i++) {
      setTimeout(() => {
        this.spawnParticleBurst(
          this.playerPos.x + (Math.random() - 0.5) * 6,
          this.playerPos.y + 2 + Math.random() * 4,
          this.playerPos.z + (Math.random() - 0.5) * 6,
          [0xfacc15, 0xef4444, 0x3b82f6, 0x10b981, 0xa855f7][i],
          35
        );
      }, i * 150);
    }
    this.callbacks.onChatMessage('🎆 [ADMIN]: Салют администратора запущен! 🎆');
  }

  public healPlayer() {
    this.stats.hp = this.stats.maxHp;
    this.spawnParticleBurst(this.playerPos.x, this.playerPos.y + 2, this.playerPos.z, 0xef4444, 20);
    sound.playCoin();
    this.callbacks.onChatMessage('❤️ [ADMIN]: Здоровье полностью восстановлено (100 HP)!');
    this.callbacks.onStatsUpdate({ ...this.stats });
  }

  public grantBeeHoney(amount: number = 5000) {
    this.beeFarmState.honey += amount;
    this.stats.coins += amount;
    sound.playAchievement();
    this.spawnParticleBurst(this.playerPos.x, this.playerPos.y + 2, this.playerPos.z, 0xfacc15, 28);
    this.callbacks.onChatMessage(`🍯 [ADMIN]: Выдано +${amount.toLocaleString()} мёда / монет!`);
    this.callbacks.onBeeFarmUpdate?.({ ...this.beeFarmState });
    this.callbacks.onStatsUpdate({ ...this.stats });
  }

  // ============================================================================
  // VR & 6DoF MOTION CONTROLLER / HAND TRACKING API
  // ============================================================================

  private emitVRState() {
    this.callbacks.onVRStateUpdate?.({
      ...this.vrState,
      leftController: {
        ...this.vrState.leftController,
        position: [...this.vrState.leftController.position] as [number, number, number],
        rotation: [...this.vrState.leftController.rotation] as [number, number, number],
        thumbstick: [...this.vrState.leftController.thumbstick] as [number, number],
      },
      rightController: {
        ...this.vrState.rightController,
        position: [...this.vrState.rightController.position] as [number, number, number],
        rotation: [...this.vrState.rightController.rotation] as [number, number, number],
        thumbstick: [...this.vrState.rightController.thumbstick] as [number, number],
      },
      teleportTarget: this.vrState.teleportTarget
        ? ([...this.vrState.teleportTarget] as [number, number, number])
        : null,
    });
  }

  private applyPerformanceProfile() {
    const lowCostRender =
      this.isSoftwareGl ||
      this.currentGameId === 'doors' ||
      (this.vrState.enabled && this.vrState.performanceMode);

    if (!this.isSoftwareGl) {
      this.sunLight.castShadow = !lowCostRender;
    }

    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    let targetRatio = Math.min(dpr, 1.5);
    if (this.isSoftwareGl) {
      targetRatio = 1;
    } else if (this.vrState.enabled && this.vrState.displayMode === 'stereo_sbs') {
      targetRatio = 1;
    } else if (this.vrState.enabled && this.vrState.performanceMode) {
      targetRatio = Math.min(dpr, 1.25);
    }
    if (Math.abs(this.renderer.getPixelRatio() - targetRatio) > 0.01) {
      this.renderer.setPixelRatio(targetRatio);
    }

    const xrAny = this.renderer.xr as any;
    if (this.renderer.xr.isPresenting) {
      try {
        xrAny.setFoveation?.(this.vrState.performanceMode ? 1.0 : 0.65);
        xrAny.setFramebufferScaleFactor?.(this.vrState.performanceMode ? 0.85 : 1.0);
      } catch {}
    }
  }

  private resetXRTrackingCaches() {
    this.vrLastXrLeftPose = null;
    this.vrLastXrRightPose = null;
    this.vrPrevXrRightTrig = false;
    this.vrPrevXrLeftTrig = false;
    this.vrPrevXrLeftGrip = false;
    this.vrPrevXrLeftPrimary = false;
    this.vrPrevXrLeftSecondary = false;
    this.vrPrevXrLeftThumb = false;
    this.vrPrevXrPrimaryR = false;
    this.vrPrevXrSecondaryR = false;
    this.vrPrevXrLeftMenu = false;
    this.vrMenuHoveredAction = null;
    this.vrPrevXrRightHandX = null;
    this.vrMoveStickX = 0;
    this.vrMoveStickY = 0;
    this.vrHeadLocalPos = [0, 1.6, 0];
    this.vrHeadLocalQuat = [0, 0, 0, 1];
  }

  /**
   * Reads the canonical HMD head position and orientation in vrXROrigin (local-floor) space
   * from the live WebXR XRViewerPose, falling back cleanly to the Three.js camera local transform.
   */
  private readLiveXRHeadPose(): {
    position: [number, number, number];
    quaternion: [number, number, number, number];
  } {
    const xrFrame = this.renderer.xr.getFrame?.() as any;
    const xrRefSpace = this.renderer.xr.getReferenceSpace?.() as any;
    let viewerPos: [number, number, number] | null = null;
    let viewerQuat: [number, number, number, number] | null = null;

    if (xrFrame && xrRefSpace && typeof xrFrame.getViewerPose === 'function') {
      try {
        const viewerPose = xrFrame.getViewerPose(xrRefSpace);
        const p = viewerPose?.transform?.position;
        const o = viewerPose?.transform?.orientation;
        if (p && o) {
          viewerPos = [p.x, p.y, p.z];
          viewerQuat = [o.x, o.y, o.z, o.w];
        }
      } catch {
        // Ignore transient XRViewerPose query failures during session transitions
      }
    }

    const resolved = resolveVRHeadPoseInOrigin(
      viewerPos,
      viewerQuat,
      [this.camera.position.x, this.camera.position.y, this.camera.position.z],
      [this.camera.quaternion.x, this.camera.quaternion.y, this.camera.quaternion.z, this.camera.quaternion.w]
    );
    this.vrHeadLocalPos = resolved.position;
    this.vrHeadLocalQuat = resolved.quaternion;
    return resolved;
  }

  /**
   * Synchronizes the VR character controller root (vrXROrigin), headset camera, and vrCameraRig
   * so head position/orientation and tracked hands stay locked together with zero frame lag during movement,
   * while lifting eyes cleanly to the Roblox world height scale (avoiding feeling short in VR).
   */
  private syncVRCharacterControllerOrigin() {
    if (this.vrXROrigin.parent !== this.scene) {
      this.scene.add(this.vrXROrigin);
    }
    if (this.camera.parent !== this.vrXROrigin) {
      this.vrXROrigin.add(this.camera);
    }
    if (this.vrCameraRig.parent !== this.vrXROrigin) {
      this.vrXROrigin.add(this.vrCameraRig);
    }

    const headPose = this.readLiveXRHeadPose();
    if (
      this.vrNeedsHeightAutoCalibrate &&
      this.renderer.xr.isPresenting &&
      headPose.position[1] > 0.25 &&
      headPose.position[1] < 2.6
    ) {
      this.vrState.heightOffset = calibrateVRHeightOffset(headPose.position[1]);
      this.vrNeedsHeightAutoCalibrate = false;
      this.emitVRState();
    }

    const isCrouching = this.currentGameId === 'doors' && this.doorsState.isCrouching;
    const xrOriginY = computeVRXROriginY(this.playerPos.y, this.vrState.heightOffset, isCrouching);

    this.vrXROrigin.position.set(this.playerPos.x, xrOriginY, this.playerPos.z);
    this.vrXROrigin.rotation.set(0, this.cameraYaw, 0);
    this.vrXROrigin.updateMatrixWorld(true);
    this.renderer.xr.updateCamera?.(this.camera);

    this.vrCameraRig.position.set(headPose.position[0], headPose.position[1], headPose.position[2]);
    this.vrCameraRig.quaternion.set(
      headPose.quaternion[0],
      headPose.quaternion[1],
      headPose.quaternion[2],
      headPose.quaternion[3]
    );
    this.vrCameraRig.updateMatrixWorld(true);
    this.vrCameraRig.getWorldPosition(this.vrHeadWorldPos);
    this.vrCameraRig.getWorldQuaternion(this.vrHeadWorldQuat);
  }

  /**
   * Polls WebXR thumbsticks BEFORE physics/locomotion runs so gaze-directed movement and turning
   * apply on the current frame without 1-frame lag or stuck axes.
   */
  private pollXRCharacterLocomotionInput(dt: number) {
    this.vrMoveStickX = 0;
    this.vrMoveStickY = 0;

    const xrSession = this.renderer.xr.getSession?.();
    if (!xrSession || !xrSession.inputSources) return;

    for (const src of xrSession.inputSources) {
      const gp = (src as any).gamepad;
      if (!gp) continue;
      const parsed = parseXRGamepadState(gp.buttons, gp.axes);

      if (src.handedness === 'left') {
        this.vrMoveStickX = parsed.thumbstick[0];
        this.vrMoveStickY = parsed.thumbstick[1];
      } else if (src.handedness === 'right') {
        if (this.vrState.smoothTurn) {
          if (Math.abs(parsed.thumbstick[0]) > 0.14) {
            this.cameraYaw -= parsed.thumbstick[0] * 2.2 * dt;
          }
        } else if (Math.abs(parsed.thumbstick[0]) > 0.65 && this.vrSnapTurnCooldown <= 0) {
          this.vrSnapTurnCooldown = 0.35;
          this.triggerVRSnapTurn(parsed.thumbstick[0] > 0 ? 1 : -1);
        }
      }
    }
  }

  /**
   * Computes the active 3D world-space camera gaze forward vector.
   * In WebXR, composes vrXROrigin yaw with the live HMD orientation quaternion.
   */
  private getCameraWorldLookDirection(outDir: THREE.Vector3) {
    if (this.vrState.enabled && this.renderer.xr.isPresenting) {
      const headPose = this.readLiveXRHeadPose();
      const gaze = computeVRWorldGazeDirection(this.cameraYaw, headPose.quaternion);
      outDir.set(gaze[0], gaze[1], gaze[2]);
      return;
    }

    if (this.vrState.enabled) {
      // Non-WebXR 6DoF VR: orient from current yaw/pitch and read camera forward vector
      outDir
        .set(
          -Math.sin(this.cameraYaw) * Math.cos(this.cameraPitch),
          -Math.sin(this.cameraPitch),
          -Math.cos(this.cameraYaw) * Math.cos(this.cameraPitch)
        )
        .normalize();
      return;
    }

    outDir
      .set(
        -Math.sin(this.cameraYaw) * Math.cos(this.cameraPitch),
        -Math.sin(this.cameraPitch),
        -Math.cos(this.cameraYaw) * Math.cos(this.cameraPitch)
      )
      .normalize();
  }

  private getMovementAxes(outForward: THREE.Vector3, outRight: THREE.Vector3) {
    if (this.vrState.enabled) {
      this.getCameraWorldLookDirection(this.vrScratchDir);
      const axes = computeVRGazeMovementAxes(
        [this.vrScratchDir.x, this.vrScratchDir.y, this.vrScratchDir.z],
        this.cameraYaw
      );
      outForward.set(axes.forward[0], axes.forward[1], axes.forward[2]);
      outRight.set(axes.right[0], axes.right[1], axes.right[2]);
      return;
    }

    // Standard non-VR horizontal movement relative to camera yaw
    outForward.set(-Math.sin(this.cameraYaw), 0, -Math.cos(this.cameraYaw));
    outRight.set(Math.cos(this.cameraYaw), 0, -Math.sin(this.cameraYaw));
  }

  private vrFeatureEnabled: boolean = false;

  public setVRFeatureEnabled(enabled: boolean) {
    this.vrFeatureEnabled = Boolean(enabled);
    if (!this.vrFeatureEnabled && this.vrState.enabled) {
      this.toggleVRMode(false);
    }
  }

  public toggleVRMode(force?: boolean) {
    const next = typeof force === 'boolean' ? force : !this.vrState.enabled;
    if (next && !this.vrFeatureEnabled) {
      return;
    }
    this.vrState.enabled = next;
    this.vrCameraRig.visible = next;
    if (!next) {
      const activeSession = this.renderer.xr.getSession?.();
      if (activeSession && typeof activeSession.end === 'function') {
        activeSession.end().catch(() => {});
      }
      if (this.camera.parent !== this.scene) {
        this.scene.add(this.camera);
      }
      if (this.vrCameraRig.parent !== this.scene) {
        this.scene.add(this.vrCameraRig);
      }
      this.vrXROrigin.position.set(0, 0, 0);
      this.vrXROrigin.rotation.set(0, 0, 0);
      this.resetXRTrackingCaches();
      this.vrTeleportReticle.root.visible = false;
      this.vrPicoGuardian.root.visible = false;
      this.vrState.vignetteIntensity = 0;
      this.vrState.activeGesture = null;
      this.vrState.activeGestureLabel = null;
      this.vrState.activeGestureExpiresAt = 0;
      this.vrActiveGestureTimer = 0;
      this.vrGestureRecognizer.reset();
      this.vrWaveOscillationEnergy = 0;
      if (this.currentGameId !== 'doors') {
        this.avatar.root.visible = true;
      }
      this.vrCameraRig.visible = false;
      this.vrAlertHUD.root.visible = false;
      this.vrControlsCard.root.visible = false;
      this.vrMainMenu.root.visible = false;
      this.vrState.vrMenuOpen = false;
      this.vrMenuHoveredAction = null;
      this.camera.near = 0.1;
      this.camera.fov = 65;
      this.camera.zoom = 1;
      this.renderer.setScissorTest(false);
      this.applyPerformanceProfile();
      this.handleResize();
    } else {
      this.avatar.root.visible = false;
      this.camera.near = 0.04;
      this.camera.updateProjectionMatrix();
      if (this.currentGameId !== 'doors') {
        this.cameraPitch = 0.05;
      }
      this.applyPerformanceProfile();
      this.vrState.lastActionLabel =
        this.vrState.controllerProfile === 'pico4'
          ? 'PICO 4 / Ultra 6DoF активирован'
          : 'VR 6DoF активирован';
      this.triggerVRHapticPulse(0.8, 60);
    }
    this.emitVRState();
    this.callbacks.onChatMessage(
      next
        ? '🥽 Включён режим PICO 4 / WebXR 6DoF! Левая кнопка [X] — 3D Главное меню VR, кнопка [Y] / L3 — скрыть памятку кнопок.'
        : '🖥️ Выход из режима VR в стандартный 3D вид.',
      'VR Система'
    );
  }

  public async startWebXRSession() {
    if (!this.vrState.enabled) {
      this.toggleVRMode(true);
    }
    const navXr = (navigator as unknown as {
      xr?: {
        isSessionSupported?: (mode: string) => Promise<boolean>;
        requestSession?: (mode: string, opts?: object) => Promise<any>;
      };
    })?.xr;

    if (navXr && typeof navXr.requestSession === 'function') {
      try {
        const supported = await navXr.isSessionSupported?.('immersive-vr');
        if (supported) {
          const session = await navXr.requestSession('immersive-vr', {
            optionalFeatures: ['local-floor', 'bounded-floor', 'hand-tracking', 'layers'],
          });
          this.resetXRTrackingCaches();
          this.vrNeedsHeightAutoCalibrate = true;
          this.camera.near = 0.04;
          this.camera.updateProjectionMatrix();
          if (this.vrXROrigin.parent !== this.scene) {
            this.scene.add(this.vrXROrigin);
          }
          const startOriginY = computeVRXROriginY(
            this.playerPos.y,
            this.vrState.heightOffset,
            this.currentGameId === 'doors' && this.doorsState.isCrouching
          );
          this.vrXROrigin.position.set(this.playerPos.x, startOriginY, this.playerPos.z);
          this.vrXROrigin.rotation.set(0, this.cameraYaw, 0);
          this.vrXROrigin.add(this.camera);
          this.vrXROrigin.add(this.vrCameraRig);
          this.vrCameraRig.position.set(0, 1.6, 0);
          this.vrCameraRig.quaternion.identity();
          this.renderer.xr.setReferenceSpaceType?.('local-floor');
          await this.renderer.xr.setSession(session);
          this.applyPerformanceProfile();
          if (this.renderTickFn) {
            this.renderer.setAnimationLoop(this.renderTickFn);
          }
          this.vrState.inWebXRSession = true;
          this.vrState.displayMode = 'webxr_immersive';
          this.vrState.lastActionLabel = 'PICO / WebXR Шлем подключён';
          session.addEventListener('end', () => {
            this.scene.add(this.camera);
            this.scene.add(this.vrCameraRig);
            this.vrXROrigin.position.set(0, 0, 0);
            this.vrXROrigin.rotation.set(0, 0, 0);
            this.resetXRTrackingCaches();
            this.vrNeedsHeightAutoCalibrate = false;
            this.camera.near = this.vrState.enabled ? 0.04 : 0.1;
            this.camera.fov = 65;
            this.camera.zoom = 1;
            this.vrState.inWebXRSession = false;
            this.vrState.displayMode = 'mono_6dof';
            this.applyPerformanceProfile();
            this.handleResize();
            if (this.isSoftwareGl && this.renderTickFn) {
              this.renderer.setAnimationLoop(null);
              this.afterDraw(this.renderTickFn);
            }
            this.emitVRState();
          });
          this.emitVRState();
          this.callbacks.onChatMessage('🥽 Аппаратная сессия PICO / WebXR запущена в VR-шлеме!', 'VR Система');
          return;
        }
      } catch {
        if (this.camera.parent !== this.scene) {
          this.scene.add(this.camera);
        }
        if (this.vrCameraRig.parent !== this.scene) {
          this.scene.add(this.vrCameraRig);
        }
        // Fall through to in-browser 6DoF stereo/mono VR simulator
      }
    }

    this.vrState.lastActionLabel = 'PICO 4 6DoF Симулятор активен';
    this.emitVRState();
    this.callbacks.onChatMessage(
      '🥽 Активирован PICO 4 / Ultra 6DoF трекинг контроллеров и рук в браузере (поддерживает PICO Browser и PICO Connect WebXR)!',
      'VR Система'
    );
  }

  public setVRControllerProfile(profile: VRControllerProfile) {
    this.vrState.controllerProfile = profile;
    this.vrState.detectedHeadsetName =
      profile === 'pico4'
        ? 'PICO 4 / PICO 4 Ultra (HyperSense 6DoF)'
        : 'Meta Quest Touch Pro (6DoF)';
    if (!this.vrState.enabled) {
      this.toggleVRMode(true);
    }
    this.vrState.lastActionLabel =
      profile === 'pico4' ? 'Профиль: PICO 4 / Ultra (HyperSense)' : 'Профиль: Quest Touch Pro';
    this.emitVRState();
    this.callbacks.onChatMessage(
      profile === 'pico4'
        ? '⚪ [PICO VR]: Выбраны 6DoF-контроллеры PICO 4 / PICO 4 Ultra с диагональной дугой HyperSense!'
        : '⚫ [VR]: Выбраны 6DoF-контроллеры Quest Touch Pro!',
      'VR Система'
    );
  }

  public setVRTrackingMode(mode: VRTrackingMode) {
    this.vrState.trackingMode = mode;
    if (!this.vrState.enabled) {
      this.toggleVRMode(true);
    }
    this.vrState.lastActionLabel =
      mode === 'hands'
        ? 'PICO Optical Hand Tracking (25 суставов)'
        : this.vrState.controllerProfile === 'pico4'
        ? 'Контроллеры PICO 4 HyperSense 6DoF'
        : 'Контроллеры Quest Touch 6DoF';
    this.emitVRState();
    this.callbacks.onChatMessage(
      mode === 'hands'
        ? '🖐️ [PICO VR]: Включено оптическое отслеживание рук PICO (5 пальцев + жест щипка)!'
        : '🎮 [PICO VR]: Включены 6DoF контроллеры с лазерными лучами!',
      'VR Система'
    );
  }

  public setVRDisplayMode(mode: VRDisplayMode) {
    this.vrState.displayMode = mode;
    if (!this.vrState.enabled) {
      this.toggleVRMode(true);
    }
    this.vrState.lastActionLabel =
      mode === 'stereo_sbs' ? 'Стерео SBS (PICO Pancake линзы)' : 'Панорамный 6DoF экран';
    this.applyPerformanceProfile();
    this.handleResize();
    this.emitVRState();
  }

  public setVROptions(
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
  ) {
    if (typeof opts.heightOffset === 'number' && Number.isFinite(opts.heightOffset)) {
      const clampedHeight = Number(
        Math.max(VR_MIN_HEIGHT_OFFSET, Math.min(VR_MAX_HEIGHT_OFFSET, opts.heightOffset)).toFixed(2)
      );
      this.vrState.heightOffset = clampedHeight;
      this.vrNeedsHeightAutoCalibrate = false;
      this.vrState.lastActionLabel = `Высота глаз VR: +${clampedHeight.toFixed(2)}м`;
    }
    const { heightOffset: _ignoredHeight, ...restOpts } = opts;
    Object.assign(this.vrState, restOpts);
    this.applyPerformanceProfile();
    this.emitVRState();
  }

  public calibrateVRStandingHeight() {
    if (this.renderer.xr.isPresenting) {
      const headPose = this.readLiveXRHeadPose();
      this.vrState.heightOffset = calibrateVRHeightOffset(headPose.position[1]);
    } else {
      this.vrState.heightOffset = VR_DEFAULT_HEIGHT_OFFSET;
    }
    this.vrNeedsHeightAutoCalibrate = false;
    this.vrState.lastActionLabel = `Рост VR выровнен (+${this.vrState.heightOffset.toFixed(2)}м)`;
    this.triggerVRHapticPulse(0.55, 35);
    this.emitVRState();
  }

  public toggleVRControlsHint(force?: boolean) {
    const next = typeof force === 'boolean' ? force : !this.vrState.controlsHintVisible;
    this.vrState.controlsHintVisible = next;
    this.vrState.lastActionLabel = next ? 'Памятка кнопок VR показана [Y]' : 'Памятка кнопок VR скрыта [Y]';
    this.triggerVRHapticPulse(0.35, 25);
    this.emitVRState();
  }

  public toggleVRMainMenu(force?: boolean) {
    const next = typeof force === 'boolean' ? force : !this.vrState.vrMenuOpen;
    if (next && !this.vrState.enabled) {
      this.toggleVRMode(true);
    }
    this.vrState.vrMenuOpen = next;
    this.vrMenuHoveredAction = null;
    if (next) {
      if (!this.renderer.xr.isPresenting) {
        this.updateCamera(0.016);
      }
      const headPos = this.renderer.xr.isPresenting ? this.vrHeadWorldPos : this.camera.position;
      this.getCameraWorldLookDirection(this.vrScratchDir);
      this.vrMainMenu.placeInFrontOfHead(
        [headPos.x, headPos.y, headPos.z],
        [this.vrScratchDir.x, this.vrScratchDir.y, this.vrScratchDir.z],
        1.65
      );
      this.vrMainMenu.updateMenu({
        visible: true,
        currentGameId: this.currentGameId,
        hp: this.stats.hp,
        coins: this.stats.coins,
        heightOffset: this.vrState.heightOffset,
        controlsHintVisible: this.vrState.controlsHintVisible,
        trackingMode: this.vrState.trackingMode,
        portalGunActive: this.activeTool === 'portal_gun',
        hoveredActionId: null,
      });
      this.vrState.lastActionLabel = '3D Главное меню VR открыто [X]';
      this.triggerVRHapticPulse(0.55, 35);
      sound.playCoin();
    } else {
      this.vrMainMenu.root.visible = false;
      this.vrState.lastActionLabel = '3D Главное меню VR закрыто';
      this.triggerVRHapticPulse(0.35, 20);
    }
    this.emitVRState();
  }

  public executeVRMenuAction(actionId: VRMenuActionId) {
    this.triggerVRHapticPulse(0.75, 45);
    sound.playCoin();

    if (actionId.startsWith('game:')) {
      const targetGame = actionId.slice(5) as GameId;
      this.toggleVRMainMenu(false);
      if (this.callbacks.onVRSwitchGame) {
        this.callbacks.onVRSwitchGame(targetGame);
      } else {
        this.loadGameWorld(targetGame);
      }
      this.vrState.lastActionLabel = `VR переход в мир: ${targetGame.toUpperCase()}`;
      this.emitVRState();
      return;
    }

    switch (actionId) {
      case 'action:height_down':
        this.setVROptions({ heightOffset: this.vrState.heightOffset - 0.15 });
        break;
      case 'action:height_up':
        this.setVROptions({ heightOffset: this.vrState.heightOffset + 0.15 });
        break;
      case 'action:height_auto':
        this.calibrateVRStandingHeight();
        break;
      case 'action:toggle_hint':
        this.toggleVRControlsHint();
        break;
      case 'action:toggle_portal_gun':
        this.selectTool(this.activeTool === 'portal_gun' ? 'sword' : 'portal_gun');
        this.toggleVRMainMenu(false);
        break;
      case 'action:resume':
        this.toggleVRMainMenu(false);
        break;
      case 'action:respawn':
        this.toggleVRMainMenu(false);
        this.respawnPlayer(true);
        break;
      case 'action:toggle_tracking':
        this.setVRTrackingMode(this.vrState.trackingMode === 'controllers' ? 'hands' : 'controllers');
        break;
      case 'action:exit_main_menu':
        this.toggleVRMainMenu(false);
        this.toggleVRMode(false);
        this.callbacks.onVRReturnToTitle?.();
        break;
    }
  }

  public triggerVRSnapTurn(direction: -1 | 1) {
    this.cameraYaw = computeSnapTurnYaw(this.cameraYaw, direction, this.vrState.snapTurnDegrees);
    this.vrTeleportFlashTimer = Math.max(this.vrTeleportFlashTimer, 0.14);
    this.vrState.lastActionLabel = `Snap-Поворот ${direction < 0 ? '-' : '+'}${this.vrState.snapTurnDegrees}°`;
    this.triggerVRHapticPulse(0.45, 30);
    sound.playJump();
    this.emitVRState();
  }

  public triggerVRTeleport() {
    if (!this.vrState.enabled) {
      this.toggleVRMode(true);
    }
    if (this.currentGameId === 'doors' && this.doorsState.isHidingInCloset) {
      return;
    }

    let dest: [number, number, number] | null = this.vrState.teleportTarget;
    if (!dest) {
      // Fallback: step 5.5m forward along VR gaze horizontal direction
      this.getMovementAxes(this.vrScratchForward, this.vrScratchRight);
      dest = [
        Number((this.playerPos.x + this.vrScratchForward.x * 5.5).toFixed(2)),
        Number(this.playerPos.y.toFixed(2)),
        Number((this.playerPos.z + this.vrScratchForward.z * 5.5).toFixed(2)),
      ];
    }

    // Clamp inside DOORS corridor bounds if in DOORS mode
    let targetX = dest[0];
    let targetZ = dest[2];
    if (this.currentGameId === 'doors') {
      targetX = Math.max(-13.5, Math.min(13.5, targetX));
      const maxOpenedZ = (this.doorsState.currentDoorNumber - 1) * 26 + 22;
      targetZ = Math.max(-6.0, Math.min(maxOpenedZ, targetZ));
    }

    this.playerPos.set(targetX, this.playerPos.y + 0.15, targetZ);
    this.playerVel.set(0, 0, 0);
    this.vrTeleportFlashTimer = 0.24;
    this.vrGripDecay = 1.0;
    this.vrState.lastActionLabel = `VR Телепорт → [${targetX.toFixed(1)}, ${targetZ.toFixed(1)}м]`;
    this.spawnParticleBurst(targetX, this.playerPos.y + 1.0, targetZ, 0x38bdf8, 22);
    this.triggerVRHapticPulse(0.9, 70);
    sound.playSuperJump();
    this.emitVRState();
  }

  public triggerVRHapticPulse(intensity: number = 0.75, durationMs: number = 50) {
    this.vrState.hapticPulseCount += 1;
    this.vrState.lastActionLabel = `Виброимпульс (${Math.round(intensity * 100)}%, ${durationMs}мс)`;
    try {
      const session = this.renderer.xr.getSession?.();
      if (session && session.inputSources) {
        for (const src of session.inputSources) {
          const actuator = (src as any)?.gamepad?.hapticActuators?.[0];
          if (actuator && typeof actuator.pulse === 'function') {
            actuator.pulse(intensity, durationMs);
          }
        }
      }
      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        navigator.vibrate(durationMs);
      }
    } catch {}
    this.emitVRState();
  }

  public recenterVRPose() {
    this.vrPointerNormX = 0;
    this.vrPointerNormY = 0;
    this.cameraPitch = this.currentGameId === 'doors' || this.vrState.enabled ? 0.02 : 0.35;
    this.vrState.lastActionLabel = 'Поза 6DoF отцентрирована';
    this.emitVRState();
  }

  public triggerVRGesture(gestureId: VRHandGestureId): { emoteId: EmoteId; durationMs: number; gestureId: VRHandGestureId } {
    if (!this.vrState.enabled) {
      this.toggleVRMode(true);
    }
    const def = getVRGestureDefinition(gestureId);
    const { emoteId, durationMs } = this.triggerLocalEmote(def.emoteId);
    this.vrState.activeGesture = def.id;
    this.vrState.activeGestureLabel = `${def.emoji} ${def.label}`;
    this.vrState.activeGestureExpiresAt = Date.now() + durationMs;
    this.vrActiveGestureTimer = durationMs / 1000;
    this.vrState.lastActionLabel = `Жест VR: ${def.emoji} ${def.label}`;
    this.triggerVRHapticPulse(0.68, 45);
    this.callbacks.onVRGestureEmote?.(emoteId, durationMs, def.id);
    this.emitVRState();
    return { emoteId, durationMs, gestureId: def.id };
  }

  private startLoop() {
    let renderBusy = false;
    const tick = () => {
      if (this.isDestroyed) return;

      const now = performance.now();
      const rawDt = (now - this.lastTime) / 1000;
      this.lastTime = now;
      const dt = Math.min(rawDt, 0.05); // Clamp dt

      this.updateSimulation(dt, now / 1000);

      // Render (Single Screen vs True Split-Screen for Local Co-op)
      if (this.localCoopEnabled) {
        const width = this.mountEl.clientWidth || window.innerWidth;
        const height = this.mountEl.clientHeight || window.innerHeight;
        const halfW = Math.max(1, Math.floor(width / 2));
        const rightW = Math.max(1, width - halfW);

        this.renderer.setScissorTest(true);

        const p1WasVisible = this.avatar.root.visible;
        const p2WasVisible = this.player2Avatar ? this.player2Avatar.root.visible : false;

        // Left Viewport: Player 1
        if (this.currentGameId === 'doors') {
          this.avatar.root.visible = false;
          if (this.player2Avatar) this.player2Avatar.root.visible = true;
        }
        this.camera.aspect = halfW / Math.max(1, height);
        this.camera.updateProjectionMatrix();
        this.renderer.setViewport(0, 0, halfW, height);
        this.renderer.setScissor(0, 0, halfW, height);
        this.renderer.render(this.scene, this.camera);

        // Right Viewport: Player 2
        if (this.currentGameId === 'doors') {
          this.avatar.root.visible = true;
          if (this.player2Avatar) this.player2Avatar.root.visible = false;
        }
        this.camera2.aspect = rightW / Math.max(1, height);
        this.camera2.updateProjectionMatrix();
        this.renderer.setViewport(halfW, 0, rightW, height);
        this.renderer.setScissor(halfW, 0, rightW, height);
        this.renderer.render(this.scene, this.camera2);

        if (this.currentGameId === 'doors') {
          this.avatar.root.visible = p1WasVisible;
          if (this.player2Avatar) this.player2Avatar.root.visible = p2WasVisible;
        }
      } else if (this.renderer.xr.isPresenting) {
        // Real PICO / WebXR immersive frame rendering: ensure origin, head rig, and hands are locked together
        this.syncVRCharacterControllerOrigin();
        this.renderer.setScissorTest(false);
        this.renderer.render(this.scene, this.camera);
      } else if (this.vrState.enabled && this.vrState.displayMode === 'stereo_sbs') {
        // STEREOSCOPIC SIDE-BY-SIDE (SBS) 3D VR LENS RENDERING (LEFT EYE + RIGHT EYE WITH IPD OFFSET)
        const width = this.mountEl.clientWidth || window.innerWidth;
        const height = this.mountEl.clientHeight || window.innerHeight;
        const halfW = Math.max(1, Math.floor(width / 2));
        const rightW = Math.max(1, width - halfW);
        const eyeOffset = computeStereoEyeOffset(this.vrState.ipdMm);

        this.vrSavedCamPos.copy(this.camera.position);
        this.vrScratchRight.set(1, 0, 0).applyQuaternion(this.camera.quaternion);

        this.renderer.setScissorTest(true);

        // Left Eye Viewport
        this.camera.position.copy(this.vrSavedCamPos).addScaledVector(this.vrScratchRight, -eyeOffset);
        this.camera.aspect = halfW / Math.max(1, height);
        this.camera.updateProjectionMatrix();
        this.renderer.setViewport(0, 0, halfW, height);
        this.renderer.setScissor(0, 0, halfW, height);
        this.renderer.render(this.scene, this.camera);

        // Right Eye Viewport
        this.camera.position.copy(this.vrSavedCamPos).addScaledVector(this.vrScratchRight, eyeOffset);
        this.camera.aspect = rightW / Math.max(1, height);
        this.camera.updateProjectionMatrix();
        this.renderer.setViewport(halfW, 0, rightW, height);
        this.renderer.setScissor(halfW, 0, rightW, height);
        this.renderer.render(this.scene, this.camera);

        // Restore center camera position & aspect
        this.camera.position.copy(this.vrSavedCamPos);
      } else {
        this.renderer.setScissorTest(false);
        const width = this.mountEl.clientWidth || window.innerWidth;
        const height = this.mountEl.clientHeight || window.innerHeight;
        this.renderer.setViewport(0, 0, width, height);
        this.renderer.render(this.scene, this.camera);
      }

      // Next frame handling (Software WebGL vs GPU/WebXR AnimationLoop)
      if (this.isSoftwareGl && !this.renderer.xr.isPresenting) {
        this.afterDraw(tick);
      }
    };

    this.renderTickFn = tick;
    if (this.isSoftwareGl) {
      this.afterDraw(tick);
    } else {
      this.renderer.setAnimationLoop(tick);
    }
  }

  private afterDraw(cb: () => void) {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    const sync = gl?.fenceSync?.(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl?.flush?.();
    const poll = () => {
      if (this.isDestroyed) return;
      const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
      if (state === gl.UNSIGNALED) {
        this.frameId = window.setTimeout(poll, 5);
      } else {
        if (sync) gl.deleteSync(sync);
        this.frameId = window.setTimeout(cb, 60);
      }
    };
    this.frameId = window.setTimeout(poll, 5);
  }

  private updateSimulation(dt: number, time: number) {
    // Poll live WebXR thumbstick locomotion & sync head/origin before computing gaze-relative movement
    if (this.vrState.enabled && this.renderer.xr.isPresenting) {
      this.pollXRCharacterLocomotionInput(dt);
      this.syncVRCharacterControllerOrigin();
    } else if (this.renderer.xr.isPresenting) {
      this.syncVRCharacterControllerOrigin();
    }

    // 0a. Blox Studio 3D Edit Mode Free Camera & World Animation
    if (this.currentGameId === 'studio' && this.studioMode === 'edit') {
      this.updateStudioEditSimulation(dt);
      return;
    }

    // 0. Admin Fly Mode handling
    if (this.isFlying) {
      const flySpeed = 26.0 * this.speedMultiplier;
      const forward = this.vrScratchForward;
      const right = this.vrScratchRight;
      this.getMovementAxes(forward, right);

      const kbZFly =
        (this.keysHeld.has(this.keybinds.forward) || this.keysHeld.has('KeyW') || this.keysHeld.has('ArrowUp') ? 1 : 0) -
        (this.keysHeld.has(this.keybinds.backward) || this.keysHeld.has('KeyS') || this.keysHeld.has('ArrowDown') ? 1 : 0);
      const kbXFly =
        (this.keysHeld.has(this.keybinds.right) || this.keysHeld.has('KeyD') || this.keysHeld.has('ArrowRight') ? 1 : 0) -
        (this.keysHeld.has(this.keybinds.left) || this.keysHeld.has('KeyA') || this.keysHeld.has('ArrowLeft') ? 1 : 0);

      const stickXFly = this.vrState.enabled && Math.abs(this.vrMoveStickX) > 0.05 ? this.vrMoveStickX : this.joystickX;
      const stickYFly = this.vrState.enabled && Math.abs(this.vrMoveStickY) > 0.05 ? this.vrMoveStickY : this.joystickY;
      const rawMoveXFly = kbXFly !== 0 ? kbXFly : stickXFly;
      const rawMoveZFly = kbZFly !== 0 ? kbZFly : -stickYFly;
      const flyMag = Math.min(1, Math.hypot(rawMoveXFly, rawMoveZFly));

      const inputDir = new THREE.Vector3()
        .addScaledVector(forward, rawMoveZFly)
        .addScaledVector(right, rawMoveXFly)
        .normalize();

      this.playerVel.x = inputDir.x * flySpeed;
      this.playerVel.z = inputDir.z * flySpeed;

      let flyY = 0;
      if (this.keysHeld.has(this.keybinds.jump) || this.keysHeld.has('Space')) flyY += 1;
      if (this.keysHeld.has('KeyC') || this.keysHeld.has('ControlLeft') || this.keysHeld.has('ShiftLeft')) flyY -= 1;
      this.playerVel.y = flyY * flySpeed;

      this.playerPos.x += this.playerVel.x * dt;
      this.playerPos.y += this.playerVel.y * dt;
      this.playerPos.z += this.playerVel.z * dt;

      this.isGrounded = false;
      this.avatar.isGrounded = false;
      this.avatar.isMoving = flyMag > 0.05 || flyY !== 0;

      if (flyMag > 0.05) {
        const targetAngle = Math.atan2(inputDir.x, inputDir.z);
        this.avatar.root.rotation.y = THREE.MathUtils.damp(this.avatar.root.rotation.y, targetAngle, 16, dt);
      }

      if (Math.random() < 0.25) {
        this.spawnParticleBurst(this.playerPos.x, this.playerPos.y + 0.3, this.playerPos.z, 0xfacc15, 2);
      }

      this.avatar.root.position.copy(this.playerPos);
      this.avatar.update(dt, time);
      this.updateCamera(dt);
      this.updateParticles(dt);
      this.justPressedKeys.clear();
      return;
    }

    // 1. Process movement inputs (Keyboard WASD/Arrows + Custom Keybinds + VR Left Thumbstick + Mobile Virtual Joystick)
    // In Local Co-op mode, custom forward/back/left/right controls Player 1 and Arrow Keys control Player 2
    const kbZ = this.localCoopEnabled
      ? (this.keysHeld.has(this.keybinds.forward) || this.keysHeld.has('KeyW') ? 1 : 0) -
        (this.keysHeld.has(this.keybinds.backward) || this.keysHeld.has('KeyS') ? 1 : 0)
      : (this.keysHeld.has(this.keybinds.forward) || this.keysHeld.has('KeyW') || this.keysHeld.has('ArrowUp') ? 1 : 0) -
        (this.keysHeld.has(this.keybinds.backward) || this.keysHeld.has('KeyS') || this.keysHeld.has('ArrowDown') ? 1 : 0);
    const kbX = this.localCoopEnabled
      ? (this.keysHeld.has(this.keybinds.right) || this.keysHeld.has('KeyD') ? 1 : 0) -
        (this.keysHeld.has(this.keybinds.left) || this.keysHeld.has('KeyA') ? 1 : 0)
      : (this.keysHeld.has(this.keybinds.right) || this.keysHeld.has('KeyD') || this.keysHeld.has('ArrowRight') ? 1 : 0) -
        (this.keysHeld.has(this.keybinds.left) || this.keysHeld.has('KeyA') || this.keysHeld.has('ArrowLeft') ? 1 : 0);

    // Combine keyboard with VR thumbstick / touch joystick (stick Y < 0 is forward)
    const activeStickX = this.vrState.enabled && Math.abs(this.vrMoveStickX) > 0.05 ? this.vrMoveStickX : this.joystickX;
    const activeStickY = this.vrState.enabled && Math.abs(this.vrMoveStickY) > 0.05 ? this.vrMoveStickY : this.joystickY;
    const rawMoveX = kbX !== 0 ? kbX : activeStickX;
    const rawMoveZ = kbZ !== 0 ? kbZ : -activeStickY;
    const inputMag = Math.min(1, Math.hypot(rawMoveX, rawMoveZ));

    const isMoving = inputMag > 0.05 && !this.doorsState.isHidingInCloset;
    const isSprinting = this.keysHeld.has(this.keybinds.sprint) || this.keysHeld.has('ShiftLeft');
    const sprintBonus = isSprinting && !(this.currentGameId === 'doors' && this.doorsState.isCrouching) ? 1.4 : 1.0;
    const crouchFactor = this.currentGameId === 'doors' && this.doorsState.isCrouching ? 0.58 : 1.0;
    const currentSpeed =
      getPlayerSpeed(this.activeTool) *
      (kbX !== 0 || kbZ !== 0 ? 1 : inputMag) *
      this.speedMultiplier *
      sprintBonus *
      crouchFactor;

    if (this.floorCreakCooldown > 0) {
      this.floorCreakCooldown -= dt;
    }

    if (isMoving) {
      // In VR mode move along camera/headset gaze direction; otherwise use standard yaw movement
      const forward = this.vrScratchForward;
      const right = this.vrScratchRight;
      this.getMovementAxes(forward, right);

      const inputDir = new THREE.Vector3()
        .addScaledVector(forward, rawMoveZ)
        .addScaledVector(right, rawMoveX)
        .normalize();

      this.playerVel.x = inputDir.x * currentSpeed;
      this.playerVel.z = inputDir.z * currentSpeed;

      // Rotate avatar smoothly to face direction
      const targetAngle = Math.atan2(inputDir.x, inputDir.z);
      this.avatar.root.rotation.y = THREE.MathUtils.damp(this.avatar.root.rotation.y, targetAngle, 16, dt);

      // Surface-dependent footsteps & creaking wooden floorboards
      this.avatar.walkPhase += dt * (currentSpeed * 0.9);
      if (this.isGrounded) {
        this.footstepTimer -= dt;
        if (this.footstepTimer <= 0) {
          const isCrouching = this.currentGameId === 'doors' && this.doorsState.isCrouching;
          this.footstepTimer = isCrouching ? 0.48 : isSprinting ? 0.25 : 0.34;
          sound.playFootstep(this.currentSurface, isCrouching);

          if (this.currentGameId === 'doors' && this.currentSurface === 'wood' && !isCrouching && this.floorCreakCooldown <= 0) {
            this.floorCreakCooldown = 0.7;
            sound.playFloorCreak();
          }

          const stepParticleColor =
            this.currentSurface === 'grass' ? 0x4ade80 : this.currentSurface === 'wood' ? 0x92400e : 0xd1d5db;
          this.spawnParticleBurst(this.playerPos.x, this.playerPos.y + 0.1, this.playerPos.z, stepParticleColor, 2);
        }
      }

      // Speed Coil Aura
      if (this.activeTool === 'speed_coil') {
        this.spawnParticleBurst(this.playerPos.x, this.playerPos.y + 0.5, this.playerPos.z, 0xef4444, 2);
      }
    } else {
      this.playerVel.x = THREE.MathUtils.damp(this.playerVel.x, 0, 14, dt);
      this.playerVel.z = THREE.MathUtils.damp(this.playerVel.z, 0, 14, dt);
      this.footstepTimer = Math.min(this.footstepTimer, 0.08);
    }

    this.avatar.isMoving = isMoving;

    // 2. Jumping, Coyote Time & Gravity
    const gravity = getPlayerGravity(this.activeTool);
    const jumpForce = getPlayerJumpForce(this.activeTool) * this.jumpMultiplier;

    // Jetpack continuous rocket boost when holding Space and having Jetpack tool or Fuel Jetpack backpack
    const isJetpackEquipped = this.activeTool === 'jetpack_boost' || this.playerSkin.backpack === 'fuel_jetpack';
    const isHoldingSpace = this.keysHeld.has('Space');

    if (isJetpackEquipped && isHoldingSpace) {
      this.playerVel.y = Math.max(this.playerVel.y, 18.0);
      this.isGrounded = false;
      this.avatar.targetSquashY = 1.35;
      if (Math.random() < 0.35) {
        sound.playGravityCoil();
        this.spawnParticleBurst(this.playerPos.x, this.playerPos.y + 0.2, this.playerPos.z, 0xf97316, 4);
      }
    }

    if (this.isGrounded) {
      this.coyoteTimer = 0.1; // 100ms coyote time
    } else {
      this.coyoteTimer -= dt;
    }

    if (this.jumpBufferTimer > 0) {
      this.jumpBufferTimer -= dt;
    }

    // Execute jump if buffered and legal
    if (this.jumpBufferTimer > 0 && (this.isGrounded || this.coyoteTimer > 0)) {
      this.playerVel.y = jumpForce;
      this.isGrounded = false;
      this.coyoteTimer = 0;
      this.jumpBufferTimer = 0;
      this.stats.jumps += 1;
      this.updateQuestProgress('jumps', 1);
      this.avatar.targetSquashY = 1.25; // takeoff stretch

      if (this.activeTool === 'gravity_coil') {
        sound.playGravityCoil();
        this.spawnParticleBurst(this.playerPos.x, this.playerPos.y + 0.5, this.playerPos.z, 0x06b6d4, 12);
      } else {
        sound.playJump();
        this.spawnParticleBurst(this.playerPos.x, this.playerPos.y + 0.2, this.playerPos.z, 0xe2e8f0, 6);
      }
    }

    // 1. Robust 3D Axis-Separated Movement & Collision
    const playerRadius = 0.65;
    const playerHeight = 4.0;
    const stepUpLimit = 0.55;

    // Optimized active platforms list for Doors mode using true Z bounding-box overlap
    const activePlatforms = this.currentGameId === 'doors'
      ? this.worldData.platforms.filter((plat) => {
          const d = (plat.userData?.depth ?? (plat.geometry as any)?.parameters?.depth) || 2;
          const halfD = d / 2;
          return this.playerPos.z >= plat.position.z - halfD - 10 && this.playerPos.z <= plat.position.z + halfD + 10;
        })
      : this.worldData.platforms;

    // A. Move along X with Wall Pushback & Step-Up
    let targetX = this.playerPos.x + this.playerVel.x * dt;
    for (const plat of activePlatforms) {
      const w = (plat.userData?.width ?? (plat.geometry as any)?.parameters?.width) || 2;
      const h = (plat.userData?.height ?? (plat.geometry as any)?.parameters?.height) || 1;
      const d = (plat.userData?.depth ?? (plat.geometry as any)?.parameters?.depth) || 2;
      const platMinX = plat.position.x - w / 2;
      const platMaxX = plat.position.x + w / 2;
      const platMinY = plat.position.y - h / 2;
      const platMaxY = plat.position.y + h / 2;
      const platMinZ = plat.position.z - d / 2;
      const platMaxZ = plat.position.z + d / 2;

      const overlapY = this.playerPos.y + playerHeight > platMinY + 0.1 && this.playerPos.y < platMaxY - 0.05;
      const overlapZ = this.playerPos.z + playerRadius > platMinZ + 0.05 && this.playerPos.z - playerRadius < platMaxZ - 0.05;
      const overlapX = targetX + playerRadius > platMinX && targetX - playerRadius < platMaxX;

      if (overlapY && overlapZ && overlapX) {
        const stepDelta = platMaxY - this.playerPos.y;
        if (stepDelta > 0 && stepDelta <= stepUpLimit && this.isGrounded) {
          this.playerPos.y = platMaxY;
        } else {
          if (this.playerVel.x > 0) {
            targetX = platMinX - playerRadius;
          } else if (this.playerVel.x < 0) {
            targetX = platMaxX + playerRadius;
          }
          this.playerVel.x = 0;
        }
      }
    }
    this.playerPos.x = targetX;

    // B. Move along Z with Wall Pushback & Step-Up
    let targetZ = this.playerPos.z + this.playerVel.z * dt;
    for (const plat of activePlatforms) {
      const w = (plat.userData?.width ?? (plat.geometry as any)?.parameters?.width) || 2;
      const h = (plat.userData?.height ?? (plat.geometry as any)?.parameters?.height) || 1;
      const d = (plat.userData?.depth ?? (plat.geometry as any)?.parameters?.depth) || 2;
      const platMinX = plat.position.x - w / 2;
      const platMaxX = plat.position.x + w / 2;
      const platMinY = plat.position.y - h / 2;
      const platMaxY = plat.position.y + h / 2;
      const platMinZ = plat.position.z - d / 2;
      const platMaxZ = plat.position.z + d / 2;

      const overlapY = this.playerPos.y + playerHeight > platMinY + 0.1 && this.playerPos.y < platMaxY - 0.05;
      const overlapX = this.playerPos.x + playerRadius > platMinX + 0.05 && this.playerPos.x - playerRadius < platMaxX - 0.05;
      const overlapZ = targetZ + playerRadius > platMinZ && targetZ - playerRadius < platMaxZ;

      if (overlapY && overlapX && overlapZ) {
        const stepDelta = platMaxY - this.playerPos.y;
        if (stepDelta > 0 && stepDelta <= stepUpLimit && this.isGrounded) {
          this.playerPos.y = platMaxY;
        } else {
          if (this.playerVel.z > 0) {
            targetZ = platMinZ - playerRadius;
          } else if (this.playerVel.z < 0) {
            targetZ = platMaxZ + playerRadius;
          }
          this.playerVel.z = 0;
        }
      }
    }
    this.playerPos.z = targetZ;
    if (this.currentGameId === 'doors' && this.playerPos.z < -6.8) {
      this.playerPos.z = -6.8;
      this.playerVel.z = Math.max(0, this.playerVel.z);
    }

    // C. Vertical Movement, Gravity & Landing / Ceiling Collision
    this.playerVel.y += gravity * dt;
    const prevY = this.playerPos.y;
    let targetY = this.playerPos.y + this.playerVel.y * dt;

    let onGroundThisFrame = false;
    let highestFloorY = -Infinity;
    let groundPlatform: THREE.Mesh | null = null;

    for (const plat of activePlatforms) {
      const w = (plat.userData?.width ?? (plat.geometry as any)?.parameters?.width) || 2;
      const h = (plat.userData?.height ?? (plat.geometry as any)?.parameters?.height) || 1;
      const d = (plat.userData?.depth ?? (plat.geometry as any)?.parameters?.depth) || 2;
      const platMinX = plat.position.x - w / 2;
      const platMaxX = plat.position.x + w / 2;
      const platMinY = plat.position.y - h / 2;
      const platMaxY = plat.position.y + h / 2;
      const platMinZ = plat.position.z - d / 2;
      const platMaxZ = plat.position.z + d / 2;

      // Check horizontal footprint overlap
      const overlapX = this.playerPos.x + playerRadius > platMinX + 0.06 && this.playerPos.x - playerRadius < platMaxX - 0.06;
      const overlapZ = this.playerPos.z + playerRadius > platMinZ + 0.06 && this.playerPos.z - playerRadius < platMaxZ - 0.06;

      if (overlapX && overlapZ) {
        // Downward: landing on platform surface
        if (this.playerVel.y <= 0) {
          const wasNearOrAbove = prevY >= platMaxY - 0.45;
          const penetratedTop = targetY <= platMaxY + 0.35;
          const aboveBottom = targetY >= platMinY - 0.6;

          if (wasNearOrAbove && penetratedTop && aboveBottom) {
            if (platMaxY > highestFloorY) {
              highestFloorY = platMaxY;
              groundPlatform = plat;
              onGroundThisFrame = true;
            }
          }
        } else {
          // Upward: bonk head against ceiling
          const headPrev = prevY + playerHeight;
          const headTarget = targetY + playerHeight;
          if (headPrev <= platMinY + 0.35 && headTarget >= platMinY && headTarget <= platMaxY) {
            targetY = platMinY - playerHeight;
            this.playerVel.y = 0;
          }
        }
      }
    }

    if (onGroundThisFrame) {
      this.playerPos.y = highestFloorY;
      this.playerVel.y = 0;
      if (!this.isGrounded) {
        this.avatar.targetSquashY = 0.82; // landing squash
      }
      this.isGrounded = true;
      this.currentSurface =
        (groundPlatform?.userData?.surfaceType as SurfaceType) || (this.currentGameId === 'doors' ? 'wood' : 'stone');
    } else {
      this.playerPos.y = targetY;
      this.isGrounded = false;
    }
    this.avatar.isGrounded = this.isGrounded;

    const playerAABB = {
      minX: this.playerPos.x - 0.8,
      maxX: this.playerPos.x + 0.8,
      minY: this.playerPos.y,
      maxY: this.playerPos.y + 4.2,
      minZ: this.playerPos.z - 0.8,
      maxZ: this.playerPos.z + 0.8,
    };

    // 4. Hazard Collisions (Kill Bricks, Spinners, Trampolines)
    for (const haz of this.worldData.hazards) {
      let hazardBounds = haz.bounds;
      if (!hazardBounds && haz.mesh) {
        const geo = haz.mesh.geometry;
        if (geo) {
          if (!geo.boundingBox) geo.computeBoundingBox();
          const box = geo.boundingBox.clone();
          box.applyMatrix4(haz.mesh.matrixWorld);
          hazardBounds = {
            minX: box.min.x,
            maxX: box.max.x,
            minY: box.min.y,
            maxY: box.max.y,
            minZ: box.min.z,
            maxZ: box.max.z,
          };
        }
      }

      if (hazardBounds && checkAABBIntersection(playerAABB, hazardBounds)) {
        if (haz.type === 'lava' || haz.type === 'spinner') {
          if (this.isGodMode) {
            // God Mode: No harm from hazards
            continue;
          }
          // Touch Kill Brick / Lava / Spinner -> OOF and respawn!
          this.screenShakeTimer = 0.3;
          this.spawnParticleBurst(this.playerPos.x, this.playerPos.y + 2, this.playerPos.z, 0xff0044, 20);
          this.respawnPlayer(false);
          return;
        } else if (haz.type === 'trampoline') {
          // Launch trampoline
          this.playerVel.y = 32.0;
          this.isGrounded = false;
          sound.playSuperJump();
          this.spawnParticleBurst(this.playerPos.x, this.playerPos.y + 0.5, this.playerPos.z, 0xff007f, 25);
          this.avatar.targetSquashY = 1.4;
          this.callbacks.onChatMessage('СУПЕР-ПРЫЖОК на Трамплине!');
        } else if (haz.type === 'speed_pad') {
          // Speed Pad booster
          this.playerVel.z += 25.0 * dt;
        }
      }
    }

    // 5. Void Fall Check
    if (this.currentGameId === 'lava_survival' && this.worldData.lavaSurface) {
      const lavaY = this.worldData.lavaSurface.position.y;
      if (this.playerPos.y < lavaY + 0.75) {
        if (this.isGodMode) {
          this.playerVel.y = Math.max(this.playerVel.y, 16.0);
        } else {
          this.screenShakeTimer = 0.3;
          this.spawnParticleBurst(this.playerPos.x, this.playerPos.y + 2, this.playerPos.z, 0xff0044, 20);
          this.respawnPlayer(false);
          return;
        }
      }
    }

    if (hasFallenIntoVoid(this.playerPos.y)) {
      if (this.currentGameId === 'bee_swarm') {
        this.playerPos.set(0, 1.5, 0);
        this.playerVel.set(0, 0, 0);
        return;
      }
      if (this.isGodMode) {
        this.playerPos.y = 12.0;
        this.playerVel.y = 15.0;
        return;
      }
      this.respawnPlayer(false);
      return;
    }

    // 6. Checkpoint Triggering
    for (const cp of this.worldData.checkpoints) {
      const dist = Math.hypot(this.playerPos.x - cp.position[0], this.playerPos.z - cp.position[2]);
      if (dist < 3.0 && Math.abs(this.playerPos.y - cp.position[1]) < 2.5) {
        if (cp.id > this.currentCheckpointId) {
          this.currentCheckpointId = cp.id;
          this.stats.currentCheckpoint = cp.id;
          sound.playCheckpoint();
          this.spawnParticleBurst(cp.position[0], cp.position[1] + 1, cp.position[2], 0x22c55e, 30);

          // Update flag material color to green
          const group = this.worldData.checkpointMeshes[cp.id];
          const pad = group?.getObjectByName(`CheckpointPad_${cp.id}`) as THREE.Mesh;
          if (pad && pad.material instanceof THREE.MeshStandardMaterial) {
            pad.material.color.set(0x22c55e);
            pad.material.emissive.set(0x16a34a);
          }

          this.callbacks.onCheckpointReached(cp);
          this.updateQuestProgress('checkpoints', 1);
          this.callbacks.onChatMessage(`Чекпоинт ${cp.id} активирован: "${cp.name}"!`);
          this.callbacks.onStatsUpdate({ ...this.stats });
        }
      }
    }

    // 7. Collectible Coins & Gems
    for (const item of this.worldData.collectibles) {
      if (!item.collected && isItemCollected([this.playerPos.x, this.playerPos.y + 2, this.playerPos.z], item.position, 2.2)) {
        item.collected = true;
        const mesh = this.worldData.collectibleMeshes.get(item.id);
        if (mesh) {
          const startPosY = mesh.position.y;
          const startTime = performance.now();
          const animCollect = () => {
            const elapsed = (performance.now() - startTime) / 1000;
            if (elapsed < 0.45) {
              mesh.position.y = startPosY + elapsed * 3.5;
              mesh.scale.multiplyScalar(0.92);
              requestAnimationFrame(animCollect);
            } else {
              this.scene.remove(mesh);
            }
          };
          animCollect();
        }

        if (item.type === 'coin') {
          this.stats.coins += item.value;
          this.updateQuestProgress('collect_coins', 1);
          sound.playCoin();
          this.spawnParticleBurst(item.position[0], item.position[1], item.position[2], 0xfbbf24, 10);
        } else {
          // Gems are hyper-rare (15% chance for a whole diamond; otherwise crystal shard coins)
          if (Math.random() < 0.15) {
            this.stats.gems += 1;
            sound.playGem();
            this.spawnParticleBurst(item.position[0], item.position[1], item.position[2], 0x38bdf8, 28);
            this.callbacks.onChatMessage(
              '💎 ГИПЕР РЕДКАЯ НАХОДКА! Вы добыли целый кристалл (+1 💎)!',
              'Сокровище'
            );
          } else {
            const shardCoins = Math.max(150, item.value || 150);
            this.stats.coins += shardCoins;
            sound.playCoin();
            this.spawnParticleBurst(item.position[0], item.position[1], item.position[2], 0xa855f7, 14);
            this.callbacks.onChatMessage(
              `✨ Осколок кристалла! +${shardCoins} монет (целый 💎 гипер редкий — шанс 15%)`,
              'Кристалл'
            );
          }
        }
        this.callbacks.onStatsUpdate({ ...this.stats });
      }
    }

    // 8. Trophy Victory Trigger (Stage 6 Summit — for non-DOORS modes; DOORS uses Cargo Elevator button)
    if (this.currentGameId !== 'doors') {
      const trophyPos = this.worldData.trophyMesh.position;
      const distToTrophy = Math.hypot(this.playerPos.x - trophyPos.x, this.playerPos.z - trophyPos.z);
      if (distToTrophy < 4.5 && Math.abs(this.playerPos.y - trophyPos.y) < 3.0) {
        if (this.stats.completionTime === 0) {
          this.stats.completionTime = Math.floor((Date.now() - this.stats.startTime) / 1000);
          sound.playVictory();
          this.spawnParticleBurst(trophyPos.x, trophyPos.y + 4, trophyPos.z, 0xf59e0b, 50);
          this.callbacks.onVictory({ ...this.stats });
          this.callbacks.onChatMessage('ПОБЕДА! Вы прошли полосу препятствий и получили Золотой Кубок!', 'Чемпион');
        }
      }
    }

    // 9. Dynamic Rotators update & Rising Lava Ocean in 'lava_survival'
    for (const rot of this.worldData.dynamicRotators) {
      rot.group.rotation[rot.axis] += dt * rot.speed;
    }

    if (this.worldData.lavaSurface) {
      // Dynamic surging magma tide that rises and oscillates
      const lavaWaveY = -1.0 + Math.sin(time * 0.8) * 1.25;
      this.worldData.lavaSurface.position.y = lavaWaveY;
      const oceanHazard = this.worldData.hazards.find((h) => h.id === 'lava_ocean');
      if (oceanHazard && oceanHazard.bounds) {
        oceanHazard.bounds.maxY = lavaWaveY + 1.8;
      }
      // Spawn occasional magma sparks near the player
      if (Math.random() < 0.2) {
        this.spawnParticleBurst(
          this.playerPos.x + (Math.random() - 0.5) * 28,
          lavaWaveY + 1.5,
          this.playerPos.z + (Math.random() - 0.5) * 28,
          0xff4500,
          2
        );
      }

      // Accumulate survival seconds for 'survive_lava' daily quests while alive above magma
      if (this.currentGameId === 'lava_survival' && this.playerPos.y >= lavaWaveY + 0.75) {
        this.lavaSurvivalTimer += dt;
        if (this.lavaSurvivalTimer >= 1.0) {
          const wholeSeconds = Math.floor(this.lavaSurvivalTimer);
          this.lavaSurvivalTimer -= wholeSeconds;
          this.updateQuestProgress('survive_lava', wholeSeconds);
        }
      }
    }

    // Rotate Trophy star
    const star = this.worldData.trophyMesh.getObjectByName('TrophyStar');
    if (star) {
      star.rotation.y += dt * 2.5;
      star.rotation.x += dt * 1.5;
    }

    // Bobbing and spinning collectibles (cached O(1) lookup)
    this.worldData.collectibleMeshes.forEach((mesh, id) => {
      let item = mesh.userData.collectibleItem as (typeof this.worldData.collectibles)[number] | undefined;
      if (!item) {
        item = this.worldData.collectibles.find((c) => c.id === id);
        if (item) {
          mesh.userData.collectibleItem = item;
        }
      }
      if (item && !item.collected) {
        mesh.rotation.y += dt * 3.0;
        mesh.position.y = item.position[1] + Math.sin(time * 3 + item.position[2]) * 0.25;
      }
    });

    // Dummy hit shake
    if (this.dummyShakeTimer > 0) {
      this.dummyShakeTimer -= dt;
      this.worldData.dummyMesh.rotation.z = Math.sin(this.dummyShakeTimer * 30) * 0.2;
    } else {
      this.worldData.dummyMesh.rotation.z = 0;
    }

    // 9b. Bee Farm Simulator 3D Logic: Field zone detection, Hive convert pad, and companion bee swarm
    if (this.currentGameId === 'bee_swarm') {
      let activeField: FlowerFieldZone | null = null;
      if (this.worldData.flowerFields) {
        for (const field of this.worldData.flowerFields) {
          const b = field.bounds;
          if (
            this.playerPos.x >= b.minX &&
            this.playerPos.x <= b.maxX &&
            this.playerPos.z >= b.minZ &&
            this.playerPos.z <= b.maxZ
          ) {
            activeField = field;
            break;
          }
        }
      }

      if (this.beeFarmState.currentField?.id !== activeField?.id) {
        this.beeFarmState.currentField = activeField;
        this.callbacks.onBeeFarmUpdate?.({ ...this.beeFarmState });
        if (activeField) {
          this.callbacks.onChatMessage(`Вы вошли на поле: ${activeField.name}! Нажимайте ЛКМ для сбора пыльцы! 🌸`);
        }
      }

      // Hive Golden Convert Pad check
      if (this.worldData.hiveBounds) {
        const hb = this.worldData.hiveBounds;
        if (
          this.playerPos.x >= hb.minX &&
          this.playerPos.x <= hb.maxX &&
          this.playerPos.z >= hb.minZ &&
          this.playerPos.z <= hb.maxZ
        ) {
          if (this.beeFarmState.pollen > 0) {
            this.convertPollenToHoney();
          }
        }
      }

      this.updateBeeSwarmSimulation(dt, time);
    }

    // 9c. Roblox DOORS First-Person Horror Hotel Simulation
    if (this.currentGameId === 'doors') {
      this.updateDoorsSimulation(dt, time);
    }

    // 10. Update Local Player 1 Avatar
    this.avatar.root.position.copy(this.playerPos);
    this.avatar.update(dt, time);

    // 10b. Update Local Co-op Player 2 (Arrow Keys + Enter/RightShift)
    if (this.localCoopEnabled && this.player2Avatar) {
      this.updateLocalCoopPlayer2(dt, time);
    }

    // 10c. Interpolate & Animate Remote Multiplayer Avatars
    this.remoteAvatars.forEach((entry) => {
      entry.avatar.root.position.x = THREE.MathUtils.damp(entry.avatar.root.position.x, entry.targetPos.x, 14, dt);
      entry.avatar.root.position.y = THREE.MathUtils.damp(entry.avatar.root.position.y, entry.targetPos.y, 14, dt);
      entry.avatar.root.position.z = THREE.MathUtils.damp(entry.avatar.root.position.z, entry.targetPos.z, 14, dt);
      entry.avatar.root.rotation.y = THREE.MathUtils.damp(entry.avatar.root.rotation.y, entry.targetRotY, 14, dt);
      if (entry.avatar.isMoving) {
        entry.avatar.walkPhase += dt * 14.0;
      }
      entry.avatar.update(dt, time);
    });

    // 10d. Emit local movement state to network layer
    this.callbacks.onLocalMove?.({
      position: [this.playerPos.x, this.playerPos.y, this.playerPos.z],
      rotationY: this.avatar.root.rotation.y,
      isMoving: this.avatar.isMoving,
      isGrounded: this.isGrounded,
      activeTool: this.activeTool,
      checkpoint: this.stats.currentCheckpoint,
      coins: this.stats.coins,
    });

    // 10e. Update Spatial 3D Portals & Momentum Transit
    this.updatePortals(dt, time);

    // 11. Third-Person Camera Following
    this.updateCamera(dt);

    // 12. Particles Update
    this.updateParticles(dt);

    // Clear single-frame just-pressed keys
    this.justPressedKeys.clear();
  }

  private updateLocalCoopPlayer2(dt: number, time: number) {
    if (!this.player2Avatar) return;

    // Optional P2 camera rotation keys (, / .) in all modes; in DOORS, ArrowLeft/Right also steers P2's POV camera
    if (this.keysHeld.has('Comma')) this.p2CameraYaw += 2.3 * dt;
    if (this.keysHeld.has('Period')) this.p2CameraYaw -= 2.3 * dt;

    let p2Z = (this.keysHeld.has('ArrowUp') ? 1 : 0) - (this.keysHeld.has('ArrowDown') ? 1 : 0);
    let p2X = 0;

    if (this.currentGameId === 'doors') {
      const turnInput = (this.keysHeld.has('ArrowLeft') ? 1 : 0) - (this.keysHeld.has('ArrowRight') ? 1 : 0);
      if (turnInput !== 0) {
        this.p2CameraYaw += turnInput * 2.3 * dt;
      }
    } else {
      p2X = (this.keysHeld.has('ArrowRight') ? 1 : 0) - (this.keysHeld.has('ArrowLeft') ? 1 : 0);
    }

    const p2Moving = p2X !== 0 || p2Z !== 0;
    const p2Speed = 16.0;

    if (p2Moving) {
      const forward = new THREE.Vector3(-Math.sin(this.p2CameraYaw), 0, -Math.cos(this.p2CameraYaw));
      const right = new THREE.Vector3(Math.cos(this.p2CameraYaw), 0, -Math.sin(this.p2CameraYaw));
      const dir = new THREE.Vector3()
        .addScaledVector(forward, p2Z)
        .addScaledVector(right, p2X)
        .normalize();

      this.p2Vel.x = dir.x * p2Speed;
      this.p2Vel.z = dir.z * p2Speed;
      const targetAngle = Math.atan2(dir.x, dir.z);
      this.player2Avatar.root.rotation.y = THREE.MathUtils.damp(this.player2Avatar.root.rotation.y, targetAngle, 16, dt);
      this.player2Avatar.walkPhase += dt * (p2Speed * 0.9);
      if (this.p2Grounded) {
        this.p2FootstepTimer -= dt;
        if (this.p2FootstepTimer <= 0) {
          this.p2FootstepTimer = 0.34;
          sound.playFootstep(this.p2Surface, false);
        }
      }
    } else {
      this.p2Vel.x = THREE.MathUtils.damp(this.p2Vel.x, 0, 14, dt);
      this.p2Vel.z = THREE.MathUtils.damp(this.p2Vel.z, 0, 14, dt);
      this.p2FootstepTimer = Math.min(this.p2FootstepTimer, 0.08);
      if (this.currentGameId === 'doors') {
        this.player2Avatar.root.rotation.y = this.p2CameraYaw + Math.PI;
      }
    }

    this.player2Avatar.isMoving = p2Moving;

    if (this.p2JumpBuffer > 0) {
      this.p2JumpBuffer -= dt;
    }

    if (this.p2JumpBuffer > 0 && this.p2Grounded) {
      this.p2Vel.y = 19.5;
      this.p2Grounded = false;
      this.p2JumpBuffer = 0;
      this.player2Avatar.targetSquashY = 1.25;
      sound.playJump();
    }

    // 1. Move along X for P2
    const p2Radius = 0.65;
    const p2Height = 4.0;
    const p2StepLimit = 0.55;

    const p2ActivePlatforms = this.currentGameId === 'doors'
      ? this.worldData.platforms.filter((plat) => {
          const d = (plat.userData?.depth ?? (plat.geometry as any)?.parameters?.depth) || 2;
          const halfD = d / 2;
          return this.p2Pos.z >= plat.position.z - halfD - 10 && this.p2Pos.z <= plat.position.z + halfD + 10;
        })
      : this.worldData.platforms;

    let p2TargetX = this.p2Pos.x + this.p2Vel.x * dt;
    for (const plat of p2ActivePlatforms) {
      const w = (plat.userData?.width ?? (plat.geometry as any)?.parameters?.width) || 2;
      const h = (plat.userData?.height ?? (plat.geometry as any)?.parameters?.height) || 1;
      const d = (plat.userData?.depth ?? (plat.geometry as any)?.parameters?.depth) || 2;
      const platMinX = plat.position.x - w / 2;
      const platMaxX = plat.position.x + w / 2;
      const platMinY = plat.position.y - h / 2;
      const platMaxY = plat.position.y + h / 2;
      const platMinZ = plat.position.z - d / 2;
      const platMaxZ = plat.position.z + d / 2;

      const overlapY = this.p2Pos.y + p2Height > platMinY + 0.1 && this.p2Pos.y < platMaxY - 0.05;
      const overlapZ = this.p2Pos.z + p2Radius > platMinZ + 0.05 && this.p2Pos.z - p2Radius < platMaxZ - 0.05;
      const overlapX = p2TargetX + p2Radius > platMinX && p2TargetX - p2Radius < platMaxX;

      if (overlapY && overlapZ && overlapX) {
        const stepDelta = platMaxY - this.p2Pos.y;
        if (stepDelta > 0 && stepDelta <= p2StepLimit && this.p2Grounded) {
          this.p2Pos.y = platMaxY;
        } else {
          if (this.p2Vel.x > 0) p2TargetX = platMinX - p2Radius;
          else if (this.p2Vel.x < 0) p2TargetX = platMaxX + p2Radius;
          this.p2Vel.x = 0;
        }
      }
    }
    this.p2Pos.x = p2TargetX;

    // 2. Move along Z for P2
    let p2TargetZ = this.p2Pos.z + this.p2Vel.z * dt;
    for (const plat of p2ActivePlatforms) {
      const w = (plat.userData?.width ?? (plat.geometry as any)?.parameters?.width) || 2;
      const h = (plat.userData?.height ?? (plat.geometry as any)?.parameters?.height) || 1;
      const d = (plat.userData?.depth ?? (plat.geometry as any)?.parameters?.depth) || 2;
      const platMinX = plat.position.x - w / 2;
      const platMaxX = plat.position.x + w / 2;
      const platMinY = plat.position.y - h / 2;
      const platMaxY = plat.position.y + h / 2;
      const platMinZ = plat.position.z - d / 2;
      const platMaxZ = plat.position.z + d / 2;

      const overlapY = this.p2Pos.y + p2Height > platMinY + 0.1 && this.p2Pos.y < platMaxY - 0.05;
      const overlapX = this.p2Pos.x + p2Radius > platMinX + 0.05 && this.p2Pos.x - p2Radius < platMaxX - 0.05;
      const overlapZ = p2TargetZ + p2Radius > platMinZ && p2TargetZ - p2Radius < platMaxZ;

      if (overlapY && overlapX && overlapZ) {
        const stepDelta = platMaxY - this.p2Pos.y;
        if (stepDelta > 0 && stepDelta <= p2StepLimit && this.p2Grounded) {
          this.p2Pos.y = platMaxY;
        } else {
          if (this.p2Vel.z > 0) p2TargetZ = platMinZ - p2Radius;
          else if (this.p2Vel.z < 0) p2TargetZ = platMaxZ + p2Radius;
          this.p2Vel.z = 0;
        }
      }
    }
    this.p2Pos.z = p2TargetZ;
    if (this.currentGameId === 'doors' && this.p2Pos.z < -6.8) {
      this.p2Pos.z = -6.8;
      this.p2Vel.z = Math.max(0, this.p2Vel.z);
    }

    // 3. Vertical & Gravity for P2
    this.p2Vel.y += -42.0 * dt;
    const p2PrevY = this.p2Pos.y;
    let p2TargetY = this.p2Pos.y + this.p2Vel.y * dt;

    let p2Ground = false;
    let p2HighestFloorY = -Infinity;
    let p2GroundPlatform: THREE.Mesh | null = null;

    for (const plat of p2ActivePlatforms) {
      const w = (plat.userData?.width ?? (plat.geometry as any)?.parameters?.width) || 2;
      const h = (plat.userData?.height ?? (plat.geometry as any)?.parameters?.height) || 1;
      const d = (plat.userData?.depth ?? (plat.geometry as any)?.parameters?.depth) || 2;
      const platMinX = plat.position.x - w / 2;
      const platMaxX = plat.position.x + w / 2;
      const platMinY = plat.position.y - h / 2;
      const platMaxY = plat.position.y + h / 2;
      const platMinZ = plat.position.z - d / 2;
      const platMaxZ = plat.position.z + d / 2;

      const overlapX = this.p2Pos.x + p2Radius > platMinX + 0.06 && this.p2Pos.x - p2Radius < platMaxX - 0.06;
      const overlapZ = this.p2Pos.z + p2Radius > platMinZ + 0.06 && this.p2Pos.z - p2Radius < platMaxZ - 0.06;

      if (overlapX && overlapZ) {
        if (this.p2Vel.y <= 0) {
          const wasNearOrAbove = p2PrevY >= platMaxY - 0.45;
          const penetratedTop = p2TargetY <= platMaxY + 0.35;
          const aboveBottom = p2TargetY >= platMinY - 0.6;

          if (wasNearOrAbove && penetratedTop && aboveBottom) {
            if (platMaxY > p2HighestFloorY) {
              p2HighestFloorY = platMaxY;
              p2GroundPlatform = plat;
              p2Ground = true;
            }
          }
        } else {
          const headPrev = p2PrevY + p2Height;
          const headTarget = p2TargetY + p2Height;
          if (headPrev <= platMinY + 0.35 && headTarget >= platMinY && headTarget <= platMaxY) {
            p2TargetY = platMinY - p2Height;
            this.p2Vel.y = 0;
          }
        }
      }
    }

    if (p2Ground) {
      this.p2Pos.y = p2HighestFloorY;
      this.p2Vel.y = 0;
      this.p2Grounded = true;
      this.p2Surface =
        (p2GroundPlatform?.userData?.surfaceType as SurfaceType) || (this.currentGameId === 'doors' ? 'wood' : 'stone');
    } else {
      this.p2Pos.y = p2TargetY;
      this.p2Grounded = false;
    }
    this.player2Avatar.isGrounded = this.p2Grounded;

    const p2AABB = {
      minX: this.p2Pos.x - 0.8,
      maxX: this.p2Pos.x + 0.8,
      minY: this.p2Pos.y,
      maxY: this.p2Pos.y + 4.2,
      minZ: this.p2Pos.z - 0.8,
      maxZ: this.p2Pos.z + 0.8,
    };

    // Respawn P2 near P1 if P2 falls into void or touches lava/spinner
    let p2Died = hasFallenIntoVoid(this.p2Pos.y);
    if (!p2Died) {
      for (const haz of this.worldData.hazards) {
        if (haz.bounds && checkAABBIntersection(p2AABB, haz.bounds)) {
          if (haz.type === 'lava' || haz.type === 'spinner') {
            p2Died = true;
          } else if (haz.type === 'trampoline') {
            this.p2Vel.y = 32.0;
            this.p2Grounded = false;
          }
        }
      }
    }

    if (p2Died) {
      sound.playOof();
      this.p2Pos.set(
        this.playerPos.x + (this.currentGameId === 'doors' ? 1.5 : 3.0),
        Math.max(0.2, this.playerPos.y + (this.currentGameId === 'doors' ? 0 : 2.0)),
        Math.max(this.currentGameId === 'doors' ? 2.0 : -9999, this.playerPos.z)
      );
      this.p2Vel.set(0, 0, 0);
    }

    this.player2Avatar.root.position.copy(this.p2Pos);
    this.player2Avatar.update(dt, time);
  }

  // ==========================================
  // Bee Farm Simulator 3D Mechanics & Helpers
  // ==========================================

  public initBeeSwarmMeshes() {
    this.clearBeeSwarmMeshes();
    if (!this.scene.children.includes(this.beeGroup)) {
      this.scene.add(this.beeGroup);
    }
    this.beeFarmState.bees.forEach((bee, idx) => {
      const mesh = this.createVoxelBee(bee, idx);
      this.beeMeshes.push(mesh);
      this.beeGroup.add(mesh);
    });
    this.callbacks.onBeeFarmUpdate?.({ ...this.beeFarmState });
  }

  public clearBeeSwarmMeshes() {
    this.beeMeshes.forEach((mesh) => {
      this.beeGroup.remove(mesh);
    });
    this.beeMeshes = [];
    if (this.scene.children.includes(this.beeGroup)) {
      this.scene.remove(this.beeGroup);
    }
  }

  private createVoxelBee(bee: BeePet, index: number): THREE.Group {
    const group = new THREE.Group();
    group.userData = {
      orbitRadius: 2.2 + index * 0.7,
      orbitAngle: (index * Math.PI * 2) / Math.max(1, this.beeFarmState.bees.length),
      speed: bee.speed,
    };

    // Body
    const bodyGeo = new THREE.BoxGeometry(0.85, 0.6, 1.1);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(bee.color),
      roughness: 0.35,
      metalness: 0.1,
    });
    const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
    bodyMesh.castShadow = true;
    group.add(bodyMesh);

    // Black stripes
    const stripeGeo = new THREE.BoxGeometry(0.88, 0.62, 0.22);
    const stripeMat = new THREE.MeshStandardMaterial({
      color: 0x111827,
      roughness: 0.4,
    });
    const stripe1 = new THREE.Mesh(stripeGeo, stripeMat);
    stripe1.position.z = -0.12;
    group.add(stripe1);

    const stripe2 = new THREE.Mesh(stripeGeo, stripeMat);
    stripe2.position.z = 0.26;
    group.add(stripe2);

    // Stinger
    const stingerGeo = new THREE.ConeGeometry(0.12, 0.35, 4);
    const stingerMat = new THREE.MeshStandardMaterial({ color: 0x111827 });
    const stinger = new THREE.Mesh(stingerGeo, stingerMat);
    stinger.rotation.x = -Math.PI / 2;
    stinger.position.set(0, 0, 0.7);
    group.add(stinger);

    // Eyes
    const eyeGeo = new THREE.BoxGeometry(0.16, 0.16, 0.06);
    const eyeMat = new THREE.MeshStandardMaterial({ color: 0x000000 });
    const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
    eyeL.position.set(-0.25, 0.08, -0.56);
    group.add(eyeL);

    const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
    eyeR.position.set(0.25, 0.08, -0.56);
    group.add(eyeR);

    // Antennae
    const antGeo = new THREE.CylinderGeometry(0.025, 0.025, 0.3, 4);
    const antMat = new THREE.MeshStandardMaterial({ color: 0x111827 });
    const antL = new THREE.Mesh(antGeo, antMat);
    antL.rotation.z = 0.25;
    antL.rotation.x = -0.3;
    antL.position.set(-0.2, 0.42, -0.35);
    group.add(antL);

    const antR = new THREE.Mesh(antGeo, antMat);
    antR.rotation.z = -0.25;
    antR.rotation.x = -0.3;
    antR.position.set(0.2, 0.42, -0.35);
    group.add(antR);

    // Translucent Wings
    const wingGeo = new THREE.BoxGeometry(0.65, 0.03, 0.38);
    const wingMat = new THREE.MeshStandardMaterial({
      color: 0xe0f2fe,
      roughness: 0.15,
      transparent: true,
      opacity: 0.75,
    });

    const wingLeftPivot = new THREE.Group();
    wingLeftPivot.name = 'wingLeft';
    wingLeftPivot.position.set(-0.4, 0.32, -0.05);
    const wingLMesh = new THREE.Mesh(wingGeo, wingMat);
    wingLMesh.position.set(-0.32, 0, 0);
    wingLeftPivot.add(wingLMesh);
    group.add(wingLeftPivot);

    const wingRightPivot = new THREE.Group();
    wingRightPivot.name = 'wingRight';
    wingRightPivot.position.set(0.4, 0.32, -0.05);
    const wingRMesh = new THREE.Mesh(wingGeo, wingMat);
    wingRMesh.position.set(0.32, 0, 0);
    wingRightPivot.add(wingRMesh);
    group.add(wingRightPivot);

    // Level star / Crown for Royal Gold Queen bee
    if (bee.type === 'royal_gold') {
      const crownGeo = new THREE.ConeGeometry(0.22, 0.2, 5);
      const crownMat = new THREE.MeshStandardMaterial({ color: 0xfbbf24, metalness: 0.6, roughness: 0.2 });
      const crown = new THREE.Mesh(crownGeo, crownMat);
      crown.position.set(0, 0.42, 0);
      group.add(crown);
    }

    group.position.copy(this.playerPos).add(new THREE.Vector3(0, 2.0, 0));
    return group;
  }

  private updateBeeSwarmSimulation(dt: number, time: number) {
    // 1. Orbit companions around player and flutter wings
    this.beeMeshes.forEach((mesh, idx) => {
      const speed = 1.6 * (mesh.userData.speed || 1.0);
      mesh.userData.orbitAngle = (mesh.userData.orbitAngle || 0) + speed * dt;
      const r = mesh.userData.orbitRadius || 2.4;
      const targetX = this.playerPos.x + Math.cos(mesh.userData.orbitAngle) * r;
      const targetZ = this.playerPos.z + Math.sin(mesh.userData.orbitAngle) * r;
      const targetY = this.playerPos.y + 2.2 + Math.sin(time * 3.5 + idx * 1.5) * 0.35;

      mesh.position.x = THREE.MathUtils.damp(mesh.position.x, targetX, 10, dt);
      mesh.position.y = THREE.MathUtils.damp(mesh.position.y, targetY, 8, dt);
      mesh.position.z = THREE.MathUtils.damp(mesh.position.z, targetZ, 10, dt);

      // Face orbit direction
      const travelAngle = mesh.userData.orbitAngle + Math.PI / 2;
      mesh.rotation.y = THREE.MathUtils.damp(mesh.rotation.y, -travelAngle, 12, dt);
      mesh.rotation.z = Math.sin(time * 6 + idx) * 0.08;

      // Flutter wings rapidly
      const wingL = mesh.getObjectByName('wingLeft');
      const wingR = mesh.getObjectByName('wingRight');
      if (wingL && wingR) {
        const flutter = Math.sin(time * 34 + idx * 2.2) * 0.45;
        wingL.rotation.z = flutter;
        wingR.rotation.z = -flutter;
      }
    });

    // 2. Periodic Bee Auto-Gather when player is on a flower field
    this.beeAutoGatherTimer += dt;
    if (this.beeAutoGatherTimer >= 1.6) {
      this.beeAutoGatherTimer = 0;
      if (this.beeFarmState.currentField && this.beeFarmState.pollen < this.beeFarmState.maxPollen) {
        const totalGather = this.beeFarmState.bees.reduce((sum, b) => sum + b.gatherPower, 0);
        const mult = this.beeFarmState.currentField.pollenPerHarvest;
        const gain = Math.min(
          this.beeFarmState.maxPollen - this.beeFarmState.pollen,
          Math.max(1, Math.round(totalGather * mult))
        );
        if (gain > 0) {
          this.beeFarmState.pollen += gain;
          this.updateQuestProgress('collect_pollen', gain);
          sound.playBeeBuzz();
          const pColor = new THREE.Color(this.beeFarmState.currentField.color).getHex();
          for (const bMesh of this.beeMeshes) {
            if (Math.random() < 0.6) {
              this.spawnParticleBurst(
                bMesh.position.x,
                bMesh.position.y,
                bMesh.position.z,
                pColor,
                3
              );
            }
          }
          this.callbacks.onBeeFarmUpdate?.({ ...this.beeFarmState });
        }
      }
    }
  }

  public gatherPollen() {
    this.avatar.triggerAttack();
    if (!this.beeFarmState.currentField) {
      this.callbacks.onChatMessage('🌸 Встаньте на цветочную поляну (Подсолнухи, Клевер, Розы, Одуванчики), чтобы собирать пыльцу!');
      return;
    }
    if (this.beeFarmState.pollen >= this.beeFarmState.maxPollen) {
      sound.playOof();
      this.callbacks.onChatMessage('🎒 Рюкзак ПОЛОН! Бегите в Улей (Золотой круг), чтобы превратить пыльцу в Мёд!');
      return;
    }

    const mult = this.beeFarmState.currentField.pollenPerHarvest;
    const gained = Math.min(
      this.beeFarmState.maxPollen - this.beeFarmState.pollen,
      Math.max(1, Math.round(this.beeFarmState.scooperPower * mult))
    );
    this.beeFarmState.pollen += gained;
    if (gained > 0) {
      this.updateQuestProgress('collect_pollen', gained);
    }
    sound.playPollenPop();
    const pColor = new THREE.Color(this.beeFarmState.currentField.color).getHex();
    this.spawnParticleBurst(
      this.playerPos.x + (Math.random() - 0.5) * 1.5,
      this.playerPos.y + 0.5,
      this.playerPos.z + (Math.random() - 0.5) * 1.5,
      pColor,
      12
    );

    if (this.beeFarmState.pollen >= this.beeFarmState.maxPollen) {
      this.callbacks.onChatMessage('🎒 Рюкзак полон пыльцы (100%)! Отправляйтесь в Улей на золотую платформу!');
    }
    this.callbacks.onBeeFarmUpdate?.({ ...this.beeFarmState });
  }

  public convertPollenToHoney() {
    if (this.beeFarmState.pollen <= 0) return;
    const p = this.beeFarmState.pollen;
    const honeyEarned = p * 2;
    this.beeFarmState.pollen = 0;
    this.beeFarmState.honey += honeyEarned;
    this.stats.coins += honeyEarned;
    sound.playHoneyConvert();
    this.spawnParticleBurst(this.playerPos.x, this.playerPos.y + 1.5, this.playerPos.z, 0xf59e0b, 25);
    this.callbacks.onChatMessage(`🍯 Улей переработал ${p} пыльцы в +${honeyEarned} Мёда (Монет)!`);
    this.callbacks.onBeeFarmUpdate?.({ ...this.beeFarmState });
    this.callbacks.onStatsUpdate({ ...this.stats });
  }

  public upgradeScooper(): boolean {
    const nextLevel = this.beeFarmState.scooperLevel + 1;
    let cost = 100;
    let newPower = 4;
    let newName = 'Железный Совок';

    if (nextLevel === 2) {
      cost = 100;
      newPower = 5;
      newName = 'Железный Совок';
    } else if (nextLevel === 3) {
      cost = 350;
      newPower = 10;
      newName = 'Золотая Лопата';
    } else if (nextLevel === 4) {
      cost = 1000;
      newPower = 20;
      newName = 'Алмазный Сачок';
    } else if (nextLevel === 5) {
      cost = 3000;
      newPower = 40;
      newName = 'Королевский Пыльцесборник';
    } else {
      this.callbacks.onChatMessage('Совок уже максимального уровня!');
      return false;
    }

    if (this.stats.coins < cost) {
      sound.playOof();
      this.callbacks.onChatMessage(`Недостаточно мёда/монет! Нужно ${cost} 🍯`);
      return false;
    }

    this.stats.coins -= cost;
    this.beeFarmState.scooperLevel = nextLevel;
    this.beeFarmState.scooperPower = newPower;
    this.beeFarmState.scooperName = newName;
    sound.playAchievement();
    this.spawnParticleBurst(this.playerPos.x, this.playerPos.y + 2, this.playerPos.z, 0x3b82f6, 30);
    this.callbacks.onChatMessage(`🛠️ Улучшение: куплен «${newName}» (Сила сбора: ${newPower})!`);
    this.callbacks.onBeeFarmUpdate?.({ ...this.beeFarmState });
    this.callbacks.onStatsUpdate({ ...this.stats });
    return true;
  }

  public upgradeBackpack(): boolean {
    const curMax = this.beeFarmState.maxPollen;
    let cost = 120;
    let nextMax = 250;

    if (curMax === 100) {
      cost = 120;
      nextMax = 250;
    } else if (curMax === 250) {
      cost = 400;
      nextMax = 650;
    } else if (curMax === 650) {
      cost = 1200;
      nextMax = 1600;
    } else if (curMax === 1600) {
      cost = 3500;
      nextMax = 4000;
    } else {
      this.callbacks.onChatMessage('Рюкзак уже максимального объёма!');
      return false;
    }

    if (this.stats.coins < cost) {
      sound.playOof();
      this.callbacks.onChatMessage(`Недостаточно мёда/монет! Нужно ${cost} 🍯`);
      return false;
    }

    this.stats.coins -= cost;
    this.beeFarmState.maxPollen = nextMax;
    sound.playAchievement();
    this.spawnParticleBurst(this.playerPos.x, this.playerPos.y + 2, this.playerPos.z, 0x10b981, 30);
    this.callbacks.onChatMessage(`🎒 Вместимость рюкзака увеличена до ${nextMax} пыльцы!`);
    this.callbacks.onBeeFarmUpdate?.({ ...this.beeFarmState });
    this.callbacks.onStatsUpdate({ ...this.stats });
    return true;
  }

  public hatchBeeEgg(): boolean {
    const cost = 180 + (this.beeFarmState.bees.length - 1) * 120;
    if (this.beeFarmState.bees.length >= 10) {
      this.callbacks.onChatMessage('Достигнут максимум пчёл в улье (10 пчёл)!');
      return false;
    }
    if (this.stats.coins < cost) {
      sound.playOof();
      this.callbacks.onChatMessage(`Недостаточно мёда/монет для яйца! Нужно ${cost} 🍯`);
      return false;
    }

    this.stats.coins -= cost;
    sound.playHatchBee();

    const roll = Math.random();
    let newBee: BeePet;
    const newId = `bee_${Date.now()}`;

    if (roll < 0.45) {
      newBee = {
        id: newId,
        name: `Рабочая Пчёлка #${this.beeFarmState.bees.length + 1}`,
        type: 'basic',
        level: 1,
        color: '#facc15',
        speed: 1.0,
        gatherPower: 2,
      };
    } else if (roll < 0.75) {
      newBee = {
        id: newId,
        name: `Бомбер Пчела 💣`,
        type: 'bomber',
        level: 1,
        color: '#3b82f6',
        speed: 1.3,
        gatherPower: 4,
      };
    } else if (roll < 0.92) {
      newBee = {
        id: newId,
        name: `Огненная Пчела 🔥`,
        type: 'rad',
        level: 1,
        color: '#ef4444',
        speed: 1.5,
        gatherPower: 6,
      };
    } else {
      newBee = {
        id: newId,
        name: `Королевская Медовая Пчела 👑`,
        type: 'royal_gold',
        level: 1,
        color: '#f59e0b',
        speed: 1.7,
        gatherPower: 10,
      };
    }

    this.beeFarmState.bees.push(newBee);
    this.initBeeSwarmMeshes();
    this.spawnParticleBurst(this.playerPos.x, this.playerPos.y + 2, this.playerPos.z, new THREE.Color(newBee.color).getHex(), 40);
    this.callbacks.onChatMessage(`🐣 Вылупилась новая пчела: ${newBee.name}! (Сила сбора: +${newBee.gatherPower})`);
    this.callbacks.onBeeFarmUpdate?.({ ...this.beeFarmState });
    this.callbacks.onStatsUpdate({ ...this.stats });
    return true;
  }

  // ==========================================================
  // ROBLOX DOORS (FIRST-PERSON HORROR HOTEL & DOOR 100) LOGIC
  // ==========================================================

  private emitDoorsStateIfChanged(force: boolean = false) {
    const ds = this.doorsState;
    const nearType = ds.nearInteractable?.type || '';
    const nearLabel = ds.nearInteractable?.label || '';
    const sig = `${ds.currentDoorNumber}|${ds.isCrouching}|${ds.isHidingInCloset}|${ds.flashlightOn}|${ds.activeEntity}|${
      ds.entityWarningText || ''
    }|${ds.screechActive}|${ds.eyesActive}|${ds.rushActive}|${ds.inDoor100Room}|${ds.figureDistance}|${
      ds.figureAlerted
    }|${nearType}|${nearLabel}|${ds.elevatorClosing}|${ds.currentRoomId}|${ds.rushWarningSeconds || 0}|${
      ds.rushDistanceMeters || 0
    }`;
    if (!force && sig === this.lastDoorsEmitSig) {
      return;
    }
    this.lastDoorsEmitSig = sig;
    this.callbacks.onDoorsStateUpdate?.({ ...this.doorsState });
  }

  public toggleDoorsCrouch() {
    if (this.currentGameId !== 'doors') return;
    this.doorsState.isCrouching = !this.doorsState.isCrouching;
    this.emitDoorsStateIfChanged(true);
  }

  public toggleDoorsFlashlight() {
    if (this.currentGameId !== 'doors') return;
    if (this.doorsState.screechActive) {
      this.repelScreech();
      return;
    }
    this.doorsState.flashlightOn = !this.doorsState.flashlightOn;
    sound.playPlaceBlock();
    this.emitDoorsStateIfChanged(true);
  }

  public repelScreech() {
    if (!this.doorsState.screechActive) return;
    this.doorsState.screechActive = false;
    this.doorsState.activeEntity = 'none';
    this.doorsState.entityWarningText = null;
    this.screechTimer = 0;
    const dd = this.worldData.doorsData;
    if (dd) {
      dd.screechMesh.position.set(0, -100, 0);
    }
    sound.playScreechRepel();
    this.stats.coins += 30;
    this.spawnParticleBurst(this.playerPos.x, this.playerPos.y + 3, this.playerPos.z + 2, 0xffffff, 18);
    this.callbacks.onChatMessage('🔦 Вы вовремя посветили на Скрича (Screech) и прогнали его! (+30 🪙)');
    this.callbacks.onStatsUpdate({ ...this.stats });
    this.emitDoorsStateIfChanged(true);
  }

  public triggerDoorsRushEvent() {
    if (this.currentGameId !== 'doors') return;
    if (this.doorsState.rushActive || this.rushWarningTimer > 0) return;

    this.rushWarningTimer = 4.2;
    this.rushApproachStage = 0;
    this.doorsState.lightFlickerIntensity = 0.95;
    this.doorsState.activeEntity = 'rush';
    this.doorsState.rushWarningSeconds = 4.2;
    this.doorsState.rushDistanceMeters = 0;
    this.doorsState.entityWarningText =
      '⚡ СВЕТ МЕРЦАЕТ! РАШ ЧЕРЕЗ 4.2с — ПРЯЧЬТЕСЬ В ШКАФ [E / Курок R]!';
    sound.playLightFlicker();
    sound.playRushApproach();
    this.triggerVRHapticPulse(0.75, 90);
    this.callbacks.onChatMessage('⚡ Свет в коридоре начал мерцать! Быстрее в шкаф [E] — через 4 сек прилетит Раш!');
    this.emitDoorsStateIfChanged(true);
  }

  public triggerDoorsScreechEvent() {
    if (this.currentGameId !== 'doors' || this.doorsState.screechActive) return;
    this.doorsState.screechActive = true;
    this.doorsState.activeEntity = 'screech';
    this.doorsState.entityWarningText = '🌑 «ПССТ!» Скрич (Screech) в темноте! Нажмите [F] или ЛКМ, чтобы отпугнуть!';
    this.screechTimer = 4.8;
    sound.playScreechPsst();
    const dd = this.worldData.doorsData;
    if (dd) {
      dd.screechMesh.position.set(this.playerPos.x + 1.4, this.playerPos.y + 3.2, this.playerPos.z + 3.0);
    }
    this.callbacks.onChatMessage('🌑 Псст! В темноте появился Скрич (Screech)! Нажмите [F] или ЛКМ!');
    this.emitDoorsStateIfChanged(true);
  }

  public applyRemoteDoorOpen(doorIndex: number) {
    if (this.currentGameId !== 'doors') return;
    this.openHotelDoor(doorIndex, true);
  }

  public applyRemoteElevatorClose() {
    if (this.currentGameId !== 'doors') return;
    this.triggerElevatorClose(true);
  }

  public openHotelDoor(doorIndex: number, isRemote: boolean = false) {
    const dd = this.worldData.doorsData;
    if (!dd) return;
    const door = dd.doors[doorIndex];
    if (!door || door.isOpen) return;

    // Dupe Entity Check (Fake Door)
    if (door.eventOnOpen === 'dupe') {
      if (isRemote) return;
      sound.playOof();
      this.screenShakeTimer = 0.5;
      if (!this.isGodMode) {
        this.stats.hp = Math.max(10, this.stats.hp - 40);
        this.callbacks.onStatsUpdate({ ...this.stats });
      }
      this.callbacks.onChatMessage('⚠️ ФАЛЬШИВАЯ ДВЕРЬ (DUPE)! Это ловушка двойника! Вы получили урон.');
      return;
    }

    door.isOpen = true;
    door.targetRotY = -Math.PI * 0.65;
    door.colliderMesh.position.y = -50;
    sound.playDoorOpen();

    if (!isRemote) {
      this.callbacks.onLocalDoorOpen?.(doorIndex, door.doorNumber);
    }

    if (door.doorNumber > this.doorsState.currentDoorNumber) {
      this.doorsState.currentDoorNumber = door.doorNumber;
    }
    const nextRoomDef = getDoorsRoomDefByDoorNumber(Math.min(100, door.doorNumber + 1));
    this.doorsState.phaseName = nextRoomDef.title;
    this.doorsState.currentRoomId = nextRoomDef.id;
    this.doorsState.currentRoomTitle = nextRoomDef.title;

    if (!isRemote) {
      this.stats.coins += 25;
      this.updateQuestProgress('open_doors', 1);
      this.callbacks.onStatsUpdate({ ...this.stats });
    }

    if (door.doorNumber === 100 || door.eventOnOpen === 'figure_room') {
      this.doorsState.inDoor100Room = true;
      this.doorsState.activeEntity = 'figure';
      this.doorsState.phaseName = 'ЭЛЕКТРОЩИТОВАЯ';
      this.doorsState.currentRoomId = 'electrical_room';
      this.doorsState.currentRoomTitle = 'ЭЛЕКТРОЩИТОВАЯ';
      this.doorsState.entityWarningText =
        '🤫 ДВЕРЬ 0100: ЭЛЕКТРОЩИТОВАЯ! Слепая Фигура патрулирует 1-й этаж — присядьте [C], крадитесь по лестнице справа на 2-й этаж к грузовому лифту!';
      sound.playFigureHeartbeat();
      this.callbacks.onChatMessage(
        '🚪 Открыта ДВЕРЬ 0100 (ЭЛЕКТРОЩИТОВАЯ)! Крадитесь на присяде [C] по лестнице справа на 2-й этаж к грузовому лифту!'
      );
    } else if (!isRemote && door.eventOnOpen === 'rush') {
      this.triggerDoorsRushEvent();
    } else if (!isRemote && door.eventOnOpen === 'screech') {
      this.triggerDoorsScreechEvent();
    } else if (!isRemote && door.eventOnOpen === 'eyes') {
      this.doorsState.eyesActive = true;
      this.doorsState.activeEntity = 'eyes';
      this.doorsState.entityWarningText =
        '👁️ НА СТЕНАХ ВСПЫХНУЛИ ГЛАЗА (EYES)! Опустите камеру вниз или отвернитесь!';
      sound.playEyesHum();
      this.callbacks.onChatMessage('👁️ В комнате появились Глаза (Eyes)! Опустите взгляд в пол!');
    } else if (!isRemote && door.eventOnOpen === 'silence') {
      this.doorsState.silenceActive = true;
      this.doorsState.activeEntity = 'silence';
      this.doorsState.entityWarningText = '🤫 ТИШИНА! Крадитесь на присяде [C], чтобы не привлечь монстра!';
      this.callbacks.onChatMessage(`🚪 Дверь #${String(door.doorNumber).padStart(4, '0')} (${nextRoomDef.title}) — соблюдайте тишину!`);
    } else if (!isRemote && door.eventOnOpen === 'gloom') {
      this.doorsState.gloomActive = true;
      this.doorsState.activeEntity = 'gloom';
      this.doorsState.entityWarningText = '🌑 МРАК! Включите фонарик [F] для освещения пути!';
      this.callbacks.onChatMessage(`🚪 Дверь #${String(door.doorNumber).padStart(4, '0')} (${nextRoomDef.title}) — сгустился мрак!`);
    } else {
      this.callbacks.onChatMessage(
        `🚪 Открыта Дверь #${String(door.doorNumber).padStart(4, '0')} — ${nextRoomDef.icon} ${nextRoomDef.title}!`
      );
    }

    this.emitDoorsStateIfChanged(true);
  }

  public toggleClosetHide(closetId?: string) {
    const dd = this.worldData.doorsData;
    if (!dd) return;

    if (this.doorsState.isHidingInCloset) {
      this.doorsState.isHidingInCloset = false;
      if (this.closetSavedPos) {
        this.playerPos.copy(this.closetSavedPos);
        this.closetSavedPos = null;
      }
      sound.playClosetHide();
      this.callbacks.onChatMessage('Вы вышли из деревянного шкафа.');
      this.emitDoorsStateIfChanged(true);
      return;
    }

    // Find nearest closet
    const targetCloset = closetId
      ? dd.closets.find((c) => c.id === closetId)
      : dd.closets.find((c) => Math.hypot(this.playerPos.x - c.position[0], this.playerPos.z - c.position[2]) < 5.0);

    if (targetCloset) {
      this.closetSavedPos = this.playerPos.clone();
      this.doorsState.isHidingInCloset = true;
      this.playerVel.set(0, 0, 0);
      this.playerPos.set(
        targetCloset.side === 'left' ? -4.3 : 4.3,
        0,
        targetCloset.position[2]
      );
      this.cameraYaw = targetCloset.side === 'left' ? -Math.PI / 2 : Math.PI / 2;
      sound.playClosetHide();
      this.callbacks.onChatMessage('🚪 Вы спрятались в деревянном шкафу! Раш не сможет вас достать. Нажмите [E] для выхода.');
      this.emitDoorsStateIfChanged(true);
    }
  }

  public triggerElevatorClose(isRemote: boolean = false) {
    if (this.doorsState.elevatorClosing) return;
    this.doorsState.elevatorClosing = true;
    this.doorsState.activeEntity = 'none';
    this.doorsState.entityWarningText = '🛗 СТВОРКИ ГРУЗОВОГО ЛИФТА ЗАКРЫВАЮТСЯ! ВЫ СБЕЖАЛИ ИЗ ЭЛЕКТРОЩИТОВОЙ (ДВЕРЬ 0100)!';
    this.elevatorCloseTimer = 1.8;
    this.screenShakeTimer = 1.2;
    sound.playElevatorClose();
    if (!isRemote) {
      this.callbacks.onLocalElevatorClose?.();
    }
    this.callbacks.onChatMessage('🛗 Нажата кнопка закрытия створок грузового лифта! Двери захлопываются прямо перед Фигурой!');
    this.emitDoorsStateIfChanged(true);
  }

  public teleportToDoorsRoom(target: DoorsRoomTypeId | number) {
    if (this.currentGameId !== 'doors') return;
    const dd = this.worldData.doorsData;
    if (!dd) return;

    const def =
      typeof target === 'number'
        ? getDoorsRoomDefByDoorNumber(target)
        : DOORS_ROOMS_ATLAS.find((r) => r.id === target) || DOORS_ROOMS_ATLAS[1];

    const targetDoorNum = typeof target === 'number' ? Math.max(0, Math.min(100, target)) : def.startDoor;

    // Open all doors prior to the target room and reset doors ahead so player can open them naturally
    for (let i = 0; i < dd.doors.length; i++) {
      if (dd.doors[i].doorNumber < targetDoorNum) {
        dd.doors[i].isOpen = true;
        dd.doors[i].targetRotY = -Math.PI * 0.65;
        dd.doors[i].hingeGroup.rotation.y = -Math.PI * 0.65;
        dd.doors[i].colliderMesh.position.y = -50;
      } else {
        dd.doors[i].isOpen = false;
        dd.doors[i].targetRotY = 0;
        dd.doors[i].hingeGroup.rotation.y = 0;
        dd.doors[i].colliderMesh.position.y = 3.5;
      }
    }

    this.doorsState.isHidingInCloset = false;
    this.doorsState.rushActive = false;
    this.doorsState.screechActive = false;
    this.doorsState.eyesActive = false;
    this.doorsState.lightFlickerIntensity = 0;
    this.doorsState.activeEntity = 'none';
    this.doorsState.entityWarningText = null;
    this.doorsState.rushWarningSeconds = 0;
    this.doorsState.rushDistanceMeters = 0;
    this.rushWarningTimer = 0;
    this.rushApproachStage = 0;

    if (targetDoorNum === 0) {
      // Starter Elevator (ЛИФТ)
      this.playerPos.set(0, 0.15, -4.2);
      this.doorsState.currentDoorNumber = 1;
      this.doorsState.inDoor100Room = false;
    } else if (targetDoorNum >= 100) {
      // Door 100: Electrical Room (ЭЛЕКТРОЩИТОВАЯ)
      const door100 = dd.doors[dd.doors.length - 1];
      if (door100) {
        door100.isOpen = true;
        door100.targetRotY = -Math.PI * 0.65;
        door100.hingeGroup.rotation.y = -Math.PI * 0.65;
        door100.colliderMesh.position.y = -50;
      }
      this.playerPos.set(0, 0.15, dd.roomStartZ + 3.0);
      this.doorsState.currentDoorNumber = 100;
      this.doorsState.inDoor100Room = true;
      this.doorsState.activeEntity = 'figure';
      this.doorsState.entityWarningText =
        '🤫 ДВЕРЬ 0100: ЭЛЕКТРОЩИТОВАЯ! Присядьте [C] и поднимайтесь по лестнице справа на 2-й этаж к грузовому лифту!';
    } else {
      const zSpawn = Math.max(2.0, (targetDoorNum - 1) * 12 + 3.5);
      this.playerPos.set(0, 0.15, zSpawn);
      this.doorsState.currentDoorNumber = targetDoorNum;
      this.doorsState.inDoor100Room = false;
    }

    this.doorsState.phaseName = def.title;
    this.doorsState.currentRoomId = def.id;
    this.doorsState.currentRoomTitle = def.title;
    this.playerVel.set(0, 0, 0);
    this.cameraYaw = Math.PI;
    this.cameraPitch = 0.02;
    sound.playCheckpoint();
    this.callbacks.onChatMessage(`🗺️ Перемещение в комнату «${def.icon} ${def.title}» (Дверь #${String(targetDoorNum).padStart(4, '0')})!`);
    this.emitDoorsStateIfChanged(true);
  }

  public teleportToDoor100() {
    this.teleportToDoorsRoom('electrical_room');
  }

  public interactInDoors() {
    if (this.currentGameId !== 'doors') return;

    if (this.doorsState.screechActive) {
      this.repelScreech();
      return;
    }

    if (this.doorsState.isHidingInCloset) {
      this.toggleClosetHide();
      return;
    }

    const interact = this.doorsState.nearInteractable;
    if (!interact) return;

    if (interact.type === 'elevator_button') {
      this.triggerElevatorClose();
    } else if (interact.type === 'door' && typeof interact.doorIndex === 'number') {
      this.openHotelDoor(interact.doorIndex);
    } else if (interact.type === 'closet') {
      this.toggleClosetHide(interact.closetId);
    } else if (interact.type === 'jeff_shop') {
      sound.playAchievement();
      this.stats.hp = this.stats.maxHp;
      this.stats.coins += 50;
      this.doorsState.flashlightOn = true;
      this.spawnParticleBurst(this.playerPos.x, this.playerPos.y + 2, this.playerPos.z, 0xfacc15, 25);
      this.callbacks.onStatsUpdate({ ...this.stats });
      this.callbacks.onChatMessage('🛒 МАГАЗИН ДЖЕФФА: Вы взяли Витамины, батарейки для фонарика и полное лечение! (+50 🪙)');
      this.emitDoorsStateIfChanged(true);
    } else if (interact.type === 'infirmary_herb') {
      sound.playAchievement();
      this.stats.hp = this.stats.maxHp;
      this.spawnParticleBurst(this.playerPos.x, this.playerPos.y + 2, this.playerPos.z, 0x4ade80, 25);
      this.callbacks.onStatsUpdate({ ...this.stats });
      this.callbacks.onChatMessage('🏥 ЛАЗАРЕТ: Целебная Трава Виридис полностью восстановила ваше здоровье (100 HP)!');
    } else if (interact.type === 'rift') {
      sound.playAchievement();
      this.stats.hp = this.stats.maxHp;
      this.stats.coins += 100;
      this.spawnParticleBurst(this.playerPos.x, this.playerPos.y + 2, this.playerPos.z, 0x38bdf8, 30);
      this.callbacks.onStatsUpdate({ ...this.stats });
      this.callbacks.onChatMessage('⚡ ПРОМЕЖУТОЧНЫЙ РАЗЛОМ: Энергия Разлома исцелила вас и даровала +100 🪙!');
    }
  }

  private updateDoorsSimulation(dt: number, time: number) {
    const dd = this.worldData.doorsData;
    if (!dd) return;

    // Keep current room title & ID synced with player's Z position
    const liveRoomDef = getDoorsRoomDefByZ(this.playerPos.z, 12);
    if (this.doorsState.currentRoomId !== liveRoomDef.id) {
      this.doorsState.currentRoomId = liveRoomDef.id;
      this.doorsState.currentRoomTitle = liveRoomDef.title;
      this.doorsState.phaseName = liveRoomDef.title;
    }

    // Smooth outdoor night sky vs indoor horror atmosphere based on zone
    const isOutdoorSkyZone = this.playerPos.z >= 984 && this.playerPos.z < 1200;
    if (this.scene.fog instanceof THREE.FogExp2) {
      const targetDensity = isOutdoorSkyZone ? 0.007 : 0.011;
      this.scene.fog.density = THREE.MathUtils.damp(this.scene.fog.density, targetDensity, 6, dt);
      this.scene.fog.color.setHex(isOutdoorSkyZone ? 0x0b1528 : 0x09060a);
    }
    if (this.scene.background instanceof THREE.Color) {
      this.scene.background.setHex(isOutdoorSkyZone ? 0x0b1528 : 0x09060a);
    }

    // Animate falling Courtyard rain streaks when nearby
    if (dd.rainGroup && this.playerPos.z >= 940 && this.playerPos.z <= 1120) {
      const pts = dd.rainGroup.children[0] as THREE.Points | undefined;
      if (pts) {
        const posAttr = pts.geometry.getAttribute('position') as THREE.BufferAttribute;
        const arr = posAttr.array as Float32Array;
        for (let r = 0; r < arr.length; r += 3) {
          arr[r + 1] -= 18 * dt;
          if (arr[r + 1] < 0.1) {
            arr[r + 1] = 13.8;
          }
        }
        posAttr.needsUpdate = true;
      }
    }

    // Clear temporary silence/gloom warnings once player moves on or turns on flashlight
    if (this.doorsState.gloomActive && this.doorsState.flashlightOn) {
      this.doorsState.gloomActive = false;
      if (this.doorsState.activeEntity === 'gloom') {
        this.doorsState.activeEntity = 'none';
        this.doorsState.entityWarningText = null;
      }
    }
    if (this.doorsState.silenceActive && this.doorsState.isCrouching) {
      this.doorsState.silenceActive = false;
      if (this.doorsState.activeEntity === 'silence') {
        this.doorsState.activeEntity = 'none';
        this.doorsState.entityWarningText = null;
      }
    }

    // 1. Smoothly animate swinging wooden hotel doors & auto-open when walking right up to them (P1 or P2)
    for (const door of dd.doors) {
      if (door.isOpen) {
        door.hingeGroup.rotation.y = THREE.MathUtils.damp(door.hingeGroup.rotation.y, door.targetRotY, 8, dt);
      } else {
        const p1Near = Math.abs(this.playerPos.z - door.z) < 2.8 && Math.abs(this.playerPos.x) < 2.4 && this.playerPos.y < 4.5;
        const p2Near = this.localCoopEnabled && Math.abs(this.p2Pos.z - door.z) < 2.8 && Math.abs(this.p2Pos.x) < 2.4 && this.p2Pos.y < 4.5;
        if (p1Near || p2Near) {
          this.openHotelDoor(door.index);
        }
      }
    }

    // 2. Determine nearest interactable prompt (Door, Closet, Jeff Shop, Infirmary, Rift, or Cargo Elevator Button)
    let nearPrompt: DoorsGameState['nearInteractable'] = null;

    if (this.doorsState.isHidingInCloset) {
      nearPrompt = {
        type: 'closet',
        label: 'Выйти из шкафа [E]',
      };
    } else {
      // Check Cargo Elevator inside on 2nd floor of Door 100 (z = dd.cargoElevator.position[2], y >= 6.8)
      const elevPos = dd.cargoElevator.position;
      const distElev = Math.hypot(this.playerPos.x - elevPos[0], this.playerPos.z - elevPos[2]);
      if (this.playerPos.y >= 6.8 && distElev < 5.8 && !this.doorsState.elevatorClosing) {
        nearPrompt = {
          type: 'elevator_button',
          label: 'ЗАКРЫТЬ СТВОРКИ ЛИФТА [E / Клик]',
        };
        // Auto-press button if player steps inside the elevator cab
        if (this.playerPos.z >= elevPos[2] - 0.8) {
          this.triggerElevatorClose();
        }
      }

      // Check Jeff Shop counters (Doors 51, 52, 54)
      if (
        !nearPrompt &&
        dd.jeffShopPositions.some(
          (pos) => Math.hypot(this.playerPos.x - pos[0], this.playerPos.z - pos[2]) < 5.2
        )
      ) {
        nearPrompt = {
          type: 'jeff_shop',
          label: '🛒 Магазин Джеффа: Взять Витамины и Заряд [E]',
        };
      }

      // Check Infirmary Viridis Herb (Doors 57 & 60)
      if (
        !nearPrompt &&
        dd.infirmaryHerbPositions.some(
          (pos) => Math.hypot(this.playerPos.x - pos[0], this.playerPos.z - pos[2]) < 5.0
        )
      ) {
        nearPrompt = {
          type: 'infirmary_herb',
          label: '🏥 Лазарет: Исцелиться Травой Виридис [E]',
        };
      }

      // Check Mid-Run Rift (Doors 66 & 70)
      if (
        !nearPrompt &&
        dd.riftPositions.some(
          (pos) => Math.hypot(this.playerPos.x - pos[0], this.playerPos.z - pos[2]) < 5.2
        )
      ) {
        nearPrompt = {
          type: 'rift',
          label: '⚡ Активировать Промежуточный Разлом (+100 🪙) [E]',
        };
      }

      // Check closed doors nearby
      if (!nearPrompt) {
        for (const door of dd.doors) {
          if (!door.isOpen && Math.abs(this.playerPos.z - door.z) < 5.5 && Math.abs(this.playerPos.x) < 3.5) {
            nearPrompt = {
              type: 'door',
              label: `Открыть Дверь #${String(door.doorNumber).padStart(4, '0')} [E]`,
              doorIndex: door.index,
            };
            break;
          }
        }
      }

      // Check wooden closets nearby
      if (!nearPrompt) {
        for (const closet of dd.closets) {
          const dCloset = Math.hypot(this.playerPos.x - closet.position[0], this.playerPos.z - closet.position[2]);
          if (dCloset < 4.2 && this.playerPos.y < 3.5) {
            nearPrompt = {
              type: 'closet',
              label: 'Спрятаться в шкаф от Раша [E]',
              closetId: closet.id,
            };
            break;
          }
        }
      }
    }

    // 3. RUSH (Раш) Light Flicker Warning, Escalating Audio/Haptics & High-Speed Corridor Charge
    if (this.rushWarningTimer > 0) {
      this.rushWarningTimer = Math.max(0, this.rushWarningTimer - dt);
      const secLeft = Number(this.rushWarningTimer.toFixed(1));
      this.doorsState.rushWarningSeconds = secLeft;
      this.doorsState.lightFlickerIntensity = 0.5 + Math.abs(Math.sin(time * 28)) * 0.5;
      this.doorsState.entityWarningText = this.doorsState.isHidingInCloset
        ? `🛡️ ВЫ В ШКАФУ! Раш прилетит через ${secLeft.toFixed(1)}с — ждите внутри!`
        : `⚡ СВЕТ МЕРЦАЕТ! РАШ ЧЕРЕЗ ${secLeft.toFixed(1)}с — ПРЯЧЬТЕСЬ В ШКАФ [E / Курок]!`;

      if (this.rushWarningTimer <= 2.5 && this.rushApproachStage === 0) {
        this.rushApproachStage = 1;
        sound.playRushApproach();
        this.triggerVRHapticPulse(0.65, 65);
      } else if (this.rushWarningTimer <= 1.1 && this.rushApproachStage === 1) {
        this.rushApproachStage = 2;
        sound.playRushApproach();
        sound.playLightFlicker();
        this.triggerVRHapticPulse(0.9, 95);
      } else if (Math.random() < 0.14) {
        sound.playLightFlicker();
      }

      if (this.rushWarningTimer <= 0) {
        this.doorsState.rushWarningSeconds = 0;
        this.doorsState.rushActive = true;
        this.rushHitPlayer = false;
        this.rushZ = Math.max(-4, this.playerPos.z - 42);
        this.rushTargetZ = Math.min(dd.roomStartZ - 2, this.playerPos.z + 42);
        this.doorsState.rushDistanceMeters = Math.round(Math.abs(this.playerPos.z - this.rushZ));
        this.doorsState.entityWarningText = '💀 РАШ ЛЕТИТ ПО КОРИДОРУ! ОСТАВАЙТЕСЬ В ШКАФУ!';
        dd.rushMesh.position.set(0, 3.6, this.rushZ);
        dd.rushLight.intensity = 3.5;
        sound.playRushRoar();
        this.triggerVRHapticPulse(1.0, 120);
        this.screenShakeTimer = 1.3;
      }
    }

    if (this.doorsState.rushActive) {
      this.rushZ += 46.0 * dt;
      this.doorsState.rushDistanceMeters = Math.max(0, Math.round(Math.abs(this.playerPos.z - this.rushZ)));
      dd.rushMesh.position.set(Math.sin(time * 25) * 0.45, 3.6, this.rushZ);
      dd.rushMesh.rotation.z = Math.sin(time * 20) * 0.25;
      this.spawnParticleBurst(0, 3.5, this.rushZ, 0x18181b, 3);

      // Check if Rush passes the player
      if (!this.rushHitPlayer && Math.abs(this.rushZ - this.playerPos.z) < 3.2 && this.playerPos.y < 5.0) {
        this.rushHitPlayer = true;
        const isSafe = this.doorsState.isHidingInCloset || Math.abs(this.playerPos.x) > 3.8 || this.isGodMode;
        if (isSafe) {
          sound.playAchievement();
          this.stats.coins += 40;
          this.callbacks.onStatsUpdate({ ...this.stats });
          this.callbacks.onChatMessage('🛡️ Раш (Rush) с грохотом пронёсся мимо вашего укрытия! (+40 🪙)');
        } else {
          sound.playOof();
          this.screenShakeTimer = 0.7;
          this.stats.hp = Math.max(10, this.stats.hp - 40);
          this.callbacks.onStatsUpdate({ ...this.stats });
          this.callbacks.onChatMessage('💥 РАШ (RUSH) задел вас в коридоре! Прячьтесь в шкафы [E], когда мерцает свет!');
        }
      }

      if (this.rushZ >= this.rushTargetZ) {
        this.doorsState.rushActive = false;
        this.doorsState.rushWarningSeconds = 0;
        this.doorsState.rushDistanceMeters = 0;
        this.doorsState.lightFlickerIntensity = 0;
        this.doorsState.activeEntity = 'none';
        this.doorsState.entityWarningText = null;
        dd.rushMesh.position.set(0, -100, 0);
        dd.rushLight.intensity = 0;
      }
    }

    // Update 4 pooled corridor PointLights to dynamically track the 4 nearest room light nodes
    const nodes = dd.roomLightNodes;
    if (nodes.length > 0 && dd.corridorLightPool.length > 0) {
      let nearestIdx = 0;
      let minDist = Infinity;
      for (let i = 0; i < nodes.length; i++) {
        const d = Math.abs(nodes[i].z - this.playerPos.z);
        if (d < minDist) {
          minDist = d;
          nearestIdx = i;
        }
      }
      const startIdx = Math.max(0, Math.min(nodes.length - dd.corridorLightPool.length, nearestIdx - 1));
      const isFlickering = this.doorsState.lightFlickerIntensity > 0 || this.doorsState.rushActive;
      for (let p = 0; p < dd.corridorLightPool.length; p++) {
        const node = nodes[startIdx + p];
        const pLight = dd.corridorLightPool[p];
        if (!node) {
          pLight.intensity = 0;
          continue;
        }
        pLight.position.set(node.x, node.y, node.z);
        pLight.color.setHex(isFlickering ? 0xfca5a5 : node.color);
        pLight.distance = node.distance;
        const flashOn = Math.sin(time * 28 + p * 1.4) > -0.15;
        pLight.intensity = isFlickering
          ? flashOn
            ? node.baseIntensity * 1.45
            : 0.05
          : node.baseIntensity;
        if (node.bulbMesh) {
          node.bulbMesh.scale.setScalar(isFlickering && flashOn ? 1.4 : 1.0);
        }
      }
    }

    dd.figureMonster.glowLight.intensity = this.doorsState.inDoor100Room ? 2.6 : 0;

    // 4. SCREECH (Скрич) in dark rooms
    const worldHeadPos =
      this.vrState.enabled && this.renderer.xr.isPresenting ? this.vrHeadWorldPos : this.camera.position;

    if (this.doorsState.screechActive) {
      this.screechTimer -= dt;
      dd.screechMesh.position.set(
        this.playerPos.x + Math.sin(time * 4) * 1.2 + 0.8,
        this.playerPos.y + 3.2 + Math.cos(time * 5) * 0.25,
        this.playerPos.z + 2.8
      );
      dd.screechMesh.lookAt(worldHeadPos);

      if (this.screechTimer <= 0) {
        this.doorsState.screechActive = false;
        this.doorsState.activeEntity = 'none';
        this.doorsState.entityWarningText = null;
        dd.screechMesh.position.set(0, -100, 0);
        if (!this.isGodMode) {
          sound.playOof();
          this.screenShakeTimer = 0.4;
          this.stats.hp = Math.max(15, this.stats.hp - 25);
          this.callbacks.onStatsUpdate({ ...this.stats });
          this.callbacks.onChatMessage('😱 Скрич укусил вас в темноте! Нажимайте [F] или ЛКМ при звуке «Псст!»');
        }
      }
    }

    // 5. EYES (Глаза) — Check if player is looking directly at glowing Eyes clusters
    let nearEyes = false;
    this.getCameraWorldLookDirection(this.scratchEyesDir);

    for (const ec of dd.eyesClusters) {
      ec.group.position.y = 4.2 + Math.sin(time * 2.6 + ec.z) * 0.35;
      ec.group.rotation.y = Math.sin(time * 1.5) * 0.35;

      const distToEyes = Math.abs(this.playerPos.z - ec.z);
      if (distToEyes < 11.5 && this.playerPos.y < 6.0) {
        nearEyes = true;
        this.scratchEyesToTarget.copy(ec.group.position).sub(worldHeadPos).normalize();
        const dot = this.scratchEyesDir.dot(this.scratchEyesToTarget);
        if (dot > 0.72 && this.scratchEyesDir.y > -0.25) {
          this.eyesDamageCooldown -= dt;
          if (this.eyesDamageCooldown <= 0) {
            this.eyesDamageCooldown = 0.9;
            sound.playEyesHum();
            this.screenShakeTimer = 0.2;
            if (!this.isGodMode) {
              this.stats.hp = Math.max(15, this.stats.hp - 12);
              this.callbacks.onStatsUpdate({ ...this.stats });
            }
          }
        }
      }
    }
    this.doorsState.eyesActive = nearEyes;
    if (!nearEyes && this.doorsState.activeEntity === 'eyes') {
      this.doorsState.activeEntity = 'none';
      this.doorsState.entityWarningText = null;
    }

    // 6. DOOR 0100: BLIND MONSTER FIGURE (Фигура) PATROL & STEALTH IN ELECTRICAL ROOM
    if (this.playerPos.z >= dd.roomStartZ - 2) {
      this.doorsState.inDoor100Room = true;
    }

    const fig = dd.figureMonster;
    if (this.doorsState.inDoor100Room && !this.doorsState.elevatorClosing) {
      const playerOnFirstFloor = this.playerPos.y < 4.5 && this.playerPos.z >= dd.roomStartZ + 2;
      const playerMakingNoise = playerOnFirstFloor && this.avatar.isMoving && !this.doorsState.isCrouching;

      this.doorsState.figureAlerted = playerMakingNoise;

      let targetFigX = Math.sin(time * 0.75) * 7.5;
      let targetFigZ = dd.roomStartZ + 28 + Math.cos(time * 0.55) * 14.0;

      if (playerMakingNoise) {
        targetFigX = this.playerPos.x;
        targetFigZ = this.playerPos.z;
      }

      const dx = targetFigX - fig.group.position.x;
      const dz = targetFigZ - fig.group.position.z;
      const distToTarget = Math.hypot(dx, dz);
      const figSpeed = playerMakingNoise ? 9.5 : 4.8;

      if (distToTarget > 0.2) {
        fig.group.position.x += (dx / distToTarget) * figSpeed * dt;
        fig.group.position.z += (dz / distToTarget) * figSpeed * dt;
        const figAngle = Math.atan2(dx, dz);
        fig.group.rotation.y = THREE.MathUtils.damp(fig.group.rotation.y, figAngle, 8, dt);
      }

      // Animate Figure limbs
      const limbSwing = Math.sin(time * (playerMakingNoise ? 11 : 6)) * 0.65;
      fig.leftLeg.rotation.x = limbSwing;
      fig.rightLeg.rotation.x = -limbSwing;
      fig.leftArm.rotation.x = -0.5 - limbSwing * 0.6;
      fig.rightArm.rotation.x = -0.5 + limbSwing * 0.6;

      const distToPlayer = Math.hypot(
        this.playerPos.x - fig.group.position.x,
        this.playerPos.z - fig.group.position.z
      );
      this.doorsState.figureDistance = Math.round(distToPlayer);

      this.figureStepTimer -= dt;
      if (this.figureStepTimer <= 0 && distToPlayer < 28) {
        this.figureStepTimer = playerMakingNoise ? 0.55 : 1.1;
        sound.playFigureHeartbeat();
      }

      // If Figure catches an un-crouched player on the 1st floor
      if (distToPlayer < 2.6 && Math.abs(this.playerPos.y - fig.group.position.y) < 3.5 && !this.isGodMode) {
        sound.playOof();
        this.screenShakeTimer = 0.6;
        this.stats.hp = Math.max(15, this.stats.hp - 35);
        this.playerPos.set(13.5, 1.0, dd.roomStartZ + 8);
        this.doorsState.isCrouching = true;
        this.callbacks.onStatsUpdate({ ...this.stats });
        this.callbacks.onChatMessage(
          '👹 Слепая Фигура услышала ваши шаги! Включён Тихий Шаг [C] — поднимайтесь по лестнице перед вами на 2-й этаж к лифту!'
        );
      }
    }

    // 7. CARGO ELEVATOR DOORS CLOSING & VICTORY SEQUENCE
    if (this.doorsState.elevatorClosing) {
      const leftDoor = dd.cargoElevator.leftDoor;
      const rightDoor = dd.cargoElevator.rightDoor;
      leftDoor.position.x = THREE.MathUtils.damp(leftDoor.position.x, -1.9, 6, dt);
      rightDoor.position.x = THREE.MathUtils.damp(rightDoor.position.x, 1.9, 6, dt);

      // Figure runs up to the outside of the elevator grate dramatically
      fig.group.position.x = THREE.MathUtils.damp(fig.group.position.x, 0, 5, dt);
      fig.group.position.y = THREE.MathUtils.damp(fig.group.position.y, 8.0, 5, dt);
      fig.group.position.z = THREE.MathUtils.damp(fig.group.position.z, dd.cargoElevator.position[2] - 5.5, 5, dt);

      this.elevatorCloseTimer -= dt;
      if (this.elevatorCloseTimer <= 0 && this.stats.completionTime === 0) {
        this.stats.completionTime = Math.floor((Date.now() - this.stats.startTime) / 1000);
        this.stats.coins += 250;
        sound.playVictory();
        this.spawnParticleBurst(this.playerPos.x, this.playerPos.y + 3, this.playerPos.z, 0xf59e0b, 60);
        this.callbacks.onStatsUpdate({ ...this.stats });
        this.callbacks.onVictory({ ...this.stats });
        this.callbacks.onChatMessage(
          '🏆 ПОБЕДА В DOORS! Вы прошли все 18 локаций и Дверь 0100 (Электрощитовая), перехитрили Фигуру и закрыли створки лифта! (+250 🪙)',
          'Отель DOORS'
        );
      }
    }

    this.doorsState.nearInteractable = nearPrompt;
    this.doorsHudEmitTimer -= dt;
    if (this.doorsHudEmitTimer <= 0) {
      this.doorsHudEmitTimer = 0.1;
      this.emitDoorsStateIfChanged(false);
    }
  }

  private updateCamera(dt: number) {
    // STUDIO 3D EDITOR FREE-FLY ORBIT CAMERA
    if (this.currentGameId === 'studio' && this.studioMode === 'edit') {
      const target = this.scratchCamTarget.copy(this.studioCamTarget);
      const camX = target.x + Math.sin(this.cameraYaw) * Math.cos(this.cameraPitch) * this.cameraDistance;
      const camY = target.y + Math.sin(this.cameraPitch) * this.cameraDistance;
      const camZ = target.z + Math.cos(this.cameraYaw) * Math.cos(this.cameraPitch) * this.cameraDistance;
      const desiredCamPos = this.scratchCamDesired.set(camX, Math.max(1.2, camY), camZ);
      this.camera.position.x = THREE.MathUtils.damp(this.camera.position.x, desiredCamPos.x, 14, dt);
      this.camera.position.y = THREE.MathUtils.damp(this.camera.position.y, desiredCamPos.y, 14, dt);
      this.camera.position.z = THREE.MathUtils.damp(this.camera.position.z, desiredCamPos.z, 14, dt);
      this.camera.lookAt(target);
      return;
    }

    // Screen shake offset (zero-allocation)
    this.scratchShakeVec.set(0, 0, 0);
    if (this.screenShakeTimer > 0) {
      this.screenShakeTimer -= dt;
      this.scratchShakeVec.set((Math.random() - 0.5) * 0.45, (Math.random() - 0.5) * 0.45, (Math.random() - 0.5) * 0.45);
    }

    // FIRST-PERSON POV CAMERA FOR ROBLOX DOORS MODE OR ACTIVE 6DoF VR MODE
    if (this.currentGameId === 'doors' || this.vrState.enabled) {
      if (this.vrState.enabled) {
        this.avatar.root.visible = false;
      }

      if (this.vrState.enabled && this.renderer.xr.isPresenting) {
        // Real PICO / WebXR manages camera.position & camera.quaternion in vrXROrigin (local-floor) space.
        // Sync the VR character controller root, head rig, and tracked hands atomically after movement.
        this.syncVRCharacterControllerOrigin();
        this.updateVRSimulation(dt, performance.now() / 1000);
      } else {
        if (this.vrCameraRig.parent !== this.scene) {
          this.scene.add(this.vrCameraRig);
        }
        const baseEye = this.currentGameId === 'doors' && this.doorsState.isCrouching ? 2.15 : 3.35;
        const vrHeightDelta = this.vrState.enabled ? this.vrState.heightOffset - VR_DEFAULT_HEIGHT_OFFSET : 0;
        const eyeHeight = Math.max(1.6, baseEye + vrHeightDelta);
        const bobAmp =
          this.avatar.isMoving && !this.doorsState.isHidingInCloset
            ? this.currentGameId === 'doors' && this.doorsState.isCrouching
              ? 0.05
              : 0.14
            : 0.012;
        const bobY = Math.sin(this.avatar.walkPhase * 1.15) * bobAmp;
        const bobX = Math.cos(this.avatar.walkPhase * 0.575) * (bobAmp * 0.55);

        this.scratchCamTarget
          .set(this.playerPos.x + bobX, this.playerPos.y + eyeHeight + bobY, this.playerPos.z)
          .add(this.scratchShakeVec);

        this.camera.position.copy(this.scratchCamTarget);

        this.scratchCamDir.set(
          -Math.sin(this.cameraYaw) * Math.cos(this.cameraPitch),
          -Math.sin(this.cameraPitch),
          -Math.cos(this.cameraYaw) * Math.cos(this.cameraPitch)
        );
        this.scratchCamLook.copy(this.scratchCamTarget).addScaledVector(this.scratchCamDir, 12);
        this.camera.lookAt(this.scratchCamLook);

        if (this.vrState.enabled) {
          this.updateVRSimulation(dt, performance.now() / 1000);
        } else if (this.flashlightSpot) {
          this.flashlightSpot.position.copy(this.scratchCamTarget);
          this.flashlightTarget.position.copy(this.scratchCamTarget).addScaledVector(this.scratchCamDir, 22);
          this.flashlightSpot.intensity = this.doorsState.flashlightOn ? 3.5 : 0;
        }
      }

      // Player 2 Split-Screen POV Camera in DOORS
      if (this.localCoopEnabled && this.player2Avatar) {
        const p2BobAmp = this.player2Avatar.isMoving ? 0.12 : 0.012;
        const p2BobY = Math.sin(this.player2Avatar.walkPhase * 1.15) * p2BobAmp;
        const p2BobX = Math.cos(this.player2Avatar.walkPhase * 0.575) * (p2BobAmp * 0.55);
        this.scratchP2Target.set(this.p2Pos.x + p2BobX, this.p2Pos.y + 3.35 + p2BobY, this.p2Pos.z);
        this.camera2.position.copy(this.scratchP2Target);
        this.scratchP2Dir.set(
          -Math.sin(this.p2CameraYaw) * Math.cos(this.p2CameraPitch),
          -Math.sin(this.p2CameraPitch),
          -Math.cos(this.p2CameraYaw) * Math.cos(this.p2CameraPitch)
        );
        this.scratchP2Desired.copy(this.scratchP2Target).addScaledVector(this.scratchP2Dir, 12);
        this.camera2.lookAt(this.scratchP2Desired);
      }
      return;
    }

    // THIRD-PERSON CAMERA FOR OBBY, LAVA SURVIVAL & BEE SWARM (zero-allocation)
    this.scratchCamTarget.set(this.playerPos.x, this.playerPos.y + 3.2, this.playerPos.z);

    const camX = this.scratchCamTarget.x + Math.sin(this.cameraYaw) * Math.cos(this.cameraPitch) * this.cameraDistance;
    const camY = this.scratchCamTarget.y + Math.sin(this.cameraPitch) * this.cameraDistance;
    const camZ = this.scratchCamTarget.z + Math.cos(this.cameraYaw) * Math.cos(this.cameraPitch) * this.cameraDistance;

    this.scratchCamDesired.set(camX, Math.max(0.5, camY), camZ).add(this.scratchShakeVec);

    // Exponential damping camera follow
    this.camera.position.x = THREE.MathUtils.damp(this.camera.position.x, this.scratchCamDesired.x, 15, dt);
    this.camera.position.y = THREE.MathUtils.damp(this.camera.position.y, this.scratchCamDesired.y, 15, dt);
    this.camera.position.z = THREE.MathUtils.damp(this.camera.position.z, this.scratchCamDesired.z, 15, dt);

    this.camera.lookAt(this.scratchCamTarget);

    // Player 2 Split-Screen Third-Person Follow Camera
    if (this.localCoopEnabled) {
      this.scratchP2Target.set(this.p2Pos.x, this.p2Pos.y + 3.2, this.p2Pos.z);
      const p2CamX = this.scratchP2Target.x + Math.sin(this.p2CameraYaw) * Math.cos(this.p2CameraPitch) * this.cameraDistance;
      const p2CamY = this.scratchP2Target.y + Math.sin(this.p2CameraPitch) * this.cameraDistance;
      const p2CamZ = this.scratchP2Target.z + Math.cos(this.p2CameraYaw) * Math.cos(this.p2CameraPitch) * this.cameraDistance;
      this.scratchP2Desired.set(p2CamX, Math.max(0.5, p2CamY), p2CamZ);

      this.camera2.position.x = THREE.MathUtils.damp(this.camera2.position.x, this.scratchP2Desired.x, 15, dt);
      this.camera2.position.y = THREE.MathUtils.damp(this.camera2.position.y, this.scratchP2Desired.y, 15, dt);
      this.camera2.position.z = THREE.MathUtils.damp(this.camera2.position.z, this.scratchP2Desired.z, 15, dt);
      this.camera2.lookAt(this.scratchP2Target);
    }
  }

  private updateVRSimulation(dt: number, time: number) {
    if (!this.vrState.enabled) return;

    const isXRPresenting = Boolean(this.renderer.xr.isPresenting);
    this.vrCameraRig.visible = true;
    this.vrLeftRig.root.visible = true;
    this.vrRightRig.root.visible = true;

    if (isXRPresenting) {
      // Keep vrCameraRig parented to vrXROrigin and locked to live XRViewerPose head position & orientation
      this.syncVRCharacterControllerOrigin();
    } else {
      if (this.vrCameraRig.parent !== this.scene) {
        this.scene.add(this.vrCameraRig);
      }
      this.vrCameraRig.position.copy(this.camera.position);
      this.vrCameraRig.quaternion.copy(this.camera.quaternion);
      this.vrCameraRig.updateMatrixWorld(true);
      this.vrHeadWorldPos.copy(this.camera.position);
      this.vrHeadWorldQuat.copy(this.camera.quaternion);
    }

    // Keep character avatar facing synced with VR horizontal gaze direction
    this.getMovementAxes(this.vrScratchForward, this.vrScratchRight);
    this.avatar.root.rotation.y = Math.atan2(this.vrScratchForward.x, this.vrScratchForward.z);

    // Decay trigger/grip pulses, active gesture timer & snap-turn cooldown smoothly
    this.vrTriggerDecay = Math.max(0, this.vrTriggerDecay - dt * 3.2);
    this.vrGripDecay = Math.max(0, this.vrGripDecay - dt * 2.8);
    if (this.vrActiveGestureTimer > 0) {
      this.vrActiveGestureTimer = Math.max(0, this.vrActiveGestureTimer - dt);
      if (this.vrActiveGestureTimer === 0 && this.vrState.activeGesture !== null) {
        this.vrState.activeGesture = null;
        this.vrState.activeGestureLabel = null;
        this.vrState.activeGestureExpiresAt = 0;
      }
    }
    if (this.vrTeleportFlashTimer > 0) {
      this.vrTeleportFlashTimer = Math.max(0, this.vrTeleportFlashTimer - dt);
    }
    if (this.vrSnapTurnCooldown > 0) {
      this.vrSnapTurnCooldown = Math.max(0, this.vrSnapTurnCooldown - dt);
    }

    const horizSpeed = Math.hypot(this.playerVel.x, this.playerVel.z);
    const walkMag = Math.min(1, horizSpeed / 14);
    const angularVel = Math.abs(this.cameraYaw - this.vrPrevCameraYaw) / Math.max(0.001, dt);
    this.vrPrevCameraYaw = this.cameraYaw;

    // Comfort anti-motion-sickness vignette intensity
    this.vrState.vignetteIntensity = computeComfortVignetteIntensity(
      horizSpeed,
      angularVel,
      this.vrTeleportFlashTimer > 0,
      this.vrState.comfortVignette
    );

    const kbX =
      (this.keysHeld.has('KeyD') || this.keysHeld.has('ArrowRight') ? 1 : 0) -
      (this.keysHeld.has('KeyA') || this.keysHeld.has('ArrowLeft') ? 1 : 0);
    const kbZ =
      (this.keysHeld.has('KeyW') || this.keysHeld.has('ArrowUp') ? 1 : 0) -
      (this.keysHeld.has('KeyS') || this.keysHeld.has('ArrowDown') ? 1 : 0);
    let leftStickVec: [number, number] = [
      kbX || (isXRPresenting ? this.vrMoveStickX : this.joystickX),
      kbZ || -(isXRPresenting ? this.vrMoveStickY : this.joystickY),
    ];
    let rightStickVec: [number, number] = [
      Number(this.vrPointerNormX.toFixed(2)),
      Number(this.vrPointerNormY.toFixed(2)),
    ];

    let leftTrigger = Number((this.vrTriggerDecay * 0.5).toFixed(2));
    let leftGrip = Number(this.vrGripDecay.toFixed(2));
    let rightTrigger = Number(this.vrTriggerDecay.toFixed(2));
    let rightGrip = Number(this.vrGripDecay.toFixed(2));

    let leftPrimary = this.keysHeld.has('KeyC') || this.keysHeld.has('ControlLeft');
    let leftSecondary = this.keysHeld.has('KeyF');
    let rightPrimary = this.keysHeld.has('KeyE') || this.keysHeld.has('Space');
    let rightSecondary = this.keysHeld.has('KeyT') || this.vrTeleportFlashTimer > 0.05;
    let leftThumbPress = this.keysHeld.has('ShiftLeft');
    let rightThumbPress = false;
    let leftMenu = false;

    // Default synthesized 6DoF poses (used when not in WebXR, or as resting head-relative baseline if a controller is untracked)
    const simAimX = isXRPresenting ? 0 : this.vrPointerNormX;
    const simAimY = isXRPresenting ? 0 : this.vrPointerNormY;
    let leftPose = computeVRControllerPoseFromPointer(
      simAimX,
      simAimY,
      'left',
      time,
      leftTrigger,
      leftGrip,
      walkMag
    );
    let rightPose = computeVRControllerPoseFromPointer(
      simAimX,
      simAimY,
      'right',
      time,
      rightTrigger,
      rightGrip,
      walkMag
    );

    // Poll Real WebXR InputSources (PICO 4 / PICO 4 Ultra / PICO Neo 3 / Quest Gamepads & 6DoF Poses)
    const xrSession = this.renderer.xr.getSession?.();
    const xrFrame = this.renderer.xr.getFrame?.() as any;
    const xrRefSpace = this.renderer.xr.getReferenceSpace?.() as any;
    let hasLiveLeftPose = false;
    let hasLiveRightPose = false;
    let originMovedDuringActions = false;

    if (xrSession && xrSession.inputSources) {
      // Use the EXACT same live head pose that vrCameraRig is synced to inside vrXROrigin
      const headPos = this.vrHeadLocalPos;
      const headQuat = this.vrHeadLocalQuat;

      let idx = 0;
      for (const src of xrSession.inputSources) {
        const handedness = src.handedness;
        const profiles = (src as any).profiles as string[] | undefined;
        if (profiles && profiles.length > 0) {
          const detected = detectVRHeadsetProfile(navigator.userAgent, profiles);
          this.vrState.controllerProfile = detected.profile;
          this.vrState.detectedHeadsetName = detected.label;
        }
        if ((src as any).hand && this.vrState.trackingMode !== 'hands') {
          this.vrState.trackingMode = 'hands';
        }

        const gp = (src as any).gamepad;
        if (gp) {
          const parsed = parseXRGamepadState(gp.buttons, gp.axes);
          if (handedness === 'left') {
            leftTrigger = parsed.trigger;
            leftGrip = parsed.grip;
            leftStickVec = parsed.thumbstick;
            leftPrimary = parsed.buttonPrimary;
            leftSecondary = parsed.buttonSecondary;
            leftThumbPress = parsed.thumbstickPressed;
            leftMenu = parsed.menuPressed;

            // Left X (buttonPrimary) -> Open / Close 3D Spatial VR Main Menu (never intercepted by PICO OS)
            if (leftPrimary && !this.vrPrevXrLeftPrimary) {
              this.toggleVRMainMenu();
            }
            this.vrPrevXrLeftPrimary = leftPrimary;

            // Left Y (buttonSecondary) OR Left Thumbstick Click (L3) OR Left Menu -> Toggle 3D Controls Hint Card
            const hintToggleNow =
              (leftSecondary && !this.vrPrevXrLeftSecondary) ||
              (leftThumbPress && !this.vrPrevXrLeftThumb) ||
              (leftMenu && !this.vrPrevXrLeftMenu);
            if (hintToggleNow) {
              this.toggleVRControlsHint();
            }
            this.vrPrevXrLeftSecondary = leftSecondary;
            this.vrPrevXrLeftThumb = leftThumbPress;
            this.vrPrevXrLeftMenu = leftMenu;

            // Left Trigger edge press -> Click hovered 3D VR Main Menu button, OR shoot Orange Portal when Portal Gun equipped!
            const leftTrigNow = parsed.trigger > 0.65;
            if (leftTrigNow && !this.vrPrevXrLeftTrig) {
              if (this.vrState.vrMenuOpen && this.vrMenuHoveredAction) {
                this.executeVRMenuAction(this.vrMenuHoveredAction);
              } else if (!this.vrState.vrMenuOpen && this.activeTool === 'portal_gun') {
                this.firePortal('orange', true);
              }
            }
            this.vrPrevXrLeftTrig = leftTrigNow;

            // Left Grip edge press -> Teleport (when VR Menu is closed)
            const gripPressedNow = parsed.grip > 0.7;
            if (gripPressedNow && !this.vrPrevXrLeftGrip && !this.vrState.vrMenuOpen) {
              this.triggerVRTeleport();
              originMovedDuringActions = true;
            }
            this.vrPrevXrLeftGrip = gripPressedNow;
          } else if (handedness === 'right') {
            rightTrigger = parsed.trigger;
            rightGrip = parsed.grip;
            rightStickVec = parsed.thumbstick;
            rightPrimary = parsed.buttonPrimary;
            rightSecondary = parsed.buttonSecondary;
            rightThumbPress = parsed.thumbstickPressed;

            // Right PICO Trigger edge press -> Click 3D VR Menu button if open, or Blue Portal if Portal Gun, else Interact / Attack
            const trigNow = parsed.trigger > 0.65;
            if (trigNow && !this.vrPrevXrRightTrig) {
              if (this.vrState.vrMenuOpen) {
                if (this.vrMenuHoveredAction) {
                  this.executeVRMenuAction(this.vrMenuHoveredAction);
                }
              } else if (this.activeTool === 'portal_gun') {
                this.firePortal('blue', false);
              } else {
                this.triggerAction(false);
                this.triggerVRHapticPulse(0.75, 45);
              }
            }
            this.vrPrevXrRightTrig = trigNow;

            // Right PICO A button -> Jump / Crouch
            if (parsed.buttonPrimary && !this.vrPrevXrPrimaryR) {
              if (this.vrState.vrMenuOpen && this.vrMenuHoveredAction) {
                this.executeVRMenuAction(this.vrMenuHoveredAction);
              } else if (this.currentGameId === 'doors') {
                this.toggleDoorsCrouch();
              } else {
                this.triggerJump();
              }
            }
            this.vrPrevXrPrimaryR = parsed.buttonPrimary;

            // Right PICO B button -> Close VR Menu if open, else Flashlight / Teleport
            if (parsed.buttonSecondary && !this.vrPrevXrSecondaryR) {
              if (this.vrState.vrMenuOpen) {
                this.toggleVRMainMenu(false);
              } else if (this.currentGameId === 'doors') {
                this.toggleDoorsFlashlight();
              } else {
                this.triggerVRTeleport();
                originMovedDuringActions = true;
              }
            }
            this.vrPrevXrSecondaryR = parsed.buttonSecondary;
          }
        }

        // Read hardware 6DoF pose directly from XRFrame (preferring wrist joint for optical hands, gripSpace for controllers)
        let hwPose: VRControllerPoseResult | null = null;
        if (xrFrame && xrRefSpace) {
          const xrHand = (src as any).hand as Map<string, any> | undefined;
          let rawTransform: { position: { x: number; y: number; z: number }; orientation: { x: number; y: number; z: number; w: number } } | null = null;

          if (xrHand && typeof xrHand.get === 'function' && typeof xrFrame.getJointPose === 'function') {
            const wristSpace = xrHand.get('wrist');
            if (wristSpace) {
              const wristPose = xrFrame.getJointPose(wristSpace, xrRefSpace);
              if (wristPose?.transform?.position && wristPose?.transform?.orientation) {
                rawTransform = wristPose.transform;
              }
            }
          }

          if (!rawTransform && typeof xrFrame.getPose === 'function') {
            const preferredSpace = (src as any).gripSpace || src.targetRaySpace;
            if (preferredSpace) {
              const spacePose = xrFrame.getPose(preferredSpace, xrRefSpace);
              if (spacePose?.transform?.position && spacePose?.transform?.orientation) {
                rawTransform = spacePose.transform;
              } else if ((src as any).gripSpace && src.targetRaySpace) {
                const rayPose = xrFrame.getPose(src.targetRaySpace, xrRefSpace);
                if (rayPose?.transform?.position && rayPose?.transform?.orientation) {
                  rawTransform = rayPose.transform;
                }
              }
            }
          }

          if (rawTransform) {
            hwPose = convertXRSpacePoseToCameraLocal(
              [rawTransform.position.x, rawTransform.position.y, rawTransform.position.z],
              [rawTransform.orientation.x, rawTransform.orientation.y, rawTransform.orientation.z, rawTransform.orientation.w],
              headPos,
              headQuat
            );
          }
        }

        // Fallback to Three.js WebXRManager controller group ONLY when actively visible and non-zero
        if (!hwPose) {
          const xrGrip = this.renderer.xr.getControllerGrip?.(idx);
          const xrRay = this.renderer.xr.getController?.(idx);
          const candidate =
            xrGrip && xrGrip.visible !== false && xrGrip.position.lengthSq() > 0.0001
              ? xrGrip
              : xrRay && xrRay.visible !== false && xrRay.position.lengthSq() > 0.0001
              ? xrRay
              : null;
          if (candidate) {
            hwPose = convertXRSpacePoseToCameraLocal(
              [candidate.position.x, candidate.position.y, candidate.position.z],
              [candidate.quaternion.x, candidate.quaternion.y, candidate.quaternion.z, candidate.quaternion.w],
              headPos,
              headQuat
            );
          }
        }

        if (hwPose) {
          if (handedness === 'left') {
            leftPose = hwPose;
            hasLiveLeftPose = true;
            this.vrLastXrLeftPose = { pose: hwPose, capturedAt: time };
          } else if (handedness === 'right') {
            rightPose = hwPose;
            hasLiveRightPose = true;
            this.vrLastXrRightPose = { pose: hwPose, capturedAt: time };
          }
        }
        idx++;
      }
    }

    // If teleport or turn moved the character controller during controller actions, re-sync origin before placing hands/raycasts
    if (isXRPresenting && originMovedDuringActions) {
      this.syncVRCharacterControllerOrigin();
    }

    // Hold recent WebXR pose briefly across transient occlusion frames so hands do not snap/jump
    if (isXRPresenting) {
      if (!hasLiveLeftPose && this.vrLastXrLeftPose && time - this.vrLastXrLeftPose.capturedAt < 0.45) {
        leftPose = this.vrLastXrLeftPose.pose;
      }
      if (!hasLiveRightPose && this.vrLastXrRightPose && time - this.vrLastXrRightPose.capturedAt < 0.45) {
        rightPose = this.vrLastXrRightPose.pose;
      }
    }

    this.vrLeftRig.root.position.set(leftPose.localPos[0], leftPose.localPos[1], leftPose.localPos[2]);
    if (leftPose.localQuat) {
      this.vrLeftRig.root.quaternion.set(
        leftPose.localQuat[0],
        leftPose.localQuat[1],
        leftPose.localQuat[2],
        leftPose.localQuat[3]
      );
    } else {
      this.vrLeftRig.root.rotation.order = 'YXZ';
      this.vrLeftRig.root.rotation.set(leftPose.localRotRad[0], leftPose.localRotRad[1], leftPose.localRotRad[2]);
    }
    this.vrLeftRig.root.updateMatrixWorld(true);

    this.vrRightRig.root.position.set(rightPose.localPos[0], rightPose.localPos[1], rightPose.localPos[2]);
    if (rightPose.localQuat) {
      this.vrRightRig.root.quaternion.set(
        rightPose.localQuat[0],
        rightPose.localQuat[1],
        rightPose.localQuat[2],
        rightPose.localQuat[3]
      );
    } else {
      this.vrRightRig.root.rotation.order = 'YXZ';
      this.vrRightRig.root.rotation.set(rightPose.localRotRad[0], rightPose.localRotRad[1], rightPose.localRotRad[2]);
    }
    this.vrRightRig.root.updateMatrixWorld(true);

    // Right Controller World Raycast & DOORS 3D Tactical Flashlight Beam
    this.vrRightRig.root.getWorldPosition(this.vrScratchOrigin);
    this.vrRightRig.root.getWorldQuaternion(this.vrScratchQuat);
    this.vrScratchDir.set(0, 0, -1).applyQuaternion(this.vrScratchQuat).normalize();

    if (this.currentGameId === 'doors' && this.flashlightSpot) {
      this.flashlightSpot.position.copy(this.vrScratchOrigin);
      this.flashlightTarget.position.copy(this.vrScratchOrigin).addScaledVector(this.vrScratchDir, 24);
      this.flashlightSpot.intensity = this.doorsState.flashlightOn ? 3.8 : 0;
    }

    this.vrRightTool.setTool(
      this.currentGameId,
      this.activeTool,
      this.doorsState.flashlightOn,
      this.portalState.lastColor,
      time
    );

    // Raycast Right Controller laser against active 3D VR Main Menu tiles (every frame) or world platforms (15Hz)
    let rightHitDist = this.vrLastHitDist;
    let rightHitLabel: string | null = this.doorsState.nearInteractable?.label || this.vrLastHitLabel;
    let nextHoveredMenuAction: VRMenuActionId | null = null;
    let rightMenuHit = false;

    if (this.vrState.vrMenuOpen && this.vrMainMenu.root.visible) {
      this.vrRaycaster.near = 0.05;
      this.vrRaycaster.far = 6.5;
      this.vrRaycaster.set(this.vrScratchOrigin, this.vrScratchDir);
      const menuHits = this.vrRaycaster.intersectObjects(this.vrMainMenu.buttonMeshes, false);
      if (menuHits.length > 0) {
        const hit = menuHits[0];
        const actId = hit.object.userData?.vrMenuActionId as VRMenuActionId | undefined;
        if (actId) {
          nextHoveredMenuAction = actId;
          rightMenuHit = true;
          rightHitDist = Math.max(0.2, Math.min(6.5, hit.distance));
          rightHitLabel = (hit.object.userData?.vrMenuLabel as string) || 'VR Меню';
          this.vrLastHitDist = rightHitDist;
        }
      }
    }

    this.vrRaycastTimer -= dt;
    if (!rightMenuHit && this.vrRaycastTimer <= 0) {
      this.vrRaycastTimer = 0.065;
      this.vrRaycaster.near = 0.2;
      this.vrRaycaster.far = 16.0;
      this.vrRaycaster.set(this.vrScratchOrigin, this.vrScratchDir);

      this.vrNearbyPlatformsCache.length = 0;
      const platforms = this.worldData.platforms;
      const pz = this.playerPos.z;
      for (let i = 0; i < platforms.length; i++) {
        const plat = platforms[i];
        if (Math.abs(plat.position.z - pz) < 22) {
          this.vrNearbyPlatformsCache.push(plat);
        }
      }
      const hits = this.vrRaycaster.intersectObjects(this.vrNearbyPlatformsCache, false);
      if (hits.length > 0) {
        rightHitDist = Math.max(0.5, Math.min(16, hits[0].distance));
        this.vrLastHitLabel = `Объект (${rightHitDist.toFixed(1)}м)`;
      } else {
        rightHitDist = 9.0;
        this.vrLastHitLabel = null;
      }
      this.vrLastHitDist = rightHitDist;
      if (!rightHitLabel) {
        rightHitLabel = this.vrLastHitLabel;
      }
    }

    // Update PICO Play-Space Chaperone / Guardian Boundary Ring around player's feet
    const nearWallWarning =
      (this.currentGameId === 'doors' && Math.abs(this.playerPos.x) > 10.5) || rightHitDist < 1.85;
    this.vrPicoGuardian.updateGuardian(
      this.playerPos,
      this.vrState.enabled && this.vrState.picoGuardianVisible,
      this.vrState.picoPassthroughGrid,
      nearWallWarning
    );

    // Left Controller Laser -> Check 3D VR Main Menu tiles first when menu is open, else Floor Teleport Target
    this.vrLeftRig.root.getWorldPosition(this.vrScratchOrigin);
    this.vrLeftRig.root.getWorldQuaternion(this.vrScratchQuat);
    let leftMenuHitDist: number | null = null;
    if (this.vrState.vrMenuOpen && this.vrMainMenu.root.visible) {
      this.vrScratchDir.set(0, 0, -1).applyQuaternion(this.vrScratchQuat).normalize();
      this.vrRaycaster.near = 0.05;
      this.vrRaycaster.far = 6.5;
      this.vrRaycaster.set(this.vrScratchOrigin, this.vrScratchDir);
      const leftMenuHits = this.vrRaycaster.intersectObjects(this.vrMainMenu.buttonMeshes, false);
      if (leftMenuHits.length > 0) {
        const hit = leftMenuHits[0];
        const actId = hit.object.userData?.vrMenuActionId as VRMenuActionId | undefined;
        if (actId) {
          leftMenuHitDist = Math.max(0.2, Math.min(6.5, hit.distance));
          if (!nextHoveredMenuAction) {
            nextHoveredMenuAction = actId;
            rightHitLabel = (hit.object.userData?.vrMenuLabel as string) || rightHitLabel;
          }
        }
      }
    }

    if (nextHoveredMenuAction !== this.vrMenuHoveredAction) {
      if (nextHoveredMenuAction) {
        this.triggerVRHapticPulse(0.26, 18);
      }
      this.vrMenuHoveredAction = nextHoveredMenuAction;
    }

    this.vrScratchDir.set(0, -0.22, -1).applyQuaternion(this.vrScratchQuat).normalize();

    const floorTarget =
      this.vrState.teleportEnabled && !this.vrState.vrMenuOpen
        ? computeFloorTeleportTarget(
            [this.vrScratchOrigin.x, this.vrScratchOrigin.y, this.vrScratchOrigin.z],
            [this.vrScratchDir.x, this.vrScratchDir.y, this.vrScratchDir.z],
            this.playerPos.y,
            15
          )
        : null;

    this.vrState.teleportTarget = floorTarget;
    if (floorTarget) {
      this.vrTeleportReticle.root.position.set(floorTarget[0], floorTarget[1], floorTarget[2]);
      this.vrTeleportReticle.updateReticle(time, true);
    } else {
      this.vrTeleportReticle.updateReticle(time, false);
    }

    const leftLaserDist =
      leftMenuHitDist !== null
        ? leftMenuHitDist
        : floorTarget
        ? Math.hypot(
            floorTarget[0] - this.vrScratchOrigin.x,
            floorTarget[1] - this.vrScratchOrigin.y,
            floorTarget[2] - this.vrScratchOrigin.z
          )
        : 6.5;

    // Sample WebXR 25-joint optical hand tracking & controller motion gestures
    let detectedHandGesture: VRHandGestureId | null = null;
    if (xrSession && xrSession.inputSources) {
      const xrFrame = this.renderer.xr.getFrame?.() as any;
      const xrRefSpace = this.renderer.xr.getReferenceSpace?.() as any;
      if (xrFrame && xrRefSpace && typeof xrFrame.getJointPose === 'function') {
        for (const src of xrSession.inputSources) {
          const xrHand = (src as any).hand as Map<string, any> | undefined;
          if (!xrHand || typeof xrHand.get !== 'function') continue;
          if (src.handedness !== 'right' && src.handedness !== 'left') continue;

          const getJ = (jointName: string): [number, number, number] | null => {
            const space = xrHand.get(jointName);
            if (!space) return null;
            const jPose = xrFrame.getJointPose(space, xrRefSpace);
            if (!jPose?.transform?.position) return null;
            const p = jPose.transform.position;
            return [p.x, p.y, p.z];
          };

          const wrist = getJ('wrist');
          const thumbTip = getJ('thumb-tip');
          const thumbBase = getJ('thumb-metacarpal') || getJ('thumb-phalanx-proximal');
          const indexTip = getJ('index-finger-tip');
          const indexKnuckle = getJ('index-finger-phalanx-proximal');
          const middleTip = getJ('middle-finger-tip');
          const middleKnuckle = getJ('middle-finger-phalanx-proximal');
          const ringTip = getJ('ring-finger-tip');
          const ringKnuckle = getJ('ring-finger-phalanx-proximal');
          const pinkyTip = getJ('pinky-finger-tip');
          const pinkyKnuckle = getJ('pinky-finger-phalanx-proximal');

          if (
            wrist &&
            thumbTip &&
            thumbBase &&
            indexTip &&
            indexKnuckle &&
            middleTip &&
            middleKnuckle &&
            ringTip &&
            ringKnuckle &&
            pinkyTip &&
            pinkyKnuckle
          ) {
            let lateralSpeed = 0;
            if (src.handedness === 'right') {
              if (this.vrPrevXrRightHandX !== null) {
                lateralSpeed = Math.abs(wrist[0] - this.vrPrevXrRightHandX) / Math.max(0.008, dt);
              }
              this.vrPrevXrRightHandX = wrist[0];
            }
            const headHeight = this.vrHeadLocalPos[1] || 1.6;
            const candidate = classifyHandJointGesture(
              {
                wrist,
                thumbTip,
                thumbBase,
                indexTip,
                indexKnuckle,
                middleTip,
                middleKnuckle,
                ringTip,
                ringKnuckle,
                pinkyTip,
                pinkyKnuckle,
              },
              {
                lateralSpeed,
                handHeightRelativeToHead: wrist[1] - headHeight,
              }
            );
            if (candidate && (src.handedness === 'right' || candidate === 'cheer')) {
              detectedHandGesture = candidate;
            }
          }
        }
      }
    }

    // Also measure horizontal wrist wave oscillation from simulated pointer/controller motion
    const pointerDeltaX = Math.abs(this.vrPointerNormX - this.vrPrevRightNormX) / Math.max(0.008, dt);
    this.vrPrevRightNormX = this.vrPointerNormX;
    if (pointerDeltaX > 3.6 && rightTrigger < 0.25) {
      this.vrWaveOscillationEnergy = Math.min(1.6, this.vrWaveOscillationEnergy + dt * 2.8);
    } else {
      this.vrWaveOscillationEnergy = Math.max(0, this.vrWaveOscillationEnergy - dt * 1.6);
    }

    const gestureCandidate =
      detectedHandGesture ??
      detectControllerGestureHint({
        rightGrip,
        rightTrigger,
        rightButtonPrimary: rightPrimary,
        rightButtonSecondary: rightSecondary,
        waveOscillationEnergy: this.vrWaveOscillationEnergy,
      });

    const firedGesture = this.vrGestureRecognizer.update(dt, gestureCandidate);
    if (firedGesture) {
      this.vrWaveOscillationEnergy = 0;
      this.triggerVRGesture(firedGesture);
    }

    const isDoorsRushDanger = Boolean(
      this.currentGameId === 'doors' &&
        !this.doorsState.isHidingInCloset &&
        ((this.doorsState.rushWarningSeconds || 0) > 0 || this.doorsState.rushActive)
    );

    this.vrLeftRig.setPoseState({
      trackingMode: this.vrState.trackingMode,
      controllerProfile: this.vrState.controllerProfile,
      trigger: leftTrigger,
      grip: leftGrip,
      thumbstick: leftStickVec,
      buttonPrimary: leftPrimary,
      buttonSecondary: leftSecondary,
      laserVisible: this.vrState.laserPointers,
      laserLength: leftLaserDist,
      hasHit: Boolean(floorTarget),
      activeGesture: this.vrState.activeGesture,
      animTime: time,
      rushAlert: isDoorsRushDanger,
    });

    this.vrRightRig.setPoseState({
      trackingMode: this.vrState.trackingMode,
      controllerProfile: this.vrState.controllerProfile,
      trigger: rightTrigger,
      grip: rightGrip,
      thumbstick: rightStickVec,
      buttonPrimary: rightPrimary,
      buttonSecondary: rightSecondary,
      laserVisible: this.vrState.laserPointers,
      laserLength: rightHitDist,
      hasHit: Boolean(this.vrLastHitLabel || rightHitLabel),
      activeGesture: this.vrState.activeGesture,
      animTime: time,
      rushAlert: isDoorsRushDanger,
    });

    // Update 3D Holographic Wrist Watch HUD on Left Hand
    this.vrWristWatch.updateWatch({
      hp: this.stats.hp,
      coins: this.stats.coins,
      doorNum:
        this.currentGameId === 'doors'
          ? this.doorsState.currentDoorNumber
          : this.stats.currentCheckpoint,
      roomTitle:
        this.currentGameId === 'doors'
          ? this.doorsState.currentRoomTitle || 'ОТЕЛЬ DOORS'
          : this.currentGameId.toUpperCase(),
      gameId: this.currentGameId,
      trackingMode: this.vrState.trackingMode,
      controllerProfile: this.vrState.controllerProfile,
      rushWarningSeconds: this.doorsState.rushWarningSeconds,
      rushActive: this.doorsState.rushActive,
      isHidingInCloset: this.doorsState.isHidingInCloset,
    });

    // Update Head-Locked 3D VR Alert Banner (Rush / Closet Safe / Screech / Eyes / Figure)
    const rushWarn = this.doorsState.rushWarningSeconds || 0;
    if (this.currentGameId === 'doors' && (rushWarn > 0 || this.doorsState.rushActive)) {
      if (this.doorsState.isHidingInCloset) {
        this.vrAlertHUD.updateAlert({
          visible: true,
          tone: 'safe',
          headline: '🛡️ ВЫ В ШКАФУ — БЕЗОПАСНО',
          subline: this.doorsState.rushActive
            ? `Раш пролетает мимо (${this.doorsState.rushDistanceMeters || 0}м)...`
            : `Раш прилетит через ${rushWarn.toFixed(1)}с — ждите внутри`,
          pulsePhase: time,
        });
      } else {
        this.vrAlertHUD.updateAlert({
          visible: true,
          tone: 'danger',
          headline: this.doorsState.rushActive
            ? `💀 РАШ ЛЕТИТ (${this.doorsState.rushDistanceMeters || 0}м)!`
            : `⚡ РАШ ЧЕРЕЗ ${rushWarn.toFixed(1)}с!`,
          subline: 'ПРЯЧЬТЕСЬ В ШКАФ! Курок R или [E]',
          pulsePhase: time,
        });
      }
    } else if (this.currentGameId === 'doors' && this.doorsState.screechActive) {
      this.vrAlertHUD.updateAlert({
        visible: true,
        tone: 'warn',
        headline: '🌑 СКРИЧ РЯДОМ!',
        subline: 'Нажмите Курок R или [F] для вспышки',
        pulsePhase: time,
      });
    } else if (this.currentGameId === 'doors' && this.doorsState.eyesActive) {
      this.vrAlertHUD.updateAlert({
        visible: true,
        tone: 'warn',
        headline: '👁️ ГЛАЗА НА СТЕНЕ!',
        subline: 'Опустите взгляд в пол!',
        pulsePhase: time,
      });
    } else if (this.currentGameId === 'doors' && this.doorsState.figureAlerted) {
      this.vrAlertHUD.updateAlert({
        visible: true,
        tone: 'danger',
        headline: `👹 ФИГУРА СЛЫШИТ (${this.doorsState.figureDistance}м)!`,
        subline: 'Нажмите [A] / [C] для тихого шага!',
        pulsePhase: time,
      });
    } else {
      this.vrAlertHUD.updateAlert({
        visible: false,
        tone: 'warn',
        headline: '',
        subline: '',
      });
    }

    // Update 3D Controller Legend Card near Left Hand (temporarily step aside while 3D VR Main Menu is open)
    this.vrControlsCard.updateCard({
      visible: this.vrState.enabled && this.vrState.controlsHintVisible && !this.vrState.vrMenuOpen,
      gameId: this.currentGameId,
      profile: this.vrState.controllerProfile,
    });

    // Update 3D Spatial Floating VR Main Menu in World Space
    this.vrMainMenu.updateMenu({
      visible: this.vrState.enabled && this.vrState.vrMenuOpen,
      currentGameId: this.currentGameId,
      hp: this.stats.hp,
      coins: this.stats.coins,
      heightOffset: this.vrState.heightOffset,
      controlsHintVisible: this.vrState.controlsHintVisible,
      trackingMode: this.vrState.trackingMode,
      portalGunActive: this.activeTool === 'portal_gun',
      hoveredActionId: this.vrMenuHoveredAction,
    });

    // Update telemetry state in VRState (throttled to ~12Hz for React UI)
    this.vrState.leftController = {
      position: leftPose.localPos,
      rotation: leftPose.localRotDeg,
      trigger: leftTrigger,
      grip: leftGrip,
      thumbstick: leftStickVec,
      buttonPrimary: leftPrimary,
      buttonSecondary: leftSecondary,
      thumbstickPressed: leftThumbPress,
      menuPressed: leftMenu,
      isPinching: leftTrigger > 0.35 || leftGrip > 0.4,
      isPointing: true,
      rayHitDistance: Number(leftLaserDist.toFixed(2)),
      rayHitLabel: floorTarget
        ? `Телепорт [${floorTarget[0].toFixed(1)}, ${floorTarget[2].toFixed(1)}м]`
        : 'Пол не в фокусе',
    };

    this.vrState.rightController = {
      position: rightPose.localPos,
      rotation: rightPose.localRotDeg,
      trigger: rightTrigger,
      grip: rightGrip,
      thumbstick: rightStickVec,
      buttonPrimary: rightPrimary,
      buttonSecondary: rightSecondary,
      thumbstickPressed: rightThumbPress,
      menuPressed: false,
      isPinching: rightTrigger > 0.35,
      isPointing: true,
      rayHitDistance: Number(rightHitDist.toFixed(2)),
      rayHitLabel: rightHitLabel,
    };

    this.vrTelemetrySyncTimer -= dt;
    if (this.vrTelemetrySyncTimer <= 0) {
      this.vrTelemetrySyncTimer = 0.085;
      this.emitVRState();
    }
  }

  private spawnParticleBurst(x: number, y: number, z: number, hexColor: number, count: number) {
    const col = new THREE.Color(hexColor);
    let spawned = 0;
    for (let i = 0; i < this.particleCount && spawned < count; i++) {
      const p = this.particleData[i];
      if (p.life <= 0) {
        p.pos.set(x, y, z);
        p.vel.set(
          (Math.random() - 0.5) * 8.0,
          Math.random() * 6.0 + 2.0,
          (Math.random() - 0.5) * 8.0
        );
        p.life = Math.random() * 0.5 + 0.4;
        p.maxLife = p.life;
        p.color.copy(col);
        this.particlesDirtyFlag = true;
        spawned++;
      }
    }
  }

  private updateParticles(dt: number) {
    let anyAlive = false;
    for (let i = 0; i < this.particleCount; i++) {
      if (this.particleData[i].life > 0) {
        anyAlive = true;
        break;
      }
    }
    if (!anyAlive && !this.particlesDirtyFlag) {
      return;
    }

    const dummyMat = this.scratchParticleMat;
    const dummyVec = this.scratchParticleVec;
    const dummyQuat = this.scratchParticleQuat;
    let stillAliveAfterTick = false;

    for (let i = 0; i < this.particleCount; i++) {
      const p = this.particleData[i];
      if (p.life > 0) {
        p.life -= dt;
        p.vel.y -= 18.0 * dt; // gravity
        p.pos.addScaledVector(p.vel, dt);

        const scale = Math.max(0, p.life / p.maxLife);
        dummyMat.compose(p.pos, dummyQuat, dummyVec.set(scale, scale, scale));
        this.particlePool.setMatrixAt(i, dummyMat);
        this.particlePool.setColorAt(i, p.color);
        if (p.life > 0) {
          stillAliveAfterTick = true;
        }
      } else {
        dummyMat.compose(dummyVec.set(0, -999, 0), dummyQuat, dummyVec.set(0, 0, 0));
        this.particlePool.setMatrixAt(i, dummyMat);
      }
    }
    this.particlePool.instanceMatrix.needsUpdate = true;
    if (this.particlePool.instanceColor) {
      this.particlePool.instanceColor.needsUpdate = true;
    }
    this.particlesDirtyFlag = stillAliveAfterTick;
  }

  // =========================================================================
  // BLOX STUDIO 3D EDITOR & PLAYTEST RUNTIME
  // =========================================================================

  private ensureStudioVisualHelpers() {
    if (!this.studioPreviewMesh) {
      const geo = new THREE.BoxGeometry(1, 1, 1);
      const mat = new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.45,
        wireframe: false,
        depthWrite: false,
      });
      this.studioPreviewMesh = new THREE.Mesh(geo, mat);
      this.studioPreviewMesh.visible = false;
      this.scene.add(this.studioPreviewMesh);
    }
    if (!this.studioSelectionBox) {
      const dummy = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
      this.studioSelectionBox = new THREE.BoxHelper(dummy, 0xfacc15);
      this.studioSelectionBox.visible = false;
      this.scene.add(this.studioSelectionBox);
    }
    this.updateStudioSelectionVisual();
  }

  private updateStudioSelectionVisual() {
    if (!this.studioSelectionBox) return;
    if (this.currentGameId !== 'studio' || this.studioMode !== 'edit' || !this.studioSelectedId) {
      this.studioSelectionBox.visible = false;
      return;
    }
    const mesh = this.worldData.studioObjectMeshes?.get(this.studioSelectedId);
    if (!mesh) {
      this.studioSelectionBox.visible = false;
      return;
    }
    this.studioSelectionBox.setFromObject(mesh);
    this.studioSelectionBox.visible = true;
  }

  private applyStudioSkyPreset(skyPreset: StudioSkyPreset) {
    if (skyPreset === 'sunset') {
      this.scene.background = new THREE.Color(0xfb923c);
      this.scene.fog = new THREE.FogExp2(0xfb923c, 0.0028);
      this.sunLight.color.setHex(0xfde68a);
      this.sunLight.intensity = 1.65;
      this.hemiLight.color.setHex(0xfdba74);
      this.hemiLight.groundColor.setHex(0x311042);
      this.hemiLight.intensity = 0.95;
    } else if (skyPreset === 'night') {
      this.scene.background = new THREE.Color(0x0f172a);
      this.scene.fog = new THREE.FogExp2(0x0f172a, 0.0032);
      this.sunLight.color.setHex(0x93c5fd);
      this.sunLight.intensity = 0.85;
      this.hemiLight.color.setHex(0x475569);
      this.hemiLight.groundColor.setHex(0x020617);
      this.hemiLight.intensity = 0.7;
    } else if (skyPreset === 'cyber') {
      this.scene.background = new THREE.Color(0x1e1b4b);
      this.scene.fog = new THREE.FogExp2(0x2e1065, 0.003);
      this.sunLight.color.setHex(0x38bdf8);
      this.sunLight.intensity = 1.25;
      this.hemiLight.color.setHex(0xc084fc);
      this.hemiLight.groundColor.setHex(0x090d16);
      this.hemiLight.intensity = 0.9;
    } else {
      this.scene.background = new THREE.Color(0x38bdf8);
      this.scene.fog = new THREE.FogExp2(0x38bdf8, 0.0026);
      this.sunLight.color.setHex(0xfff7ed);
      this.sunLight.intensity = 1.8;
      this.hemiLight.color.setHex(0xbae6fd);
      this.hemiLight.groundColor.setHex(0x475569);
      this.hemiLight.intensity = 1.0;
    }
  }

  public getStudioState(): StudioRuntimeState {
    const selectedObject = this.studioSelectedId
      ? this.studioProject.objects.find((o) => o.id === this.studioSelectedId) || null
      : null;
    return {
      mode: this.studioMode,
      tool: this.studioTool,
      activeKind: this.studioActiveKind,
      activeColor: this.studioActiveColor,
      activeMaterial: this.studioActiveMaterial,
      activeSize: [...this.studioActiveSize] as [number, number, number],
      activeRotationY: this.studioActiveRotationY,
      gridSize: this.studioProject.gridSize,
      skyPreset: this.studioProject.skyPreset,
      selectedId: selectedObject ? selectedObject.id : null,
      selectedObject: selectedObject
        ? {
            ...selectedObject,
            position: [...selectedObject.position] as [number, number, number],
            size: [...selectedObject.size] as [number, number, number],
          }
        : null,
      objectCount: this.studioProject.objects.length,
      maxObjects: STUDIO_MAX_OBJECTS,
      canUndo: this.studioUndoStack.length > 0,
      canRedo: this.studioRedoStack.length > 0,
      projectName: this.studioProject.name,
    };
  }

  private emitStudioState() {
    this.callbacks.onStudioStateChange?.(this.getStudioState());
  }

  private pushStudioHistory() {
    this.studioUndoStack.push(cloneStudioObjects(this.studioProject.objects));
    if (this.studioUndoStack.length > 40) {
      this.studioUndoStack.shift();
    }
    this.studioRedoStack = [];
  }

  private commitStudioProjectChanges() {
    this.studioProject.updatedAt = Date.now();
    saveStudioProject(this.studioProject);
    rebuildStudioWorldObjects(this.worldData, this.studioProject);
    this.stats.totalCheckpoints = this.worldData.checkpoints.length;
    this.updateStudioSelectionVisual();
    this.emitStudioState();
  }

  private updateStudioEditSimulation(dt: number) {
    const flySpeed = 30;
    const forward = new THREE.Vector3(-Math.sin(this.cameraYaw), 0, -Math.cos(this.cameraYaw));
    const right = new THREE.Vector3(Math.cos(this.cameraYaw), 0, -Math.sin(this.cameraYaw));

    const kbZ =
      (this.keysHeld.has('KeyW') || this.keysHeld.has('ArrowUp') ? 1 : 0) -
      (this.keysHeld.has('KeyS') || this.keysHeld.has('ArrowDown') ? 1 : 0);
    const kbX =
      (this.keysHeld.has('KeyD') || this.keysHeld.has('ArrowRight') ? 1 : 0) -
      (this.keysHeld.has('KeyA') || this.keysHeld.has('ArrowLeft') ? 1 : 0);
    const kbY =
      (this.keysHeld.has('KeyE') || this.keysHeld.has('Space') ? 1 : 0) -
      (this.keysHeld.has('KeyQ') || this.keysHeld.has('KeyC') || this.keysHeld.has('ShiftLeft') ? 1 : 0);

    const rawMoveX = kbX !== 0 ? kbX : this.joystickX;
    const rawMoveZ = kbZ !== 0 ? kbZ : -this.joystickY;

    if (rawMoveX !== 0 || rawMoveZ !== 0) {
      const moveDir = new THREE.Vector3()
        .addScaledVector(forward, rawMoveZ)
        .addScaledVector(right, rawMoveX)
        .normalize();
      this.studioCamTarget.x = Math.max(-120, Math.min(120, this.studioCamTarget.x + moveDir.x * flySpeed * dt));
      this.studioCamTarget.z = Math.max(-120, Math.min(120, this.studioCamTarget.z + moveDir.z * flySpeed * dt));
    }
    if (kbY !== 0) {
      this.studioCamTarget.y = Math.max(1, Math.min(100, this.studioCamTarget.y + kbY * flySpeed * dt));
    }

    for (const rot of this.worldData.dynamicRotators) {
      rot.group.rotation[rot.axis] += dt * rot.speed;
    }

    if (this.studioSelectionBox && this.studioSelectionBox.visible) {
      this.studioSelectionBox.update();
    }

    this.updateCamera(dt);
    this.updateParticles(dt);
    this.justPressedKeys.clear();
  }

  private raycastStudioScene(clientX: number, clientY: number) {
    const dom = this.renderer?.domElement;
    if (!dom) return null;
    const rect = dom.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;

    const ndcX = ((clientX - rect.left) / rect.width) * 2 - 1;
    const ndcY = -((clientY - rect.top) / rect.height) * 2 + 1;
    this.studioRaycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), this.camera);

    const targets: THREE.Object3D[] = [];
    if (this.worldData.studioBaseplate) targets.push(this.worldData.studioBaseplate);
    if (this.worldData.studioGroup) targets.push(...this.worldData.studioGroup.children);

    const hits = this.studioRaycaster.intersectObjects(targets, true);
    for (const hit of hits) {
      if (hit.object.userData?.isStudioBaseplate || hit.object.userData?.studioObjectId) {
        return hit;
      }
    }
    return null;
  }

  private findStudioObjectIdFromHit(obj: THREE.Object3D | null): string | null {
    let cur: THREE.Object3D | null = obj;
    while (cur) {
      if (typeof cur.userData?.studioObjectId === 'string') {
        return cur.userData.studioObjectId;
      }
      cur = cur.parent;
    }
    return null;
  }

  private updateStudioHoverPreview(clientX: number, clientY: number) {
    if (!this.studioPreviewMesh) return;
    if (this.studioTool !== 'place' || this.studioMode !== 'edit') {
      this.studioPreviewMesh.visible = false;
      return;
    }
    const hit = this.raycastStudioScene(clientX, clientY);
    if (!hit) {
      this.studioPreviewMesh.visible = false;
      return;
    }
    const worldNormal = new THREE.Vector3(0, 1, 0);
    if (hit.face) {
      worldNormal.copy(hit.face.normal).transformDirection(hit.object.matrixWorld);
    }
    const snapPos = computeStudioSnapPosition(
      hit.point,
      worldNormal,
      this.studioActiveSize,
      this.studioProject.gridSize,
      this.studioActiveRotationY
    );
    const [effW, effH, effD] = getRotatedStudioFootprint(this.studioActiveSize, this.studioActiveRotationY);
    this.studioPreviewMesh.scale.set(effW, effH, effD);
    this.studioPreviewMesh.position.set(snapPos[0], snapPos[1] + effH / 2, snapPos[2]);
    const mat = this.studioPreviewMesh.material as THREE.MeshBasicMaterial;
    mat.color.set(this.studioActiveColor || '#38bdf8');
    this.studioPreviewMesh.visible = true;
  }

  private handleStudioViewportClick(clientX: number, clientY: number) {
    const hit = this.raycastStudioScene(clientX, clientY);
    if (!hit) {
      if (this.studioTool === 'select') {
        this.studioSelectedId = null;
        this.updateStudioSelectionVisual();
        this.emitStudioState();
      }
      return;
    }

    const hitObjectId = this.findStudioObjectIdFromHit(hit.object);

    if (this.studioTool === 'select') {
      this.studioSelectedId = hitObjectId;
      this.updateStudioSelectionVisual();
      this.emitStudioState();
      return;
    }

    if (this.studioTool === 'erase') {
      if (hitObjectId) {
        this.deleteStudioObjectById(hitObjectId);
      }
      return;
    }

    if (this.studioTool === 'place') {
      if (this.studioProject.objects.length >= STUDIO_MAX_OBJECTS) {
        this.callbacks.onChatMessage(`Достигнут лимит объектов (${STUDIO_MAX_OBJECTS})! Удалите лишние блоки.`, 'Студия');
        return;
      }
      const worldNormal = new THREE.Vector3(0, 1, 0);
      if (hit.face) {
        worldNormal.copy(hit.face.normal).transformDirection(hit.object.matrixWorld);
      }
      const pos = computeStudioSnapPosition(
        hit.point,
        worldNormal,
        this.studioActiveSize,
        this.studioProject.gridSize,
        this.studioActiveRotationY
      );
      const newObj: StudioObject = {
        id: createStudioObjectId(),
        kind: this.studioActiveKind,
        position: pos,
        size: [...this.studioActiveSize] as [number, number, number],
        rotationY: normalizeStudioRotationY(this.studioActiveRotationY),
        color: this.studioActiveColor,
        material: this.studioActiveMaterial,
      };
      this.pushStudioHistory();
      this.studioProject.objects.push(newObj);
      this.studioSelectedId = newObj.id;
      sound.playCoin();
      this.spawnParticleBurst(pos[0], pos[1] + newObj.size[1] / 2, pos[2], new THREE.Color(newObj.color).getHex(), 8);
      this.commitStudioProjectChanges();
    }
  }

  public setStudioPlayMode(play: boolean) {
    if (this.currentGameId !== 'studio') return;
    if (play) {
      this.studioMode = 'play';
      if (this.studioPreviewMesh) this.studioPreviewMesh.visible = false;
      if (this.studioSelectionBox) this.studioSelectionBox.visible = false;
      if (this.worldData.studioGrid) this.worldData.studioGrid.visible = false;
      this.avatar.root.visible = true;
      rebuildStudioWorldObjects(this.worldData, this.studioProject);
      this.currentCheckpointId = 0;
      this.stats.currentCheckpoint = 0;
      this.stats.totalCheckpoints = this.worldData.checkpoints.length;
      this.stats.coins = 0;
      this.stats.gems = 0;
      this.stats.deaths = 0;
      this.stats.startTime = Date.now();
      this.stats.completionTime = 0;
      this.cameraDistance = 10;
      this.cameraYaw = 0;
      this.cameraPitch = 0.35;
      this.respawnPlayer(true);
      this.emitStudioState();
      this.callbacks.onChatMessage('▶ Тестирование карты запущено! Дойдите до Золотого Кубка!', 'Студия');
    } else {
      this.studioMode = 'edit';
      this.avatar.root.visible = false;
      if (typeof document !== 'undefined' && document.pointerLockElement === this.renderer?.domElement) {
        try {
          document.exitPointerLock?.();
        } catch {}
      }
      if (this.worldData.studioGrid) this.worldData.studioGrid.visible = true;
      rebuildStudioWorldObjects(this.worldData, this.studioProject);
      this.cameraDistance = 34;
      this.cameraYaw = 0.45;
      this.cameraPitch = 0.55;
      this.updateStudioSelectionVisual();
      this.emitStudioState();
      this.callbacks.onChatMessage('🛠️ Режим редактирования карты.', 'Студия');
    }
  }

  public setStudioTool(tool: StudioToolMode) {
    this.studioTool = tool;
    if (tool !== 'place' && this.studioPreviewMesh) {
      this.studioPreviewMesh.visible = false;
    }
    this.emitStudioState();
  }

  public setStudioPartPreset(
    kind: StudioObjectKind,
    defaultSize: [number, number, number],
    defaultColor: string,
    defaultMaterial: StudioMaterialKind
  ) {
    this.studioTool = 'place';
    this.studioActiveKind = kind;
    this.studioActiveSize = [...defaultSize] as [number, number, number];
    this.studioActiveColor = defaultColor;
    this.studioActiveMaterial = defaultMaterial;
    this.studioSelectedId = null;
    this.updateStudioSelectionVisual();
    this.emitStudioState();
  }

  public setStudioColor(color: string) {
    this.studioActiveColor = color;
    if (this.studioSelectedId) {
      this.updateSelectedStudioObject({ color });
    } else {
      this.emitStudioState();
    }
  }

  public setStudioMaterial(material: StudioMaterialKind) {
    this.studioActiveMaterial = material;
    if (this.studioSelectedId) {
      this.updateSelectedStudioObject({ material });
    } else {
      this.emitStudioState();
    }
  }

  public setStudioSize(size: [number, number, number]) {
    const clean: [number, number, number] = [
      Math.max(1, Math.min(40, Number(size[0]) || 2)),
      Math.max(0.5, Math.min(40, Number(size[1]) || 2)),
      Math.max(1, Math.min(40, Number(size[2]) || 2)),
    ];
    this.studioActiveSize = clean;
    if (this.studioSelectedId) {
      this.updateSelectedStudioObject({ size: clean });
    } else {
      this.emitStudioState();
    }
  }

  public rotateStudioSelectionOrBrush() {
    if (this.studioSelectedId) {
      const target = this.studioProject.objects.find((o) => o.id === this.studioSelectedId);
      if (target) {
        this.updateSelectedStudioObject({ rotationY: normalizeStudioRotationY(target.rotationY + 90) });
        return;
      }
    }
    this.studioActiveRotationY = normalizeStudioRotationY(this.studioActiveRotationY + 90);
    this.emitStudioState();
  }

  public setStudioGridSize(gridSize: 1 | 2 | 4) {
    this.studioProject.gridSize = gridSize;
    saveStudioProject(this.studioProject);
    this.emitStudioState();
  }

  public setStudioSkyPreset(skyPreset: StudioSkyPreset) {
    this.studioProject.skyPreset = skyPreset;
    this.applyStudioSkyPreset(skyPreset);
    saveStudioProject(this.studioProject);
    this.emitStudioState();
  }

  public renameStudioProject(name: string) {
    const clean = String(name || '').trim().slice(0, 40) || 'Мой Первый Паркур';
    this.studioProject.name = clean;
    saveStudioProject(this.studioProject);
    this.emitStudioState();
  }

  public updateSelectedStudioObject(patch: Partial<StudioObject>) {
    if (!this.studioSelectedId) return;
    const idx = this.studioProject.objects.findIndex((o) => o.id === this.studioSelectedId);
    if (idx === -1) return;
    this.pushStudioHistory();
    this.studioProject.objects[idx] = {
      ...this.studioProject.objects[idx],
      ...patch,
    };
    this.commitStudioProjectChanges();
  }

  public nudgeSelectedStudioObject(dx: number, dy: number, dz: number) {
    if (!this.studioSelectedId) return;
    const target = this.studioProject.objects.find((o) => o.id === this.studioSelectedId);
    if (!target) return;
    const nx = Math.max(-116, Math.min(116, Number((target.position[0] + dx).toFixed(2))));
    const ny = Math.max(0, Math.min(120, Number((target.position[1] + dy).toFixed(2))));
    const nz = Math.max(-116, Math.min(116, Number((target.position[2] + dz).toFixed(2))));
    this.updateSelectedStudioObject({ position: [nx, ny, nz] });
  }

  public duplicateSelectedStudioObject() {
    if (!this.studioSelectedId) return;
    if (this.studioProject.objects.length >= STUDIO_MAX_OBJECTS) {
      this.callbacks.onChatMessage(`Достигнут лимит объектов (${STUDIO_MAX_OBJECTS})!`, 'Студия');
      return;
    }
    const target = this.studioProject.objects.find((o) => o.id === this.studioSelectedId);
    if (!target) return;
    this.pushStudioHistory();
    const copy: StudioObject = {
      ...target,
      id: createStudioObjectId(),
      position: [
        Math.min(116, target.position[0] + this.studioProject.gridSize),
        target.position[1],
        target.position[2],
      ],
      size: [...target.size] as [number, number, number],
    };
    this.studioProject.objects.push(copy);
    this.studioSelectedId = copy.id;
    this.commitStudioProjectChanges();
  }

  public deleteStudioObjectById(id: string) {
    const idx = this.studioProject.objects.findIndex((o) => o.id === id);
    if (idx === -1) return;
    this.pushStudioHistory();
    this.studioProject.objects.splice(idx, 1);
    if (this.studioSelectedId === id) {
      this.studioSelectedId = null;
    }
    sound.playOof();
    this.commitStudioProjectChanges();
  }

  public deleteSelectedStudioObject() {
    if (!this.studioSelectedId) return;
    this.deleteStudioObjectById(this.studioSelectedId);
  }

  public undoStudio() {
    const prev = this.studioUndoStack.pop();
    if (!prev) return;
    this.studioRedoStack.push(cloneStudioObjects(this.studioProject.objects));
    this.studioProject.objects = prev;
    this.studioSelectedId = null;
    this.commitStudioProjectChanges();
  }

  public redoStudio() {
    const next = this.studioRedoStack.pop();
    if (!next) return;
    this.studioUndoStack.push(cloneStudioObjects(this.studioProject.objects));
    this.studioProject.objects = next;
    this.studioSelectedId = null;
    this.commitStudioProjectChanges();
  }

  public loadStudioTemplate(templateId: StudioTemplateId) {
    this.pushStudioHistory();
    const tpl = createTemplateProject(templateId);
    this.studioProject = tpl;
    this.studioSelectedId = null;
    this.studioCamTarget.set(0, 6, 16);
    this.applyStudioSkyPreset(tpl.skyPreset);
    this.commitStudioProjectChanges();
    this.callbacks.onChatMessage(`Загружен шаблон «${tpl.name}»!`, 'Студия');
  }

  public exportStudioJson(): string {
    return exportStudioProjectJson(this.studioProject);
  }

  public importStudioProject(jsonText: string): boolean {
    const parsed = importStudioProjectJson(jsonText);
    if (!parsed) return false;
    this.pushStudioHistory();
    this.studioProject = parsed;
    this.studioSelectedId = null;
    this.applyStudioSkyPreset(parsed.skyPreset);
    this.commitStudioProjectChanges();
    this.callbacks.onChatMessage(`Карта «${parsed.name}» импортирована (${parsed.objects.length} объектов)!`, 'Студия');
    return true;
  }

  public dispose() {
    this.isDestroyed = true;
    this.renderer?.setAnimationLoop?.(null);
    if (this.frameId) {
      cancelAnimationFrame(this.frameId);
      clearTimeout(this.frameId);
    }
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    window.removeEventListener('blur', this.handleWindowBlur);
    window.removeEventListener('mousemove', this.handleMouseMove);
    window.removeEventListener('mouseup', this.handleMouseUp);
    window.removeEventListener('resize', this.handleResize);
    const dom = this.renderer?.domElement;
    if (dom) {
      dom.removeEventListener('mousedown', this.handleMouseDown);
      dom.removeEventListener('wheel', this.handleWheel);
      dom.removeEventListener('touchstart', this.handleTouchStart);
      dom.removeEventListener('touchmove', this.handleTouchMove);
      dom.removeEventListener('touchend', this.handleTouchEnd);
      dom.removeEventListener('touchcancel', this.handleTouchEnd);
      dom.removeEventListener('contextmenu', this.handleContextMenu);
    }
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }

    if (this.studioPreviewMesh) {
      this.scene.remove(this.studioPreviewMesh);
      this.studioPreviewMesh.geometry.dispose();
      (this.studioPreviewMesh.material as THREE.Material).dispose();
      this.studioPreviewMesh = null;
    }
    if (this.studioSelectionBox) {
      this.scene.remove(this.studioSelectionBox);
      this.studioSelectionBox.dispose();
      this.studioSelectionBox = null;
    }

    this.clearRemotePlayers();
    this.setLocalCoopMode(false);
    this.avatar.dispose();
    this.renderer.dispose();
    if (dom && dom.parentNode) {
      dom.parentNode.removeChild(dom);
    }
  }
}
