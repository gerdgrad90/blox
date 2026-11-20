import * as THREE from 'three';
import { Checkpoint, CollectibleItem, FlowerFieldZone, GameId, ObstacleHazard, PlacedBlock, SecretArea, SurfaceType } from './types';
import { buildStarterElevatorAndReception, buildThematicDoorsRoomSegment, decorateFinalElectricalRoom } from './doorsRooms';
import { StudioMaterialKind, StudioObject, StudioProject, getRotatedStudioFootprint, loadStudioProject } from './studio';

export interface DoorsHotelDoor {
  index: number;
  doorNumber: number; // 1 to 100
  z: number;
  hingeGroup: THREE.Group;
  colliderMesh: THREE.Mesh;
  isOpen: boolean;
  targetRotY: number;
  eventOnOpen?: 'rush' | 'eyes' | 'screech' | 'figure_room' | 'silence' | 'dupe' | 'gloom' | 'glitch' | 'snare' | 'stalker';
  isFake?: boolean;
}

export interface DoorsCloset {
  id: string;
  position: [number, number, number];
  side: 'left' | 'right';
  mesh: THREE.Group;
}

export interface DoorsRoomLightNode {
  x: number;
  y: number;
  z: number;
  color: number;
  baseIntensity: number;
  distance: number;
  bulbMesh?: THREE.Mesh;
}

export interface DoorsWorldData {
  doors: DoorsHotelDoor[];
  closets: DoorsCloset[];
  corridorLightPool: THREE.PointLight[];
  roomLightNodes: DoorsRoomLightNode[];
  rainGroup?: THREE.Group;
  rushMesh: THREE.Group;
  rushLight: THREE.PointLight;
  eyesClusters: { group: THREE.Group; z: number; active: boolean }[];
  screechMesh: THREE.Group;
  figureMonster: {
    group: THREE.Group;
    leftLeg: THREE.Mesh;
    rightLeg: THREE.Mesh;
    leftArm: THREE.Mesh;
    rightArm: THREE.Mesh;
    glowLight: THREE.PointLight;
  };
  cargoElevator: {
    group: THREE.Group;
    leftDoor: THREE.Mesh;
    rightDoor: THREE.Mesh;
    buttonMesh: THREE.Mesh;
    position: [number, number, number];
  };
  roomStartZ: number;
  jeffShopPos: [number, number, number];
  jeffShopPositions: [number, number, number][];
  infirmaryHerbPos: [number, number, number];
  infirmaryHerbPositions: [number, number, number][];
  riftPos: [number, number, number];
  riftPositions: [number, number, number][];
}

export interface WorldBuildResult {
  scene: THREE.Scene;
  worldRoot: THREE.Group;
  gameId: GameId;
  platforms: THREE.Mesh[];
  hazards: ObstacleHazard[];
  checkpoints: Checkpoint[];
  checkpointMeshes: THREE.Group[];
  collectibles: CollectibleItem[];
  collectibleMeshes: Map<string, THREE.Group>;
  dynamicRotators: { group: THREE.Group; speed: number; axis: 'y' | 'z' }[];
  placedBlockMeshes: Map<string, THREE.Mesh>;
  trophyMesh: THREE.Group;
  dummyMesh: THREE.Group;
  lavaSurface?: THREE.Mesh;
  secretAreas?: SecretArea[];
  flowerFields?: FlowerFieldZone[];
  hiveBounds?: { minX: number; maxX: number; minZ: number; maxZ: number };
  doorsData?: DoorsWorldData;
  studioGroup?: THREE.Group;
  studioBaseplate?: THREE.Mesh;
  studioGrid?: THREE.GridHelper;
  studioObjectMeshes?: Map<string, THREE.Object3D>;
}

/**
 * Creates procedural Stud Texture (Roblox classic cylinder top studs)
 */
export function createStudTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 128, 128);

  const cx = 64;
  const cy = 64;
  const r = 36;

  // Outer shadow
  ctx.beginPath();
  ctx.arc(cx, cy + 3, r, 0, Math.PI * 2);
  ctx.fillStyle = '#000000';
  ctx.globalAlpha = 0.18;
  ctx.fill();

  // Stud fill
  ctx.globalAlpha = 1.0;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = '#f0f0f0';
  ctx.fill();

  // Top highlight rim
  ctx.beginPath();
  ctx.arc(cx, cy - 2, r - 3, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.globalAlpha = 0.45;
  ctx.fill();

  ctx.globalAlpha = 1.0;
  ctx.strokeStyle = '#cccccc';
  ctx.lineWidth = 3;
  ctx.stroke();

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1, 1);
  return texture;
}

/**
 * Helper to create a single platform box
 */
function createPlatform(
  worldRoot: THREE.Group,
  platforms: THREE.Mesh[],
  x: number,
  y: number,
  z: number,
  w: number,
  h: number,
  d: number,
  mat: THREE.Material,
  surfaceType: SurfaceType = 'stone'
): THREE.Mesh {
  const geo = new THREE.BoxGeometry(w, h, d);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(x, y + h / 2, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData = { width: w, height: h, depth: d, surfaceType };
  platforms.push(mesh);
  worldRoot.add(mesh);
  return mesh;
}

/**
 * Universal Game World Builder: switches between 'obby', 'lava_survival', 'bee_swarm', and 'doors'
 */
export function buildGameWorld(scene: THREE.Scene, gameId: GameId, existingRoot?: THREE.Group): WorldBuildResult {
  if (existingRoot) {
    scene.remove(existingRoot);
    existingRoot.clear();
  }
  const worldRoot = existingRoot || new THREE.Group();
  worldRoot.name = `WorldRoot_${gameId}`;
  scene.add(worldRoot);

  if (gameId === 'lava_survival') {
    return createLavaSurvivalWorld(scene, worldRoot);
  }
  if (gameId === 'bee_swarm') {
    return createBeeSwarmWorld(scene, worldRoot);
  }
  if (gameId === 'doors') {
    return createDoorsHotelWorld(scene, worldRoot);
  }
  if (gameId === 'studio') {
    return createStudioWorld(scene, worldRoot);
  }
  return createObbyWorld(scene, worldRoot);
}

/**
 * Backward compatibility export
 */
export function createBloxWorld(scene: THREE.Scene): WorldBuildResult {
  return buildGameWorld(scene, 'obby');
}

/**
 * ============================================================================
 * GAME 1: PARCOUR BLOX OBBY 3D
 * ============================================================================
 */
function createObbyWorld(scene: THREE.Scene, worldRoot: THREE.Group): WorldBuildResult {
  const platforms: THREE.Mesh[] = [];
  const hazards: ObstacleHazard[] = [];
  const checkpoints: Checkpoint[] = [];
  const checkpointMeshes: THREE.Group[] = [];
  const collectibles: CollectibleItem[] = [];
  const collectibleMeshes = new Map<string, THREE.Group>();
  const dynamicRotators: { group: THREE.Group; speed: number; axis: 'y' | 'z' }[] = [];
  const placedBlockMeshes = new Map<string, THREE.Mesh>();

  const studTexture = createStudTexture();
  const grassMat = new THREE.MeshStandardMaterial({ color: 0x4ade80, roughness: 0.8, map: studTexture });
  const rockMat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.9 });
  const neonRedMat = new THREE.MeshStandardMaterial({ color: 0xff0044, emissive: 0xff0044, emissiveIntensity: 0.85, roughness: 0.2 });
  const neonBlueMat = new THREE.MeshStandardMaterial({ color: 0x00f0ff, emissive: 0x00b4d8, emissiveIntensity: 0.6, roughness: 0.2 });
  const neonYellowMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, emissive: 0xeab308, emissiveIntensity: 0.5, roughness: 0.2 });
  const goldMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.85, roughness: 0.15, emissive: 0xca8a04, emissiveIntensity: 0.4 });

  // Base Sea Bed below (spacious wide ocean horizon)
  const seaBed = new THREE.Mesh(new THREE.PlaneGeometry(720, 720), new THREE.MeshStandardMaterial({ color: 0x0369a1, roughness: 0.9 }));
  seaBed.rotation.x = -Math.PI / 2;
  seaBed.position.set(0, -14, 110);
  worldRoot.add(seaBed);

  // Fluffy high sky clouds for spacious aerial parkour atmosphere
  const cloudMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.9, transparent: true, opacity: 0.88 });
  const cloudCoords: [number, number, number, number][] = [
    [-42, 52, 20, 1.4],
    [48, 56, 45, 1.6],
    [-55, 60, 88, 1.8],
    [52, 54, 125, 1.5],
    [-48, 62, 165, 1.7],
    [44, 65, 205, 1.9],
    [-25, 68, 250, 1.6],
    [30, 64, -18, 1.3],
  ];
  cloudCoords.forEach(([cx, cy, cz, scale]) => {
    const cg = new THREE.Group();
    const c1 = new THREE.Mesh(new THREE.BoxGeometry(10 * scale, 2.8 * scale, 6 * scale), cloudMat);
    const c2 = new THREE.Mesh(new THREE.BoxGeometry(6 * scale, 3.6 * scale, 5 * scale), cloudMat);
    c2.position.set(2 * scale, 1.4 * scale, 0.5 * scale);
    const c3 = new THREE.Mesh(new THREE.BoxGeometry(5 * scale, 2.4 * scale, 4.5 * scale), cloudMat);
    c3.position.set(-3 * scale, 0.8 * scale, -0.5 * scale);
    cg.add(c1, c2, c3);
    cg.position.set(cx, cy, cz);
    worldRoot.add(cg);
  });

  // --- STAGE 0: Wide Spawn Plaza ---
  createPlatform(worldRoot, platforms, 0, 0, 0, 20, 2, 20, grassMat, 'grass');
  createCheckPointMesh(worldRoot, checkpoints, checkpointMeshes, 0, 'Спавн', 0, 2, 0, true);

  // --- STAGE 1: Spacious Stepping Stones & Lava Canyon ---
  createPlatform(worldRoot, platforms, 0, 1.0, 17, 6, 1.5, 6, rockMat, 'stone');
  createPlatform(worldRoot, platforms, -5.0, 2.5, 27, 5.5, 1.5, 5.5, rockMat, 'stone');
  createPlatform(worldRoot, platforms, 5.0, 4.0, 37, 5.5, 1.5, 5.5, rockMat, 'stone');

  // Wide Lava Canyon between stage 1 and 2
  const lava1 = createPlatform(worldRoot, platforms, 0, 2.5, 49, 20, 0.8, 14, neonRedMat, 'stone');
  hazards.push({ id: 'lava_1', type: 'lava', mesh: lava1, damage: 100, active: true });

  createPlatform(worldRoot, platforms, -4.0, 3.5, 49, 4.0, 1.8, 4.0, neonBlueMat, 'stone');
  createPlatform(worldRoot, platforms, 4.0, 3.5, 49, 4.0, 1.8, 4.0, neonYellowMat, 'stone');

  // --- STAGE 2: Checkpoint 1 & Wide Neon Zig-Zag Bridge ---
  createPlatform(worldRoot, platforms, 0, 5.0, 62, 16, 2, 14, grassMat, 'grass');
  createCheckPointMesh(worldRoot, checkpoints, checkpointMeshes, 1, 'Неоновый Мост', 0, 7.0, 62, false);

  const neonColors = [neonRedMat, neonYellowMat, neonBlueMat, neonRedMat, neonYellowMat];
  for (let i = 0; i < 5; i++) {
    const xOffset = i % 2 === 0 ? -4.5 : 4.5;
    createPlatform(worldRoot, platforms, xOffset, 6.2 + i * 1.2, 75 + i * 8.5, 4.5, 1.1, 4.5, neonColors[i], 'stone');
  }

  // --- STAGE 3: Checkpoint 2 & Spacious Spinner Arena ---
  createPlatform(worldRoot, platforms, 0, 12.5, 120, 18, 2, 18, grassMat, 'grass');
  createCheckPointMesh(worldRoot, checkpoints, checkpointMeshes, 2, 'Вращающийся Лазер', 0, 14.5, 120, false);

  // Rotating laser cross hazard centered in spacious arena
  const spinnerGroup = new THREE.Group();
  spinnerGroup.position.set(0, 15.0, 120);
  const arm1 = new THREE.Mesh(new THREE.BoxGeometry(14, 0.6, 0.6), neonRedMat);
  const arm2 = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 14), neonRedMat);
  spinnerGroup.add(arm1, arm2);
  worldRoot.add(spinnerGroup);
  hazards.push({ id: 'spinner_1', type: 'spinner', mesh: arm1, damage: 45, active: true });
  hazards.push({ id: 'spinner_2', type: 'spinner', mesh: arm2, damage: 45, active: true });
  dynamicRotators.push({ group: spinnerGroup, speed: 1.4, axis: 'y' });

  // --- STAGE 4: Checkpoint 3 & Wide Glass Skybridge ---
  createPlatform(worldRoot, platforms, 0, 14.0, 142, 14, 2, 12, rockMat, 'stone');
  createCheckPointMesh(worldRoot, checkpoints, checkpointMeshes, 3, 'Стеклянный Путь', 0, 16.0, 142, false);

  for (let i = 0; i < 4; i++) {
    const glassMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.65,
      roughness: 0.1,
    });
    createPlatform(worldRoot, platforms, i % 2 === 0 ? -3.8 : 3.8, 15.5 + i * 1.4, 154 + i * 8.5, 4.5, 0.9, 4.5, glassMat, 'stone');
  }

  // --- STAGE 5: Checkpoint 4 & Trampoline Sky-Leap ---
  createPlatform(worldRoot, platforms, 0, 21.0, 190, 16, 2, 16, grassMat, 'grass');
  createCheckPointMesh(worldRoot, checkpoints, checkpointMeshes, 4, 'Супер-Трамплин', 0, 23.0, 190, false);

  // Spacious Trampoline Jump pad
  const padMesh = createPlatform(worldRoot, platforms, 0, 23.0, 198, 5.5, 0.5, 5.5, neonYellowMat, 'stone');
  hazards.push({ id: 'bounce_pad', type: 'trampoline', mesh: padMesh, damage: 0, active: true });

  // Wide Floating Sky Island high above
  createPlatform(worldRoot, platforms, 0, 31.0, 216, 12, 2, 12, rockMat, 'stone');

  // --- STAGE 6: Checkpoint 5 & Grand Golden Summit ---
  createPlatform(worldRoot, platforms, 0, 35.0, 236, 22, 2, 22, grassMat, 'grass');
  createCheckPointMesh(worldRoot, checkpoints, checkpointMeshes, 5, 'Золотая Вершина', 0, 37.0, 236, false);

  // The Golden Cup Trophy
  const trophyMesh = createGoldenTrophy();
  trophyMesh.position.set(0, 37.0, 236);
  worldRoot.add(trophyMesh);
  dynamicRotators.push({ group: trophyMesh, speed: 1.0, axis: 'y' });

  // Practice Dummy
  const dummyMesh = createPracticeDummy();
  dummyMesh.position.set(6.5, 37.0, 233);
  worldRoot.add(dummyMesh);

  // Coins along the spacious course
  const coinPositions: [number, number, number][] = [
    [0, 3.5, 17],
    [-5.0, 5.0, 27],
    [5.0, 6.5, 37],
    [-4.5, 9.0, 75],
    [4.5, 11.5, 92],
    [0, 17.0, 120],
    [-3.8, 18.0, 154],
    [0, 25.0, 198],
    [0, 33.5, 216],
    [-5.0, 39.0, 236],
    [5.0, 39.0, 236],
  ];

  coinPositions.forEach((pos, idx) => {
    const id = `coin_obby_${idx}`;
    const mesh = createCoinMesh();
    mesh.position.set(pos[0], pos[1], pos[2]);
    worldRoot.add(mesh);
    collectibleMeshes.set(id, mesh);
    collectibles.push({ id, type: 'coin', position: pos, value: 50, collected: false });
    dynamicRotators.push({ group: mesh, speed: 2.2, axis: 'y' });
  });

  // --- SECRET AREA: Тайная Кристальная Комната (Hidden Crystal Chamber) ---
  const secretAreas: SecretArea[] = [];
  const crystalMat = new THREE.MeshStandardMaterial({
    color: 0xc084fc,
    emissive: 0x9333ea,
    emissiveIntensity: 0.6,
    roughness: 0.2,
  });
  const secretFloorMat = new THREE.MeshStandardMaterial({
    color: 0x1e1b4b,
    roughness: 0.5,
    metalness: 0.2,
    map: studTexture,
  });

  // Secret wide stepping bridge branching off Checkpoint 2 (Z = 120, X = -13 -> -36)
  createPlatform(worldRoot, platforms, -13, 11.5, 120, 4.0, 0.9, 4.0, crystalMat);
  createPlatform(worldRoot, platforms, -21, 9.8, 115, 4.0, 0.9, 4.0, crystalMat);
  createPlatform(worldRoot, platforms, -28, 8.2, 108, 4.0, 0.9, 4.0, crystalMat);

  // Spacious Hidden Crystal Vault Island
  createPlatform(worldRoot, platforms, -36, 6.5, 100, 14, 2, 14, secretFloorMat);

  // Floating secret crystals
  for (let c = 0; c < 3; c++) {
    const octGeo = new THREE.OctahedronGeometry(0.95, 0);
    const octMesh = new THREE.Mesh(octGeo, crystalMat);
    octMesh.position.set(-36 + (c - 1) * 3.8, 9.4, 100 + (c % 2 === 0 ? 1.5 : -1.5));
    worldRoot.add(octMesh);
    dynamicRotators.push({ group: octMesh as any, speed: 2.0 + c * 0.5, axis: 'y' });
  }

  // Secret Hyper-Rare Crystal Gem in the hidden Crystal Vault
  const secretCoinId = 'coin_secret_crystal';
  const secretCoinMesh = createGemMesh();
  secretCoinMesh.scale.set(1.45, 1.45, 1.45);
  secretCoinMesh.position.set(-36, 9.4, 100);
  worldRoot.add(secretCoinMesh);
  collectibleMeshes.set(secretCoinId, secretCoinMesh);
  collectibles.push({ id: secretCoinId, type: 'gem', position: [-36, 9.4, 100], value: 250, collected: false });
  dynamicRotators.push({ group: secretCoinMesh, speed: 2.8, axis: 'y' });

  secretAreas.push({
    id: 'secret_crystal_vault',
    name: 'Тайная Кристальная Комната',
    description: 'Скрытая пещера с фиолетовыми кристаллами за пределами трассы!',
    bounds: {
      minX: -44,
      maxX: -28,
      minY: 4,
      maxY: 14,
      minZ: 92,
      maxZ: 109,
    },
  });

  return {
    scene,
    worldRoot,
    gameId: 'obby',
    platforms,
    hazards,
    checkpoints,
    checkpointMeshes,
    collectibles,
    collectibleMeshes,
    dynamicRotators,
    placedBlockMeshes,
    trophyMesh,
    dummyMesh,
    secretAreas,
  };
}

