import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { CharacterSkin, Checkpoint, CollectibleItem, GameId, ObstacleHazard, PlacedBlock, PlayerStats, RemotePlayerInfo, ToolType, Achievement } from './types';
import { RobloxAvatar } from './avatar';
import { buildGameWorld, createBloxWorld, WorldBuildResult } from './world';
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

export interface GameEngineCallbacks {
  onStatsUpdate: (stats: PlayerStats) => void;
  onCheckpointReached: (checkpoint: Checkpoint) => void;
  onChatMessage: (message: string, author?: string) => void;
  onVictory: (finalStats: PlayerStats) => void;
  onToolChanged: (tool: ToolType) => void;
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
}

export class GameEngine {
  private mountEl: HTMLElement;
  private callbacks: GameEngineCallbacks;

  // Three.js Core
  public renderer: THREE.WebGLRenderer;
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;
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

  // Achievement Tracking
  public consecutiveJumpsWithoutDeath: number = 0;
  private placedBlocksCount: number = 0;
  private speedSprintTime: number = 0;
  private lavaSurvivalTimer: number = 0;
  public unlockedAchievements: Set<string> = new Set();

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
    this.scene.fog = new THREE.FogExp2(0x38bdf8, 0.007);

    this.camera = new THREE.PerspectiveCamera(
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
    const sunLight = new THREE.DirectionalLight(0xfff7ed, 1.8);
    sunLight.position.set(40, 70, 30);
    if (!this.isSoftwareGl) {
      sunLight.castShadow = true;
      sunLight.shadow.mapSize.width = 1024;
      sunLight.shadow.mapSize.height = 1024;
      sunLight.shadow.camera.near = 10;
      sunLight.shadow.camera.far = 160;
      const d = 45;
      sunLight.shadow.camera.left = -d;
      sunLight.shadow.camera.right = d;
      sunLight.shadow.camera.top = d;
      sunLight.shadow.camera.bottom = -d;
      sunLight.shadow.bias = -0.0005;
    }
    this.scene.add(sunLight);

    const hemiLight = new THREE.HemisphereLight(0xbae6fd, 0x475569, 1.0);
    this.scene.add(hemiLight);

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

    // 7. Bind Input Listeners
    this.bindInputs();

    // 8. Pre-warm shaders
    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }

    // 9. Start Game Loop
    this.startLoop();