/**
 * ============================================================================
 * GAME 2: THE FLOOR IS LAVA SURVIVAL 3D
 * ============================================================================
 */
function createLavaSurvivalWorld(scene: THREE.Scene, worldRoot: THREE.Group): WorldBuildResult {
  const platforms: THREE.Mesh[] = [];
  const hazards: ObstacleHazard[] = [];
  const checkpoints: Checkpoint[] = [];
  const checkpointMeshes: THREE.Group[] = [];
  const collectibles: CollectibleItem[] = [];
  const collectibleMeshes = new Map<string, THREE.Group>();
  const dynamicRotators: { group: THREE.Group; speed: number; axis: 'y' | 'z' }[] = [];
  const placedBlockMeshes = new Map<string, THREE.Mesh>();

  const studTexture = createStudTexture();

  // Materials for city, construction & boiling magma
  const rooftopMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.7, map: studTexture });
  const concreteMat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.85 });
  const brickMat = new THREE.MeshStandardMaterial({ color: 0x991b1b, roughness: 0.8 });
  const woodPlankMat = new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.7 });
  const steelGirderMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.6, roughness: 0.35 });
  const darkSteelMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.8, roughness: 0.25 });
  const hazardOrangeMat = new THREE.MeshStandardMaterial({ color: 0xf97316, emissive: 0xea580c, emissiveIntensity: 0.8, roughness: 0.2 });
  const fireNeonMat = new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0xdc2626, emissiveIntensity: 0.9, roughness: 0.2 });

  // 1. Rising Boiling Magma Ocean Plane
  const lavaGeo = new THREE.PlaneGeometry(350, 350, 32, 32);
  const lavaMat = new THREE.MeshStandardMaterial({
    color: 0xef4444,
    emissive: 0xff3b00,
    emissiveIntensity: 0.95,
    roughness: 0.15,
    metalness: 0.1,
  });
  const lavaSurface = new THREE.Mesh(lavaGeo, lavaMat);
  lavaSurface.rotation.x = -Math.PI / 2;
  lavaSurface.position.set(0, -1.0, 75);
  worldRoot.add(lavaSurface);

  // Large floor hazard covering the whole bottom void
  const lavaHazardBox = new THREE.Mesh(new THREE.BoxGeometry(350, 4, 350), lavaMat);
  lavaHazardBox.position.set(0, -3.0, 75);
  worldRoot.add(lavaHazardBox);
  hazards.push({
    id: 'lava_ocean',
    type: 'lava',
    mesh: lavaHazardBox,
    damage: 100,
    active: true,
  });

  // --- STAGE 0: Safe Spawn — "Blox Pizza & Cafe" Rooftop ---
  const spawnBuilding = createPlatform(worldRoot, platforms, 0, 0, 0, 16, 3, 16, rooftopMat);
  // Building walls below sinking into the lava
  const spawnWalls = new THREE.Mesh(new THREE.BoxGeometry(15.6, 20, 15.6), concreteMat);
  spawnWalls.position.set(0, -10, 0);
  worldRoot.add(spawnWalls);

  // Blox Pizza Neon Billboard Sign on spawn
  const signMat = new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0xef4444, emissiveIntensity: 0.7 });
  const signPost = new THREE.Mesh(new THREE.BoxGeometry(0.4, 3, 0.4), darkSteelMat);
  signPost.position.set(-6, 4.5, -6);
  const signBoard = new THREE.Mesh(new THREE.BoxGeometry(6, 1.8, 0.4), signMat);
  signBoard.position.set(-3.5, 5.5, -6);
  worldRoot.add(signPost, signBoard);

  createCheckPointMesh(worldRoot, checkpoints, checkpointMeshes, 0, 'Крыша Пиццерии (Старт)', 0, 3, 0, true);

  // --- STAGE 1: Wooden Escape Planks & Industrial Vents ---
  createPlatform(worldRoot, platforms, 0, 2.5, 14, 4, 1.2, 4, darkSteelMat);
  // Air conditioner vent unit
  const acMesh = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.6, 2.4), concreteMat);
  acMesh.position.set(0, 4.0, 14);
  worldRoot.add(acMesh);

  // Narrow Wooden Planks over boiling lava
  createPlatform(worldRoot, platforms, -4.0, 4.0, 22, 2.0, 0.8, 7.0, woodPlankMat, 'wood');
  createPlatform(worldRoot, platforms, 4.0, 6.0, 31, 2.0, 0.8, 7.0, woodPlankMat, 'wood');

  // --- STAGE 2: Skyscraper Rooftop with Rotating Laser Hazard ---
  createPlatform(worldRoot, platforms, 0, 8.5, 44, 14, 3, 14, brickMat);
  const towerWalls = new THREE.Mesh(new THREE.BoxGeometry(13.6, 30, 13.6), brickMat);
  towerWalls.position.set(0, -8, 44);
  worldRoot.add(towerWalls);

  createCheckPointMesh(worldRoot, checkpoints, checkpointMeshes, 1, 'Крыша Небоскрёба', 0, 11.5, 44, false);

  // Rotating laser vent hazard
  const laserVentGroup = new THREE.Group();
  laserVentGroup.position.set(0, 12.0, 44);
  const laserBeam1 = new THREE.Mesh(new THREE.BoxGeometry(13, 0.4, 0.4), fireNeonMat);
  const laserBeam2 = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 13), fireNeonMat);
  laserVentGroup.add(laserBeam1, laserBeam2);
  worldRoot.add(laserVentGroup);
  hazards.push({ id: 'laser_vent_1', type: 'spinner', mesh: laserBeam1, damage: 60, active: true });
  hazards.push({ id: 'laser_vent_2', type: 'spinner', mesh: laserBeam2, damage: 60, active: true });
  dynamicRotators.push({ group: laserVentGroup, speed: 1.8, axis: 'y' });

  // --- STAGE 3: Yellow Industrial Construction Crane ---
  createPlatform(worldRoot, platforms, 0, 14.0, 64, 8, 2, 8, concreteMat);
  createCheckPointMesh(worldRoot, checkpoints, checkpointMeshes, 2, 'Башенный Кран', 0, 16.0, 64, false);

  // Crane Central Tower (Yellow Steel Girders)
  const craneTower = new THREE.Mesh(new THREE.BoxGeometry(2.5, 24, 2.5), steelGirderMat);
  craneTower.position.set(0, 24, 76);
  worldRoot.add(craneTower);

  // Crane Horizontal Arm Balance Beams
  createPlatform(worldRoot, platforms, 0, 20.0, 76, 2.0, 1.0, 16.0, steelGirderMat);
  createPlatform(worldRoot, platforms, -5.0, 22.0, 84, 3.5, 1.0, 3.5, darkSteelMat);
  createPlatform(worldRoot, platforms, 5.0, 24.0, 92, 3.5, 1.0, 3.5, darkSteelMat);

  // Rotating Crane Counterweight Blade
  const craneSpinner = new THREE.Group();
  craneSpinner.position.set(0, 25.5, 84);
  const blade = new THREE.Mesh(new THREE.BoxGeometry(10, 0.5, 0.5), hazardOrangeMat);
  craneSpinner.add(blade);
  worldRoot.add(craneSpinner);
  hazards.push({ id: 'crane_blade', type: 'spinner', mesh: blade, damage: 50, active: true });
  dynamicRotators.push({ group: craneSpinner, speed: -1.5, axis: 'y' });

  // --- STAGE 4: Stepping Volcano Pillars & Magma Geysers ---
  createPlatform(worldRoot, platforms, 0, 24.0, 106, 10, 2, 10, rooftopMat);
  createCheckPointMesh(worldRoot, checkpoints, checkpointMeshes, 3, 'Лавовые Гейзеры', 0, 26.0, 106, false);

  for (let i = 0; i < 4; i++) {
    const xPos = i % 2 === 0 ? -3.5 : 3.5;
    const yPos = 26.0 + i * 2.0;
    const zPos = 117 + i * 8;
    // Molten Pillar
    createPlatform(worldRoot, platforms, xPos, yPos, zPos, 3.2, 1.5, 3.2, darkSteelMat);
    // Molten Rim
    const rim = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.2, 3.6), hazardOrangeMat);
    rim.position.set(xPos, yPos + 1.5, zPos);
    worldRoot.add(rim);
  }

  // --- STAGE 5: Penthouse & Sky Launch Trampoline ---
  createPlatform(worldRoot, platforms, 0, 33.0, 150, 12, 2, 12, concreteMat);
  createCheckPointMesh(worldRoot, checkpoints, checkpointMeshes, 4, 'Пентхаус (Трамплин)', 0, 35.0, 150, false);

  // High-bounce trampoline
  const trampMesh = createPlatform(worldRoot, platforms, 0, 35.0, 158, 4.5, 0.6, 4.5, hazardOrangeMat);
  hazards.push({ id: 'lava_trampoline', type: 'trampoline', mesh: trampMesh, damage: 0, active: true });

  // Floating Cloud Rooftop
  createPlatform(worldRoot, platforms, 0, 44.0, 172, 8, 2, 8, steelGirderMat);

  // --- STAGE 6: VIP Rooftop Helipad & Rescue Helicopter ---
  createPlatform(worldRoot, platforms, 0, 48.0, 192, 18, 3, 18, darkSteelMat);
  const heliTower = new THREE.Mesh(new THREE.BoxGeometry(17.6, 60, 17.6), concreteMat);
  heliTower.position.set(0, 18, 192);
  worldRoot.add(heliTower);

  // Painted Yellow "H" Helipad Ring
  const ringGeo = new THREE.RingGeometry(5.5, 6.5, 32);
  const heliMarkMat = new THREE.MeshBasicMaterial({ color: 0xfacc15, side: THREE.DoubleSide });
  const heliRing = new THREE.Mesh(ringGeo, heliMarkMat);
  heliRing.rotation.x = -Math.PI / 2;
  heliRing.position.set(0, 51.1, 192);
  worldRoot.add(heliRing);

  createCheckPointMesh(worldRoot, checkpoints, checkpointMeshes, 5, 'VIP Вертолётная Площадка', 0, 51.0, 192, false);

  // Blox Rescue Helicopter Model
  const chopperGroup = createRescueHelicopter();
  chopperGroup.position.set(0, 51.5, 192);
  worldRoot.add(chopperGroup);
  // Animate main helicopter rotor
  const mainRotor = chopperGroup.getObjectByName('MainRotor');
  if (mainRotor) {
    dynamicRotators.push({ group: mainRotor as THREE.Group, speed: 18.0, axis: 'y' });
  }

  // Golden Survival Trophy at center of Helipad
  const trophyMesh = createGoldenTrophy();
  trophyMesh.position.set(0, 51.5, 192);
  worldRoot.add(trophyMesh);
  dynamicRotators.push({ group: trophyMesh, speed: 1.2, axis: 'y' });

  // Dummy target to punch
  const dummyMesh = createPracticeDummy();
  dummyMesh.position.set(5.5, 51.5, 190);
  worldRoot.add(dummyMesh);

  // Coins scattered across the rooftops (gems are hyper-rare and only found in the secret crane hideout!)
  const lavaCollectibles: [number, number, number, 'coin' | 'gem'][] = [
    [0, 5.0, 14, 'coin'],
    [-4.0, 6.5, 22, 'coin'],
    [4.0, 8.5, 31, 'coin'],
    [0, 13.5, 44, 'coin'],
    [0, 22.0, 76, 'coin'],
    [-5.0, 24.5, 84, 'coin'],
    [5.0, 26.5, 92, 'coin'],
    [-3.5, 29.5, 117, 'coin'],
    [3.5, 33.5, 133, 'coin'],
    [0, 37.0, 150, 'coin'],
    [0, 46.5, 172, 'coin'],
    [-4.5, 53.0, 192, 'coin'],
    [4.5, 53.0, 192, 'coin'],
  ];

  lavaCollectibles.forEach((item, idx) => {
    const id = `lava_col_${idx}`;
    const isGem = item[3] === 'gem';
    const mesh = isGem ? createGemMesh() : createCoinMesh();
    mesh.position.set(item[0], item[1], item[2]);
    worldRoot.add(mesh);
    collectibleMeshes.set(id, mesh);
    collectibles.push({
      id,
      type: item[3],
      position: [item[0], item[1], item[2]],
      value: isGem ? 100 : 50,
      collected: false,
    });
    dynamicRotators.push({ group: mesh, speed: 2.2, axis: 'y' });
  });

  // --- SECRET AREA: Тайное Убежище Крана (Crane Rooftop Hideout) ---
  const secretAreas: SecretArea[] = [];
  const vipGoldMat = new THREE.MeshStandardMaterial({
    color: 0xfacc15,
    metalness: 0.8,
    roughness: 0.2,
    emissive: 0xca8a04,
    emissiveIntensity: 0.4,
  });

  // Secret perch high atop the crane counterweight (X: 0, Y: 30, Z: 76)
  createPlatform(worldRoot, platforms, 0, 29.0, 76, 5.0, 1.2, 5.0, vipGoldMat);

  // Secret Diamond Gem on the crane roof
  const secretLavaGemId = 'gem_secret_crane';
  const secretGemMesh = createGemMesh();
  secretGemMesh.scale.set(1.5, 1.5, 1.5);
  secretGemMesh.position.set(0, 31.5, 76);
  worldRoot.add(secretGemMesh);
  collectibleMeshes.set(secretLavaGemId, secretGemMesh);
  collectibles.push({ id: secretLavaGemId, type: 'gem', position: [0, 31.5, 76], value: 300, collected: false });
  dynamicRotators.push({ group: secretGemMesh, speed: 2.5, axis: 'y' });

  secretAreas.push({
    id: 'secret_crane_hideout',
    name: 'Тайное Убежище Крана',
    description: 'Секретная золотая площадка на верхушке башенного крана!',
    bounds: {
      minX: -4,
      maxX: 4,
      minY: 28,
      maxY: 36,
      minZ: 72,
      maxZ: 80,
    },
  });

  return {
    scene,
    worldRoot,
    gameId: 'lava_survival',
    platforms,
    hazards,
    checkpoints,
    checkpointMeshes,
    collectibles,
    collectibleMeshes,
    dynamicRotators,
    placedBlockMeshes,
    trophyMesh,
    dummyMesh,
    lavaSurface,
    secretAreas,
  };
}

/**
 * Creates Checkpoint mesh + Flag
 */
function createCheckPointMesh(
  worldRoot: THREE.Group,
  checkpoints: Checkpoint[],
  checkpointMeshes: THREE.Group[],
  id: number,
  name: string,
  x: number,
  y: number,
  z: number,
  activated: boolean
) {
  checkpoints.push({ id, name, position: [x, y, z], activated });

  const group = new THREE.Group();
  group.position.set(x, y, z);

  // Platform pad
  const padGeo = new THREE.CylinderGeometry(2.2, 2.4, 0.4, 16);
  const padMat = new THREE.MeshStandardMaterial({
    color: activated ? 0x22c55e : 0x64748b,
    roughness: 0.4,
    emissive: activated ? 0x15803d : 0x000000,
    emissiveIntensity: 0.4,
  });
  const pad = new THREE.Mesh(padGeo, padMat);
  pad.name = 'CheckpointPad';

  // Pole
  const poleGeo = new THREE.CylinderGeometry(0.08, 0.08, 3.2, 8);
  const poleMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.8, roughness: 0.2 });
  const pole = new THREE.Mesh(poleGeo, poleMat);
  pole.position.set(1.5, 1.6, 0);

  // Flag banner
  const flagGeo = new THREE.BoxGeometry(1.2, 0.7, 0.06);
  const flagMat = new THREE.MeshStandardMaterial({
    color: activated ? 0x22c55e : 0xef4444,
    emissive: activated ? 0x16a34a : 0xb91c1c,
    emissiveIntensity: 0.5,
  });
  const flag = new THREE.Mesh(flagGeo, flagMat);
  flag.name = 'CheckpointFlag';
  flag.position.set(2.1, 2.7, 0);

  group.add(pad, pole, flag);
  worldRoot.add(group);
  checkpointMeshes.push(group);
}

/**
 * Creates 3D Gold Coin
 */
function createCoinMesh(): THREE.Group {
  const group = new THREE.Group();
  const coinGeo = new THREE.CylinderGeometry(0.7, 0.7, 0.18, 16);
  const coinMat = new THREE.MeshStandardMaterial({
    color: 0xfacc15,
    metalness: 0.9,
    roughness: 0.15,
    emissive: 0xca8a04,
    emissiveIntensity: 0.35,
  });
  const coin = new THREE.Mesh(coinGeo, coinMat);
  coin.rotation.z = Math.PI / 2;
  group.add(coin);
  return group;
}

/**
 * Creates 3D Diamond Gem
 */
function createGemMesh(): THREE.Group {
  const group = new THREE.Group();
  const gemGeo = new THREE.OctahedronGeometry(0.8, 0);
  const gemMat = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    metalness: 0.2,
    roughness: 0.1,
    emissive: 0x0284c7,
    emissiveIntensity: 0.8,
  });
  const gem = new THREE.Mesh(gemGeo, gemMat);
  group.add(gem);
  return group;
}

/**
 * Creates Practice Punching Dummy
 */
function createPracticeDummy(): THREE.Group {
  const dummy = new THREE.Group();
  dummy.name = 'PracticeDummy';

  const woodMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.6 });
  const strawMat = new THREE.MeshStandardMaterial({ color: 0xfef08a, roughness: 0.8 });

  // Post
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 3.5, 8), woodMat);
  post.position.set(0, 1.75, 0);

  // Body
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 1.6, 12), strawMat);
  body.position.set(0, 2.2, 0);

  // Target
  const targetMat = new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0xb91c1c, emissiveIntensity: 0.4 });
  const target = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.08, 16), targetMat);
  target.rotation.x = Math.PI / 2;
  target.position.set(0, 2.2, 0.72);

  dummy.add(post, body, target);
  return dummy;
}

/**
 * Creates Golden Roblox Summit Trophy
 */
function createGoldenTrophy(): THREE.Group {
  const trophy = new THREE.Group();
  trophy.name = 'GoldenTrophy';

  const goldMat = new THREE.MeshStandardMaterial({
    color: 0xfacc15,
    metalness: 0.9,
    roughness: 0.15,
    emissive: 0xca8a04,
    emissiveIntensity: 0.4,
  });

  const base = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.6, 2.2), goldMat);
  base.position.set(0, 0.3, 0);

  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.6, 1.8, 16), goldMat);
  stem.position.set(0, 1.4, 0);

  const cup = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 0.5, 2.0, 16), goldMat);
  cup.position.set(0, 3.0, 0);

  // Handles
  const handleMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.85, roughness: 0.2 });
  const handleL = new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.15, 8, 16, Math.PI), handleMat);
  handleL.position.set(-1.6, 3.0, 0);
  handleL.rotation.z = Math.PI / 2;

  const handleR = new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.15, 8, 16, Math.PI), handleMat);
  handleR.position.set(1.6, 3.0, 0);
  handleR.rotation.z = -Math.PI / 2;

  // Star inside cup
  const starMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfef08a, emissiveIntensity: 0.9, roughness: 0.1 });
  const star = new THREE.Mesh(new THREE.OctahedronGeometry(0.6), starMat);
  star.position.set(0, 4.2, 0);

  trophy.add(base, stem, cup, handleL, handleR, star);
  return trophy;
}

/**
 * Creates Blox Rescue Helicopter for VIP Helipad in Lava Survival
 */
function createRescueHelicopter(): THREE.Group {
  const heli = new THREE.Group();
  heli.name = 'RescueHelicopter';

  const bodyMat = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.4, metalness: 0.3 });
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, transparent: true, opacity: 0.7, roughness: 0.1 });
  const skidMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.8, roughness: 0.3 });
  const bladeMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.6, roughness: 0.4 });

  // Main Cabin
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(3.2, 2.4, 5.0), bodyMat);
  cabin.position.set(0, 2.0, 0);

  // Cockpit Glass
  const cockpit = new THREE.Mesh(new THREE.BoxGeometry(2.8, 1.8, 2.2), glassMat);
  cockpit.position.set(0, 2.2, 2.2);

  // Tail Boom
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.9, 6.0), bodyMat);
  tail.position.set(0, 2.3, -5.0);

  // Landing Skids
  const skidL = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 5.5, 8), skidMat);
  skidL.rotation.x = Math.PI / 2;
  skidL.position.set(-1.6, 0.4, 0);

  const skidR = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 5.5, 8), skidMat);
  skidR.rotation.x = Math.PI / 2;
  skidR.position.set(1.6, 0.4, 0);

  // Main Rotor Hub & Blades
  const mainRotorGroup = new THREE.Group();
  mainRotorGroup.name = 'MainRotor';
  mainRotorGroup.position.set(0, 3.4, 0);

  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.8, 8), skidMat);
  const blade1 = new THREE.Mesh(new THREE.BoxGeometry(11.0, 0.12, 0.6), bladeMat);
  const blade2 = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.12, 11.0), bladeMat);
  mainRotorGroup.add(mast, blade1, blade2);

  heli.add(cabin, cockpit, tail, skidL, skidR, mainRotorGroup);
  return heli;
}

/**
 * ============================================================================
 * GAME 3: BEE SWARM SIMULATOR 3D
 * ============================================================================
 */