    this.callbacks.onChatMessage('Добро пожаловать в Blox World! [WASD] бег, [Пробел] прыжок, [1-5] предметы.');
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
    dom.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  private handleKeyDown = (e: KeyboardEvent) => {
    // Ignore shortcuts when typing in an input
    const tag = (e.target as HTMLElement)?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;

    const code = e.code;
    if (!this.keysHeld.has(code)) {
      this.justPressedKeys.add(code);
    }
    this.keysHeld.add(code);

    // Hotbar selection 1-7
    if (code === 'Digit1') this.selectTool('sword');
    if (code === 'Digit2') this.selectTool('speed_coil');
    if (code === 'Digit3') this.selectTool('gravity_coil');
    if (code === 'Digit4') this.selectTool('hammer');
    if (code === 'Digit5') this.selectTool('jetpack_boost');
    if (code === 'Digit6') this.selectTool('bloxy_cola');
    if (code === 'Digit7') this.selectTool('dance');

    // Reset character
    if (code === 'KeyR') {
      this.respawnPlayer(true);
    }

    // Jump buffer (Player 1)
    if (code === 'Space') {
      this.jumpBufferTimer = 0.14; // 140ms buffer
    }

    // Jump buffer (Player 2 in Local Co-op mode)
    if (this.localCoopEnabled && (code === 'Enter' || code === 'ShiftRight' || code === 'Numpad0')) {
      this.p2JumpBuffer = 0.14;
    }

    // Sound toggle shortcut
    if (code === 'KeyM') {
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
          this.cameraPitch = Math.max(0.08, Math.min(1.4, this.cameraPitch + dy * 0.006));
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

  private handleMouseDown = (e: MouseEvent) => {
    // If left click on canvas
    if (e.button === 0) {
      if (this.activeTool === 'sword') {
        this.performSwordAttack();
      } else if (this.activeTool === 'hammer') {
        this.placeOrRemoveBlock(e.shiftKey);
      } else if (this.activeTool === 'jetpack_boost') {
        this.triggerJetpackBoost();
      } else if (this.activeTool === 'bloxy_cola') {
        this.drinkBloxyCola();
      }
    }

    // Orbit drag on right click or left click drag
    this.isDraggingMouse = true;
    this.lastMouseX = e.clientX;
    this.lastMouseY = e.clientY;
  };

  private handleMouseMove = (e: MouseEvent) => {
    if (!this.isDraggingMouse) return;
    const dx = e.clientX - this.lastMouseX;
    const dy = e.clientY - this.lastMouseY;
    this.lastMouseX = e.clientX;
    this.lastMouseY = e.clientY;

    this.cameraYaw -= dx * 0.006;
    this.cameraPitch = Math.max(0.08, Math.min(1.4, this.cameraPitch + dy * 0.005));
  };

  private handleMouseUp = () => {
    this.isDraggingMouse = false;
  };

  private handleWheel = (e: WheelEvent) => {
    this.cameraDistance = Math.max(4, Math.min(26, this.cameraDistance + e.deltaY * 0.02));
  };

  private handleResize = () => {
    if (!this.mountEl || this.isDestroyed) return;
    const width = this.mountEl.clientWidth || window.innerWidth;
    const height = this.mountEl.clientHeight || window.innerHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
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
    if (this.activeTool === 'sword') {
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

    // Remove any placed blocks from previous world
    this.worldData?.placedBlockMeshes.forEach((m) => {
      this.scene.remove(m);
    });

    this.worldData = buildGameWorld(this.scene, gameId, this.worldData?.worldRoot);
    this.currentCheckpointId = 0;
    this.stats.currentCheckpoint = 0;
    this.stats.totalCheckpoints = this.worldData.checkpoints.length;
    this.respawnPlayer(true);

    if (this.localCoopEnabled && this.player2Avatar) {
      this.p2Pos.set(2.5, 2.2, 0);
      this.p2Vel.set(0, 0, 0);
      this.p2CheckpointId = 0;
      this.player2Avatar.root.position.copy(this.p2Pos);
    }

    if (gameId === 'lava_survival') {
      this.scene.background = new THREE.Color(0x1e1b4b);
      this.scene.fog = new THREE.FogExp2(0x31102f, 0.008);
      this.callbacks.onChatMessage('Запущен режим «Пол — это лава: Выживание 3D»! Поднимайтесь на крыши до вертолёта! 🌋🚁');
    } else {
      this.scene.background = new THREE.Color(0x38bdf8);
      this.scene.fog = new THREE.FogExp2(0x38bdf8, 0.007);
      this.callbacks.onChatMessage('Запущен режим «Паркур: Blox Obby 3D»! Пройдите 6 полос препятствий! 🏃🏆');
    }
  }

  public selectTool(tool: ToolType) {
    this.activeTool = tool;
    this.avatar.setEquippedTool(tool);
    this.avatar.isEmoting = tool === 'dance';
    this.callbacks.onToolChanged(tool);

    if (tool === 'speed_coil') {
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
    }
  }

  public setBlockColor(color: string) {
    this.selectedBlockColor = color;
  }

  private performSwordAttack() {
    this.avatar.triggerAttack();
    sound.playSwordSlash();
    this.callbacks.onLocalAttack?.();

    // Check hit against Target Dummy NPC
    const dummy = this.worldData.dummyMesh;
    const distToDummy = this.playerPos.distanceTo(dummy.position);
    if (distToDummy < 4.0) {
      sound.playOof();
      this.dummyShakeTimer = 0.4;
      this.spawnParticleBurst(dummy.position.x, dummy.position.y + 3, dummy.position.z, 0xfed000, 16);
      this.callbacks.onChatMessage('Вы ударили Noob Bob! "OOF!"', 'Noob Bob');
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
    mesh.userData = { width: 2, height: 2, depth: 2 };

    this.scene.add(mesh);
    this.worldData.placedBlockMeshes.set(blockKey, mesh);
    this.worldData.platforms.push(mesh);

    sound.playPlaceBlock();
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
      this.p2Pos.set(2.5, 2.2, 0);
      this.p2Vel.set(0, 0, 0);
      this.p2CheckpointId = 0;
      this.player2Avatar.root.position.copy(this.p2Pos);
    } else if (this.player2Avatar) {
      this.scene.remove(this.player2Avatar.root);
      this.player2Avatar.dispose();
      this.player2Avatar = null;
    }
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
      av.setNameplate(player.skin.name, '#38bdf8');
      av.setEquippedTool(player.activeTool || 'sword');
      av.root.position.set(player.position[0], player.position[1], player.position[2]);
      av.root.rotation.y = player.rotationY || 0;
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
    const entry = this.remoteAvatars.get(update.id);
    if (!entry) return;
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
      entry.avatar.setNameplate(skin.name, '#38bdf8');
    }
  }

  public triggerRemotePlayerAttack(id: string) {
    const entry = this.remoteAvatars.get(id);
    if (entry) {
      entry.avatar.triggerAttack();
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

  public respawnPlayer(manual: boolean = false) {
    const cp = this.worldData.checkpoints[this.currentCheckpointId] || this.worldData.checkpoints[0];
    this.playerPos.set(cp.position[0], cp.position[1] + 1.2, cp.position[2]);
    this.playerVel.set(0, 0, 0);
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

  public updateSkin(skin: CharacterSkin) {
    this.playerSkin = skin;
    this.avatar.updateSkin(skin);
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

      // Render
      this.renderer.render(this.scene, this.camera);

      // Next frame handling (Software WebGL vs GPU rAF)
      if (this.isSoftwareGl) {
        this.afterDraw(tick);
      } else {
        this.frameId = requestAnimationFrame(tick);
      }
    };

    if (this.isSoftwareGl) {
      this.afterDraw(tick);
    } else {
      this.frameId = requestAnimationFrame(tick);
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
    // 1. Process movement inputs (Keyboard WASD/Arrows + Mobile Virtual Joystick)
    // In Local Co-op mode, WASD controls Player 1 and Arrow Keys control Player 2
    const kbZ = this.localCoopEnabled
      ? (this.keysHeld.has('KeyW') ? 1 : 0) - (this.keysHeld.has('KeyS') ? 1 : 0)
      : (this.keysHeld.has('KeyW') || this.keysHeld.has('ArrowUp') ? 1 : 0) -
        (this.keysHeld.has('KeyS') || this.keysHeld.has('ArrowDown') ? 1 : 0);
    const kbX = this.localCoopEnabled
      ? (this.keysHeld.has('KeyD') ? 1 : 0) - (this.keysHeld.has('KeyA') ? 1 : 0)
      : (this.keysHeld.has('KeyD') || this.keysHeld.has('ArrowRight') ? 1 : 0) -
        (this.keysHeld.has('KeyA') || this.keysHeld.has('ArrowLeft') ? 1 : 0);

    // Combine keyboard with touch joystick (joystickY < 0 is forward)
    const rawMoveX = kbX !== 0 ? kbX : this.joystickX;
    const rawMoveZ = kbZ !== 0 ? kbZ : -this.joystickY;
    const inputMag = Math.min(1, Math.hypot(rawMoveX, rawMoveZ));

    const isMoving = inputMag > 0.05;
    const currentSpeed = getPlayerSpeed(this.activeTool) * (kbX !== 0 || kbZ !== 0 ? 1 : inputMag);

    if (isMoving) {
      // Calculate movement relative to camera yaw
      const forward = new THREE.Vector3(-Math.sin(this.cameraYaw), 0, -Math.cos(this.cameraYaw));
      const right = new THREE.Vector3(Math.cos(this.cameraYaw), 0, -Math.sin(this.cameraYaw));

      const inputDir = new THREE.Vector3()
        .addScaledVector(forward, rawMoveZ)
        .addScaledVector(right, rawMoveX)
        .normalize();

      this.playerVel.x = inputDir.x * currentSpeed;
      this.playerVel.z = inputDir.z * currentSpeed;

      // Rotate avatar smoothly to face direction
      const targetAngle = Math.atan2(inputDir.x, inputDir.z);
      this.avatar.root.rotation.y = THREE.MathUtils.damp(this.avatar.root.rotation.y, targetAngle, 16, dt);

      // Footstep sounds & dust particles
      this.avatar.walkPhase += dt * (currentSpeed * 0.9);
      if (this.isGrounded && Math.sin(this.avatar.walkPhase) > 0.95 && Math.random() < 0.25) {
        sound.playFootstep();
        this.spawnParticleBurst(this.playerPos.x, this.playerPos.y + 0.1, this.playerPos.z, 0xd1d5db, 2);
      }

      // Speed Coil Aura
      if (this.activeTool === 'speed_coil') {
        this.spawnParticleBurst(this.playerPos.x, this.playerPos.y + 0.5, this.playerPos.z, 0xef4444, 2);
      }
    } else {
      this.playerVel.x = THREE.MathUtils.damp(this.playerVel.x, 0, 14, dt);
      this.playerVel.z = THREE.MathUtils.damp(this.playerVel.z, 0, 14, dt);
    }

    this.avatar.isMoving = isMoving;

    // 2. Jumping, Coyote Time & Gravity
    const gravity = getPlayerGravity(this.activeTool);
    const jumpForce = getPlayerJumpForce(this.activeTool);

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

    // A. Move along X with Wall Pushback & Step-Up
    let targetX = this.playerPos.x + this.playerVel.x * dt;
    for (const plat of this.worldData.platforms) {
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
    for (const plat of this.worldData.platforms) {
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

    // C. Vertical Movement, Gravity & Landing / Ceiling Collision
    this.playerVel.y += gravity * dt;
    const prevY = this.playerPos.y;
    let targetY = this.playerPos.y + this.playerVel.y * dt;

    let onGroundThisFrame = false;
    let highestFloorY = -Infinity;

    for (const plat of this.worldData.platforms) {
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

    // 4. Hazard Collisions
    for (const haz of this.worldData.hazards) {
      if (haz.bounds && checkAABBIntersection(playerAABB, haz.bounds)) {
        if (haz.type === 'lava' || haz.type === 'spinner') {
          // Touch Lava / Spinner -> OOF and respawn!
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
    if (hasFallenIntoVoid(this.playerPos.y)) {
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
          this.scene.remove(mesh);
        }

        if (item.type === 'coin') {
          this.stats.coins += item.value;
          sound.playCoin();
          this.spawnParticleBurst(item.position[0], item.position[1], item.position[2], 0xfbbf24, 10);
        } else {
          this.stats.gems += 1;
          sound.playGem();
          this.spawnParticleBurst(item.position[0], item.position[1], item.position[2], 0xa855f7, 18);
        }
        this.callbacks.onStatsUpdate({ ...this.stats });
      }
    }

    // 8. Trophy Victory Trigger (Stage 6 Summit)
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
    }

    // Rotate Trophy star
    const star = this.worldData.trophyMesh.getObjectByName('TrophyStar');
    if (star) {
      star.rotation.y += dt * 2.5;
      star.rotation.x += dt * 1.5;
    }

    // Bobbing and spinning collectibles
    this.worldData.collectibleMeshes.forEach((mesh, id) => {
      const item = this.worldData.collectibles.find((c) => c.id === id);
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

    // 11. Third-Person Camera Following
    this.updateCamera(dt);

    // 12. Particles Update
    this.updateParticles(dt);

    // Clear single-frame just-pressed keys
    this.justPressedKeys.clear();
  }

  private updateLocalCoopPlayer2(dt: number, time: number) {
    if (!this.player2Avatar) return;

    const p2Z = (this.keysHeld.has('ArrowUp') ? 1 : 0) - (this.keysHeld.has('ArrowDown') ? 1 : 0);
    const p2X = (this.keysHeld.has('ArrowRight') ? 1 : 0) - (this.keysHeld.has('ArrowLeft') ? 1 : 0);
    const p2Moving = p2X !== 0 || p2Z !== 0;
    const p2Speed = 16.0;

    if (p2Moving) {
      const forward = new THREE.Vector3(-Math.sin(this.cameraYaw), 0, -Math.cos(this.cameraYaw));
      const right = new THREE.Vector3(Math.cos(this.cameraYaw), 0, -Math.sin(this.cameraYaw));
      const dir = new THREE.Vector3()
        .addScaledVector(forward, p2Z)
        .addScaledVector(right, p2X)
        .normalize();

      this.p2Vel.x = dir.x * p2Speed;
      this.p2Vel.z = dir.z * p2Speed;
      const targetAngle = Math.atan2(dir.x, dir.z);
      this.player2Avatar.root.rotation.y = THREE.MathUtils.damp(this.player2Avatar.root.rotation.y, targetAngle, 16, dt);
      this.player2Avatar.walkPhase += dt * (p2Speed * 0.9);
    } else {
      this.p2Vel.x = THREE.MathUtils.damp(this.p2Vel.x, 0, 14, dt);
      this.p2Vel.z = THREE.MathUtils.damp(this.p2Vel.z, 0, 14, dt);
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

    let p2TargetX = this.p2Pos.x + this.p2Vel.x * dt;
    for (const plat of this.worldData.platforms) {
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
    for (const plat of this.worldData.platforms) {
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

    // 3. Vertical & Gravity for P2
    this.p2Vel.y += -42.0 * dt;
    const p2PrevY = this.p2Pos.y;
    let p2TargetY = this.p2Pos.y + this.p2Vel.y * dt;

    let p2Ground = false;
    let p2HighestFloorY = -Infinity;

    for (const plat of this.worldData.platforms) {
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
      this.p2Pos.set(this.playerPos.x + 3.0, this.playerPos.y + 2.0, this.playerPos.z);
      this.p2Vel.set(0, 0, 0);
    }

    this.player2Avatar.root.position.copy(this.p2Pos);
    this.player2Avatar.update(dt, time);
  }

  private updateCamera(dt: number) {
    // Spherical coordinates from player target
    const target = this.playerPos.clone().add(new THREE.Vector3(0, 3.2, 0));

    // Screen shake offset
    let shakeOffset = new THREE.Vector3(0, 0, 0);
    if (this.screenShakeTimer > 0) {
      this.screenShakeTimer -= dt;
      shakeOffset.set((Math.random() - 0.5) * 0.4, (Math.random() - 0.5) * 0.4, (Math.random() - 0.5) * 0.4);
    }

    const camX = target.x + Math.sin(this.cameraYaw) * Math.cos(this.cameraPitch) * this.cameraDistance;
    const camY = target.y + Math.sin(this.cameraPitch) * this.cameraDistance;
    const camZ = target.z + Math.cos(this.cameraYaw) * Math.cos(this.cameraPitch) * this.cameraDistance;

    const desiredCamPos = new THREE.Vector3(camX, Math.max(0.5, camY), camZ).add(shakeOffset);

    // Exponential damping camera follow
    this.camera.position.x = THREE.MathUtils.damp(this.camera.position.x, desiredCamPos.x, 15, dt);
    this.camera.position.y = THREE.MathUtils.damp(this.camera.position.y, desiredCamPos.y, 15, dt);
    this.camera.position.z = THREE.MathUtils.damp(this.camera.position.z, desiredCamPos.z, 15, dt);

    this.camera.lookAt(target);
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
        spawned++;
      }
    }
  }

  private updateParticles(dt: number) {
    const dummyMat = new THREE.Matrix4();
    const dummyVec = new THREE.Vector3();
    const dummyQuat = new THREE.Quaternion();

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
      } else {
        dummyMat.compose(dummyVec.set(0, -999, 0), dummyQuat, dummyVec.set(0, 0, 0));
        this.particlePool.setMatrixAt(i, dummyMat);
      }
    }
    this.particlePool.instanceMatrix.needsUpdate = true;
    if (this.particlePool.instanceColor) {
      this.particlePool.instanceColor.needsUpdate = true;
    }
  }

  public dispose() {
    this.isDestroyed = true;
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
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }

    this.clearRemotePlayers();
    this.setLocalCoopMode(false);
    this.avatar.dispose();
    this.renderer.dispose();
    if (this.renderer.domElement && this.renderer.domElement.parentNode) {
      this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
    }
  }
}