function createBeeSwarmWorld(scene: THREE.Scene, worldRoot: THREE.Group): WorldBuildResult {
  const platforms: THREE.Mesh[] = [];
  const hazards: ObstacleHazard[] = [];
  const checkpoints: Checkpoint[] = [];
  const checkpointMeshes: THREE.Group[] = [];
  const collectibles: CollectibleItem[] = [];
  const collectibleMeshes = new Map<string, THREE.Group>();
  const dynamicRotators: { group: THREE.Group; speed: number; axis: 'y' | 'z' }[] = [];
  const placedBlockMeshes = new Map<string, THREE.Mesh>();

  // Materials
  const meadowGrassMat = new THREE.MeshStandardMaterial({ color: 0x65a30d, roughness: 0.8 });
  const soilMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.9 });
  const hiveWoodMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.5, metalness: 0.1 });
  const goldHiveMat = new THREE.MeshStandardMaterial({ color: 0xfbbf24, roughness: 0.2, metalness: 0.6, emissive: 0xb45309, emissiveIntensity: 0.3 });
  const fenceMat = new THREE.MeshStandardMaterial({ color: 0x92400e, roughness: 0.7 });
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.8 });
  const leavesMat = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.6 });

  // 1. SOLID GROUND MEADOW (130 x 130) - ZERO PARKOUR, CANNOT FALL OFF
  createPlatform(worldRoot, platforms, 0, 0, 40, 130, 2, 130, meadowGrassMat, 'grass');

  // Boundary Fences & Perimeter Trees
  for (let x = -60; x <= 60; x += 8) {
    const fNorth = new THREE.Mesh(new THREE.BoxGeometry(7.5, 1.4, 0.4), fenceMat);
    fNorth.position.set(x, 1.7, 102);
    const fSouth = new THREE.Mesh(new THREE.BoxGeometry(7.5, 1.4, 0.4), fenceMat);
    fSouth.position.set(x, 1.7, -22);
    worldRoot.add(fNorth, fSouth);
  }
  for (let z = -20; z <= 100; z += 8) {
    const fWest = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.4, 7.5), fenceMat);
    fWest.position.set(-62, 1.7, z);
    const fEast = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.4, 7.5), fenceMat);
    fEast.position.set(62, 1.7, z);
    worldRoot.add(fWest, fEast);
  }

  // Decorative stylized low-poly Trees around borders
  const treeCoords: [number, number][] = [
    [-55, -15], [-45, -18], [45, -18], [55, -15],
    [-58, 20], [-58, 50], [-58, 80],
    [58, 20], [58, 50], [58, 80],
    [-45, 98], [-20, 98], [0, 98], [20, 98], [45, 98],
  ];
  treeCoords.forEach(([tx, tz]) => {
    const tree = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.7, 3.5, 8), trunkMat);
    trunk.position.y = 2.75;
    const foliage = new THREE.Mesh(new THREE.DodecahedronGeometry(2.4), leavesMat);
    foliage.position.y = 5.5;
    tree.add(trunk, foliage);
    tree.position.set(tx, 0, tz);
    worldRoot.add(tree);
  });

  // 2. HONEY HIVE STATION & CONVERT PLATFORM (Spawn & Home Base)
  const hiveGroup = new THREE.Group();
  hiveGroup.position.set(0, 1.0, -14);

  // Central Honey Hive Tower
  const mainHive = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.8, 6.0, 6), hiveWoodMat);
  mainHive.position.set(0, 3.0, 0);
  const hiveRoof = new THREE.Mesh(new THREE.ConeGeometry(4.2, 2.5, 6), goldHiveMat);
  hiveRoof.position.set(0, 7.2, 0);
  hiveGroup.add(mainHive, hiveRoof);

  // Side Mini Hives
  const hiveL = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.6, 4.5, 6), hiveWoodMat);
  hiveL.position.set(-6.5, 2.25, 1.5);
  const hiveR = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.6, 4.5, 6), hiveWoodMat);
  hiveR.position.set(6.5, 2.25, 1.5);
  hiveGroup.add(hiveL, hiveR);
  worldRoot.add(hiveGroup);

  // Golden Honey Conversion Pad (Walk onto this to convert Pollen -> Honey!)
  const convertPadGeo = new THREE.BoxGeometry(10, 0.3, 7);
  const convertPadMat = new THREE.MeshStandardMaterial({
    color: 0xf59e0b,
    roughness: 0.3,
    metalness: 0.7,
    emissive: 0xd97706,
    emissiveIntensity: 0.5,
  });
  const convertPad = new THREE.Mesh(convertPadGeo, convertPadMat);
  convertPad.position.set(0, 1.15, -5.5);
  worldRoot.add(convertPad);

  // Honey Dripper & Jar Decor
  const honeyPot = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1.0, 1.6, 12), goldHiveMat);
  honeyPot.position.set(-4.5, 2.0, -5.5);
  worldRoot.add(honeyPot);

  // NPC: Beekeeper Boris (Пасечник Борис) standing near Hive
  const beekeeperNpc = new THREE.Group();
  beekeeperNpc.position.set(4.5, 1.0, -5.5);
  const bBody = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.6, 0.8), new THREE.MeshStandardMaterial({ color: 0x3b82f6 }));
  bBody.position.y = 1.6;
  const bHead = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.0, 1.0), new THREE.MeshStandardMaterial({ color: 0xfed7aa }));
  bHead.position.y = 2.9;
  const bHat = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.6, 0.4, 12), new THREE.MeshStandardMaterial({ color: 0xfef08a }));
  bHat.position.y = 3.6;
  beekeeperNpc.add(bBody, bHead, bHat);
  worldRoot.add(beekeeperNpc);

  // Hive bounds for auto-converting pollen to honey
  const hiveBounds = {
    minX: -6.0,
    maxX: 6.0,
    minZ: -9.5,
    maxZ: -2.0,
  };

  // Checkpoint 0: Base / Hive
  createCheckPointMesh(worldRoot, checkpoints, checkpointMeshes, 0, 'Медовый Улей (База)', 0, 1.2, -1.0, true);

  // 3. FOUR INTERACTIVE FLOWER FIELDS
  const flowerFields: FlowerFieldZone[] = [
    {
      id: 'field_sunflower',
      name: 'Поле Подсолнухов 🌻',
      flowerType: 'sunflower',
      color: '#facc15',
      pollenPerHarvest: 3,
      bounds: { minX: -48, maxX: -6, minZ: 10, maxZ: 48 },
    },
    {
      id: 'field_clover',
      name: 'Клеверная Поляна 🍀',
      flowerType: 'clover',
      color: '#4ade80',
      pollenPerHarvest: 4,
      bounds: { minX: 6, maxX: 48, minZ: 10, maxZ: 48 },
    },
    {
      id: 'field_rose',
      name: 'Розовый Сад 🌹',
      flowerType: 'rose',
      color: '#f43f5e',
      pollenPerHarvest: 6,
      bounds: { minX: -48, maxX: -6, minZ: 56, maxZ: 94 },
    },
    {
      id: 'field_dandelion',
      name: 'Одуванчиковая Долина 🌼',
      flowerType: 'dandelion',
      color: '#fbbf24',
      pollenPerHarvest: 5,
      bounds: { minX: 6, maxX: 48, minZ: 56, maxZ: 94 },
    },
  ];

  // Build 3D soil patches and colorful flower clusters in each field
  flowerFields.forEach((field) => {
    const width = field.bounds.maxX - field.bounds.minX;
    const depth = field.bounds.maxZ - field.bounds.minZ;
    const cx = (field.bounds.minX + field.bounds.maxX) / 2;
    const cz = (field.bounds.minZ + field.bounds.maxZ) / 2;

    // Soil Bed
    const soilMesh = new THREE.Mesh(new THREE.BoxGeometry(width, 0.2, depth), soilMat);
    soilMesh.position.set(cx, 1.05, cz);
    soilMesh.receiveShadow = true;
    worldRoot.add(soilMesh);

    // Flower clusters
    const flowerColor = new THREE.Color(field.color);
    const flowerMat = new THREE.MeshStandardMaterial({
      color: flowerColor,
      roughness: 0.3,
      emissive: flowerColor,
      emissiveIntensity: 0.25,
    });
    const stemMat = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.7 });

    const numFlowers = 24;
    for (let i = 0; i < numFlowers; i++) {
      const fx = cx + (Math.random() - 0.5) * (width - 4);
      const fz = cz + (Math.random() - 0.5) * (depth - 4);

      const fGroup = new THREE.Group();
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.8, 6), stemMat);
      stem.position.y = 0.4;

      let bloom: THREE.Mesh;
      if (field.flowerType === 'sunflower') {
        bloom = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.15, 8), flowerMat);
        const center = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.18, 8), soilMat);
        fGroup.add(center);
      } else if (field.flowerType === 'rose') {
        bloom = new THREE.Mesh(new THREE.DodecahedronGeometry(0.42), flowerMat);
      } else if (field.flowerType === 'clover') {
        bloom = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.12, 6, 8), flowerMat);
      } else {
        bloom = new THREE.Mesh(new THREE.SphereGeometry(0.38, 8, 8), flowerMat);
      }
      bloom.position.y = 0.85;

      fGroup.add(stem, bloom);
      fGroup.position.set(fx, 1.15, fz);
      worldRoot.add(fGroup);
    }
  });

  // Checkpoints at the 4 fields
  createCheckPointMesh(worldRoot, checkpoints, checkpointMeshes, 1, 'Поле Подсолнухов', -27, 1.2, 29, false);
  createCheckPointMesh(worldRoot, checkpoints, checkpointMeshes, 2, 'Клеверная Поляна', 27, 1.2, 29, false);
  createCheckPointMesh(worldRoot, checkpoints, checkpointMeshes, 3, 'Розовый Сад', -27, 1.2, 75, false);
  createCheckPointMesh(worldRoot, checkpoints, checkpointMeshes, 4, 'Одуванчиковая Долина', 27, 1.2, 75, false);
  createCheckPointMesh(worldRoot, checkpoints, checkpointMeshes, 5, 'Королевский Медовый Трон', 0, 1.2, 50, false);

  // Golden Bee Trophy in the center park
  const trophyMesh = createGoldenTrophy();
  trophyMesh.position.set(0, 1.2, 50);
  worldRoot.add(trophyMesh);
  dynamicRotators.push({ group: trophyMesh, speed: 1.5, axis: 'y' });

  // Practice Dummy
  const dummyMesh = createPracticeDummy();
  dummyMesh.position.set(0, 1.2, 10);
  worldRoot.add(dummyMesh);

  // Collectible Pollen Sparkles & Honey Drops (only 1 hyper-rare crystal spawn in center meadow)
  const beeCollectibles: [number, number, number, 'coin' | 'gem'][] = [
    [-27, 2.5, 29, 'coin'],
    [-20, 2.5, 38, 'coin'],
    [27, 2.5, 29, 'coin'],
    [20, 2.5, 38, 'coin'],
    [-27, 2.5, 75, 'coin'],
    [-35, 2.5, 68, 'coin'],
    [27, 2.5, 75, 'coin'],
    [35, 2.5, 82, 'coin'],
    [0, 3.0, 50, 'gem'],
    [-10, 2.5, -4, 'coin'],
    [10, 2.5, -4, 'coin'],
  ];

  beeCollectibles.forEach((item, idx) => {
    const id = `bee_drop_${idx}`;
    const isGem = item[3] === 'gem';
    const mesh = isGem ? createGemMesh() : createCoinMesh();
    mesh.position.set(item[0], item[1], item[2]);
    worldRoot.add(mesh);
    collectibleMeshes.set(id, mesh);
    collectibles.push({
      id,
      type: item[3],
      position: [item[0], item[1], item[2]],
      value: isGem ? 100 : 50,
      collected: false,
    });
    dynamicRotators.push({ group: mesh, speed: 2.2, axis: 'y' });
  });

  return {
    scene,
    worldRoot,
    gameId: 'bee_swarm',
    platforms,
    hazards,
    checkpoints,
    checkpointMeshes,
    collectibles,
    collectibleMeshes,
    dynamicRotators,
    placedBlockMeshes,
    trophyMesh,
    dummyMesh,
    flowerFields,
    hiveBounds,
  };
}

/**
 * Helper to create a golden brass plaque texture with the Door Number (0010 .. 0100)
 */
function createDoorNumberPlaqueTexture(num: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;

  // Brushed brass plate background
  const grad = ctx.createLinearGradient(0, 0, 256, 128);
  grad.addColorStop(0, '#fde047');
  grad.addColorStop(0.5, '#f59e0b');
  grad.addColorStop(1, '#b45309');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 128);

  // Dark inner border
  ctx.strokeStyle = '#451a03';
  ctx.lineWidth = 8;
  ctx.strokeRect(8, 8, 240, 112);

  // Rivets in corners
  ctx.fillStyle = '#451a03';
  [
    [22, 22],
    [234, 22],
    [22, 106],
    [234, 106],
  ].forEach(([rx, ry]) => {
    ctx.beginPath();
    ctx.arc(rx, ry, 6, 0, Math.PI * 2);
    ctx.fill();
  });

  // Formatted 4-digit hotel door number (e.g. 0010, 0100)
  const label = String(num).padStart(4, '0');
  ctx.fillStyle = '#1c1917';
  ctx.font = '900 64px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, 128, 66);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Creates a procedural wooden floorboards texture for the Hotel corridors
 */
function createHotelWoodPlankTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#3b2314';
  ctx.fillRect(0, 0, 256, 256);

  const plankCount = 8;
  const plankW = 256 / plankCount;
  for (let i = 0; i < plankCount; i++) {
    ctx.fillStyle = i % 2 === 0 ? '#432818' : '#361f12';
    ctx.fillRect(i * plankW, 0, plankW - 2, 256);
    ctx.fillStyle = '#1a0f08';
    ctx.fillRect((i + 1) * plankW - 2, 0, 2, 256);

    // Horizontal joint seam
    const seamY = (i * 73 + 40) % 256;
    ctx.fillRect(i * plankW, seamY, plankW, 2);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 36);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const plaqueMaterialCache = new Map<number, THREE.Material>();

function getCachedPlaqueMaterial(num: number): THREE.Material {
  if (plaqueMaterialCache.has(num)) {
    return plaqueMaterialCache.get(num)!;
  }
  const plaqueTex = createDoorNumberPlaqueTexture(num);
  const mat = new THREE.MeshStandardMaterial({
    map: plaqueTex,
    roughness: 0.3,
    metalness: 0.6,
    emissive: 0x78350f,
    emissiveIntensity: 0.35,
  });
  plaqueMaterialCache.set(num, mat);
  return mat;
}

/**
 * ============================================================================
 * GAME 4: ROBLOX DOORS — ПЕРВОЕ ЛИЦО (POV) ОТЕЛЬ УЖАСОВ И ДВЕРЬ 100
 * ============================================================================
 */
function createDoorsHotelWorld(scene: THREE.Scene, worldRoot: THREE.Group): WorldBuildResult {
  const platforms: THREE.Mesh[] = [];
  const hazards: ObstacleHazard[] = [];
  const checkpoints: Checkpoint[] = [];
  const checkpointMeshes: THREE.Group[] = [];
  const collectibles: CollectibleItem[] = [];
  const collectibleMeshes = new Map<string, THREE.Group>();
  const dynamicRotators: { group: THREE.Group; speed: number; axis: 'y' | 'z' }[] = [];
  const placedBlockMeshes = new Map<string, THREE.Mesh>();

  const doors: DoorsHotelDoor[] = [];
  const closets: DoorsCloset[] = [];
  const roomLightNodes: DoorsRoomLightNode[] = [];
  const eyesClusters: { group: THREE.Group; z: number; active: boolean }[] = [];

  // Materials
  const woodPlankTex = createHotelWoodPlankTexture();
  const woodFloorMat = new THREE.MeshStandardMaterial({
    map: woodPlankTex,
    roughness: 0.78,
    metalness: 0.08,
  });
  const carpetMat = new THREE.MeshStandardMaterial({
    color: 0x6b1118,
    roughness: 0.9,
  });
  const riftCarpetMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.85,
  });
  const carpetGoldTrimMat = new THREE.MeshStandardMaterial({
    color: 0xb45309,
    roughness: 0.6,
    metalness: 0.3,
  });
  const riftTrimMat = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    emissive: 0x0284c7,
    emissiveIntensity: 0.55,
    roughness: 0.4,
  });
  const wallpaperMat = new THREE.MeshStandardMaterial({
    color: 0x2b1d28,
    roughness: 0.85,
  });
  const wainscotMat = new THREE.MeshStandardMaterial({
    color: 0x26160c,
    roughness: 0.7,
  });
  const ceilingMat = new THREE.MeshStandardMaterial({
    color: 0x171214,
    roughness: 0.9,
  });
  const basementCeilingMat = new THREE.MeshStandardMaterial({
    color: 0x1f2937,
    roughness: 0.92,
  });
  const hospitalCeilingMat = new THREE.MeshStandardMaterial({
    color: 0xcbd5e1,
    roughness: 0.65,
  });
  const heavyDoorWoodMat = new THREE.MeshStandardMaterial({
    color: 0x452212,
    roughness: 0.6,
    metalness: 0.1,
  });
  const door100SteelMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    roughness: 0.4,
    metalness: 0.75,
  });
  const brassMat = new THREE.MeshStandardMaterial({
    color: 0xf59e0b,
    roughness: 0.25,
    metalness: 0.88,
    emissive: 0x78350f,
    emissiveIntensity: 0.2,
  });
  const closetWoodMat = new THREE.MeshStandardMaterial({
    color: 0x331b0e,
    roughness: 0.7,
  });
  const normalBulbMat = new THREE.MeshStandardMaterial({
    color: 0xfef08a,
    emissive: 0xf59e0b,
    emissiveIntensity: 1.4,
  });
  const darkBulbMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    emissive: 0x1e293b,
    emissiveIntensity: 0.15,
  });
  const powerBulbMat = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    emissive: 0x0284c7,
    emissiveIntensity: 1.4,
  });
  const hospitalBulbMat = new THREE.MeshStandardMaterial({
    color: 0xe0f2fe,
    emissive: 0xbae6fd,
    emissiveIntensity: 1.5,
  });
  const gardenBulbMat = new THREE.MeshStandardMaterial({
    color: 0x86efac,
    emissive: 0x22c55e,
    emissiveIntensity: 1.25,
  });

  // 1. BASE CORRIDOR & ZONE-SPECIFIC FLOORS, WALLS, AND CEILINGS
  const totalDoors = 100;
  const roomLength = 12;
  const totalLength = totalDoors * roomLength; // 1200 units

  const addPlat = (
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    mat: THREE.Material,
    surface: SurfaceType = 'wood'
  ) => createPlatform(worldRoot, platforms, x, y, z, w, h, d, mat, surface);

  // Continuous solid base floor (width 13 indoor, widened to 18 in Courtyard z=984..1080)
  createPlatform(worldRoot, platforms, 0, -1, 492, 13, 1, 984, woodFloorMat, 'wood');
  const courtyardStoneWalkMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.85 });
  const courtyardGrassMat = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.92 });
  const basementStoneMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.88, metalness: 0.12 });
  const greenhouseBrickMat = new THREE.MeshStandardMaterial({ color: 0x7c2d12, roughness: 0.88 });

  createPlatform(worldRoot, platforms, 0, -1, 1032, 18, 1, 96, courtyardStoneWalkMat, 'stone');
  createPlatform(worldRoot, platforms, 0, -1, 1140, 13, 1, 120, greenhouseBrickMat, 'stone');

  // Starter Wooden Elevator (ЛИФТ, z = -8..0) & Reception Lobby (СТОЙКА АДМИНИСТРАТОРА, z = 0..12)
  buildStarterElevatorAndReception(worldRoot, addPlat);
  roomLightNodes.push({
    x: 0,
    y: 6.8,
    z: -4.0,
    color: 0xffb74d,
    baseIntensity: 2.8,
    distance: 18,
  });

  // Decorative Zone Floors (Zero coplanar Z-fighting!)
  // Basement stone slab (Doors 31-38, z = 360..456)
  const stoneSlab1 = createPlatform(worldRoot, platforms, 0, -0.97, 408, 11.6, 1.0, 96, basementStoneMat, 'stone');
  stoneSlab1.castShadow = false;
  // Courtyard entrance flagstone (Doors 75-82, z = 888..984)
  const stoneSlabEnt = createPlatform(worldRoot, platforms, 0, -0.97, 936, 11.6, 1.0, 96, courtyardStoneWalkMat, 'stone');
  stoneSlabEnt.castShadow = false;

  // Courtyard cobblestone path & flanking green lawns (Doors 83-90, z = 984..1080)
  const courtGrassL = new THREE.Mesh(new THREE.BoxGeometry(6.6, 0.04, 96), courtyardGrassMat);
  courtGrassL.position.set(-5.7, 0.02, 1032);
  const courtGrassR = new THREE.Mesh(new THREE.BoxGeometry(6.6, 0.04, 96), courtyardGrassMat);
  courtGrassR.position.set(5.7, 0.02, 1032);
  const courtPath = new THREE.Mesh(new THREE.BoxGeometry(4.8, 0.05, 96), courtyardStoneWalkMat);
  courtPath.position.set(0, 0.025, 1032);
  worldRoot.add(courtGrassL, courtGrassR, courtPath);

  // Greenhouse planter lawns flanking brick garden walkway (Doors 91-99, z = 1080..1200)
  const ghGrassL = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.04, 120), courtyardGrassMat);
  ghGrassL.position.set(-4.3, 0.02, 1140);
  const ghGrassR = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.04, 120), courtyardGrassMat);
  ghGrassR.position.set(4.3, 0.02, 1140);
  worldRoot.add(ghGrassL, ghGrassR);

  // Hotel Velvet Runner Carpets ONLY in hotel-carpeted zones (NEVER in Basement, Infirmary, Courtyard, or Greenhouse!)
  const addCarpetStrip = (zStart: number, zEnd: number, bodyMat: THREE.Material, trimMat: THREE.Material) => {
    const len = zEnd - zStart;
    const zMid = (zStart + zEnd) / 2;
    const runner = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.05, len), bodyMat);
    runner.position.set(0, 0.025, zMid);
    runner.receiveShadow = true;
    const tL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.06, len), trimMat);
    tL.position.set(-2.15, 0.03, zMid);
    const tR = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.06, len), trimMat);
    tR.position.set(2.15, 0.03, zMid);
    worldRoot.add(runner, tL, tR);
  };
  addCarpetStrip(0, 360, carpetMat, carpetGoldTrimMat); // Doors 1-30
  addCarpetStrip(456, 672, carpetMat, carpetGoldTrimMat); // Doors 39-56
  addCarpetStrip(780, 888, riftCarpetMat, riftTrimMat); // Doors 66-74 (Mid-Rift)

  // Outer Side Walls per zone
  // Indoor corridor outer walls (z = 0..984 and z = 1080..1200)
  createPlatform(worldRoot, platforms, -6.5, 0, 492, 1, 9.5, 984, wallpaperMat);
  createPlatform(worldRoot, platforms, 6.5, 0, 492, 1, 9.5, 984, wallpaperMat);
  createPlatform(worldRoot, platforms, -6.5, 0, 1140, 1, 8.2, 120, courtyardStoneWalkMat);
  createPlatform(worldRoot, platforms, 6.5, 0, 1140, 1, 8.2, 120, courtyardStoneWalkMat);

  // Wide open Courtyard stone perimeter walls (z = 984..1080, x = ±9.0)
  createPlatform(worldRoot, platforms, -9.0, 0, 1032, 1, 9.5, 96, courtyardStoneWalkMat);
  createPlatform(worldRoot, platforms, 9.0, 0, 1032, 1, 9.5, 96, courtyardStoneWalkMat);

  // Lower dark oak wainscoting panels ONLY in classic hotel corridors
  const addWainscotSpan = (zStart: number, zEnd: number) => {
    const len = zEnd - zStart;
    const zMid = (zStart + zEnd) / 2;
    const wL = new THREE.Mesh(new THREE.BoxGeometry(0.24, 2.8, len), wainscotMat);
    wL.position.set(-5.9, 1.4, zMid);
    const wR = new THREE.Mesh(new THREE.BoxGeometry(0.24, 2.8, len), wainscotMat);
    wR.position.set(5.9, 1.4, zMid);
    worldRoot.add(wL, wR);
  };
  addWainscotSpan(0, 360);
  addWainscotSpan(456, 672);

  // Zone Ceilings (OPEN SKY above Courtyard 984..1080 and Glass Roof above Greenhouses 1080..1200!)
  const addCeilingSpan = (zStart: number, zEnd: number, y: number, mat: THREE.Material) => {
    const len = zEnd - zStart;
    const ceil = new THREE.Mesh(new THREE.BoxGeometry(13, 0.6, len), mat);
    ceil.position.set(0, y, (zStart + zEnd) / 2);
    worldRoot.add(ceil);
  };
  addCeilingSpan(0, 360, 9.5, ceilingMat); // Doors 1-30
  addCeilingSpan(360, 456, 8.4, basementCeilingMat); // Doors 31-38 Basement
  addCeilingSpan(456, 588, 9.5, ceilingMat); // Doors 39-49 Archives
  addCeilingSpan(588, 600, 11.4, ceilingMat); // Door 50 Library (high vaulted)
  addCeilingSpan(600, 672, 9.5, ceilingMat); // Doors 51-56 Jeff Shop
  addCeilingSpan(672, 780, 9.0, hospitalCeilingMat); // Doors 57-65 Infirmary
  addCeilingSpan(780, 984, 9.5, ceilingMat); // Doors 66-82 Mid-Rift & Courtyard Entrance

  // Night Sky Moon & Stars visible over Courtyard (z=984..1080) & Glass Greenhouse (z=1080..1200)
  const moonMesh = new THREE.Mesh(
    new THREE.SphereGeometry(5.2, 16, 16),
    new THREE.MeshBasicMaterial({ color: 0xe0f2fe })
  );
  moonMesh.position.set(16, 44, 1055);
  worldRoot.add(moonMesh);

  const starPositions = new Float32Array(240 * 3);
  for (let s = 0; s < 240; s++) {
    starPositions[s * 3] = (Math.random() - 0.5) * 140;
    starPositions[s * 3 + 1] = 32 + Math.random() * 26;
    starPositions[s * 3 + 2] = 965 + Math.random() * 260;
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
  const starPoints = new THREE.Points(
    starGeo,
    new THREE.PointsMaterial({ color: 0xe2e8f0, size: 0.45, sizeAttenuation: true })
  );
  worldRoot.add(starPoints);

  // Courtyard Falling Rain Streaks (z = 984..1080)
  const rainGroup = new THREE.Group();
  const rainCount = 260;
  const rainPositions = new Float32Array(rainCount * 3);
  for (let r = 0; r < rainCount; r++) {
    rainPositions[r * 3] = (Math.random() - 0.5) * 16;
    rainPositions[r * 3 + 1] = Math.random() * 14;
    rainPositions[r * 3 + 2] = 985 + Math.random() * 94;
  }
  const rainGeo = new THREE.BufferGeometry();
  rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPositions, 3));
  const rainPoints = new THREE.Points(
    rainGeo,
    new THREE.PointsMaterial({ color: 0x93c5fd, size: 0.22, transparent: true, opacity: 0.72 })
  );
  rainGroup.add(rainPoints);
  worldRoot.add(rainGroup);

  // 2. BUILD 100 CANONICAL HOTEL ROOM SEGMENTS ACROSS ALL 18 ROOM ARCHETYPES
  const invisibleColliderMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0 });
  const ironBarGateMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.85, roughness: 0.3 });

  for (let i = 0; i < totalDoors; i++) {
    const doorNum = i + 1;
    const zStart = i * roomLength;
    const zCenter = zStart + roomLength / 2;
    const zDoor = (i + 1) * roomLength;

    const isFlooded = doorNum >= 31 && doorNum <= 38;
    const isInfirmary = doorNum >= 57 && doorNum <= 65;
    const isMidRift = doorNum >= 66 && doorNum <= 74;
    const isCourtyard = doorNum >= 83 && doorNum <= 90;
    const isGreenhouse = doorNum >= 91 && doorNum <= 99;
    const isPowerPlant = doorNum >= 95;

    // Build all 18 room decorations & architectural elements from doorsRooms.ts
    if (doorNum >= 2) {
      buildThematicDoorsRoomSegment(worldRoot, doorNum, zStart, zCenter, zDoor, addPlat);
    }

    // Partition walls on Left & Right of the doorway at zDoor
    if (isCourtyard) {
      createPlatform(worldRoot, platforms, -5.4, 0, zDoor, 6.2, 7.6, 0.85, courtyardStoneWalkMat);
      createPlatform(worldRoot, platforms, 5.4, 0, zDoor, 6.2, 7.6, 0.85, courtyardStoneWalkMat);
    } else {
      const partMat = isInfirmary ? hospitalCeilingMat : isGreenhouse ? courtyardStoneWalkMat : wallpaperMat;
      createPlatform(worldRoot, platforms, -4.15, 0, zDoor, 3.7, 8.6, 0.8, partMat);
      createPlatform(worldRoot, platforms, 4.15, 0, zDoor, 3.7, 8.6, 0.8, partMat);

      const transom = new THREE.Mesh(
        new THREE.BoxGeometry(4.6, 1.8, 0.8),
        isCourtyard || isGreenhouse ? courtyardStoneWalkMat : wainscotMat
      );
      transom.position.set(0, 7.9, zDoor);
      worldRoot.add(transom);
    }

    // Door frame trim
    const frameMat = isCourtyard || isGreenhouse ? courtyardStoneWalkMat : isInfirmary ? door100SteelMat : wainscotMat;
    const frameL = new THREE.Mesh(new THREE.BoxGeometry(0.3, 7.2, 1.0), frameMat);
    frameL.position.set(-2.3, 3.6, zDoor);
    const frameR = new THREE.Mesh(new THREE.BoxGeometry(0.3, 7.2, 1.0), frameMat);
    frameR.position.set(2.3, 3.6, zDoor);
    worldRoot.add(frameL, frameR);

    // Massive Hinged Wooden / Iron-Gate / Steel Door
    const hingeGroup = new THREE.Group();
    hingeGroup.position.set(-2.2, 0, zDoor);
    worldRoot.add(hingeGroup);

    const isDoor100 = doorNum === 100;
    const isIronGateDoor = doorNum >= 95 && doorNum <= 99;
    if (isIronGateDoor) {
      // Hinged iron-bar gate door (bars swing open WITH the door instead of blocking the corridor!)
      const topRail = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.35, 0.24), ironBarGateMat);
      topRail.position.set(2.2, 6.85, 0);
      const midRail = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.25, 0.22), ironBarGateMat);
      midRail.position.set(2.2, 3.5, 0);
      const botRail = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.4, 0.24), ironBarGateMat);
      botRail.position.set(2.2, 0.2, 0);
      hingeGroup.add(topRail, midRail, botRail);
      for (let b = 0; b <= 6; b++) {
        const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 6.8, 6), ironBarGateMat);
        bar.position.set(0.25 + b * 0.65, 3.4, 0);
        hingeGroup.add(bar);
      }
    } else {
      const doorMat = isDoor100 ? door100SteelMat : heavyDoorWoodMat;
      const doorLeaf = new THREE.Mesh(new THREE.BoxGeometry(4.4, 7.0, 0.36), doorMat);
      doorLeaf.position.set(2.2, 3.5, 0);
      doorLeaf.castShadow = false;
      doorLeaf.receiveShadow = false;
      hingeGroup.add(doorLeaf);

      const panelMat = isDoor100 ? brassMat : wainscotMat;
      const topPanel = new THREE.Mesh(new THREE.BoxGeometry(3.4, 2.2, 0.44), panelMat);
      topPanel.position.set(2.2, 5.2, 0);
      const botPanel = new THREE.Mesh(new THREE.BoxGeometry(3.4, 2.4, 0.44), panelMat);
      botPanel.position.set(2.2, 1.8, 0);
      hingeGroup.add(topPanel, botPanel);
    }

    // Golden Brass Door Handle
    const handleGroup = new THREE.Group();
    handleGroup.position.set(3.8, 3.3, 0);
    const handleBar = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.9, 8), brassMat);
    handleBar.rotation.x = Math.PI / 2;
    const knobFront = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 10), brassMat);
    knobFront.position.z = -0.45;
    const knobBack = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 10), brassMat);
    knobBack.position.z = 0.45;
    handleGroup.add(handleBar, knobFront, knobBack);
    hingeGroup.add(handleGroup);

    // Golden Number Plaque (0001 .. 0100)
    const plaqueMat = getCachedPlaqueMaterial(doorNum);
    const plaqueMeshFront = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.8, 0.06), plaqueMat);
    plaqueMeshFront.position.set(2.2, 5.2, -0.24);
    const plaqueMeshBack = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.8, 0.06), plaqueMat);
    plaqueMeshBack.position.set(2.2, 5.2, 0.24);
    hingeGroup.add(plaqueMeshFront, plaqueMeshBack);

    // Physical collision barrier while door is closed
    const colliderMesh = createPlatform(worldRoot, platforms, 0, 0, zDoor, 4.4, 7.0, 0.7, invisibleColliderMat);

    // Event assignment for canonical monsters and rooms across 100 doors
    let eventOnOpen: DoorsHotelDoor['eventOnOpen'] = undefined;
    if (doorNum === 15 || doorNum === 35 || doorNum === 62 || doorNum === 95) eventOnOpen = 'rush';
    else if (doorNum === 20 || doorNum === 44 || doorNum === 78) eventOnOpen = 'screech';
    else if (doorNum === 25 || doorNum === 58 || doorNum === 88) eventOnOpen = 'eyes';
    else if (doorNum === 32 || doorNum === 68) eventOnOpen = 'silence';
    else if (doorNum === 48 || doorNum === 92) eventOnOpen = 'gloom';
    else if (doorNum === 100) eventOnOpen = 'figure_room';

    doors.push({
      index: i,
      doorNumber: doorNum,
      z: zDoor,
      hingeGroup,
      colliderMesh,
      isOpen: false,
      targetRotY: 0,
      eventOnOpen,
    });

    // Damp basement water puddle effect (cleanly above basement stone slab at y=0.05)
    if (isFlooded && i % 2 === 0) {
      const waterMat = new THREE.MeshStandardMaterial({
        color: 0x0284c7,
        roughness: 0.1,
        metalness: 0.8,
        transparent: true,
        opacity: 0.55,
      });
      const waterPool = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.03, 7.5), waterMat);
      waterPool.position.set(0, 0.05, zCenter);
      worldRoot.add(waterPool);
    }

    // Chandelier / Room Light Fixture + Light Node (used by the 4-light dynamic follower pool!)
    const isDarkRoom = doorNum === 20 || doorNum === 44 || doorNum === 78;
    const bulbMat = isDarkRoom
      ? darkBulbMat
      : isInfirmary
      ? hospitalBulbMat
      : isMidRift || isPowerPlant
      ? powerBulbMat
      : isFlooded
      ? gardenBulbMat
      : normalBulbMat;

    let bulbMesh: THREE.Mesh;
    if (!isCourtyard && !isGreenhouse) {
      const chandelierGroup = new THREE.Group();
      chandelierGroup.position.set(0, isFlooded ? 7.8 : doorNum === 50 ? 10.2 : 8.8, zCenter);
      const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.9, 6), brassMat);
      rod.position.y = 0.25;
      bulbMesh = new THREE.Mesh(new THREE.SphereGeometry(0.38, 10, 10), bulbMat);
      bulbMesh.position.y = -0.2;
      chandelierGroup.add(rod, bulbMesh);
      worldRoot.add(chandelierGroup);
    } else {
      // Outdoor Courtyard & Greenhouse use overhead moon/lantern lighting without hanging hotel rods
      bulbMesh = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 8), isCourtyard ? hospitalBulbMat : gardenBulbMat);
      bulbMesh.position.set(0, isCourtyard ? 8.2 : 8.8, zCenter);
      worldRoot.add(bulbMesh);
    }

    const nodeColor = isDarkRoom
      ? 0x64748b
      : isInfirmary
      ? 0xe0f2fe
      : isMidRift || isPowerPlant
      ? 0x38bdf8
      : isFlooded
      ? 0x4ade80
      : isCourtyard
      ? 0x93c5fd
      : 0xffb74d;
    const baseIntensity = isDarkRoom ? 0.55 : isCourtyard ? 3.2 : isPowerPlant ? 3.0 : 2.9;

    roomLightNodes.push({
      x: 0,
      y: isCourtyard ? 7.5 : 7.8,
      z: zCenter,
      color: nodeColor,
      baseIntensity,
      distance: 32,
      bulbMesh,
    });

    // Closets for hiding from Rush (avoid overlapping specialty landmarks in Lobby/Invitation/Library/Jeff/Courtyard)
    const addCloset = (side: 'left' | 'right', zPos: number) => {
      const closetGroup = new THREE.Group();
      const xPos = side === 'left' ? -5.05 : 5.05;
      closetGroup.position.set(xPos, 0, zPos);

      const body = new THREE.Mesh(new THREE.BoxGeometry(1.7, 6.2, 2.8), closetWoodMat);
      body.position.y = 3.1;
      body.castShadow = false;

      const doorFaceX = side === 'left' ? 0.88 : -0.88;
      const slats = new THREE.Mesh(new THREE.BoxGeometry(0.1, 5.4, 2.4), brassMat);
      slats.position.set(doorFaceX, 3.1, 0);

      closetGroup.add(body, slats);
      worldRoot.add(closetGroup);

      closets.push({
        id: `closet_${i}_${side}`,
        position: [xPos, 0, zPos],
        side,
        mesh: closetGroup,
      });
    };

    if (
      doorNum >= 3 &&
      doorNum !== 50 &&
      doorNum !== 51 &&
      doorNum !== 52 &&
      !isCourtyard &&
      i % 2 === 0
    ) {
      addCloset('left', zStart + 8.6);
      addCloset('right', zStart + 4.4);
    }

    // Gold Coins along rooms
    if (i % 2 === 0) {
      const coinId = `doors_gold_${i}`;
      const coinMesh = createCoinMesh();
      coinMesh.position.set(i % 4 === 0 ? -2.4 : 2.4, 1.6, zCenter);
      worldRoot.add(coinMesh);
      collectibleMeshes.set(coinId, coinMesh);
      collectibles.push({
        id: coinId,
        type: 'coin',
        position: [coinMesh.position.x, coinMesh.position.y, coinMesh.position.z],
        value: 25,
        collected: false,
      });
      dynamicRotators.push({ group: coinMesh, speed: 2.2, axis: 'y' });
    }
  }

  // Create 4 pooled PointLights that smoothly illuminate whichever rooms are closest to the player
  const corridorLightPool: THREE.PointLight[] = [];
  for (let p = 0; p < 4; p++) {
    const pLight = new THREE.PointLight(0xffb74d, 2.9, 34, 1.35);
    pLight.position.set(0, 7.8, 6 + p * 12);
    worldRoot.add(pLight);
    corridorLightPool.push(pLight);
  }

  // Checkpoints along the 100-door journey
  createCheckPointMesh(worldRoot, checkpoints, checkpointMeshes, 0, 'Стойка Администратора (Дверь 0001)', 0, 0.1, 2, true);
  createCheckPointMesh(worldRoot, checkpoints, checkpointMeshes, 1, 'Заросший Подвал (Дверь 0031)', 0, 0.1, 362, false);
  createCheckPointMesh(worldRoot, checkpoints, checkpointMeshes, 2, 'Библиотека и Магазин Джеффа (Дверь 0050)', 0, 0.1, 594, false);
  createCheckPointMesh(worldRoot, checkpoints, checkpointMeshes, 3, 'Внутренний Двор и Оранжерея (Дверь 0090)', 0, 0.1, 1074, false);
  createCheckPointMesh(worldRoot, checkpoints, checkpointMeshes, 4, 'Дверь 0100: Финальная Электрощитовая', 0, 0.1, 1204, false);

  // 3. BUILD MONSTER ENTITIES: RUSH, EYES, SCREECH
  const rushMesh = new THREE.Group();
  rushMesh.name = 'DoorsRushEntity';
  rushMesh.position.set(0, -100, 0);

  const rushCore = new THREE.Mesh(
    new THREE.SphereGeometry(2.4, 20, 20),
    new THREE.MeshStandardMaterial({
      color: 0x09090b,
      emissive: 0x18181b,
      roughness: 0.9,
    })
  );
  rushMesh.add(rushCore);

  const rushEyeMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const rushMouthMat = new THREE.MeshBasicMaterial({ color: 0xe2e8f0 });
  [-1, 1].forEach((dirZ) => {
    const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.42, 10, 10), rushEyeMat);
    eyeL.position.set(-0.85, 0.55, dirZ * 2.15);
    const eyeR = new THREE.Mesh(new THREE.SphereGeometry(0.42, 10, 10), rushEyeMat);
    eyeR.position.set(0.85, 0.55, dirZ * 2.15);
    const mouth = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.1, 0.3), rushMouthMat);
    mouth.position.set(0, -0.65, dirZ * 2.15);
    rushMesh.add(eyeL, eyeR, mouth);
  });

  const rushLight = new THREE.PointLight(0x94a3b8, 0, 22);
  rushMesh.add(rushLight);
  worldRoot.add(rushMesh);

  // Eyes clusters across rooms (Doors 25, 58, 88) — emissive meshes without wasting extra PointLights
  [294, 690, 1050].forEach((zEye) => {
    const eyesGroup = new THREE.Group();
    eyesGroup.position.set(0, 4.2, zEye);

    const coreAura = new THREE.Mesh(
      new THREE.SphereGeometry(1.6, 16, 16),
      new THREE.MeshStandardMaterial({
        color: 0x3b0764,
        emissive: 0x7e22ce,
        emissiveIntensity: 1.2,
        roughness: 0.45,
      })
    );
    eyesGroup.add(coreAura);

    const eyeGlowMat = new THREE.MeshBasicMaterial({ color: 0xc084fc });
    const pupilMat = new THREE.MeshBasicMaterial({ color: 0xffffff });

    for (let e = 0; e < 14; e++) {
      const angle = (e / 14) * Math.PI * 2;
      const radius = 0.7 + (e % 3) * 0.45;
      const ex = Math.cos(angle) * radius;
      const ey = Math.sin(angle) * radius * 0.8;
      const ez = (Math.random() - 0.5) * 0.8;

      const eyeBall = new THREE.Mesh(new THREE.SphereGeometry(0.24, 8, 8), eyeGlowMat);
      eyeBall.position.set(ex, ey, ez);
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.11, 6, 6), pupilMat);
      pupil.position.set(ex, ey, ez - 0.18);
      eyesGroup.add(eyeBall, pupil);
    }

    worldRoot.add(eyesGroup);
    eyesClusters.push({ group: eyesGroup, z: zEye, active: true });
  });

  // Screech entity
  const screechMesh = new THREE.Group();
  screechMesh.name = 'DoorsScreechEntity';
  screechMesh.position.set(0, -100, 0);

  const sBody = new THREE.Mesh(
    new THREE.SphereGeometry(0.75, 14, 14),
    new THREE.MeshStandardMaterial({ color: 0x09090b, roughness: 0.4 })
  );
  const sEyeMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const sEyeL = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 8), sEyeMat);
  sEyeL.position.set(-0.26, 0.16, -0.66);
  const sEyeR = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 8), sEyeMat);
  sEyeR.position.set(0.26, 0.16, -0.66);
  const sSmile = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.12, 0.1), sEyeMat);
  sSmile.position.set(0, -0.18, -0.68);
  screechMesh.add(sBody, sEyeL, sEyeR, sSmile);

  for (let t = 0; t < 6; t++) {
    const a = (t / 6) * Math.PI * 2;
    const tentacle = new THREE.Mesh(
      new THREE.ConeGeometry(0.12, 1.2, 6),
      new THREE.MeshStandardMaterial({ color: 0x09090b })
    );
    tentacle.position.set(Math.cos(a) * 0.85, Math.sin(a) * 0.85, 0.2);
    tentacle.rotation.z = a - Math.PI / 2;
    screechMesh.add(tentacle);
  }
  worldRoot.add(screechMesh);

  // 4. DOOR 0100: TWO-STORY ELECTRICAL ROOM (ЭЛЕКТРОЩИТОВАЯ), FIGURE & CARGO ELEVATOR
  const concreteMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.85 });
  const steelDeckMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.5, metalness: 0.6 });
  const hazardYellowMat = new THREE.MeshStandardMaterial({
    color: 0xfacc15,
    emissive: 0xca8a04,
    emissiveIntensity: 0.3,
  });

  const roomStartZ = totalLength; // 1200
  createPlatform(worldRoot, platforms, 0, -1, roomStartZ + 45, 38, 1, 92, concreteMat, 'stone');

  createPlatform(worldRoot, platforms, -19, 0, roomStartZ + 45, 1, 20, 90, concreteMat);
  createPlatform(worldRoot, platforms, 19, 0, roomStartZ + 45, 1, 20, 90, concreteMat);
  createPlatform(worldRoot, platforms, 0, 0, roomStartZ + 90, 38, 20, 1, concreteMat);
  createPlatform(worldRoot, platforms, -12.5, 0, roomStartZ, 13, 20, 1, concreteMat);
  createPlatform(worldRoot, platforms, 12.5, 0, roomStartZ, 13, 20, 1, concreteMat);

  decorateFinalElectricalRoom(worldRoot, roomStartZ);

  const elecCeiling = new THREE.Mesh(new THREE.BoxGeometry(38, 1, 90), ceilingMat);
  elecCeiling.position.set(0, 20, roomStartZ + 45);
  worldRoot.add(elecCeiling);

  // Add Electrical Room light nodes into the pooled light system (zero extra PointLights!)
  roomLightNodes.push(
    { x: -10, y: 8.5, z: roomStartZ + 20, color: 0xef4444, baseIntensity: 3.4, distance: 38 },
    { x: 10, y: 8.5, z: roomStartZ + 25, color: 0x38bdf8, baseIntensity: 3.2, distance: 38 },
    { x: 0, y: 15.0, z: roomStartZ + 62, color: 0xfacc15, baseIntensity: 3.8, distance: 42 },
    { x: 0, y: 14.5, z: roomStartZ + 74, color: 0xfef08a, baseIntensity: 3.6, distance: 34 }
  );

  // Stairs to 2nd floor on the right side (x = 13.5, z = roomStartZ + 10 .. roomStartZ + 44)
  for (let step = 0; step < 16; step++) {
    const stepY = (step + 1) * 0.5;
    const stepZ = roomStartZ + 10 + step * 2.2;
    createPlatform(
      worldRoot,
      platforms,
      13.5,
      stepY - 0.5,
      stepZ,
      7.0,
      0.5,
      2.4,
      step % 2 === 0 ? steelDeckMat : hazardYellowMat,
      'stone'
    );
  }

  // 2nd Floor Mezzanine (z = roomStartZ + 43 .. roomStartZ + 88)
  createPlatform(worldRoot, platforms, 0, 7.5, roomStartZ + 65, 36, 0.5, 46, steelDeckMat, 'stone');

  // Figure Monster patrolling 1st floor of Electrical Room
  const figureGroup = new THREE.Group();
  figureGroup.name = 'DoorsFigureMonster';
  figureGroup.position.set(-4, 0, roomStartZ + 25);

  const fleshMat = new THREE.MeshStandardMaterial({ color: 0x7f1d1d, roughness: 0.55 });
  const ribMat = new THREE.MeshStandardMaterial({ color: 0xfecaca, roughness: 0.4 });
  const mouthDarkMat = new THREE.MeshBasicMaterial({ color: 0x09090b });

  const figLeftLeg = new THREE.Mesh(new THREE.BoxGeometry(0.85, 2.8, 0.85), fleshMat);
  figLeftLeg.position.set(-0.7, 1.4, 0);
  const figRightLeg = new THREE.Mesh(new THREE.BoxGeometry(0.85, 2.8, 0.85), fleshMat);
  figRightLeg.position.set(0.7, 1.4, 0);

  const figTorso = new THREE.Mesh(new THREE.BoxGeometry(2.2, 2.8, 1.3), fleshMat);
  figTorso.position.set(0, 4.1, 0);
  for (let r = 0; r < 4; r++) {
    const rib = new THREE.Mesh(new THREE.BoxGeometry(2.35, 0.18, 1.4), ribMat);
    rib.position.set(0, 3.2 + r * 0.5, 0);
    figureGroup.add(rib);
  }

  const figLeftArm = new THREE.Mesh(new THREE.BoxGeometry(0.7, 3.6, 0.7), fleshMat);
  figLeftArm.position.set(-1.55, 3.5, 0);
  const figRightArm = new THREE.Mesh(new THREE.BoxGeometry(0.7, 3.6, 0.7), fleshMat);
  figRightArm.position.set(1.55, 3.5, 0);

  const figHead = new THREE.Mesh(new THREE.SphereGeometry(1.15, 16, 16), fleshMat);
  figHead.position.set(0, 6.2, 0.2);
  const figMouth = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.75, 0.4, 14), mouthDarkMat);
  figMouth.rotation.x = Math.PI / 2;
  figMouth.position.set(0, 6.2, 1.05);
  const figRing = new THREE.Mesh(new THREE.TorusGeometry(0.78, 0.14, 8, 16), ribMat);
  figRing.position.set(0, 6.2, 1.2);

  const figGlow = new THREE.PointLight(0xef4444, 0, 16);
  figGlow.position.set(0, 5.5, 0);

  figureGroup.add(figLeftLeg, figRightLeg, figTorso, figLeftArm, figRightArm, figHead, figMouth, figRing, figGlow);
  worldRoot.add(figureGroup);

  // Cargo Elevator on 2nd floor of Door 100 (z = roomStartZ + 72 = 1272)
  const elevatorGroup = new THREE.Group();
  elevatorGroup.position.set(0, 8.0, roomStartZ + 72);

  const cageMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.4, metalness: 0.8 });
  const elevFloor = new THREE.Mesh(new THREE.BoxGeometry(8, 0.3, 8), hazardYellowMat);
  elevFloor.position.y = 0.15;
  const elevRoof = new THREE.Mesh(new THREE.BoxGeometry(8, 0.4, 8), cageMat);
  elevRoof.position.y = 7.2;
  const elevBack = new THREE.Mesh(new THREE.BoxGeometry(8, 7.2, 0.4), cageMat);
  elevBack.position.set(0, 3.6, 3.8);
  const elevWallL = new THREE.Mesh(new THREE.BoxGeometry(0.4, 7.2, 8), cageMat);
  elevWallL.position.set(-3.8, 3.6, 0);
  const elevWallR = new THREE.Mesh(new THREE.BoxGeometry(0.4, 7.2, 8), cageMat);
  elevWallR.position.set(3.8, 3.6, 0);

  const leftDoor = new THREE.Mesh(new THREE.BoxGeometry(3.8, 7.0, 0.35), door100SteelMat);
  leftDoor.position.set(-3.6, 3.5, -3.8);
  const rightDoor = new THREE.Mesh(new THREE.BoxGeometry(3.8, 7.0, 0.35), door100SteelMat);
  rightDoor.position.set(3.6, 3.5, -3.8);

  const buttonBox = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.2, 0.8), cageMat);
  buttonBox.position.set(3.4, 3.4, -1.2);
  const buttonMesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.28, 12, 12),
    new THREE.MeshStandardMaterial({
      color: 0x22c55e,
      emissive: 0x16a34a,
      emissiveIntensity: 1.5,
    })
  );
  buttonMesh.position.set(3.15, 3.4, -1.2);

  elevatorGroup.add(elevFloor, elevRoof, elevBack, elevWallL, elevWallR, leftDoor, rightDoor, buttonBox, buttonMesh);
  worldRoot.add(elevatorGroup);

  const trophyMesh = createGoldenTrophy();
  trophyMesh.position.set(0, 8.3, roomStartZ + 73.5);
  worldRoot.add(trophyMesh);

  const dummyMesh = createPracticeDummy();
  dummyMesh.position.set(0, -100, 0);
  worldRoot.add(dummyMesh);

  const jeffShopPositions: [number, number, number][] = [
    [-2.8, 0, 50 * roomLength + 6], // Door 51 (startDoor!)
    [-2.8, 0, 51 * roomLength + 6], // Door 52
    [-2.8, 0, 53 * roomLength + 6], // Door 54
  ];
  const infirmaryHerbPositions: [number, number, number][] = [
    [-2.8, 0, 56 * roomLength + 6], // Door 57 (startDoor!)
    [-2.8, 0, 59 * roomLength + 6], // Door 60
  ];
  const riftPositions: [number, number, number][] = [
    [3.2, 0, 65 * roomLength + 6], // Door 66 (startDoor!)
    [3.2, 0, 69 * roomLength + 6], // Door 70
  ];

  return {
    scene,
    worldRoot,
    gameId: 'doors',
    platforms,
    hazards,
    checkpoints,
    checkpointMeshes,
    collectibles,
    collectibleMeshes,
    dynamicRotators,
    placedBlockMeshes,
    trophyMesh,
    dummyMesh,
    doorsData: {
      doors,
      closets,
      corridorLightPool,
      roomLightNodes,
      rainGroup,
      rushMesh,
      rushLight,
      eyesClusters,
      screechMesh,
      figureMonster: {
        group: figureGroup,
        leftLeg: figLeftLeg,
        rightLeg: figRightLeg,
        leftArm: figLeftArm,
        rightArm: figRightArm,
        glowLight: figGlow,
      },
      cargoElevator: {
        group: elevatorGroup,
        leftDoor,
        rightDoor,
        buttonMesh,
        position: [0, 8.0, roomStartZ + 72],
      },
      roomStartZ,
      jeffShopPos: jeffShopPositions[0],
      jeffShopPositions,
      infirmaryHerbPos: infirmaryHerbPositions[0],
      infirmaryHerbPositions,
      riftPos: riftPositions[0],
      riftPositions,
    },
  };
}

/**
 * ============================================================================
 * GAME 5: BLOX STUDIO 3D (SANDBOX LEVEL EDITOR + PLAYTEST WORLD)
 * ============================================================================
 */
let cachedStudioStudTexture: THREE.CanvasTexture | null = null;
function getStudioStudTexture(): THREE.CanvasTexture {
  if (!cachedStudioStudTexture) {
    cachedStudioStudTexture = createStudTexture();
  }
  return cachedStudioStudTexture;
}

export function createStudioMaterial(
  colorHex: string,
  materialKind: StudioMaterialKind
): THREE.MeshStandardMaterial {
  const color = new THREE.Color(colorHex || '#38bdf8');
  const studTexture = getStudioStudTexture();

  switch (materialKind) {
    case 'neon':
      return new THREE.MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: 0.75,
        roughness: 0.18,
        metalness: 0.1,
      });
    case 'glass':
      return new THREE.MeshStandardMaterial({
        color,
        transparent: true,
        opacity: 0.58,
        roughness: 0.08,
        metalness: 0.15,
      });
    case 'wood':
      return new THREE.MeshStandardMaterial({
        color,
        roughness: 0.85,
        metalness: 0.02,
      });
    case 'metal':
      return new THREE.MeshStandardMaterial({
        color,
        roughness: 0.25,
        metalness: 0.8,
      });
    case 'plastic':
    default:
      return new THREE.MeshStandardMaterial({
        color,
        roughness: 0.45,
        metalness: 0.08,
        map: studTexture,
      });
  }
}

function tagStudioObjectRecursive(root: THREE.Object3D, studioObjectId: string) {
  root.userData.studioObjectId = studioObjectId;
  root.traverse((child) => {
    child.userData.studioObjectId = studioObjectId;
  });
}

function buildSingleStudioObject(
  worldData: WorldBuildResult,
  obj: StudioObject,
  checkpointIndexRef: { nextId: number },
  hasTrophyRef: { found: boolean }
) {
  const studioGroup = worldData.studioGroup;
  if (!studioGroup) return;

  const [x, baseY, z] = obj.position;
  const [w, h, d] = obj.size;
  const [effW, effH, effD] = getRotatedStudioFootprint(obj.size, obj.rotationY);
  const radY = THREE.MathUtils.degToRad(obj.rotationY);
  const surfaceType: SurfaceType = obj.material === 'wood' ? 'wood' : 'stone';

  if (obj.kind === 'block') {
    const mat = createStudioMaterial(obj.color, obj.material);
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    mesh.position.set(x, baseY + h / 2, z);
    mesh.rotation.y = radY;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData = { width: effW, height: effH, depth: effD, surfaceType, studioObjectId: obj.id };
    worldData.platforms.push(mesh);
    studioGroup.add(mesh);
    worldData.studioObjectMeshes?.set(obj.id, mesh);
    return;
  }

  if (obj.kind === 'ramp') {
    const mat = createStudioMaterial(obj.color, obj.material);
    const rampGroup = new THREE.Group();
    const steps = 4;
    const stepH = h / steps;
    const stepD = d / steps;
    const cos = Math.cos(radY);
    const sin = Math.sin(radY);

    for (let i = 0; i < steps; i++) {
      const currH = stepH * (i + 1);
      const localZ = -d / 2 + stepD * (i + 0.5);
      // Rotate local (0, localZ) around Y by radY: worldX = x + localZ * sin, worldZ = z + localZ * cos
      const stepWorldX = x + localZ * sin;
      const stepWorldZ = z + localZ * cos;
      const [sEffW, , sEffD] = getRotatedStudioFootprint([w, currH, stepD], obj.rotationY);

      const stepMesh = new THREE.Mesh(new THREE.BoxGeometry(w, currH, stepD), mat);
      stepMesh.position.set(stepWorldX, baseY + currH / 2, stepWorldZ);
      stepMesh.rotation.y = radY;
      stepMesh.castShadow = true;
      stepMesh.receiveShadow = true;
      stepMesh.userData = {
        width: sEffW,
        height: currH,
        depth: sEffD,
        surfaceType,
        studioObjectId: obj.id,
      };
      worldData.platforms.push(stepMesh);
      rampGroup.add(stepMesh);
    }

    tagStudioObjectRecursive(rampGroup, obj.id);
    studioGroup.add(rampGroup);
    worldData.studioObjectMeshes?.set(obj.id, rampGroup);
    return;
  }

  if (obj.kind === 'lava') {
    const mat = createStudioMaterial(obj.color, 'neon');
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    mesh.position.set(x, baseY + h / 2, z);
    mesh.rotation.y = radY;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData = { width: effW, height: effH, depth: effD, surfaceType: 'stone', studioObjectId: obj.id };
    worldData.platforms.push(mesh);
    worldData.hazards.push({
      id: `studio_lava_${obj.id}`,
      type: 'lava',
      mesh,
      damage: 100,
      active: true,
    });
    studioGroup.add(mesh);
    worldData.studioObjectMeshes?.set(obj.id, mesh);
    return;
  }

  if (obj.kind === 'trampoline') {
    const group = new THREE.Group();
    const mat = createStudioMaterial(obj.color, 'neon');
    const pad = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    pad.position.set(x, baseY + h / 2, z);
    pad.rotation.y = radY;
    pad.castShadow = true;
    pad.receiveShadow = true;
    pad.userData = { width: effW, height: effH, depth: effD, surfaceType: 'stone', studioObjectId: obj.id };

    const rimMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, metalness: 0.7, roughness: 0.25 });
    const rim = new THREE.Mesh(new THREE.BoxGeometry(w * 0.72, h + 0.08, d * 0.72), rimMat);
    rim.position.set(x, baseY + h / 2 + 0.04, z);
    rim.rotation.y = radY;

    group.add(pad, rim);
    tagStudioObjectRecursive(group, obj.id);
    worldData.platforms.push(pad);
    worldData.hazards.push({
      id: `studio_trampoline_${obj.id}`,
      type: 'trampoline',
      mesh: pad,
      damage: 0,
      active: true,
    });
    studioGroup.add(group);
    worldData.studioObjectMeshes?.set(obj.id, group);
    return;
  }

  if (obj.kind === 'spinner') {
    const spinGroup = new THREE.Group();
    spinGroup.position.set(x, baseY + h / 2, z);
    spinGroup.rotation.y = radY;

    const barMat = createStudioMaterial(obj.color, 'neon');
    const barMesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), barMat);
    barMesh.castShadow = true;
    const hubMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.65, 0.75, h + 0.3, 12),
      new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.85, roughness: 0.2 })
    );
    spinGroup.add(barMesh, hubMesh);
    tagStudioObjectRecursive(spinGroup, obj.id);

    worldData.hazards.push({
      id: `studio_spinner_${obj.id}`,
      type: 'spinner',
      mesh: barMesh,
      damage: 45,
      active: true,
    });
    worldData.dynamicRotators.push({ group: spinGroup, speed: 1.5, axis: 'y' });
    studioGroup.add(spinGroup);
    worldData.studioObjectMeshes?.set(obj.id, spinGroup);
    return;
  }

  if (obj.kind === 'checkpoint') {
    const cpId = checkpointIndexRef.nextId++;
    worldData.checkpoints.push({
      id: cpId,
      name: `Точка #${cpId}`,
      position: [x, baseY + h, z],
      activated: false,
    });

    const cpGroup = new THREE.Group();
    cpGroup.position.set(x, baseY, z);
    cpGroup.rotation.y = radY;

    const pad = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      createStudioMaterial(obj.color || '#22c55e', obj.material)
    );
    pad.name = `CheckpointPad_${cpId}`;
    pad.position.set(0, h / 2, 0);

    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.09, 0.09, 3.2, 8),
      new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.8, roughness: 0.2 })
    );
    pole.position.set(w * 0.35, h + 1.6, 0);

    const flag = new THREE.Mesh(
      new THREE.BoxGeometry(1.3, 0.75, 0.08),
      new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0xb91c1c, emissiveIntensity: 0.5 })
    );
    flag.name = 'CheckpointFlag';
    flag.position.set(w * 0.35 + 0.65, h + 2.75, 0);

    cpGroup.add(pad, pole, flag);
    tagStudioObjectRecursive(cpGroup, obj.id);
    worldData.checkpointMeshes[cpId] = cpGroup;
    studioGroup.add(cpGroup);
    worldData.studioObjectMeshes?.set(obj.id, cpGroup);
    return;
  }

  if (obj.kind === 'coin' || obj.kind === 'gem') {
    const mesh = obj.kind === 'coin' ? createCoinMesh() : createGemMesh();
    const scaleFactor = Math.max(0.7, Math.min(2.5, Math.max(w, d) / 1.5));
    mesh.scale.setScalar(scaleFactor);
    mesh.position.set(x, baseY + Math.max(1.0, h * 0.6), z);
    tagStudioObjectRecursive(mesh, obj.id);

    const colId = `studio_${obj.kind}_${obj.id}`;
    worldData.collectibles.push({
      id: colId,
      type: obj.kind,
      position: [x, baseY + Math.max(1.0, h * 0.6), z],
      value: obj.kind === 'gem' ? 100 : 50,
      collected: false,
    });
    worldData.collectibleMeshes.set(colId, mesh);
    worldData.dynamicRotators.push({ group: mesh, speed: 2.2, axis: 'y' });
    studioGroup.add(mesh);
    worldData.studioObjectMeshes?.set(obj.id, mesh);
    return;
  }

  if (obj.kind === 'trophy') {
    const trophy = createGoldenTrophy();
    trophy.position.set(x, baseY, z);
    trophy.rotation.y = radY;
    tagStudioObjectRecursive(trophy, obj.id);
    worldData.trophyMesh = trophy;
    hasTrophyRef.found = true;
    worldData.dynamicRotators.push({ group: trophy, speed: 1.0, axis: 'y' });
    studioGroup.add(trophy);
    worldData.studioObjectMeshes?.set(obj.id, trophy);
    return;
  }

  if (obj.kind === 'spawn') {
    const spawnGroup = new THREE.Group();
    const baseMat = createStudioMaterial(obj.color || '#0ea5e9', 'metal');
    const pad = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), baseMat);
    pad.position.set(x, baseY + h / 2, z);
    pad.rotation.y = radY;
    pad.receiveShadow = true;
    pad.userData = { width: effW, height: effH, depth: effD, surfaceType: 'stone', studioObjectId: obj.id };

    const ring = new THREE.Mesh(
      new THREE.RingGeometry(Math.min(w, d) * 0.2, Math.min(w, d) * 0.34, 24),
      new THREE.MeshBasicMaterial({ color: 0xf8fafc, side: THREE.DoubleSide })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(x, baseY + h + 0.03, z);

    spawnGroup.add(pad, ring);
    tagStudioObjectRecursive(spawnGroup, obj.id);
    worldData.platforms.push(pad);
    studioGroup.add(spawnGroup);
    worldData.studioObjectMeshes?.set(obj.id, spawnGroup);
  }
}

export function rebuildStudioWorldObjects(worldData: WorldBuildResult, project: StudioProject): void {
  if (!worldData.studioGroup) return;

  // Keep baseplate collider, strip previously generated studio object colliders
  worldData.platforms = worldData.platforms.filter((p) => Boolean(p.userData?.isStudioBaseplate));
  worldData.hazards = [];
  worldData.checkpoints = [];
  worldData.checkpointMeshes = [];
  worldData.collectibles = [];
  worldData.collectibleMeshes.clear();
  worldData.dynamicRotators = [];
  worldData.studioObjectMeshes?.clear();
  worldData.studioGroup.clear();

  // Always reserve Checkpoint 0 at the first spawn object (or [0, 0.5, 0])
  const firstSpawn = project.objects.find((o) => o.kind === 'spawn');
  const spawnPos: [number, number, number] = firstSpawn
    ? [firstSpawn.position[0], firstSpawn.position[1] + firstSpawn.size[1], firstSpawn.position[2]]
    : [0, 0.2, 0];
  worldData.checkpoints.push({
    id: 0,
    name: 'Спавн',
    position: spawnPos,
    activated: true,
  });

  // Fallback hidden trophy off-map if user hasn't placed a Trophy finish yet
  const fallbackTrophy = createGoldenTrophy();
  fallbackTrophy.position.set(0, -250, 0);
  fallbackTrophy.visible = false;
  worldData.trophyMesh = fallbackTrophy;

  const checkpointIndexRef = { nextId: 1 };
  const hasTrophyRef = { found: false };

  for (const obj of project.objects) {
    buildSingleStudioObject(worldData, obj, checkpointIndexRef, hasTrophyRef);
  }
}

function createStudioWorld(scene: THREE.Scene, worldRoot: THREE.Group): WorldBuildResult {
  const platforms: THREE.Mesh[] = [];
  const hazards: ObstacleHazard[] = [];
  const checkpoints: Checkpoint[] = [];
  const checkpointMeshes: THREE.Group[] = [];
  const collectibles: CollectibleItem[] = [];
  const collectibleMeshes = new Map<string, THREE.Group>();
  const dynamicRotators: { group: THREE.Group; speed: number; axis: 'y' | 'z' }[] = [];
  const placedBlockMeshes = new Map<string, THREE.Mesh>();

  const studTexture = getStudioStudTexture().clone();
  studTexture.needsUpdate = true;
  studTexture.repeat.set(60, 60);

  const baseplateMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    roughness: 0.78,
    metalness: 0.08,
    map: studTexture,
  });

  const baseplate = new THREE.Mesh(new THREE.BoxGeometry(240, 2, 240), baseplateMat);
  baseplate.position.set(0, -1, 0); // top surface at exactly y = 0
  baseplate.receiveShadow = true;
  baseplate.userData = {
    width: 240,
    height: 2,
    depth: 240,
    surfaceType: 'stone' as SurfaceType,
    isStudioBaseplate: true,
  };
  platforms.push(baseplate);
  worldRoot.add(baseplate);

  // Subtle Studio Grid Overlay (240x240, 120 divisions = 2-stud cells)
  const studioGrid = new THREE.GridHelper(240, 120, 0x38bdf8, 0x475569);
  studioGrid.position.set(0, 0.03, 0);
  const gridMats = Array.isArray(studioGrid.material) ? studioGrid.material : [studioGrid.material];
  gridMats.forEach((m) => {
    m.transparent = true;
    m.opacity = 0.4;
  });
  worldRoot.add(studioGrid);

  const studioGroup = new THREE.Group();
  studioGroup.name = 'StudioObjectsGroup';
  worldRoot.add(studioGroup);

  const trophyMesh = createGoldenTrophy();
  trophyMesh.position.set(0, -250, 0);
  trophyMesh.visible = false;

  const dummyMesh = createPracticeDummy();
  dummyMesh.position.set(0, -250, 0);
  dummyMesh.visible = false;

  const result: WorldBuildResult = {
    scene,
    worldRoot,
    gameId: 'studio',
    platforms,
    hazards,
    checkpoints,
    checkpointMeshes,
    collectibles,
    collectibleMeshes,
    dynamicRotators,
    placedBlockMeshes,
    trophyMesh,
    dummyMesh,
    studioGroup,
    studioBaseplate: baseplate,
    studioGrid,
    studioObjectMeshes: new Map<string, THREE.Object3D>(),
  };

  rebuildStudioWorldObjects(result, loadStudioProject());
  return result;
}


